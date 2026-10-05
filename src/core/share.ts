import { poiById } from '../data/pois.ts';
import { tileById } from '../data/tiles.ts';
import type { ChunkSize } from '../data/world-layout.ts';
import type { Settings } from './store.ts';

/**
 * Shareable views: camera position plus the layers that matter for "look at this", encoded into
 * the URL (`?at=x,y,zoom&l=…`). Nothing about the map itself is shared: the recipient loads their
 * own copy of the world.
 */

type Shared = Pick<
  Settings,
  | 'world'
  | 'pois'
  | 'highlight'
  | 'pickedColor'
  | 'cropToBiome'
  | 'sectors'
  | 'grids'
  | 'maze'
  | 'customRing'
  | 'player'
>;

interface Packed {
  w: 'standard' | 'classic';
  p?: string[];
  h?: string[];
  pc?: number;
  c?: 0 | 1;
  s?: [0 | 1, 0 | 1, number, number];
  g?: [0 | 1, 0 | 1, ChunkSize?];
  m?: [0 | 1, 0 | 1, 0 | 1];
  r?: [0 | 1, number];
  pl?: [0 | 1, number, number, number, string];
}

const b = (v: boolean): 0 | 1 => (v ? 1 : 0);

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeLayers(s: Settings): string {
  const p: Packed = { w: s.world };
  if (s.pois.length) p.p = s.pois;
  if (s.highlight.length) p.h = s.highlight;
  if (s.pickedColor !== null) p.pc = s.pickedColor;
  if (!s.cropToBiome) p.c = 0;
  if (s.sectors.show || s.sectors.manual)
    p.s = [b(s.sectors.show), b(s.sectors.manual), s.sectors.inner, s.sectors.outer];
  if (s.grids.chunk || s.grids.mob) p.g = [b(s.grids.chunk), b(s.grids.mob), s.grids.chunkSize];
  if (s.maze.small || s.maze.medium || s.maze.large)
    p.m = [b(s.maze.small), b(s.maze.medium), b(s.maze.large)];
  if (s.customRing.on) p.r = [1, s.customRing.r];
  if (s.player.on) p.pl = [1, s.player.x, s.player.y, s.player.r, s.player.color];
  return toBase64Url(JSON.stringify(p));
}

const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null;

/** Decodes the `l` parameter; unknown ids and malformed values are dropped, never trusted. */
export function decodeLayers(param: string, current: Settings): Partial<Shared> | null {
  let p: Packed;
  try {
    p = JSON.parse(fromBase64Url(param)) as Packed;
  } catch {
    return null;
  }
  if (!p || typeof p !== 'object') return null;
  const out: Partial<Shared> = {};
  out.world = p.w === 'classic' ? 'classic' : 'standard';
  out.pois = Array.isArray(p.p) ? p.p.filter((id) => typeof id === 'string' && poiById.has(id)) : [];
  out.highlight = Array.isArray(p.h) ? p.h.filter((id) => typeof id === 'string' && tileById.has(id)) : [];
  out.pickedColor = num(p.pc, 0, 0xffffff);
  out.cropToBiome = p.c !== 0;
  out.sectors = Array.isArray(p.s)
    ? { show: !!p.s[0], manual: !!p.s[1], inner: num(p.s[2], 0, 359) ?? 0, outer: num(p.s[3], 0, 359) ?? 0 }
    : { ...current.sectors, show: false, manual: false };
  const chunkSize: ChunkSize = Array.isArray(p.g) && (p.g[2] === '64' || p.g[2] === '256') ? p.g[2] : 'auto';
  out.grids = Array.isArray(p.g)
    ? { chunk: !!p.g[0], mob: !!p.g[1], chunkSize }
    : { chunk: false, mob: false, chunkSize: current.grids.chunkSize };
  out.maze = Array.isArray(p.m)
    ? { small: !!p.m[0], medium: !!p.m[1], large: !!p.m[2] }
    : { small: false, medium: false, large: false };
  out.customRing = Array.isArray(p.r)
    ? { on: true, r: num(p.r[1], 1, 5000) ?? 500 }
    : { ...current.customRing, on: false };
  out.player =
    Array.isArray(p.pl) && num(p.pl[1], -1e6, 1e6) !== null && num(p.pl[2], -1e6, 1e6) !== null
      ? {
          on: true,
          x: Math.round(p.pl[1]),
          y: Math.round(p.pl[2]),
          r: num(p.pl[3], 0, 5000) ?? current.player.r,
          color: /^#[0-9a-f]{6}$/i.test(String(p.pl[4])) ? String(p.pl[4]) : current.player.color,
        }
      : { ...current.player, on: false };
  return out;
}

export function shareUrl(x: number, y: number, zoom: number, s: Settings): string {
  const at = `${Math.round(x)},${Math.round(y)},${Math.round(zoom * 10) / 10}`;
  return `${location.origin}${location.pathname}?at=${at}&l=${encodeLayers(s)}`;
}
