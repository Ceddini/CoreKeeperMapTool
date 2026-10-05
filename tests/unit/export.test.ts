import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ingest } from '../../src/workers/ingest/ingest.ts';
import { MapModel } from '../../src/workers/model/map-model.ts';
import { exportPng } from '../../src/workers/export/export.ts';
import { decodePng } from '../../src/workers/ingest/png.ts';
import type { ExportOptions } from '../../src/core/rpc.ts';

const gz = readFileSync('public/example/classic.mapparts.gzip');

describe('exportPng', () => {
  it('round-trips map pixels exactly at 1×', async () => {
    const model = new MapModel();
    await ingest(new Blob([gz]), model);
    const region = { minX: -300, minY: -200, maxX: 299, maxY: 199 };
    const opts: ExportOptions = {
      scale: 1,
      region,
      background: 'transparent',
      lut: null,
      dim: 0.25,
      customColor: 0,
      primitives: [],
      labels: [],
      mazeClasses: 0,
    };
    const blob = await exportPng(
      model,
      opts,
      null,
      () => {},
      () => false,
    );
    const img = await decodePng(new Uint8Array(await blob.arrayBuffer()));
    expect(img.width).toBe(600);
    expect(img.height).toBe(400);
    for (const [x, y] of [
      [0, 0],
      [-1, -1],
      [150, -120],
      [-299, 199],
    ] as const) {
      const row = region.maxY - y;
      const col = x - region.minX;
      const o = (row * img.width + col) * 4;
      const idx = model.indexAt(x, y);
      const rgb = idx ? model.palette.colors[idx]! : 0;
      expect(img.rgba[o + 3]).toBe(idx ? 255 : 0);
      if (idx) expect((img.rgba[o]! << 16) | (img.rgba[o + 1]! << 8) | img.rgba[o + 2]!).toBe(rgb);
    }
  });

  it('scales by repeating pixels', async () => {
    const model = new MapModel();
    await ingest(new Blob([gz]), model);
    const opts: ExportOptions = {
      scale: 2,
      region: { minX: 0, minY: 0, maxX: 9, maxY: 4 },
      background: 'dark',
      lut: null,
      dim: 0.25,
      customColor: 0,
      primitives: [],
      labels: [],
      mazeClasses: 0,
    };
    const img = await decodePng(
      new Uint8Array(
        await (
          await exportPng(
            model,
            opts,
            null,
            () => {},
            () => false,
          )
        ).arrayBuffer(),
      ),
    );
    expect([img.width, img.height]).toEqual([20, 10]);
    expect(Array.from(img.rgba.subarray(0, 4))).toEqual(Array.from(img.rgba.subarray(4, 8)));
  });
});
