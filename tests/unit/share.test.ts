import { describe, expect, it } from 'vitest';
import { decodeLayers, encodeLayers } from '../../src/core/share.ts';
import { DEFAULT_SETTINGS, type Settings } from '../../src/core/store.ts';

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  world: 'classic',
  pois: ['ghorm', 'azeos'],
  highlight: ['ScarletOre'],
  sectors: { show: true, manual: true, inner: 45, outer: 300 },
  grids: { chunk: true, mob: false, chunkSize: '256' },
  maze: { small: false, medium: true, large: true },
  player: { on: true, x: 120, y: -40, r: 208, color: '#ff5a5a' },
};

describe('share links', () => {
  it('round-trips the shared layers', () => {
    const out = decodeLayers(encodeLayers(settings), DEFAULT_SETTINGS)!;
    expect(out).toMatchObject({
      world: 'classic',
      pois: ['ghorm', 'azeos'],
      highlight: ['ScarletOre'],
      sectors: { show: true, manual: true, inner: 45, outer: 300 },
      grids: { chunk: true, mob: false, chunkSize: '256' },
      maze: { small: false, medium: true, large: true },
      player: { on: true, x: 120, y: -40 },
    });
  });

  it('stays short and URL-safe', () => {
    const l = encodeLayers(settings);
    expect(l).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(l.length).toBeLessThan(300);
  });

  it('drops unknown ids and rejects garbage', () => {
    const forged = btoa(
      JSON.stringify({ w: 'evil', p: ['ghorm', 'nope'], h: [42, 'ScarletOre'], s: [1, 1, 9999, -5] }),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const out = decodeLayers(forged, DEFAULT_SETTINGS)!;
    expect(out.world).toBe('standard');
    expect(out.pois).toEqual(['ghorm']);
    expect(out.highlight).toEqual(['ScarletOre']);
    expect(out.sectors).toMatchObject({ inner: 359, outer: 0 });
    expect(decodeLayers('%%%', DEFAULT_SETTINGS)).toBeNull();
  });
});
