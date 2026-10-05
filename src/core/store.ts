import { effect, signal, type Signal } from './signals.ts';
import type { WorldType } from '../data/schema.ts';
import { PLAYER_RADIUS_DEFAULT } from '../data/world-layout.ts';
import type { Lang } from '../i18n/i18n.ts';
import type { MapSummary, ZoneResult } from './rpc.ts';
import type { MazeHole } from '../workers/analysis/maze.ts';
import type { SerializedIngestError } from './errors.ts';
import type { Camera } from '../render/camera.ts';

export type PanelId = 'map' | 'layers' | 'tiles' | 'help';
export type Theme = 'system' | 'dark' | 'light';
export type MapBackground = 'dark' | 'light' | 'checker';

export interface Settings {
  lang: Lang | null;
  theme: Theme;
  mapBackground: MapBackground;
  world: WorldType;
  pois: string[];
  cropToBiome: boolean;
  sectors: { show: boolean; manual: boolean; inner: number; outer: number };
  customRing: { on: boolean; r: number };
  grids: { chunk: boolean; mob: boolean };
  maze: { small: boolean; medium: boolean; large: boolean };
  player: { on: boolean; x: number; y: number; r: number; color: string };
  alpha: { rings: number; sectors: number; grid: number; dim: number };
  highlight: string[];
  pickedColor: number | null;
  paint: { on: boolean; color: string };
  panel: PanelId | null;
  onlyOnMap: boolean;
  liveRefresh: boolean;
  /** Set after the first map load, when the Layers panel is opened once as the next step. */
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: null,
  theme: 'system',
  mapBackground: 'dark',
  world: 'standard',
  pois: [],
  cropToBiome: true,
  sectors: { show: false, manual: false, inner: 0, outer: 0 },
  customRing: { on: false, r: 500 },
  grids: { chunk: false, mob: false },
  maze: { small: false, medium: false, large: false },
  player: { on: false, x: 0, y: 0, r: PLAYER_RADIUS_DEFAULT, color: '#ff5a5a' },
  alpha: { rings: 0.75, sectors: 0.35, grid: 0.45, dim: 0.22 },
  highlight: [],
  pickedColor: null,
  paint: { on: false, color: '#ff2fd0' },
  panel: null,
  onlyOnMap: true,
  liveRefresh: false,
  onboarded: false,
};

const KEY = 'ckmt:settings';
const VERSION = 1;

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode or quota: settings simply don't persist */
  }
}

/** Merge stored values over defaults, keeping only fields with the default's type. */
function merge<T>(def: T, stored: unknown): T {
  if (stored === null || stored === undefined) return def;
  if (Array.isArray(def)) return (Array.isArray(stored) ? stored : def) as T;
  if (typeof def === 'object' && def !== null) {
    if (typeof stored !== 'object' || Array.isArray(stored)) return def;
    const out: Record<string, unknown> = { ...(def as Record<string, unknown>) };
    for (const k of Object.keys(out)) out[k] = merge(out[k], (stored as Record<string, unknown>)[k]);
    return out as T;
  }
  if (def === null) return stored as T;
  return (typeof stored === typeof def ? stored : def) as T;
}

export function loadSettings(): Settings {
  const raw = storageGet(KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { v?: number; data?: unknown };
      return merge(DEFAULT_SETTINGS, parsed.data);
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  // Migration from the original tool's keys.
  const legacyLang = storageGet('i18nextLng');
  return { ...DEFAULT_SETTINGS, lang: legacyLang === 'de' || legacyLang === 'en' ? legacyLang : null };
}

export function saveSettings(s: Settings): void {
  storageSet(KEY, JSON.stringify({ v: VERSION, data: s }));
}

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface FileInfo {
  name: string;
  size: number;
  lastModified: number;
  source: 'picker' | 'drop' | 'input' | 'example' | 'launch';
}

export interface Progress {
  phase: 'read' | 'decode';
  loaded: number;
  total: number;
}

export interface Analysis {
  zones: ZoneResult[];
}

export interface AppStore {
  settings: Signal<Settings>;
  status: Signal<LoadStatus>;
  progress: Signal<Progress | null>;
  error: Signal<SerializedIngestError | { kind: 'internal'; message: string } | null>;
  file: Signal<FileInfo | null>;
  summary: Signal<MapSummary | null>;
  updatedAt: Signal<number | null>;
  palette: Signal<{ colors: Uint32Array; size: number }>;
  stats: Signal<import('./rpc.ts').StatsResult | null>;
  analysis: Signal<Analysis | null>;
  maze: Signal<{ mask: Uint8Array; holes: MazeHole[] } | null>;
  mazeBusy: Signal<boolean>;
  camera: Signal<Camera>;
  hover: Signal<{ x: number; y: number; cell: number } | null>;
  live: Signal<'off' | 'watching' | 'paused' | 'unsupported'>;
  pickMode: Signal<'none' | 'tile' | 'player'>;
  canReopen: Signal<{ name: string } | null>;
}

export function createStore(): AppStore {
  const settings = signal(loadSettings(), () => false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  effect(() => {
    const s = settings.value;
    clearTimeout(timer);
    timer = setTimeout(() => saveSettings(s), 250);
  });
  return {
    settings,
    status: signal<LoadStatus>('idle'),
    progress: signal<Progress | null>(null),
    error: signal<AppStore['error']['value']>(null),
    file: signal<FileInfo | null>(null),
    summary: signal<MapSummary | null>(null),
    updatedAt: signal<number | null>(null),
    palette: signal({ colors: new Uint32Array(1), size: 1 }),
    stats: signal<AppStore['stats']['value']>(null),
    analysis: signal<Analysis | null>(null),
    maze: signal<AppStore['maze']['value']>(null),
    mazeBusy: signal(false),
    camera: signal<Camera>({ x: 0, y: 0, zoom: 1 }),
    hover: signal<AppStore['hover']['value']>(null),
    live: signal<AppStore['live']['value']>('off'),
    pickMode: signal<'none' | 'tile' | 'player'>('none'),
    canReopen: signal<{ name: string } | null>(null),
  };
}

/** Update part of the settings immutably. */
export function patchSettings(store: AppStore, patch: (s: Settings) => Partial<Settings>): void {
  const s = store.settings.peek();
  store.settings.value = { ...s, ...patch(s) };
}
