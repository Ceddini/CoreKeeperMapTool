/**
 * Append-only colour palette. Index 0 is reserved for "unexplored" (alpha 0).
 * Indices fit in 15 bits so chunk cells can carry a flag in bit 15.
 */
export const MAX_PALETTE = 0x7fff;
export const INDEX_MASK = 0x7fff;
export const BLOCK_FLAG = 0x8000;

export class Palette {
  /** 24-bit RGB per index (index 0 unused). */
  readonly colors: Uint32Array = new Uint32Array(MAX_PALETTE + 1);
  size = 1;
  private keys = new Int32Array(1 << 16).fill(-1);
  private vals = new Uint16Array(1 << 16);
  private mask = (1 << 16) - 1;

  lookup(rgb: number): number {
    let h = Math.imul(rgb, 0x9e3779b1) >>> 16;
    for (;;) {
      h &= this.mask;
      const k = this.keys[h]!;
      if (k === rgb) return this.vals[h]!;
      if (k === -1) return this.insert(h, rgb);
      h++;
    }
  }

  private insert(slot: number, rgb: number): number {
    if (this.size > MAX_PALETTE) throw new RangeError('too-many-colors');
    const idx = this.size++;
    this.keys[slot] = rgb;
    this.vals[slot] = idx;
    this.colors[idx] = rgb;
    return idx;
  }

  /** Index RGBA pixels (row 0 = top) into palette indices. */
  indexPixels(rgba: Uint8Array, out: Uint16Array): void {
    let lastRgb = -1;
    let lastIdx = 0;
    for (let i = 0, p = 0; p < out.length; i += 4, p++) {
      if (rgba[i + 3]! < 128) {
        out[p] = 0;
        continue;
      }
      const rgb = (rgba[i]! << 16) | (rgba[i + 1]! << 8) | rgba[i + 2]!;
      if (rgb !== lastRgb) {
        lastRgb = rgb;
        lastIdx = this.lookup(rgb);
      }
      out[p] = lastIdx;
    }
  }
}
