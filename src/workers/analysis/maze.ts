import { MAZES, MAZE_EXTENT_RADII, MAZE_SEED_RADII, type MazeSize } from '../../data/world-layout.ts';
import type { MapModel } from '../model/map-model.ts';

import { MAZE_WINDOW, MAZE_WINDOW_RADIUS } from '../../core/constants.ts';

/** The analysed window spans [-R, R] in both axes around the Core. */
export { MAZE_WINDOW, MAZE_WINDOW_RADIUS };

export interface MazeHole {
  /** Largest maze that fits (1 = small, 2 = medium, 3 = large). */
  size: MazeSize;
  /** World tile bounds of the unexplored region. */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
  /** Centre of a rectangle that fits the maze: a good "go to" target. */
  fitX: number;
  fitY: number;
}

export interface MazeResult {
  /**
   * Class per window cell (row 0 = top = world y +R): 0 none, 1 small, 2 medium, 3 large.
   * Cell (col, row) is world tile (col - R, R - row).
   */
  mask: Uint8Array;
  holes: MazeHole[];
}

/** Is the compass angle of (dx, dy) inside the sector [start, start + span)? */
function inSector(dx: number, dy: number, startDeg: number, spanDeg: number): boolean {
  let deg = (Math.atan2(dx, dy) * 180) / Math.PI - startDeg;
  deg = ((deg % 360) + 360) % 360;
  return deg < spanDeg;
}

/**
 * Finds unexplored regions in the Stone sector big enough to hold one of the mazes.
 * Exact: a rectangle fits iff the summed-area table over the region mask equals its area.
 */
export function findMazeHoles(model: MapModel, stoneStartDeg: number, stoneSpanDeg = 180): MazeResult {
  const R = MAZE_WINDOW_RADIUS;
  const W = MAZE_WINDOW;
  const rMin2 = MAZE_EXTENT_RADII.min ** 2;
  const rMax2 = MAZE_EXTENT_RADII.max ** 2;

  // 1. Candidate cells: unexplored, inside the radius band and the stone sector.
  const cand = new Uint8Array(W * W);
  for (let row = 0; row < W; row++) {
    const y = R - row;
    const dy = y + 0.5;
    for (let col = 0; col < W; col++) {
      const x = col - R;
      const dx = x + 0.5;
      const d2 = dx * dx + dy * dy;
      if (d2 < rMin2 || d2 > rMax2) continue;
      if (model.indexAt(x, y) !== 0) continue;
      if (!inSector(dx, dy, stoneStartDeg, stoneSpanDeg)) continue;
      cand[row * W + col] = 1;
    }
  }

  // 2. Connected components (4-connected), keeping those that touch the seed band.
  const label = new Int32Array(W * W);
  const stack = new Int32Array(W * W);
  const seed0 = MAZE_SEED_RADII.min ** 2;
  const seed1 = MAZE_SEED_RADII.max ** 2;
  const comps: { minX: number; minY: number; maxX: number; maxY: number; area: number; seeded: boolean }[] = [
    { minX: 0, minY: 0, maxX: 0, maxY: 0, area: 0, seeded: false },
  ];
  for (let start = 0; start < W * W; start++) {
    if (!cand[start] || label[start]) continue;
    const id = comps.length;
    const comp = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, area: 0, seeded: false };
    comps.push(comp);
    let sp = 0;
    stack[sp++] = start;
    label[start] = id;
    while (sp) {
      const p = stack[--sp]!;
      const row = (p / W) | 0;
      const col = p - row * W;
      const x = col - R;
      const y = R - row;
      comp.area++;
      if (x < comp.minX) comp.minX = x;
      if (x > comp.maxX) comp.maxX = x;
      if (y < comp.minY) comp.minY = y;
      if (y > comp.maxY) comp.maxY = y;
      if (!comp.seeded) {
        const d2 = (x + 0.5) ** 2 + (y + 0.5) ** 2;
        if (d2 >= seed0 && d2 <= seed1) comp.seeded = true;
      }
      const visit = (q: number) => {
        if (cand[q] && !label[q]) {
          label[q] = id;
          stack[sp++] = q;
        }
      };
      if (col > 0) visit(p - 1);
      if (col < W - 1) visit(p + 1);
      if (row > 0) visit(p - W);
      if (row < W - 1) visit(p + W);
    }
  }

  // 3. Summed-area table over candidate cells of seeded components.
  const S = new Int32Array((W + 1) * (W + 1));
  for (let row = 0; row < W; row++) {
    let rowSum = 0;
    for (let col = 0; col < W; col++) {
      const l = label[row * W + col]!;
      if (l && comps[l]!.seeded) rowSum++;
      S[(row + 1) * (W + 1) + col + 1] = S[row * (W + 1) + col + 1]! + rowSum;
    }
  }
  const rectSum = (row: number, col: number, h: number, w: number) =>
    S[(row + h) * (W + 1) + col + w]! -
    S[row * (W + 1) + col + w]! -
    S[(row + h) * (W + 1) + col]! +
    S[row * (W + 1) + col]!;

  // 4. For each maze size (largest first), find components containing a fitting rectangle.
  const compClass = new Uint8Array(comps.length);
  const fit = new Map<number, [number, number]>();
  for (let m = MAZES.length - 1; m >= 0; m--) {
    const { width: w, height: h } = MAZES[m]!;
    const cls = m + 1;
    for (let row = 0; row + h <= W; row++) {
      for (let col = 0; col + w <= W; col++) {
        const l = label[row * W + col]!;
        if (!l || compClass[l]! >= cls || !comps[l]!.seeded) continue;
        if (rectSum(row, col, h, w) === w * h) {
          compClass[l] = cls;
          fit.set(l, [col - R + w / 2, R - row - h / 2]);
        }
      }
    }
  }

  const mask = new Uint8Array(W * W);
  for (let i = 0; i < W * W; i++) {
    const l = label[i]!;
    if (l) mask[i] = compClass[l]!;
  }
  const holes: MazeHole[] = [];
  comps.forEach((c, l) => {
    const cls = compClass[l]!;
    if (!cls) return;
    const [fitX, fitY] = fit.get(l)!;
    holes.push({
      size: MAZES[cls - 1]!.id,
      minX: c.minX,
      minY: c.minY,
      maxX: c.maxX,
      maxY: c.maxY,
      area: c.area,
      fitX,
      fitY,
    });
  });
  holes.sort(
    (a, b) =>
      MAZES.findIndex((m) => m.id === b.size) - MAZES.findIndex((m) => m.id === a.size) || b.area - a.area,
  );
  return { mask, holes };
}
