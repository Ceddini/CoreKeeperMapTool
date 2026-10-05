import { BLOCK_FLAG, INDEX_MASK, Palette } from './palette.ts';

export const PART = 256;
export const CELLS = PART * PART;

export type ChunkKey = number;

export function chunkKey(cx: number, cy: number): ChunkKey {
  return ((cx + 32768) * 65536 + (cy + 32768)) >>> 0;
}

export function keyToXY(key: ChunkKey): [number, number] {
  return [Math.floor(key / 65536) - 32768, (key % 65536) - 32768];
}

export interface Chunk {
  key: ChunkKey;
  cx: number;
  cy: number;
  hash: number;
  /**
   * Palette index per tile in image order (row 0 = the chunk's top row, i.e. world y = cy*256+255).
   * Bit 15 marks tiles that belong to a 2×2 block of one colour (used for boulders).
   */
  cells: Uint16Array;
}

export interface Bounds {
  minCx: number;
  minCy: number;
  maxCx: number;
  maxCy: number;
}

export class MapModel {
  palette = new Palette();
  readonly chunks = new Map<ChunkKey, Chunk>();
  /** Bumped whenever chunk data changes; used to invalidate analysis caches. */
  version = 0;

  get(cx: number, cy: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cy));
  }

  set(chunk: Chunk): void {
    this.chunks.set(chunk.key, chunk);
    this.version++;
  }

  delete(key: ChunkKey): void {
    if (this.chunks.delete(key)) this.version++;
  }

  clear(): void {
    this.chunks.clear();
    this.version++;
  }

  bounds(): Bounds | null {
    if (this.chunks.size === 0) return null;
    let minCx = Infinity,
      minCy = Infinity,
      maxCx = -Infinity,
      maxCy = -Infinity;
    for (const c of this.chunks.values()) {
      if (c.cx < minCx) minCx = c.cx;
      if (c.cy < minCy) minCy = c.cy;
      if (c.cx > maxCx) maxCx = c.cx;
      if (c.cy > maxCy) maxCy = c.cy;
    }
    return { minCx, minCy, maxCx, maxCy };
  }

  /** Palette index (without flags) of world tile (x, y); 0 = unexplored or missing. */
  indexAt(x: number, y: number): number {
    return this.cellAt(x, y) & INDEX_MASK;
  }

  cellAt(x: number, y: number): number {
    const cx = Math.floor(x / PART);
    const cy = Math.floor(y / PART);
    const c = this.get(cx, cy);
    if (!c) return 0;
    const col = x - cx * PART;
    const row = PART - 1 - (y - cy * PART);
    return c.cells[row * PART + col]!;
  }

  /**
   * Recompute the 2×2 block flag for the given chunks. A tile is flagged when it is part of any
   * 2×2 square of identical explored tiles, also across chunk borders.
   */
  computeBlockFlags(keys: Iterable<ChunkKey>): void {
    for (const key of keys) {
      const c = this.chunks.get(key);
      if (c) this.flagChunk(c);
    }
  }

  /** Chunks whose flags depend on `key` (itself and its 8 neighbours). */
  neighbourhood(keys: Iterable<ChunkKey>): Set<ChunkKey> {
    const out = new Set<ChunkKey>();
    for (const key of keys) {
      const [cx, cy] = keyToXY(key);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.add(chunkKey(cx + dx, cy + dy));
    }
    return out;
  }

  private flagChunk(c: Chunk): void {
    const cells = c.cells;
    // Clear flags.
    for (let i = 0; i < CELLS; i++) cells[i] = cells[i]! & INDEX_MASK;

    // Index lookup in image coordinates relative to this chunk, crossing into neighbours.
    // Image row r grows downwards; row 256 is row 0 of the chunk below (cy - 1).
    const n = {
      up: this.get(c.cx, c.cy + 1),
      down: this.get(c.cx, c.cy - 1),
      left: this.get(c.cx - 1, c.cy),
      right: this.get(c.cx + 1, c.cy),
      ul: this.get(c.cx - 1, c.cy + 1),
      ur: this.get(c.cx + 1, c.cy + 1),
      dl: this.get(c.cx - 1, c.cy - 1),
      dr: this.get(c.cx + 1, c.cy - 1),
    };
    const at = (r: number, col: number): number => {
      let ch: Chunk | undefined = c;
      if (r < 0) {
        r += PART;
        ch = col < 0 ? n.ul : col >= PART ? n.ur : n.up;
      } else if (r >= PART) {
        r -= PART;
        ch = col < 0 ? n.dl : col >= PART ? n.dr : n.down;
      } else if (col < 0) ch = n.left;
      else if (col >= PART) ch = n.right;
      if (!ch) return 0;
      if (col < 0) col += PART;
      else if (col >= PART) col -= PART;
      return ch.cells[r * PART + col]! & INDEX_MASK;
    };

    // Square with top-left (r, col) is uniform → flag its cells that lie in this chunk.
    const flag = (r: number, col: number) => {
      if (r >= 0 && r < PART && col >= 0 && col < PART) cells[r * PART + col]! |= BLOCK_FLAG;
    };
    const testSquare = (r: number, col: number, v: number, right: number, down: number, dr: number) => {
      if (v !== 0 && v === right && v === down && v === dr) {
        flag(r, col);
        flag(r, col + 1);
        flag(r + 1, col);
        flag(r + 1, col + 1);
      }
    };

    // Interior squares (fast path).
    for (let r = 0; r < PART - 1; r++) {
      const row = r * PART;
      for (let col = 0; col < PART - 1; col++) {
        const v = cells[row + col]! & INDEX_MASK;
        if (v === 0) continue;
        if (
          v === (cells[row + col + 1]! & INDEX_MASK) &&
          v === (cells[row + PART + col]! & INDEX_MASK) &&
          v === (cells[row + PART + col + 1]! & INDEX_MASK)
        ) {
          cells[row + col]! |= BLOCK_FLAG;
          cells[row + col + 1]! |= BLOCK_FLAG;
          cells[row + PART + col]! |= BLOCK_FLAG;
          cells[row + PART + col + 1]! |= BLOCK_FLAG;
        }
      }
    }
    // Border squares: top-left at r = -1 or 255, or col = -1 or 255.
    for (let i = -1; i < PART; i++) {
      for (const [r, col] of [
        [-1, i],
        [PART - 1, i],
        [i, -1],
        [i, PART - 1],
      ] as const) {
        testSquare(r, col, at(r, col), at(r, col + 1), at(r + 1, col), at(r + 1, col + 1));
      }
    }
  }

  /** Per palette index: tile count, and count of tiles that are part of a 2×2 block. */
  stats(): {
    counts: Uint32Array;
    blockCounts: Uint32Array;
    explored: number;
    bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  } {
    const counts = new Uint32Array(this.palette.size);
    const blockCounts = new Uint32Array(this.palette.size);
    let explored = 0;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const c of this.chunks.values()) {
      const cells = c.cells;
      let rowMin = PART,
        rowMax = -1,
        colMin = PART,
        colMax = -1;
      for (let i = 0; i < CELLS; i++) {
        const v = cells[i]!;
        const idx = v & INDEX_MASK;
        if (idx === 0) continue;
        explored++;
        counts[idx]!++;
        if (v & BLOCK_FLAG) blockCounts[idx]!++;
        const row = i >> 8;
        const col = i & 255;
        if (row < rowMin) rowMin = row;
        if (row > rowMax) rowMax = row;
        if (col < colMin) colMin = col;
        if (col > colMax) colMax = col;
      }
      if (rowMax < 0) continue;
      const x0 = c.cx * PART;
      const yTop = c.cy * PART + PART - 1;
      minX = Math.min(minX, x0 + colMin);
      maxX = Math.max(maxX, x0 + colMax);
      minY = Math.min(minY, yTop - rowMax);
      maxY = Math.max(maxY, yTop - rowMin);
    }
    return { counts, blockCounts, explored, bounds: explored ? { minX, minY, maxX, maxY } : null };
  }
}
