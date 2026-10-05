import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { MapPartsScanner } from '../../src/workers/ingest/scanner.ts';
import { decodePng } from '../../src/workers/ingest/png.ts';
import { ingest } from '../../src/workers/ingest/ingest.ts';
import { MapModel } from '../../src/workers/model/map-model.ts';
import { BLOCK_FLAG, INDEX_MASK } from '../../src/workers/model/palette.ts';
import { IngestError } from '../../src/core/errors.ts';

const gz = readFileSync('public/example/example.mapparts.gzip');
const json = gunzipSync(gz);
const parsed = JSON.parse(json.toString()) as {
  mapParts: { keys: { x: number; y: number }[]; values: { png: number[] }[] };
};

function scan(chunkSizes: number[]) {
  const keys: [number, number][] = [];
  const parts: Uint8Array[] = [];
  const s = new MapPartsScanner({
    key: (_i, x, y) => keys.push([x, y]),
    part: (_i, png) => parts.push(png ? png.slice() : new Uint8Array()),
  });
  let p = 0;
  let k = 0;
  while (p < json.length) {
    const size = chunkSizes[k++ % chunkSizes.length]!;
    s.push(new Uint8Array(json.subarray(p, p + size)));
    p += size;
  }
  s.end();
  return { keys, parts };
}

describe('MapPartsScanner', () => {
  it('matches JSON.parse on the example map', () => {
    const { keys, parts } = scan([1 << 20]);
    expect(keys).toEqual(parsed.mapParts.keys.map((k) => [k.x, k.y]));
    expect(parts.length).toBe(parsed.mapParts.values.length);
    for (let i = 0; i < parts.length; i += 37)
      expect(Array.from(parts[i]!)).toEqual(parsed.mapParts.values[i]!.png);
  });

  it('survives arbitrary chunk boundaries', () => {
    const odd = scan([1, 7, 3, 4096, 13, 65537, 2]);
    const whole = scan([1 << 24]);
    expect(odd.keys).toEqual(whole.keys);
    for (let i = 0; i < whole.parts.length; i += 11) expect(odd.parts[i]).toEqual(whole.parts[i]);
  });

  it('rejects non-map JSON', () => {
    const s = new MapPartsScanner({ key() {}, part() {} });
    expect(() => s.push(new TextEncoder().encode('[1,2,3]'))).toThrow();
  });
});

describe('decodePng', () => {
  it('decodes a 256×256 RGBA part with binary alpha', async () => {
    const png = new Uint8Array(parsed.mapParts.values[0]!.png);
    const img = await decodePng(png);
    expect(img.width).toBe(256);
    expect(img.height).toBe(256);
    for (let i = 3; i < img.rgba.length; i += 4) expect([0, 255]).toContain(img.rgba[i]);
  });
});

describe('ingest', () => {
  it('loads the example map into the model', async () => {
    const model = new MapModel();
    let uploaded = 0;
    const t0 = performance.now();
    const res = await ingest(new Blob([gz]), model, { onChunks: (c) => (uploaded += c.length) });
    const ms = performance.now() - t0;
    expect(model.chunks.size).toBe(224);
    expect(uploaded).toBe(224);
    expect(res.warnings).toEqual([]);
    expect(model.palette.size).toBeGreaterThan(50);
    console.log(`ingest example: ${ms.toFixed(0)} ms, ${model.palette.size - 1} colours`);
  });

  it('only re-decodes changed parts on incremental refresh', async () => {
    const model = new MapModel();
    await ingest(new Blob([gz]), model);
    const res = await ingest(new Blob([gz]), model, { incremental: true });
    expect(res.changed).toEqual([]);
    expect(res.removed).toEqual([]);
  });

  it('flags 2×2 blocks of one colour', async () => {
    const model = new MapModel();
    await ingest(new Blob([gz]), model);
    let flagged = 0;
    let checked = 0;
    for (const c of model.chunks.values()) {
      for (let r = 0; r < 255; r++)
        for (let col = 0; col < 255; col++) {
          const i = r * 256 + col;
          const v = c.cells[i]! & INDEX_MASK;
          if (!v) continue;
          const uniform =
            v === (c.cells[i + 1]! & INDEX_MASK) &&
            v === (c.cells[i + 256]! & INDEX_MASK) &&
            v === (c.cells[i + 257]! & INDEX_MASK);
          if (uniform) {
            checked++;
            if (c.cells[i]! & BLOCK_FLAG && c.cells[i + 257]! & BLOCK_FLAG) flagged++;
          }
        }
    }
    expect(checked).toBeGreaterThan(0);
    expect(flagged).toBe(checked);
  });

  it('reports a world file as the wrong file', async () => {
    const world = readFileSync('tests/fixtures/wrong.world.gzip');
    await expect(
      ingest(new Blob([world]), new MapModel(), { fileName: '5.world.gzip' }),
    ).rejects.toMatchObject({
      kind: 'wrong-file',
      hint: 'world',
    });
  });

  it('reports non-gzip input', async () => {
    await expect(ingest(new Blob([new Uint8Array([1, 2, 3, 4])]), new MapModel())).rejects.toBeInstanceOf(
      IngestError,
    );
  });

  it('reports a truncated file', async () => {
    const half = gz.subarray(0, gz.length >> 1);
    await expect(ingest(new Blob([half]), new MapModel())).rejects.toMatchObject({ kind: 'truncated' });
  });
});
