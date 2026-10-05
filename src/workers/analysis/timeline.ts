import { decodePng } from '../ingest/png.ts';
import { CELLS, type Chunk, type MapModel } from '../model/map-model.ts';

/**
 * Exploration times. Each map part carries a second PNG whose RGBA bytes are a big-endian 32-bit
 * number per tile: the Unix time (seconds since 1970) divided by 4 when the tile was first revealed,
 * 0 = never. Calibrated against real saves: the last explored tile lands minutes before the map file
 * was written. Everything below works in Unix seconds (raw value × 4).
 */
export const RAW_TIME_STEP_S = 4;

export function exploreTimeToDate(seconds: number): Date {
  return new Date(seconds * 1000);
}

export interface Session {
  /** Unix seconds. */
  start: number;
  end: number;
  tiles: number;
}

export interface TimelineInfo {
  min: number;
  max: number;
  /** Seconds per step in the 16-bit per-tile values sent to the renderer (value = 1 + (t-min)/unit). */
  unit: number;
  /** Tiles explored per bin, 120 bins from min to max (for the slider's sparkline). */
  histogram: Uint32Array;
  /** Play sessions: runs of exploration separated by gaps of 20+ minutes. */
  sessions: Session[];
  tiles: number;
}

const SESSION_GAP_S = 20 * 60;
const HIST_BINS = 120;

/**
 * Exact times of one chunk, kept compact: tile i was explored at `base + (steps[i] - 1) * 4` seconds
 * (steps 0 = unknown). A chunk is usually explored within a few days, so 16-bit steps fit; chunks
 * whose times span longer fall back to 32 bits.
 */
interface ChunkTimes {
  base: number;
  steps: Uint16Array | Uint32Array;
}

/** Cached per chunk object (a changed part is a new chunk object). */
const cache = new WeakMap<Chunk, ChunkTimes | null>();

async function decodeTimes(c: Chunk): Promise<ChunkTimes | null> {
  if (cache.has(c)) return cache.get(c)!;
  let out: ChunkTimes | null = null;
  if (c.ts) {
    try {
      const { width, height, rgba } = await decodePng(c.ts);
      if (width === 256 && height === 256) {
        const raw = new Uint32Array(CELLS);
        let lo = Infinity;
        let hi = 0;
        for (let i = 0, p = 0; i < CELLS; i++, p += 4) {
          const v = ((rgba[p]! << 24) | (rgba[p + 1]! << 16) | (rgba[p + 2]! << 8) | rgba[p + 3]!) >>> 0;
          raw[i] = v;
          if (!v) continue;
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        if (hi) {
          const steps = hi - lo < 0xffff ? new Uint16Array(CELLS) : raw;
          for (let i = 0; i < CELLS; i++) {
            const v = raw[i]!;
            steps[i] = v ? v - lo + 1 : 0;
          }
          out = { base: lo * RAW_TIME_STEP_S, steps };
        }
      }
    } catch {
      out = null;
    }
  }
  cache.set(c, out);
  return out;
}

/** Seconds since the epoch when tile (x, y) was explored, if known. */
export function timeAt(model: MapModel, x: number, y: number): number {
  const cx = Math.floor(x / 256);
  const cy = Math.floor(y / 256);
  const c = model.get(cx, cy);
  const t = c ? cache.get(c) : null;
  if (!c || !t) return 0;
  const row = 255 - (y - cy * 256);
  const s = t.steps[row * 256 + (x - cx * 256)]!;
  return s ? t.base + (s - 1) * RAW_TIME_STEP_S : 0;
}

/** Memory held by the decoded times of the current chunks (for tests). */
export function timeCacheBytes(model: MapModel): number {
  let n = 0;
  for (const c of model.chunks.values()) n += cache.get(c)?.steps.byteLength ?? 0;
  return n;
}

export interface TimelineResult {
  info: TimelineInfo | null;
  /** Per chunk: 16-bit relative times (0 = unknown), for the renderer. */
  chunks: { key: number; times: Uint16Array }[];
}

export async function buildTimeline(model: MapModel): Promise<TimelineResult> {
  const chunks = [...model.chunks.values()];
  const decoded = await Promise.all(chunks.map(decodeTimes));

  // Only tiles that are actually explored count (revealed maps can carry times elsewhere).
  let min = Infinity;
  let max = -Infinity;
  let tiles = 0;
  decoded.forEach((t, ci) => {
    if (!t) return;
    const cells = chunks[ci]!.cells;
    const { base, steps: st } = t;
    for (let i = 0; i < CELLS; i++) {
      const s = st[i]!;
      if (!s || !(cells[i]! & 0x7fff)) continue;
      const v = base + (s - 1) * RAW_TIME_STEP_S;
      tiles++;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  });
  if (!tiles) return { info: null, chunks: [] };

  const span = max - min;
  const unit = Math.max(RAW_TIME_STEP_S, Math.ceil((span + 1) / 65534));
  const histogram = new Uint32Array(HIST_BINS);
  // Counts per 16-bit step, for session detection.
  const steps = new Uint32Array(Math.floor(span / unit) + 2);
  const out: { key: number; times: Uint16Array }[] = [];
  decoded.forEach((t, ci) => {
    const chunk = chunks[ci]!;
    const times = new Uint16Array(CELLS);
    if (t) {
      const cells = chunk.cells;
      const { base, steps: st } = t;
      for (let i = 0; i < CELLS; i++) {
        const s0 = st[i]!;
        if (!s0 || !(cells[i]! & 0x7fff)) continue;
        const v = base + (s0 - 1) * RAW_TIME_STEP_S;
        const s = Math.floor((v - min) / unit);
        times[i] = s + 1;
        steps[s]!++;
        histogram[Math.min(HIST_BINS - 1, Math.floor(((v - min) / Math.max(1, span)) * HIST_BINS))]!++;
      }
    }
    out.push({ key: chunk.key, times });
  });

  const sessions: Session[] = [];
  const gap = Math.max(1, Math.ceil(SESSION_GAP_S / unit));
  let cur: Session | null = null;
  let lastStep = -Infinity;
  for (let s = 0; s < steps.length; s++) {
    const n = steps[s]!;
    if (!n) continue;
    const t = min + s * unit;
    if (!cur || s - lastStep > gap) {
      cur = { start: t, end: t, tiles: 0 };
      sessions.push(cur);
    }
    cur.end = t + unit - 1;
    cur.tiles += n;
    lastStep = s;
  }

  return { info: { min, max, unit, histogram, sessions, tiles }, chunks: out };
}
