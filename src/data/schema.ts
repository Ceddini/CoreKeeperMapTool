export type Hex = `#${string}`;

export type WorldType = 'standard' | 'classic';

export type BiomeId =
  | 'underground'
  | 'stone'
  | 'clay'
  | 'larva_hive'
  | 'ruins'
  | 'wilderness'
  | 'sunken_sea'
  | 'desert'
  | 'shimmering'
  | 'passage'
  | 'oasis'
  | 'breakers_reach';

export type TileCategoryId =
  | 'ores'
  | 'boulders'
  | 'liquids'
  | 'blocks'
  | 'ground'
  | 'ground_cover'
  | 'nature'
  | 'objects'
  | 'floors'
  | 'walls'
  | 'building'
  | 'automation'
  | 'special';

export interface TileDef {
  id: string;
  /** English display name (localised names live in locales/<lang>/tiles.json, keyed by id). */
  name: string;
  variant?: string;
  layer?: 'wall' | 'ground';
  rgb: Hex;
  category: TileCategoryId;
  /** `block2x2` tiles (boulders) only count where a 2×2 block of the same colour exists. */
  shape: 'single' | 'block2x2';
  biome?: BiomeId;
  tileset?: string;
  source: 'wiki' | 'legacy';
  /** Names of identical-looking tiles merged into this entry (conveyor directions, crate sizes, …). */
  members?: string[];
}

/** Selects tiles that count as evidence for a biome during sector detection. */
export interface TileSelector {
  tilesets?: string[];
  ids?: string[];
  rgb?: Hex[];
}

export interface ZoneSector {
  biome: BiomeId;
  /** Degrees clockwise from the zone rotation (compass convention: 0 = north). */
  offsetDeg: number;
  spanDeg: number;
  evidence?: TileSelector;
}

export interface ZoneDef {
  id: 'inner' | 'outer' | 'shimmering' | 'passage';
  rMin: number;
  rMax: number;
  /** Zones with more than one sector have an unknown rotation that is detected from the map. */
  sectors: ZoneSector[];
}

export interface WorldLayout {
  zones: ZoneDef[];
}

export type PoiKind = 'boss' | 'optional_boss' | 'poi' | 'merchant';

export interface PoiDef {
  id: string;
  kind: PoiKind;
  /** Biomes the POI spawns in. Rings are cropped to these biomes' sectors. */
  biomes: BiomeId[];
  /** Distances from the Core per world type. Missing = distance unknown (biome sector only). */
  radii: Partial<Record<WorldType, number[]>>;
  /** Distance ranges [from, to] (roaming bosses, or where only a range is known). */
  bands?: Partial<Record<WorldType, [number, number][]>>;
  /** Where no area can be drawn (e.g. Breaker's Reach, "far north"): a labelled hint position. */
  hint?: Partial<Record<WorldType, { bearingDeg: number; r: number }>>;
  color: Hex;
  icon?: string;
  since: string;
}
