import type { ChunkUpload } from '../../core/rpc.ts';
import { paintOverlay } from '../canvas2d-painter.ts';
import { HL_BLOCK, HL_CUSTOM } from '../highlight.ts';
import type { RenderState, Renderer } from '../renderer.ts';

const PART = 256;
const MAZE_COLORS = [0, 0xffff00ff, 0xffffff00, 0xff33ff1a]; // ABGR: magenta, cyan, green

interface Tile {
  cx: number;
  cy: number;
  cells: Uint16Array;
  canvas: HTMLCanvasElement;
  dirty: boolean;
}

/**
 * Fallback renderer for browsers without WebGL 2. Chunks are composited on the CPU into small
 * canvases (re-done when the palette or highlight changes) and drawn with drawImage.
 */
export class C2dRenderer implements Renderer {
  readonly kind = 'canvas2d' as const;
  readonly isLost = false;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tiles = new Map<number, Tile>();
  private palette: Uint32Array = new Uint32Array(1);
  private paletteSize = 1;
  private lut: Uint8Array = new Uint8Array(1);
  private maze: HTMLCanvasElement | null = null;
  private mazeData: { mask: Uint8Array; size: number } | null = null;
  private mazeClasses = -1;
  private points: Float32Array | null = null;
  private lastDim = -1;
  private lastCustom = '';
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true })!;
  }

  get chunkCount(): number {
    return this.tiles.size;
  }

  clearChunks(): void {
    this.tiles.clear();
  }

  upsertChunks(chunks: readonly ChunkUpload[]): void {
    for (const c of chunks) {
      const existing = this.tiles.get(c.key);
      if (existing) {
        existing.cells = c.cells;
        existing.dirty = true;
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = PART;
        canvas.height = PART;
        this.tiles.set(c.key, { cx: c.cx, cy: c.cy, cells: c.cells, canvas, dirty: true });
      }
    }
  }

  removeChunks(keys: readonly number[]): void {
    for (const k of keys) this.tiles.delete(k);
  }

  private invalidateAll(): void {
    for (const t of this.tiles.values()) t.dirty = true;
  }

  setPalette(colors: Uint32Array, size: number): void {
    this.palette = colors;
    this.paletteSize = size;
    this.invalidateAll();
  }

  setHighlightLut(lut: Uint8Array): void {
    this.lut = lut;
    this.invalidateAll();
  }

  setMazeMask(mask: Uint8Array | null, size: number): void {
    this.mazeData = mask ? { mask, size } : null;
    this.mazeClasses = -1;
  }

  setPoints(points: Float32Array | null): void {
    this.points = points;
  }

  private composite(t: Tile, active: boolean, dim: number, custom: [number, number, number]): void {
    const img = new ImageData(PART, PART);
    const out = new Uint32Array(img.data.buffer);
    const pal = this.palette;
    const dimA = Math.round(dim * 255);
    const customAbgr =
      (255 << 24) |
      (Math.round(custom[2] * 255) << 16) |
      (Math.round(custom[1] * 255) << 8) |
      Math.round(custom[0] * 255);
    for (let i = 0; i < out.length; i++) {
      const v = t.cells[i]!;
      const idx = v & 0x7fff;
      if (!idx || idx >= this.paletteSize) continue;
      const rgb = pal[idx]!;
      let a = 255;
      let color = ((rgb & 255) << 16) | (rgb & 0xff00) | ((rgb >> 16) & 255);
      if (active) {
        const f = this.lut[idx] ?? 0;
        const on = f !== 0 && (!(f & HL_BLOCK) || (v & 0x8000) !== 0);
        if (!on) a = dimA;
        else if (f & HL_CUSTOM) color = customAbgr & 0xffffff;
      }
      out[i] = ((a << 24) | color) >>> 0;
    }
    t.canvas.getContext('2d')!.putImageData(img, 0, 0);
    t.dirty = false;
  }

  private mazeCanvas(classes: number): HTMLCanvasElement | null {
    if (!this.mazeData || !classes) return null;
    if (this.maze && this.mazeClasses === classes) return this.maze;
    const { mask, size } = this.mazeData;
    const c = this.maze ?? document.createElement('canvas');
    c.width = size;
    c.height = size;
    const img = new ImageData(size, size);
    const out = new Uint32Array(img.data.buffer);
    for (let i = 0; i < mask.length; i++) {
      const cls = mask[i]!;
      if (cls && classes & (1 << (cls - 1))) out[i] = (MAZE_COLORS[cls]! & 0x00ffffff) | (217 << 24);
    }
    c.getContext('2d')!.putImageData(img, 0, 0);
    this.maze = c;
    this.mazeClasses = classes;
    return c;
  }

  render(s: RenderState): void {
    const ctx = this.ctx;
    const W = Math.max(1, Math.round(s.width * s.dpr));
    const H = Math.max(1, Math.round(s.height * s.dpr));
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W;
      this.canvas.height = H;
    }
    // Re-composite everything when the dim level or paint colour changes.
    const customKey = s.customColor.join(',');
    if (s.dim !== this.lastDim || customKey !== this.lastCustom) {
      this.lastDim = s.dim;
      this.lastCustom = customKey;
      this.invalidateAll();
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    const z = s.camera.zoom;
    const x0 = s.camera.x - s.width / 2 / z;
    const y0 = s.camera.y + s.height / 2 / z;
    const toX = (wx: number) => (wx - x0) * z;
    const toY = (wy: number) => (y0 - wy) * z;
    ctx.imageSmoothingEnabled = z * s.dpr < 1;

    const minCx = Math.floor(x0 / PART);
    const maxCx = Math.floor((x0 + s.width / z) / PART);
    const minCy = Math.floor((y0 - s.height / z) / PART);
    const maxCy = Math.floor(y0 / PART);
    for (const t of this.tiles.values()) {
      if (t.cx < minCx || t.cx > maxCx || t.cy < minCy || t.cy > maxCy) continue;
      if (t.dirty) this.composite(t, s.highlightActive, s.dim, s.customColor);
      ctx.drawImage(t.canvas, toX(t.cx * PART), toY(t.cy * PART + PART), PART * z, PART * z);
    }

    if (s.points && this.points) {
      const p = this.points;
      const size = Math.max(z + 2 / s.dpr, 4 / s.dpr);
      ctx.fillStyle = s.pointOverride
        ? `rgb(${s.pointOverride.map((c) => Math.round(c * 255)).join(',')})`
        : '#ff4d4d';
      const max = Math.min(p.length, 50_000 * 3);
      for (let i = 0; i < max; i += 3)
        ctx.fillRect(toX(p[i]! + 0.5) - size / 2, toY(p[i + 1]! + 0.5) - size / 2, size, size);
    }

    const maze = this.mazeCanvas(s.mazeClasses);
    if (maze && this.mazeData) {
      const R = (this.mazeData.size - 1) / 2;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(maze, toX(-R), toY(R + 1), this.mazeData.size * z, this.mazeData.size * z);
    }

    paintOverlay(ctx, { x0, y0, scale: z, width: s.width, height: s.height }, s.primitives);

    // Core marker.
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.beginPath();
    ctx.arc(toX(0), toY(0), 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffbf40';
    ctx.beginPath();
    ctx.arc(toX(0), toY(0), 5, 0, Math.PI * 2);
    ctx.fill();

    if (s.hover && z * s.dpr >= 6) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(toX(s.hover[0]), toY(s.hover[1] + 1), z, z);
    }
  }

  dispose(): void {
    this.tiles.clear();
  }
}
