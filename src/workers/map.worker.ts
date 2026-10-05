/// <reference lib="webworker" />
import type { ChunkUpload, WorkerEvent, WorkerRequest, ZoneResult } from '../core/rpc.ts';
import { IngestError } from '../core/errors.ts';
import { WORLD_LAYOUTS } from '../data/world-layout.ts';
import { HL_BLOCK } from '../render/highlight.ts';
import { detectZone } from './analysis/biomes.ts';
import { findMazeHoles } from './analysis/maze.ts';
import { findClusters } from './analysis/clusters.ts';
import { buildTimeline, timeAt } from './analysis/timeline.ts';
import { exportPng } from './export/export.ts';
import { ingest } from './ingest/ingest.ts';
import { CELLS, MapModel, PART, type Chunk } from './model/map-model.ts';
import { BLOCK_FLAG, INDEX_MASK } from './model/palette.ts';

declare const self: DedicatedWorkerGlobalScope;

let model = new MapModel();
let ingestAbort: AbortController | null = null;
let ingestId = 0;
let mazeMask: Uint8Array | null = null;
const cancelledExports = new Set<number>();
let sentPaletteSize = 0;

function post(ev: WorkerEvent, transfer: Transferable[] = []): void {
  self.postMessage(ev, transfer);
}

function sendPalette(m: MapModel = model): void {
  if (m.palette.size === sentPaletteSize) return;
  sentPaletteSize = m.palette.size;
  const colors = m.palette.colors.slice(0, m.palette.size);
  post({ type: 'palette', colors, size: m.palette.size }, [colors.buffer]);
}

function sendChunks(id: number, chunks: Chunk[], m: MapModel = model): void {
  sendPalette(m);
  const uploads: ChunkUpload[] = chunks.map((c) => ({
    key: c.key,
    cx: c.cx,
    cy: c.cy,
    cells: c.cells.slice(),
  }));
  post(
    { type: 'chunks', id, chunks: uploads },
    uploads.map((u) => u.cells.buffer),
  );
}

async function handleIngest(req: Extract<WorkerRequest, { type: 'ingest' }>): Promise<void> {
  ingestAbort?.abort();
  const ctl = new AbortController();
  ingestAbort = ctl;
  ingestId = req.id;
  const t0 = performance.now();
  // A full load goes into a fresh model so the previous map can be restored if the new file fails.
  const target = req.incremental ? model : new MapModel();
  let streamed = false;
  const stream = (chunks: Chunk[]) => {
    if (!req.incremental && !streamed) {
      streamed = true;
      sentPaletteSize = 0;
      post({ type: 'reset', id: req.id });
    }
    sendChunks(req.id, chunks, target);
  };
  try {
    const res = await ingest(req.file, target, {
      signal: ctl.signal,
      incremental: req.incremental,
      fileName: req.fileName,
      onProgress: (p) => post({ type: 'progress', id: req.id, ...p }),
      onChunks: stream,
    });
    if (ctl.signal.aborted) throw new IngestError('aborted');
    model = target;
    if (res.removed.length) post({ type: 'removed', keys: res.removed });
    // Chunks were streamed before block flags existed: resend those whose flags are now known.
    const resend = new Set([...res.changed, ...res.reflagged]);
    sendChunks(req.id, [...resend].map((k) => model.chunks.get(k)!).filter(Boolean));
    mazeMask = null;
    post({
      type: 'ingested',
      id: req.id,
      summary: {
        partCount: res.partCount,
        chunkCount: model.chunks.size,
        bounds: model.bounds()!,
        changed: res.changed.length,
        removed: res.removed,
        warnings: res.warnings,
        ms: performance.now() - t0,
      },
    });
  } catch (e) {
    if (streamed && target !== model) {
      // Restore the previous map on the main thread.
      sentPaletteSize = 0;
      post({ type: 'reset', id: req.id });
      if (model.chunks.size) sendChunks(req.id, [...model.chunks.values()]);
    }
    const kind = e instanceof IngestError ? e.kind : ctl.signal.aborted ? 'aborted' : null;
    if (kind) {
      const hint = e instanceof IngestError ? e.hint : undefined;
      post({ type: 'error', id: req.id, error: { kind, ...(hint ? { hint } : {}) } });
    } else {
      post({
        type: 'error',
        id: req.id,
        error: { kind: 'internal', message: String((e as Error)?.message ?? e) },
      });
    }
  } finally {
    if (ingestAbort === ctl) ingestAbort = null;
  }
}

