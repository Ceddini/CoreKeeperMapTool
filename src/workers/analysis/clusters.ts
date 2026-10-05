import { HL_BLOCK } from '../../render/highlight.ts';
import { CELLS, PART, type MapModel } from '../model/map-model.ts';
import { BLOCK_FLAG, INDEX_MASK } from '../model/palette.ts';

/** Per cluster: representative tile x, y; tile count; bounds minX, minY, maxX, maxY. */
export const CLUSTER_STRIDE = 7;

export interface ClusterResult {
  clusters: Int32Array;
  count: number;
  /** More highlighted tiles than `maxTiles`: only the first ones were grouped. */
  truncated: boolean;
}

const OFF = 1 << 20;
const key = (x: number, y: number) => (x + OFF) * 2 ** 21 + (y + OFF);

/**
 * Groups highlighted tiles into connected spots (8-neighbourhood), e.g. one ore vein or one
 * boulder per cluster, so the UI can jump from spot to spot.
 */
export function findClusters(model: MapModel, lut: Uint8Array, maxTiles = 400_000): ClusterResult {
  const xs: number[] = [];
  const ys: number[] = [];
  let truncated = false;
  outer: for (const c of model.chunks.values()) {
    const x0 = c.cx * PART;
    const yTop = c.cy * PART + PART - 1;
    const cells = c.cells;
    for (let i = 0; i < CELLS; i++) {
      const v = cells[i]!;
      const f = lut[v & INDEX_MASK];
      if (!f || (f & HL_BLOCK && !(v & BLOCK_FLAG))) continue;
      if (xs.length >= maxTiles) {
        truncated = true;
        break outer;
      }
      xs.push(x0 + (i & 255));
      ys.push(yTop - (i >> 8));
    }
  }

  const n = xs.length;
  const index = new Map<number, number>();
  for (let i = 0; i < n; i++) index.set(key(xs[i]!, ys[i]!), i);
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]!]!;
      a = parent[a]!;
    }
    return a;
  };
  for (let i = 0; i < n; i++) {
    const x = xs[i]!;
    const y = ys[i]!;
    // Half of the 8-neighbourhood is enough: the other half links back to us.
    for (const [dx, dy] of [
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ] as const) {
      const j = index.get(key(x + dx, y + dy));
      if (j === undefined) continue;
      const a = find(i);
      const b = find(j);
      if (a !== b) parent[a] = b;
    }
  }

  // Aggregate per root: count, bounds, centroid.
  const slot = new Map<number, number>();
  const agg: number[] = []; // sumX, sumY, count, minX, minY, maxX, maxY
  for (let i = 0; i < n; i++) {
    const r = find(i);
    let s = slot.get(r);
    if (s === undefined) {
      s = agg.length / 7;
      slot.set(r, s);
      agg.push(0, 0, 0, Infinity, Infinity, -Infinity, -Infinity);
    }
    const o = s * 7;
    const x = xs[i]!;
    const y = ys[i]!;
    agg[o]! += x;
    agg[o + 1]! += y;
    agg[o + 2]!++;
    agg[o + 3] = Math.min(agg[o + 3]!, x);
    agg[o + 4] = Math.min(agg[o + 4]!, y);
    agg[o + 5] = Math.max(agg[o + 5]!, x);
    agg[o + 6] = Math.max(agg[o + 6]!, y);
  }
  const count = agg.length / 7;
  // Representative: the member tile closest to the centroid (always inside the spot).
  const best = new Float64Array(count).fill(Infinity);
  const rep = new Int32Array(count * 2);
  for (let i = 0; i < n; i++) {
    const s = slot.get(find(i))!;
    const o = s * 7;
    const cx = agg[o]! / agg[o + 2]!;
    const cy = agg[o + 1]! / agg[o + 2]!;
    const d = (xs[i]! - cx) ** 2 + (ys[i]! - cy) ** 2;
    if (d < best[s]!) {
      best[s] = d;
      rep[s * 2] = xs[i]!;
      rep[s * 2 + 1] = ys[i]!;
    }
  }
  const clusters = new Int32Array(count * CLUSTER_STRIDE);
  for (let s = 0; s < count; s++) {
    const o = s * 7;
    clusters.set(
      [rep[s * 2]!, rep[s * 2 + 1]!, agg[o + 2]!, agg[o + 3]!, agg[o + 4]!, agg[o + 5]!, agg[o + 6]!],
      s * CLUSTER_STRIDE,
    );
  }
  return { clusters, count, truncated };
}
