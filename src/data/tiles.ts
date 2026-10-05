import generated from './tiles.generated.json' with { type: 'json' };
import { biomeByTileset } from './biomes.ts';
import type { BiomeId, Hex, TileCategoryId, TileDef } from './schema.ts';

interface GeneratedTile {
  id: string;
  key: string;
  name: string;
  variant?: string;
  layer?: 'wall' | 'ground';
  rgb: string;
  tileset?: string;
  tileType?: string;
  categories: string[];
  size: number[];
}

export const TILE_DATA_INFO = {
  source: generated.source,
  license: generated.license,
  gameVersion: generated.gameVersion,
  revision: generated.revision,
};

/** UI order of the tile categories. */
export const TILE_CATEGORIES: readonly TileCategoryId[] = [
  'ores',
  'boulders',
  'liquids',
  'blocks',
  'ground',
  'ground_cover',
  'nature',
  'objects',
  'walls',
  'floors',
  'building',
  'automation',
  'special',
];

const BIOME_CATEGORY: Record<string, BiomeId> = {
  DirtBiome: 'underground',
  SlimeBiome: 'underground',
  StoneBiome: 'stone',
  ClayBiome: 'clay',
  CityBiome: 'ruins',
  NatureBiome: 'wilderness',
  MoldBiome: 'wilderness',
  SeaBiome: 'sunken_sea',
  DesertBiome: 'desert',
  LavaBiome: 'desert',
  OasisBiome: 'oasis',
  CrystalBiome: 'shimmering',
  PassageBiome: 'passage',
  ExcavationBiome: 'breakers_reach',
};

function categorize(t: GeneratedTile): TileCategoryId {
  const cats = t.categories;
  if (cats.includes('OreBoulder')) return 'boulders';
  if (t.tileType === 'ore' || t.tileType === 'ancientCrystal' || /\bOre$/.test(t.name)) return 'ores';
  if (t.tileType === 'water') return 'liquids';
  if (t.layer === 'wall') return 'blocks';
  if (t.layer === 'ground' || t.tileType === 'ground' || t.tileType === 'wateredGround') return 'ground';
  if (t.tileType === 'groundSlime' || t.tileType === 'chrysalis' || t.tileType === 'smallGrass')
    return 'ground_cover';
  if (t.tileType === 'bigRoot' || cats.includes('Plant')) return 'nature';
  if (t.tileType === 'wall') return 'walls';
  if (t.tileType === 'floor' || t.tileType === 'litFloor' || t.tileType === 'rug') return 'floors';
  if (t.tileType === 'bridge' || t.tileType === 'fence' || t.tileType === 'rail') return 'building';
  if (cats.includes('Technology') || cats.includes('Automation')) return 'automation';
  if (t.tileType === 'pit' || t.tileType === 'greatWall') return 'special';
  return 'objects';
}

function biomeOf(t: GeneratedTile): BiomeId | undefined {
  if (t.tileset && biomeByTileset.has(t.tileset)) return biomeByTileset.get(t.tileset);
  for (const c of t.categories) if (BIOME_CATEGORY[c]) return BIOME_CATEGORY[c];
  return undefined;
}

function fromGenerated(t: GeneratedTile): TileDef {
  const def: TileDef = {
    id: t.id,
    name: t.name,
    rgb: t.rgb as Hex,
    category: categorize(t),
    shape: t.size[0] === 2 && t.size[1] === 2 && t.categories.includes('OreBoulder') ? 'block2x2' : 'single',
    source: 'wiki',
  };
  if (t.variant) def.variant = t.variant;
  if (t.layer) def.layer = t.layer;
  if (t.tileset) def.tileset = t.tileset;
  const biome = biomeOf(t);
  if (biome) def.biome = biome;
  return def;
}

/**
 * Colours observed on real maps by contributors of the original tool that the wiki does not list
 * (older colour revisions or tiles the wiki data lacks). Keep this list short; prefer fixing the wiki.
 */
