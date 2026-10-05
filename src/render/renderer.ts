import type { ChunkUpload } from '../core/rpc.ts';
import type { Camera } from './camera.ts';
import type { OverlayPrimitive } from './overlay-scene.ts';

export interface RenderState {
  camera: Camera;
  /** CSS size of the canvas and device pixel ratio. */
  width: number;
  height: number;
  dpr: number;
  highlightActive: boolean;
  dim: number;
  customColor: [number, number, number];
  primitives: readonly OverlayPrimitive[];
  mazeClasses: number;
  hover: [number, number] | null;
  /** Show the highlight point layer (zoomed out with an active highlight). */
  points: boolean;
  pointOverride: [number, number, number] | null;
  /** Exploration history: 0 off, 1 replay (hide tiles explored after the cut), 2 highlight newer. */
  timeMode: 0 | 1 | 2;
  /** 16-bit time step (see TimelineInfo.unit) used as the cut. */
  timeCut: number;
}

/** Implemented by the WebGL2 renderer and the Canvas 2D fallback. */
export interface Renderer {
  readonly kind: 'webgl2' | 'canvas2d';
  readonly isLost: boolean;
  readonly chunkCount: number;
  clearChunks(): void;
  upsertChunks(chunks: readonly ChunkUpload[]): void;
  removeChunks(keys: readonly number[]): void;
  setPalette(colors: Uint32Array, size: number): void;
  setHighlightLut(lut: Uint8Array): void;
  setMazeMask(mask: Uint8Array | null, size: number): void;
  setPoints(points: Float32Array | null): void;
  /** Per-chunk 16-bit exploration times (null clears them). */
  setTimes(chunks: readonly { key: number; times: Uint16Array }[] | null): void;
  render(s: RenderState): void;
  dispose(): void;
}
