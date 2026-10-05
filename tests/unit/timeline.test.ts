import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ingest } from '../../src/workers/ingest/ingest.ts';
import { MapModel } from '../../src/workers/model/map-model.ts';
import { buildTimeline, exploreTimeToDate, timeAt } from '../../src/workers/analysis/timeline.ts';

async function load(path: string) {
  const m = new MapModel();
  await ingest(new Blob([readFileSync(path)]), m);
  return m;
}

// Raw values are Unix time / 4. Dates below were confirmed against when the maps were played.
describe('exploration timeline', () => {
  it('reads real exploration dates (Classic example, played January 2023)', async () => {
    const m = await load('public/example/classic.mapparts.gzip');
    const { info, chunks } = await buildTimeline(m);
    expect(info).not.toBeNull();
    expect(exploreTimeToDate(info!.min).toISOString()).toBe('2023-01-16T01:55:56.000Z');
    expect(exploreTimeToDate(info!.max).toISOString()).toBe('2023-01-16T22:01:08.000Z');
    expect(chunks).toHaveLength(m.chunks.size);
    expect(info!.histogram.reduce((a, b) => a + b, 0)).toBe(info!.tiles);
  });

  it('finds one play session on a played map, explored outwards from the Core', async () => {
    const m = await load('tests/fixtures/played-standard.mapparts.gzip');
    const { info } = await buildTimeline(m);
    expect(info!.sessions).toHaveLength(1);
    const s = info!.sessions[0]!;
    expect((s.end - s.start) / 60).toBeGreaterThan(30);
    // Last tile explored just before the save was written on 2026-09-12 22:22 UTC.
    expect(exploreTimeToDate(info!.max).toISOString()).toBe('2026-09-12T22:18:24.000Z');
    // The Core area is explored first.
    expect(timeAt(m, 0, 0)).toBeGreaterThanOrEqual(info!.min);
    expect(timeAt(m, 0, 0)).toBeLessThan(info!.min + 15 * 60);
  });

  it('encodes times in 16 bits relative to the first exploration', async () => {
    const m = await load('tests/fixtures/played-standard.mapparts.gzip');
    const { info, chunks } = await buildTimeline(m);
    let maxStep = 0;
    for (const c of chunks) for (const v of c.times) if (v > maxStep) maxStep = v;
    expect(maxStep).toBe(Math.floor((info!.max - info!.min) / info!.unit) + 1);
  });
});
