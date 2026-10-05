import type { WorldLayout, WorldType, ZoneDef } from './schema.ts';

/** Map files store the world as 256×256 tile parts; one pixel is one tile. */
export const PART_SIZE = 256;

export const CHUNK_GRID = 64;
export const MOB_GRID = 16;
export const PLAYER_RADIUS_DEFAULT = 208;

/** Unexplored rectangles that fit one of these mazes are maze-hole candidates (Rune Song quest). */
export const MAZES = [
  { id: 'small', width: 20, height: 18 },
  { id: 'medium', width: 39, height: 39 },
  { id: 'large', width: 51, height: 53 },
] as const;
export type MazeSize = (typeof MAZES)[number]['id'];

/** Maze holes are searched in the Stone sector between these radii (seeds) … */
export const MAZE_SEED_RADII = { min: 150, max: 450 } as const;
/** … and may extend up to these radii (matches the original tool's flood-fill bounds). */
export const MAZE_EXTENT_RADII = { min: 140, max: 500 } as const;

// Zone radii: corekeeper.atma.gg “World” and Fandom biome pages (inner biomes 150–450, Great Wall
// 450–520, Shimmering Frontier ring 1080–1170, Passage beyond ~1170).
const inner: ZoneDef = {
  id: 'inner',
  rMin: 150,
  rMax: 450,
  sectors: [
    { biome: 'stone', offsetDeg: 0, spanDeg: 180, evidence: { tilesets: ['Stone'], ids: ['IronOre'] } },
    { biome: 'clay', offsetDeg: 180, spanDeg: 180, evidence: { tilesets: ['Clay'], ids: ['TinOre'] } },
  ],
};

function outer(rMax: number): ZoneDef {
  return {
    id: 'outer',
    rMin: 450,
    rMax,
    sectors: [
      {
        biome: 'wilderness',
        offsetDeg: 0,
        spanDeg: 120,
        evidence: { tilesets: ['Nature'], ids: ['ScarletOre'], rgb: ['#0c732b', '#1a5d2e'] },
      },
      {
        biome: 'desert',
        offsetDeg: 120,
        spanDeg: 120,
        evidence: { tilesets: ['Desert', 'DesertTemple', 'DesertTemple2'] },
      },
      {
        biome: 'sunken_sea',
        offsetDeg: 240,
        spanDeg: 120,
        evidence: { tilesets: ['Sea', 'City'], ids: ['OctarineOre'], rgb: ['#fa59a3', '#307ccd'] },
      },
    ],
  };
}

export const WORLD_LAYOUTS: Record<WorldType, WorldLayout> = {
  standard: {
    zones: [
      inner,
      outer(1080),
      {
        id: 'shimmering',
        rMin: 1080,
        rMax: 1170,
        sectors: [{ biome: 'shimmering', offsetDeg: 0, spanDeg: 360 }],
      },
      { id: 'passage', rMin: 1170, rMax: 1350, sectors: [{ biome: 'passage', offsetDeg: 0, spanDeg: 360 }] },
    ],
  },
  // Classic (pre-1.0) worlds have no Passage and their outer biomes extend much further.
  classic: { zones: [inner, outer(2000)] },
};

/** Inner biomes that live inside another biome's sector (used to crop rings). */
export const SECTOR_ALIASES: Partial<Record<string, string>> = {
  larva_hive: 'clay',
  ruins: 'stone',
  oasis: 'desert',
};