// prettier-ignore
const LEGACY_TILES: TileDef[] = [
  { id: 'legacy:lava_2', name: 'Lava', rgb: '#cc4421', category: 'liquids', shape: 'single', source: 'legacy' },
  { id: 'legacy:dark_stone_block', name: 'Dark Stone Block', rgb: '#7b8cac', category: 'blocks', shape: 'single', biome: 'stone', source: 'legacy' },
  { id: 'legacy:caveling_floor_tile', name: 'Caveling Floor Tile', rgb: '#828282', category: 'floors', shape: 'single', biome: 'stone', source: 'legacy' },
  { id: 'legacy:electrical_wire', name: 'Electrical Wire', rgb: '#595049', category: 'automation', shape: 'single', source: 'legacy' },
  { id: 'legacy:clay_pot', name: 'Clay Pot', rgb: '#633013', category: 'objects', shape: 'single', biome: 'clay', source: 'legacy' },
  { id: 'legacy:jellyfish', name: 'Beached Jelly', rgb: '#307ccd', category: 'objects', shape: 'single', biome: 'sunken_sea', source: 'legacy' },
  { id: 'legacy:ancient_wire', name: 'Indestructible Ancient Wire', rgb: '#425d5e', category: 'objects', shape: 'single', source: 'legacy' },
  { id: 'legacy:tilled_grass', name: 'Tilled Grass Ground', rgb: '#0c732b', category: 'ground', shape: 'single', biome: 'wilderness', source: 'legacy' },
  { id: 'legacy:watered_grass', name: 'Watered Grass Ground', rgb: '#1a5d2e', category: 'ground', shape: 'single', biome: 'wilderness', source: 'legacy' },
  { id: 'legacy:coral_wood', name: 'Coral Wood', rgb: '#fa59a3', category: 'nature', shape: 'single', biome: 'sunken_sea', source: 'legacy' },
];

/** Names for merged groups where the automatic name would be unwieldy. */
const GROUP_NAMES: Partial<Record<string, string>> = {
  '#818181': 'Caveling Floor Tile',
};

const SIZE_WORD = /^(Large|Medium|Small)\s+/i;

/** One readable name for tiles that look identical on the map. */
function groupName(list: readonly TileDef[]): string {
  const override = GROUP_NAMES[list[0]!.rgb];
  if (override) return override;
  const names = [...new Set(list.map((t) => t.name.replace(SIZE_WORD, '').trim()))];
  if (names.length === 1) return names[0]!;
  // "Conveyor Belt" + "Conveyor Belt Splitter" → "Conveyor Belt"
  const shortest = names.reduce((a, b) => (b.length < a.length ? b : a));
  if (names.every((n) => n.startsWith(shortest))) return shortest;
  return names.length <= 3 ? names.join(' / ') : `${names[0]} +${names.length - 1}`;
}

/**
 * Tiles with the same colour, category and shape can't be told apart on the map (conveyor
 * directions, crate and vessel sizes, …), so they become one entry. Ore vs. boulder stays separate
 * because the 2×2 rule distinguishes them.
 */
function mergeIdentical(tiles: readonly TileDef[]): { merged: TileDef[]; aliases: Map<string, TileDef> } {
  const groups = new Map<string, TileDef[]>();
  for (const t of tiles) {
    const key = `${t.rgb}|${t.category}|${t.shape}|${t.layer ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const merged: TileDef[] = [];
  const aliases = new Map<string, TileDef>();
  for (const list of groups.values()) {
    const first = list[0]!;
    if (list.length === 1) {
      merged.push(first);
      continue;
    }
    const def: TileDef = {
      id: first.id,
      name: groupName(list),
      rgb: first.rgb,
      category: first.category,
      shape: first.shape,
      source: list.every((t) => t.source === 'wiki') ? 'wiki' : 'legacy',
      members: [...new Set(list.map((t) => t.name + (t.variant ? ` (${t.variant})` : '')))],
    };
    if (first.layer) def.layer = first.layer;
    if (list.every((t) => t.biome === first.biome) && first.biome) def.biome = first.biome;
    if (list.every((t) => t.tileset === first.tileset) && first.tileset) def.tileset = first.tileset;
    merged.push(def);
    for (const t of list) aliases.set(t.id, def);
  }
  return { merged, aliases };
}

const { merged: MERGED, aliases: ALIASES } = mergeIdentical([
  ...(generated.tiles as GeneratedTile[]).map(fromGenerated),
  ...LEGACY_TILES,
]);

export const TILES: readonly TileDef[] = MERGED;

/** Lookup by id; ids of tiles merged into a group resolve to the group (keeps old settings working). */
export const tileById: ReadonlyMap<string, TileDef> = new Map([
  ...ALIASES,
  ...TILES.map((t) => [t.id, t] as const),
]);

export function hexToInt(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

export function intToHex(rgb: number): Hex {
  return `#${rgb.toString(16).padStart(6, '0')}`;
}

/** All tiles sharing a 24-bit colour (ore + boulder, crate sizes, …). */
export const tilesByRgb: ReadonlyMap<number, readonly TileDef[]> = (() => {
  const m = new Map<number, TileDef[]>();
  for (const t of TILES) {
    const k = hexToInt(t.rgb);
    const list = m.get(k);
    if (list) list.push(t);
    else m.set(k, [t]);
  }
  return m;
})();
