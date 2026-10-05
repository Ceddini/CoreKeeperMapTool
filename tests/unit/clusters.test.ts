import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLUSTER_STRIDE, findClusters } from '../../src/workers/analysis/clusters.ts';
import { CELLS, MapModel, chunkKey } from '../../src/workers/model/map-model.ts';
import { ingest } from '../../src/workers/ingest/ingest.ts';
import { HL_ANY, HL_BLOCK, buildHighlightLut } from '../../src/render/highlight.ts';
import { TILES } from '../../src/data/tiles.ts';

/** One chunk at (0,0) filled with index 1, with index 2 painted at the given world tiles. */
function model(tiles: [number, number][]): MapModel {
  const m = new MapModel();
  m.palette.lookup(0x111111);
  m.palette.lookup(0xff0000);
  const cells = new Uint16Array(CELLS).fill(1);
  for (const [x, y] of tiles) cells[(255 - y) * 256 + x] = 2;
  m.set({ key: chunkKey(0, 0), cx: 0, cy: 0, hash: 0, cells });
  m.computeBlockFlags([chunkKey(0, 0)]);
  return m;
}

const lutFor = (flag: number) => {
  const lut = new Uint8Array(3);
  lut[2] = flag;
  return lut;
};

function spots(res: ReturnType<typeof findClusters>) {
  const out: { x: number; y: number; count: number }[] = [];
  for (let i = 0; i < res.count; i++) {
    const o = i * CLUSTER_STRIDE;
    out.push({ x: res.clusters[o]!, y: res.clusters[o + 1]!, count: res.clusters[o + 2]! });
  }
  return out.sort((a, b) => a.x - b.x);
}

describe('findClusters', () => {
  it('groups touching tiles (including diagonals) and separates distant ones', () => {
    const m = model([
      [10, 10],
      [11, 10],
      [12, 11], // diagonal neighbour of (11,10)
      [100, 100],
    ]);
    const res = findClusters(m, lutFor(HL_ANY));
    expect(spots(res).map((s) => s.count)).toEqual([3, 1]);
  });

  it('picks a representative tile that belongs to the spot', () => {
    const m = model([
      [20, 20],
      [21, 20],
      [22, 20],
    ]);
    const [s] = spots(findClusters(m, lutFor(HL_ANY)));
    expect(s).toMatchObject({ x: 21, y: 20, count: 3 });
  });

  it('only counts 2×2 blocks for boulder highlights', () => {
    const m = model([
      [30, 30],
      [31, 30],
      [30, 31],
      [31, 31], // a boulder
      [50, 50], // a single ore tile
    ]);
    const res = findClusters(m, lutFor(HL_BLOCK));
    expect(spots(res).map((s) => s.count)).toEqual([4]);
  });

  it('runs on the example map', async () => {
    const m = new MapModel();
    await ingest(new Blob([readFileSync('public/example/classic.mapparts.gzip')]), m);
    const scarlet = TILES.filter((t) => t.name === 'Scarlet Ore');
    const lut = buildHighlightLut(m.palette.colors, m.palette.size, scarlet, null);
    const t0 = performance.now();
    const res = findClusters(m, lut);
    console.log(`scarlet ore: ${res.count} spots (${(performance.now() - t0).toFixed(0)} ms)`);
    expect(res.count).toBeGreaterThan(100);
    expect(res.truncated).toBe(false);
  });
});
