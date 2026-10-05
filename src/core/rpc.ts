import type { SerializedIngestError, IngestWarning } from './errors.ts';
import type { ZoneDef, WorldType } from '../data/schema.ts';
import type { MazeHole } from '../workers/analysis/maze.ts';
import type { TimelineInfo } from '../workers/analysis/timeline.ts';
import type { OverlayLabel, OverlayPrimitive } from '../render/overlay-scene.ts';

export interface ChunkUpload {
  key: number;
  cx: number;
  cy: number;
  /** Palette indices with the 2×2 block flag in bit 15 (image order, row 0 = top). */
  cells: Uint16Array;
}

export interface MapSummary {
  partCount: number;
  chunkCount: number;
  bounds: { minCx: number; minCy: number; maxCx: number; maxCy: number };
  changed: number;
  removed: number[];
  warnings: IngestWarning[];
  ms: number;
}

export interface ZoneResult {
  zone: ZoneDef['id'];
  rotationDeg: number;
  confidence: number;
  evidence: number;
}

export interface StatsResult {
  /** Per palette index. */
  counts: Uint32Array;
  blockCounts: Uint32Array;
  explored: number;
  /** Tight bounds of explored tiles. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
}

export interface ExportOptions {
  scale: 1 | 2 | 4;
  /** Inclusive world tile bounds. */
  region: { minX: number; minY: number; maxX: number; maxY: number };
  background: 'transparent' | 'dark';
  /** Highlight flags per palette index (see render/highlight.ts) and the alpha for other tiles. */
  lut: Uint8Array | null;
  dim: number;
  customColor: number;
  primitives: OverlayPrimitive[];
  labels: OverlayLabel[];
  /** Bit mask of maze classes to draw (1 small, 2 medium, 4 large). */
  mazeClasses: number;
}

export type WorkerRequest =
  | { type: 'ingest'; id: number; file: Blob; fileName: string; incremental: boolean }
  | { type: 'cancel'; id: number }
  | { type: 'detect'; id: number; world: WorldType }
  | { type: 'maze'; id: number; stoneStartDeg: number }
  | { type: 'stats'; id: number }
  | { type: 'points'; id: number; lut: Uint8Array; limit: number }
  | { type: 'clusters'; id: number; lut: Uint8Array }
  | { type: 'timeline'; id: number; withChunks: boolean }
  | { type: 'probe'; id: number; x: number; y: number }
  | { type: 'chunks'; id: number; keys: number[] | 'all' }
  | { type: 'export'; id: number; opts: ExportOptions };

export type WorkerEvent =
  | { type: 'progress'; id: number; phase: 'read' | 'decode'; loaded: number; total: number }
  | { type: 'palette'; colors: Uint32Array; size: number }
  | { type: 'chunks'; id: number; chunks: ChunkUpload[] }
  | { type: 'reset'; id: number }
  | { type: 'removed'; keys: number[] }
  | { type: 'ingested'; id: number; summary: MapSummary }
  | { type: 'error'; id: number; error: SerializedIngestError | { kind: 'internal'; message: string } }
  | { type: 'detected'; id: number; zones: ZoneResult[] }
  | { type: 'maze'; id: number; mask: Uint8Array; holes: MazeHole[] }
  | { type: 'stats'; id: number; stats: StatsResult }
  | {
      type: 'points';
      id: number;
      /** (x, y, paletteIndex) triples */ points: Float32Array;
      count: number;
      truncated: boolean;
    }
  | {
      type: 'probe';
      id: number;
      cell: number;
      /** Unix seconds, 0 if unknown */ time: number;
    }
  | { type: 'timeline'; id: number; info: TimelineInfo | null; chunks: { key: number; times: Uint16Array }[] }
  | {
      type: 'clusters';
      id: number;
      /** CLUSTER_STRIDE ints per cluster: repX, repY, count, minX, minY, maxX, maxY */
      clusters: Int32Array;
      count: number;
      truncated: boolean;
    }
  | { type: 'export-progress'; id: number; done: number; total: number }
  | { type: 'exported'; id: number; blob: Blob };
