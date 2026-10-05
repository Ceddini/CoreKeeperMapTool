/**
 * Imports map tile colours from the Core Keeper Fandom wiki (Module:ObjectInfo/data) and writes
 * src/data/tiles.generated.json. Run manually after a game update:  npm run data:import
 *
 * The wiki content is licensed CC BY-SA; the app credits it in About.
 * `action=raw` is behind a Cloudflare challenge, so the module source is read through the MediaWiki API.
 */
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
const luaparse = require('luaparse') as {
  parse(src: string, opts: Record<string, unknown>): { body: { arguments: LuaNode[] }[] };
};

const API =
  'https://corekeeper.fandom.com/api.php?action=query&prop=revisions&titles=Module:ObjectInfo/data' +
  '&rvprop=content|timestamp&rvslots=main&format=json&formatversion=2';
const CACHE = '.cache/objectinfo-data.json';
const OUT = 'src/data/tiles.generated.json';

interface LuaNode {
  type: string;
  raw?: string;
  value?: unknown;
  argument?: LuaNode;
  fields?: { type: string; key?: LuaNode & { name?: string }; value: LuaNode }[];
}

type LuaValue = string | number | boolean | null | LuaValue[] | { [k: string]: LuaValue };

function toValue(n: LuaNode): LuaValue {
  switch (n.type) {
    case 'StringLiteral':
      return JSON.parse('"' + n.raw!.slice(1, -1).replace(/\\'/g, "'") + '"') as string;
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return n.value as number | boolean;
    case 'NilLiteral':
      return null;
    case 'UnaryExpression':
      return -(toValue(n.argument!) as number);
    case 'TableConstructorExpression': {
      const obj: Record<string, LuaValue> = {};
      const arr: LuaValue[] = [];
      for (const f of n.fields!) {
        if (f.type === 'TableKeyString') obj[f.key!.name!] = toValue(f.value);
        else if (f.type === 'TableKey') obj[String(toValue(f.key!))] = toValue(f.value);
        else arr.push(toValue(f.value));
      }
      return Object.keys(obj).length ? obj : arr;
    }
    default:
      return null;
  }
}

interface WikiEntry {
  name?: string;
  statenote?: string;
  type?: string;
  categories?: string[];
  size?: number[];
  area?: string;
  tileset?: string;
  tileType?: string;
  associatedGround?: string;
  associatedWall?: string;
  priority?: number;
  paintable?: boolean;
  color?: string;
  wallColor?: string;
  groundColor?: string;
}

export interface GeneratedTile {
  /** Stable id: wiki object key, plus `#variant` and `:wall` / `:ground` where needed. */
  id: string;
  key: string;
  name: string;
  variant?: string;
  layer?: 'wall' | 'ground';
  rgb: string;
  tileset?: string;
  tileType?: string;
  categories: string[];
  size: [number, number];
  priority?: number;
}

async function loadSource(): Promise<{ lua: string; timestamp: string }> {
  if (process.argv.includes('--cached') && existsSync(CACHE)) {
    return JSON.parse(await readFile(CACHE, 'utf8')) as { lua: string; timestamp: string };
  }
  const res = await fetch(API, { headers: { 'User-Agent': 'CoreKeeperMapTool data importer' } });
  if (!res.ok) throw new Error(`Wiki API returned ${res.status}`);
  const json = (await res.json()) as {
    query: { pages: { revisions: { timestamp: string; slots: { main: { content: string } } }[] }[] };
  };
  const rev = json.query.pages[0]!.revisions[0]!;
  const data = { lua: rev.slots.main.content, timestamp: rev.timestamp };
  await mkdir('.cache', { recursive: true });
  await writeFile(CACHE, JSON.stringify(data));
  return data;
}

function normalizeHex(hex: string): string {
  const h = hex.trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(h)) throw new Error(`Bad colour ${hex}`);
  return h;
}

function titleFromKey(key: string): string {
  return key
    .replace(/block$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

function extract(root: Record<string, Record<string, WikiEntry>>): GeneratedTile[] {
  const tiles: GeneratedTile[] = [];
  // Ground colours already covered by a wall entry (wall blocks carry both colours).
  const coveredGround = new Set<string>();
  for (const variants of Object.values(root)) {
    for (const e of Object.values(variants ?? {})) {
      if (e?.associatedGround && e.groundColor) coveredGround.add(e.associatedGround);
    }
  }

  for (const [key, variants] of Object.entries(root)) {
    if (!variants || typeof variants !== 'object') continue;
    const entries = Object.entries(variants);
    for (const [variantKey, e] of entries) {
      if (!e || typeof e !== 'object') continue;
      if (!e.color && !e.wallColor && !e.groundColor) continue;
      if (!e.name && coveredGround.has(key)) continue;

      const name = e.name ?? titleFromKey(key);
      const multiVariant = entries.length > 1 && variantKey !== '0';
      const base: Omit<GeneratedTile, 'id' | 'rgb'> = {
        key,
        name,
        categories: (e.categories ?? []).filter((c) => typeof c === 'string'),
        size: [e.size?.[0] ?? 1, e.size?.[1] ?? 1],
      };
      if (e.statenote && (multiVariant || entries.length > 1)) base.variant = e.statenote;
      if (e.tileset) base.tileset = e.tileset;
      if (e.tileType) base.tileType = e.tileType;
      if (e.priority !== undefined) base.priority = e.priority;
      const idBase = variantKey === '0' ? key : `${key}#${variantKey}`;

      if (e.wallColor || e.groundColor) {
        if (e.wallColor)
          tiles.push({ ...base, id: `${idBase}:wall`, layer: 'wall', rgb: normalizeHex(e.wallColor) });
        if (e.groundColor)
          tiles.push({ ...base, id: `${idBase}:ground`, layer: 'ground', rgb: normalizeHex(e.groundColor) });
      } else {
        tiles.push({ ...base, id: idBase, rgb: normalizeHex(e.color!) });
      }
    }
  }
  return dedupe(tiles, root);
}

/**
 * Wall blocks repeat the colour of their named ground tile, and many variants (crates, conveyors,
 * fences in the same colour) are indistinguishable on the map. Keep one entry per (name, colour).
 */
function dedupe(tiles: GeneratedTile[], root: Record<string, Record<string, WikiEntry>>): GeneratedTile[] {
  const namedGround = new Set(
    Object.entries(root)
      .filter(([, v]) => v?.['0']?.name && (v['0'].color || v['0'].groundColor))
      .map(([k]) => k),
  );
  const seen = new Set<string>();
  const out: GeneratedTile[] = [];
  for (const t of tiles) {
    if (t.layer === 'ground') {
      const assoc = root[t.key]?.['0']?.associatedGround;
      if (assoc && namedGround.has(assoc)) continue;
    }
    const sig = `${t.name}|${t.variant ?? ''}|${t.rgb}`;
    const sigNoVariant = `${t.name}||${t.rgb}`;
    if (seen.has(sig) || seen.has(sigNoVariant)) continue;
    seen.add(sig);
    out.push(t);
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

function report(prev: GeneratedTile[], next: GeneratedTile[]): void {
  const p = new Map(prev.map((t) => [t.id, t]));
  const n = new Map(next.map((t) => [t.id, t]));
  const added = next.filter((t) => !p.has(t.id));
  const removed = prev.filter((t) => !n.has(t.id));
  const changed = next.filter((t) => p.has(t.id) && p.get(t.id)!.rgb !== t.rgb);
  console.log(
    `tiles: ${next.length} (added ${added.length}, removed ${removed.length}, recoloured ${changed.length})`,
  );
  for (const t of added) console.log(`  + ${t.id} ${t.rgb} ${t.name}`);
  for (const t of removed) console.log(`  - ${t.id} ${t.rgb} ${t.name}`);
  for (const t of changed) console.log(`  ~ ${t.id} ${p.get(t.id)!.rgb} -> ${t.rgb}`);
}

const { lua, timestamp } = await loadSource();
const versionMatch = /^--\s*([\d.]+)/.exec(lua);
const ast = luaparse.parse(lua, { comments: false, luaVersion: '5.1' });
const root = toValue(ast.body[0]!.arguments[0]!) as unknown as Record<string, Record<string, WikiEntry>>;
const tiles = extract(root);

let prev: GeneratedTile[] = [];
if (existsSync(OUT)) prev = (JSON.parse(await readFile(OUT, 'utf8')) as { tiles: GeneratedTile[] }).tiles;
report(prev, tiles);

await writeFile(
  OUT,
  JSON.stringify(
    {
      source: 'https://corekeeper.fandom.com/wiki/Module:ObjectInfo/data',
      license: 'CC BY-SA 3.0',
      gameVersion: versionMatch?.[1] ?? 'unknown',
      revision: timestamp,
      tiles,
    },
    null,
    1,
  ) + '\n',
);
console.log(`wrote ${OUT} (game data ${versionMatch?.[1]}, wiki revision ${timestamp})`);
