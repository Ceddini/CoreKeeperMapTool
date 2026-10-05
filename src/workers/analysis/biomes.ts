import type { TileSelector, ZoneDef } from '../../data/schema.ts';
import { TILES, hexToInt } from '../../data/tiles.ts';
import { INDEX_MASK } from '../model/palette.ts';
import { PART, type MapModel } from '../model/map-model.ts';

export const BINS = 1440;
const BIN_DEG = 360 / BINS;

export interface ZoneDetection {
  zone: ZoneDef['id'];
  /** Rotation in compass degrees (0 = north, clockwise). Sector i covers [rot+offset, rot+offset+span). */
  rotationDeg: number;
  /** Share of evidence tiles that fall inside their expected sector (0–1). */
  confidence: number;
  evidence: number;
}

function selectorMatches(sel: TileSelector, rgb: number): boolean {
  if (sel.rgb?.some((h) => hexToInt(h) === rgb)) return true;
  for (const t of TILES) {
    if (hexToInt(t.rgb) !== rgb) continue;
    if (sel.ids?.some((id) => t.id === id || t.id.startsWith(id + ':'))) return true;
    if (t.tileset && sel.tilesets?.includes(t.tileset)) return true;
  }
  return false;
}

/** For each palette index: which sector of the zone it is evidence for (-1 = none). */
function evidenceTable(model: MapModel, zone: ZoneDef): Int8Array {
  const table = new Int8Array(model.palette.size).fill(-1);
  for (let idx = 1; idx < model.palette.size; idx++) {
    const rgb = model.palette.colors[idx]!;
    zone.sectors.forEach((s, si) => {
      if (table[idx] === -1 && s.evidence && selectorMatches(s.evidence, rgb)) table[idx] = si;
    });
  }
  return table;
}

/** Compass angle bin (0 = north, clockwise) for a world offset from the Core. */
function binOf(dx: number, dy: number): number {
  let deg = (Math.atan2(dx, dy) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  const b = Math.floor(deg / BIN_DEG);
  return b >= BINS ? 0 : b;
}

/**
 * Finds the rotation of a zone's sectors that best explains the explored tiles: every evidence
 * tile votes for its biome at its angle, and the rotation maximising the number of tiles inside
 * their own biome's sector wins. O(tiles in annulus + BINS × sectors).
 */
export function detectZone(model: MapModel, zone: ZoneDef): ZoneDetection | null {
  if (zone.sectors.length < 2) return null;
  const table = evidenceTable(model, zone);
  const counts = zone.sectors.map(() => new Float64Array(BINS));
  const r0sq = zone.rMin * zone.rMin;
  const r1sq = zone.rMax * zone.rMax;
  let evidence = 0;
  // Large zones: sampling every other tile in both axes is plenty for an angular histogram.
  const step = zone.rMax > 600 ? 2 : 1;

  const cmin = Math.floor(-zone.rMax / PART);
  const cmax = Math.floor(zone.rMax / PART);
  for (let cy = cmin; cy <= cmax; cy++) {
    for (let cx = cmin; cx <= cmax; cx++) {
      const chunk = model.get(cx, cy);
      if (!chunk) continue;
      const cells = chunk.cells;
      const x0 = cx * PART;
      const yTop = cy * PART + PART - 1;
      for (let row = 0; row < PART; row += step) {
        // Tile centre offsets from the Core.
        const dy = yTop - row + 0.5;
        const dy2 = dy * dy;
        if (dy2 > r1sq) continue;
        const base = row * PART;
        for (let col = 0; col < PART; col += step) {
          const idx = cells[base + col]! & INDEX_MASK;
          if (idx === 0) continue;
          const s = table[idx]!;
          if (s < 0) continue;
          const dx = x0 + col + 0.5;
          const d2 = dx * dx + dy2;
          if (d2 < r0sq || d2 >= r1sq) continue;
          counts[s]![binOf(dx, dy)]!++;
          evidence++;
        }
      }
    }
  }
  if (evidence === 0) return { zone: zone.id, rotationDeg: 0, confidence: 0, evidence: 0 };

  // Circular prefix sums over a doubled array: P[i] = sum of bins [0, i).
  const prefix = counts.map((c) => {
    const p = new Float64Array(2 * BINS + 1);
    for (let i = 0; i < 2 * BINS; i++) p[i + 1] = p[i]! + c[i % BINS]!;
    return p;
  });

  let best = -1;
  let bestBin = 0;
  for (let rot = 0; rot < BINS; rot++) {
    let score = 0;
    zone.sectors.forEach((s, si) => {
      const start = (rot + Math.round(s.offsetDeg / BIN_DEG)) % BINS;
      const len = Math.round(s.spanDeg / BIN_DEG);
      const p = prefix[si]!;
      score += p[start + len]! - p[start]!;
    });
    if (score > best) {
      best = score;
      bestBin = rot;
    }
  }
  return { zone: zone.id, rotationDeg: bestBin * BIN_DEG, confidence: best / evidence, evidence };
}
