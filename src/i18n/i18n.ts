import en from './locales/en.json' with { type: 'json' };
import { signal } from '../core/signals.ts';
import type { PoiDef, TileDef, BiomeId } from '../data/schema.ts';

export type Lang = 'en' | 'de';
export type MsgKey = keyof typeof en;
type Dict = Partial<Record<string, string>>;

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'de', label: 'Deutsch' },
];

const dicts: Partial<Record<Lang, Dict>> = { en };
const version = signal(0);
export const lang = signal<Lang>('en');

const loaders: Record<Exclude<Lang, 'en'>, () => Promise<Dict>> = {
  de: () => import('./locales/de.json').then((m) => m.default as Dict),
};

export function detectLang(saved?: string | null): Lang {
  if (saved === 'en' || saved === 'de') return saved;
  for (const l of navigator.languages ?? [navigator.language]) {
    if (l?.toLowerCase().startsWith('de')) return 'de';
  }
  return 'en';
}

export async function setLang(l: Lang): Promise<void> {
  if (!dicts[l] && l !== 'en') dicts[l] = await loaders[l]();
  lang.value = l;
  document.documentElement.lang = l;
  version.value++;
}

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Translate a message. Reading it inside an effect re-renders on language change. */
export function t(key: MsgKey, vars?: Record<string, string | number>): string {
  void version.value;
  const s = dicts[lang.value]?.[key] ?? (en as Dict)[key] ?? key;
  return interpolate(s, vars);
}

/** Plural-aware: uses `<key>.one` / `<key>.other` with {count}. */
export function tn(key: string, count: number, vars?: Record<string, string | number>): string {
  void version.value;
  const rule = new Intl.PluralRules(lang.value).select(count);
  const k = `${key}.${rule === 'one' ? 'one' : 'other'}`;
  const s = dicts[lang.value]?.[k] ?? (en as Dict)[k] ?? k;
  return interpolate(s, { count: fmt(count), ...vars });
}

/** Optional lookup for data-driven keys (tile, poi and biome names). */
function lookup(key: string): string | undefined {
  void version.value;
  return dicts[lang.value]?.[key] ?? (en as Dict)[key];
}

export function fmt(n: number, digits = 0): string {
  return new Intl.NumberFormat(lang.value, { maximumFractionDigits: digits }).format(n);
}

export function tileName(tile: TileDef): string {
  const base = lookup(`tile.${tile.id}`) ?? tile.name;
  const layer = tile.layer ? ` ${t(tile.layer === 'wall' ? 'tile.layer.wall' : 'tile.layer.ground')}` : '';
  const variant = tile.variant ? ` (${lookup(`tile.variant.${tile.variant}`) ?? tile.variant})` : '';
  return base + layer + variant;
}

export function poiName(poi: PoiDef): string {
  return lookup(`poi.${poi.id}`) ?? poi.id;
}

export function biomeName(id: BiomeId): string {
  return lookup(`biome.${id}`) ?? id;
}
