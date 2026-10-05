import type { ExportOptions } from '../../core/rpc.ts';
import { paintLabels, paintOverlay } from '../../render/canvas2d-painter.ts';
import { HL_BLOCK, HL_CUSTOM, lutIsActive } from '../../render/highlight.ts';
import { MAX_EXPORT_PIXELS, MAZE_WINDOW, MAZE_WINDOW_RADIUS } from '../../core/constants.ts';
import type { MapModel } from '../model/map-model.ts';
import { BLOCK_FLAG, INDEX_MASK } from '../model/palette.ts';
import { PngEncoder } from './png-encoder.ts';

const STRIP_TILES = 64;
const BG_DARK = [11, 13, 16];
const MAZE_COLORS: [number, number, number][] = [
  [0, 0, 0],
  [255, 0, 255],
  [0, 255, 255],
  [0, 255, 0],
];

/** Renders the map (with highlights, maze holes and overlays) to a PNG in horizontal strips. */
export async function exportPng(
  model: MapModel,
  opts: ExportOptions,
  maze: Uint8Array | null,
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<Blob> {
  const { scale: s, region } = opts;
  const tilesW = region.maxX - region.minX + 1;
  const tilesH = region.maxY - region.minY + 1;
  const width = tilesW * s;
  const height = tilesH * s;
  if (width * height > MAX_EXPORT_PIXELS) throw new Error('too-large');

  const palette = model.palette.colors;
  const highlight = lutIsActive(opts.lut);
  const lut = opts.lut;
  const dimA = Math.round(opts.dim * 255);
  const dark = opts.background === 'dark';
  const canPaint = typeof OffscreenCanvas === 'function';
  const paintsOverlay = canPaint && (opts.primitives.length > 0 || opts.labels.length > 0);
  const enc = new PngEncoder(width, height);
  const R = MAZE_WINDOW_RADIUS;

  for (let ty = 0; ty < tilesH; ty += STRIP_TILES) {
    if (isCancelled()) throw new Error('cancelled');
    const rowsT = Math.min(STRIP_TILES, tilesH - ty);
    const px = new Uint8ClampedArray(width * rowsT * s * 4);
    for (let ry = 0; ry < rowsT; ry++) {
      const y = region.maxY - ty - ry;
      for (let tx = 0; tx < tilesW; tx++) {
        const x = region.minX + tx;
        const cell = model.cellAt(x, y);
        const idx = cell & INDEX_MASK;
        let r = 0,
          g = 0,
          b = 0,
          a = 0;
        if (idx) {
          const rgb = palette[idx]!;
          r = rgb >> 16;
          g = (rgb >> 8) & 255;
          b = rgb & 255;
          a = 255;
          if (highlight) {
            const f = lut![idx] ?? 0;
            const on = f !== 0 && (!(f & HL_BLOCK) || (cell & BLOCK_FLAG) !== 0);
            if (!on) a = dimA;
            else if (f & HL_CUSTOM) {
              r = opts.customColor >> 16;
              g = (opts.customColor >> 8) & 255;
              b = opts.customColor & 255;
            }
          }
        }
        if (maze && opts.mazeClasses && Math.abs(x) <= R && Math.abs(y) <= R) {
          const cls = maze[(R - y) * MAZE_WINDOW + (x + R)]!;
          if (cls && opts.mazeClasses & (1 << (cls - 1))) {
            [r, g, b] = MAZE_COLORS[cls]!;
            a = 255;
          }
        }
        if (dark) {
          r = (r * a + BG_DARK[0]! * (255 - a)) / 255;
          g = (g * a + BG_DARK[1]! * (255 - a)) / 255;
          b = (b * a + BG_DARK[2]! * (255 - a)) / 255;
          a = 255;
        }
        for (let sy = 0; sy < s; sy++) {
          let o = ((ry * s + sy) * width + tx * s) * 4;
          for (let sx = 0; sx < s; sx++, o += 4) {
            px[o] = r;
            px[o + 1] = g;
            px[o + 2] = b;
            px[o + 3] = a;
          }
        }
      }
    }
    let rows: Uint8Array = new Uint8Array(px.buffer);
    if (paintsOverlay) {
      const canvas = new OffscreenCanvas(width, rowsT * s);
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(new ImageData(px, width, rowsT * s), 0, 0);
      const view = { x0: region.minX, y0: region.maxY + 1 - ty, scale: s, width, height: rowsT * s };
      paintOverlay(ctx, view, opts.primitives);
      paintLabels(ctx, view, opts.labels, Math.max(14, 6 * s));
      rows = new Uint8Array(ctx.getImageData(0, 0, width, rowsT * s).data.buffer);
    }
    await enc.writeRows(rows, rowsT * s);
    onProgress(ty + rowsT, tilesH);
  }
  return enc.finish();
}
