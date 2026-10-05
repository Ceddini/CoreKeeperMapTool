import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { ingest } from '../../src/workers/ingest/ingest.ts';
import { CELLS, MapModel, chunkKey } from '../../src/workers/model/map-model.ts';
import { BINS, detectZone } from '../../src/workers/analysis/biomes.ts';
import { findMazeHoles } from '../../src/workers/analysis/maze.ts';
import { WORLD_LAYOUTS } from '../../src/data/world-layout.ts';
import { TILES, hexToInt } from '../../src/data/tiles.ts';

const gz = readFileSync('public/example/classic.mapparts.gzip');
let model: MapModel;

beforeAll(async () => {
  model = new MapModel();
  await ingest(new Blob([gz]), model);
});

/** Port of the original tool's ray-based detector (stone − clay over a half circle). */
function legacyInnerStartDeg(m: MapModel): number {
  const tilesetOf = new Map<number, string>();
  for (const t of TILES) if (t.tileset) tilesetOf.set(hexToInt(t.rgb), t.tileset);
  const delta: number[] = [];
  for (let b = 0; b < BINS; b++) {
    const a = (b * 2 * Math.PI) / BINS;
    let stone = 0,
      clay = 0,
      px: number | undefined,
      py: number | undefined;
    for (let r = 150; r < 400; r++) {
      const x = Math.trunc(r * Math.sin(a));
      const y = Math.trunc(r * Math.cos(a));
      if (x === px && y === py) continue;
      px = x;
      py = y;
      const idx = m.indexAt(x, y);
      if (!idx) continue;
      const ts = tilesetOf.get(m.palette.colors[idx]!);
      if (ts === 'Stone') stone++;
      else if (ts === 'Clay') clay++;
    }
    delta.push(stone - clay);
  }
  let best = -Infinity,
    bestB = 0;
  for (let b = 0; b < BINS; b++) {
    let s = 0;
    for (let i = 0; i < BINS / 2; i++) s += delta[(b + i) % BINS]!;
    if (s > best) {
      best = s;
      bestB = b;
    }
  }
  return (bestB * 360) / BINS;
}

function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

describe('biome sector detection', () => {
  it('agrees with the original algorithm for the inner zone', () => {
    const inner = WORLD_LAYOUTS.classic.zones.find((z) => z.id === 'inner')!;
    const t0 = performance.now();
    const res = detectZone(model, inner)!;
    console.log(
      `inner: ${res.rotationDeg}° conf ${res.confidence.toFixed(2)} (${(performance.now() - t0).toFixed(0)} ms)`,
    );
    expect(res.evidence).toBeGreaterThan(1000);
    expect(angleDiff(res.rotationDeg, legacyInnerStartDeg(model))).toBeLessThan(6);
  });

  it('detects the outer zone with high confidence', () => {
    const outer = WORLD_LAYOUTS.classic.zones.find((z) => z.id === 'outer')!;
    const t0 = performance.now();
    const res = detectZone(model, outer)!;
    console.log(
      `outer: ${res.rotationDeg}° conf ${res.confidence.toFixed(2)} (${(performance.now() - t0).toFixed(0)} ms)`,
    );
    expect(res.confidence).toBeGreaterThan(0.7);
  });
});

/** A model where every tile is explored (index 1) except the given world rectangles. */
function syntheticModel(holes: { x: number; y: number; w: number; h: number }[]): MapModel {
  const m = new MapModel();
  m.palette.lookup(0x678397);
  for (let cy = -3; cy < 3; cy++)
    for (let cx = -3; cx < 3; cx++) {
      const cells = new Uint16Array(CELLS).fill(1);
      m.set({ key: chunkKey(cx, cy), cx, cy, hash: 0, cells });
    }
  for (const h of holes)
    for (let y = h.y; y < h.y + h.h; y++)
      for (let x = h.x; x < h.x + h.w; x++) {
        const cx = Math.floor(x / 256),
          cy = Math.floor(y / 256);
        const c = m.get(cx, cy)!;
        c.cells[(255 - (y - cy * 256)) * 256 + (x - cx * 256)] = 0;
      }
  return m;
}

describe('maze holes', () => {
  // Stone sector facing east: [0°, 180°) compass → x > 0.
  it('finds a hole that exactly fits the small maze', () => {
    const m = syntheticModel([{ x: 250, y: 0, w: 20, h: 18 }]);
    const res = findMazeHoles(m, 0);
    expect(res.holes).toHaveLength(1);
    expect(res.holes[0]!.size).toBe('small');
  });

  it('rejects a hole one tile too narrow', () => {
    const m = syntheticModel([{ x: 250, y: 0, w: 19, h: 18 }]);
    expect(findMazeHoles(m, 0).holes).toHaveLength(0);
  });

  it('classifies by the largest maze that fits', () => {
    const m = syntheticModel([
      { x: 200, y: 50, w: 39, h: 39 },
      { x: 300, y: -150, w: 60, h: 60 },
    ]);
    const sizes = findMazeHoles(m, 0)
      .holes.map((h) => h.size)
      .sort();
    expect(sizes).toEqual(['large', 'medium']);
  });

  it('checks every row, not only the first (L-shaped region)', () => {
    // 20 wide on the first rows, but only 5 wide below: must not fit.
    const m = syntheticModel([
      { x: 250, y: 10, w: 20, h: 9 },
      { x: 250, y: 0, w: 5, h: 10 },
    ]);
    expect(findMazeHoles(m, 0).holes).toHaveLength(0);
  });

  it('ignores holes outside the stone sector', () => {
    const m = syntheticModel([{ x: -300, y: 0, w: 30, h: 30 }]);
    expect(findMazeHoles(m, 0).holes).toHaveLength(0);
  });

  it('runs on the example map', () => {
    const inner = WORLD_LAYOUTS.classic.zones.find((z) => z.id === 'inner')!;
    const rot = detectZone(model, inner)!.rotationDeg;
    const t0 = performance.now();
    const res = findMazeHoles(model, rot);
    console.log(`maze: ${res.holes.length} holes (${(performance.now() - t0).toFixed(0)} ms)`);
    expect(res.mask.length).toBeGreaterThan(0);
  });
});