function handlePoints(req: Extract<WorkerRequest, { type: 'points' }>): void {
  const lut = req.lut;
  const out: number[] = [];
  let truncated = false;
  outer: for (const c of model.chunks.values()) {
    const cells = c.cells;
    const x0 = c.cx * PART;
    const yTop = c.cy * PART + PART - 1;
    for (let i = 0; i < CELLS; i++) {
      const v = cells[i]!;
      const f = lut[v & INDEX_MASK];
      if (!f) continue;
      if (f & HL_BLOCK && !(v & BLOCK_FLAG)) continue;
      if (out.length >= req.limit * 3) {
        truncated = true;
        break outer;
      }
      out.push(x0 + (i & 255), yTop - (i >> 8), v & INDEX_MASK);
    }
  }
  const points = Float32Array.from(out);
  post({ type: 'points', id: req.id, points, count: points.length / 3, truncated }, [points.buffer]);
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    switch (req.type) {
      case 'ingest':
        await handleIngest(req);
        break;
      case 'cancel':
        if (req.id === ingestId) ingestAbort?.abort();
        cancelledExports.add(req.id);
        break;
      case 'detect': {
        const zones: ZoneResult[] = [];
        for (const z of WORLD_LAYOUTS[req.world].zones) {
          const r = detectZone(model, z);
          if (r) zones.push(r);
        }
        post({ type: 'detected', id: req.id, zones });
        break;
      }
      case 'maze': {
        const res = findMazeHoles(model, req.stoneStartDeg);
        mazeMask = res.mask;
        const mask = res.mask.slice();
        post({ type: 'maze', id: req.id, mask, holes: res.holes }, [mask.buffer]);
        break;
      }
      case 'stats': {
        const stats = model.stats();
        post({ type: 'stats', id: req.id, stats }, [stats.counts.buffer, stats.blockCounts.buffer]);
        break;
      }
      case 'points':
        handlePoints(req);
        break;
      case 'clusters': {
        const res = findClusters(model, req.lut);
        post({ type: 'clusters', id: req.id, ...res }, [res.clusters.buffer]);
        break;
      }
      case 'probe':
        post({
          type: 'probe',
          id: req.id,
          cell: model.cellAt(req.x, req.y),
          time: timeAt(model, req.x, req.y),
        });
        break;
      case 'timeline': {
        const res = await buildTimeline(model);
        const chunks = req.withChunks ? res.chunks : [];
        post(
          { type: 'timeline', id: req.id, info: res.info, chunks },
          chunks.map((c) => c.times.buffer),
        );
        break;
      }
      case 'chunks': {
        const list =
          req.keys === 'all'
            ? [...model.chunks.values()]
            : req.keys.map((k) => model.chunks.get(k)!).filter(Boolean);
        sendChunks(req.id, list);
        break;
      }
      case 'export': {
        const blob = await exportPng(
          model,
          req.opts,
          mazeMask,
          (done, total) => post({ type: 'export-progress', id: req.id, done, total }),
          () => cancelledExports.has(req.id),
        );
        post({ type: 'exported', id: req.id, blob });
        break;
      }
    }
  } catch (err) {
    post({
      type: 'error',
      id: req.id,
      error: { kind: 'internal', message: String((err as Error)?.message ?? err) },
    });
  }
};
