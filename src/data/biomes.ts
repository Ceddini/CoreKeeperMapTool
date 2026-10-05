import type { BiomeId, Hex } from './schema.ts';

export interface BiomeDef {
  id: BiomeId;
  /** Sector fill colour on the map (legacy colours where they existed). */
  color: Hex;
  /** Wiki tilesets whose tiles belong to this biome (used for the inspector and detection). */
  tilesets: string[];
}

export const BIOMES: readonly BiomeDef[] = [
  { id: 'underground', color: '#7f5f30', tilesets: ['Dirt'] },
  { id: 'stone', color: '#c2c2c2', tilesets: ['Stone', 'DarkStone'] },
  { id: 'clay', color: '#a66829', tilesets: ['Clay'] },
  { id: 'larva_hive', color: '#c77463', tilesets: ['LarvaHive'] },
  { id: 'ruins', color: '#4a6a78', tilesets: ['City'] },
  { id: 'wilderness', color: '#2b941b', tilesets: ['Nature', 'Mold'] },
  { id: 'sunken_sea', color: '#3b7edb', tilesets: ['Sea'] },
  { id: 'desert', color: '#cfc35d', tilesets: ['Desert', 'DesertTemple', 'DesertTemple2', 'Lava'] },
  { id: 'oasis', color: '#c77138', tilesets: ['Oasis'] },
  { id: 'shimmering', color: '#3988db', tilesets: ['Crystal', 'Alien'] },
  { id: 'passage', color: '#efefef', tilesets: ['Passage'] },
  {
    id: 'breakers_reach',
    color: '#6a6248',
    tilesets: ['Excavation', 'ExcavationDungeon', 'ExcavationRock', 'ExcavationBorder', 'ExcavationVoid'],
  },
];

export const biomeById = new Map(BIOMES.map((b) => [b.id, b]));

export const biomeByTileset = new Map<string, BiomeId>(
  BIOMES.flatMap((b) => b.tilesets.map((t) => [t, b.id] as const)),
);
