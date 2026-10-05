import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateData } from '../../src/data/validate.ts';
import { POIS } from '../../src/data/pois.ts';
import { BIOMES } from '../../src/data/biomes.ts';
import { TILES, TILE_CATEGORIES, tileById } from '../../src/data/tiles.ts';
import { chunkGrid } from '../../src/data/world-layout.ts';

const en = JSON.parse(readFileSync('src/i18n/locales/en.json', 'utf8')) as Record<string, string>;
const de = JSON.parse(readFileSync('src/i18n/locales/de.json', 'utf8')) as Record<string, string>;

describe('game data', () => {
  it('passes validation', () => {
    const issues = validateData({ iconExists: (f) => existsSync(`src/assets/poi/${f}`) });
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
  });

  it('has English names for every POI, biome and tile category', () => {
    for (const p of POIS) expect(en[`poi.${p.id}`], p.id).toBeTruthy();
    for (const b of BIOMES) expect(en[`biome.${b.id}`], b.id).toBeTruthy();
    for (const c of TILE_CATEGORIES) expect(en[`tiles.cat.${c}`], c).toBeTruthy();
  });
});

describe('merged tiles', () => {
  it('has one entry per look (colour, category, shape)', () => {
    const keys = TILES.map((t) => `${t.rgb}|${t.category}|${t.shape}|${t.layer ?? ''}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('combines conveyor directions and the splitter into one Conveyor Belt', () => {
    const conveyor = TILES.filter((t) => t.category === 'automation' && t.rgb === '#687fae');
    expect(conveyor.map((t) => t.name)).toEqual(['Conveyor Belt']);
    expect(conveyor[0]!.members).toContain('Conveyor Belt Splitter');
    expect(tileById.get('ConveyorBelt#2')).toBe(conveyor[0]);
  });
});

describe('translations', () => {
  it('German covers every UI string (proper names may fall back to English)', () => {
    const missing = Object.keys(en).filter((k) => !(k in de) && !/^(poi|biome)\./.test(k));
    expect(missing).toEqual([]);
  });

  it('keeps the same placeholders', () => {
    for (const [k, v] of Object.entries(de)) {
      const want = (en[k]?.match(/\{\w+\}/g) ?? []).sort();
      expect((v.match(/\{\w+\}/g) ?? []).sort(), k).toEqual(want);
    }
  });
});

describe('chunk grid', () => {
  it('follows the world type on Auto and can be forced either way', () => {
    expect(chunkGrid('standard', 'auto')).toEqual({ size: 256, offset: 128 });
    expect(chunkGrid('classic', 'auto')).toEqual({ size: 64, offset: 0 });
    expect(chunkGrid('classic', '256').size).toBe(256);
    expect(chunkGrid('standard', '64').size).toBe(64);
  });
});
