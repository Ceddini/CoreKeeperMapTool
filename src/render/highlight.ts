import type { TileDef } from '../data/schema.ts';
import { hexToInt } from '../data/tiles.ts';

/** Highlight LUT flags per palette index. */
export const HL_ANY = 1;
/** Only highlight tiles that are part of a 2×2 block (boulders). */
export const HL_BLOCK = 2;
/** Draw in the custom highlight colour instead of the tile colour. */
export const HL_CUSTOM = 4;

/**
 * Builds the per-palette-index highlight table from the selected tiles.
 * Tiles sharing a colour combine: selecting both the ore and its boulder highlights any tile.
 */
export function buildHighlightLut(
  paletteColors: Uint32Array,
  paletteSize: number,
  selected: readonly TileDef[],
  customRgb: number | null,
): Uint8Array {
  const lut = new Uint8Array(Math.max(paletteSize, 1));
  const want = new Map<number, number>();
  for (const t of selected) {
    const rgb = hexToInt(t.rgb);
    const flag = t.shape === 'block2x2' ? HL_BLOCK : HL_ANY;
    want.set(rgb, (want.get(rgb) ?? 0) | flag);
  }
  for (let i = 1; i < paletteSize; i++) {
    const rgb = paletteColors[i]!;
    let f = want.get(rgb) ?? 0;
    if (f & HL_ANY) f &= ~HL_BLOCK;
    if (customRgb !== null && rgb === customRgb) f = HL_ANY | HL_CUSTOM;
    lut[i] = f;
  }
  return lut;
}

export function lutIsActive(lut: Uint8Array | null): boolean {
  if (!lut) return false;
  for (let i = 1; i < lut.length; i++) if (lut[i]) return true;
  return false;
}
