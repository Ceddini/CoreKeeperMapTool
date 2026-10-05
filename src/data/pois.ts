import type { PoiDef } from './schema.ts';

/**
 * Bosses and points of interest. `radii.standard` are 1.0+ world distances from the Core;
 * `radii.classic` are pre-1.0 ("Classic") world distances. `bands` are distance ranges where the
 * wiki only gives a range or the boss roams. With neither, the POI spawns anywhere in its biome and
 * the UI shows the biome area.
 *
 * Sources: Core Keeper Wiki on Fandom (boss, merchant and place pages, retrieved 2026-10-05) and
 * corekeeper.atma.gg (World, Atlantean Worm). Icons are file names in src/assets/poi/.
 */
// prettier-ignore
export const POIS: readonly PoiDef[] = [
  // Bosses
  { id: 'glurch', kind: 'boss', biomes: ['underground'], radii: { standard: [65], classic: [65] }, color: '#d95917', icon: 'glurch.webp', since: '0.1' },
  { id: 'ghorm', kind: 'boss', biomes: ['stone', 'clay'], radii: { standard: [200], classic: [250] }, color: '#7f5f30', icon: 'ghorm.png', since: '0.1' },
  { id: 'malugaz', kind: 'boss', biomes: ['ruins'], radii: { standard: [300], classic: [350] }, color: '#1f4ec9', icon: 'malugaz.png', since: '0.1' },
  { id: 'azeos', kind: 'boss', biomes: ['wilderness'], radii: { standard: [550], classic: [600] }, color: '#d2b835', icon: 'azeos.png', since: '0.3' },
  { id: 'omoroth', kind: 'boss', biomes: ['sunken_sea'], radii: { standard: [650], classic: [1100] }, color: '#9e3f9b', icon: 'omoroth.png', since: '0.4' },
  { id: 'ra_akar', kind: 'boss', biomes: ['desert'], radii: { standard: [600], classic: [1000] }, color: '#1d9124', icon: 'ra_akar.png', since: '0.5' },
  { id: 'core_commander', kind: 'boss', biomes: ['desert'], radii: { standard: [700] }, color: '#143fb0', icon: 'core_commander.webp', since: '1.0' },

  // Optional bosses
  { id: 'hive_mother', kind: 'optional_boss', biomes: ['larva_hive'], radii: { standard: [330], classic: [330] }, color: '#fca694', icon: 'hive_mother.png', since: '0.1' },
  { id: 'ivy', kind: 'optional_boss', biomes: ['wilderness'], radii: { standard: [600], classic: [900] }, color: '#ff00ff', icon: 'ivy.png', since: '0.3' },
  { id: 'morpha', kind: 'optional_boss', biomes: ['sunken_sea'], radii: { standard: [700], classic: [1400] }, color: '#1898f4', icon: 'morpha.png', since: '0.4' },
  { id: 'igneous', kind: 'optional_boss', biomes: ['desert'], radii: { standard: [650], classic: [1400] }, color: '#484454', icon: 'igneous.png', since: '0.5' },
  { id: 'urschleim', kind: 'optional_boss', biomes: ['passage'], radii: { standard: [1260] }, color: '#ff62dd', icon: 'urschleim.webp', since: '1.0' },
  { id: 'druidra', kind: 'optional_boss', biomes: ['wilderness'], radii: {}, color: '#5fae3c', icon: 'druidra.webp', since: '1.0' },
  { id: 'crydra', kind: 'optional_boss', biomes: ['sunken_sea'], radii: {}, color: '#5ec8f0', icon: 'crydra.webp', since: '1.0' },
  { id: 'pyrdra', kind: 'optional_boss', biomes: ['desert'], radii: {}, color: '#e8622c', icon: 'pyrdra.webp', since: '1.0' },
  { id: 'atlantean_worm', kind: 'optional_boss', biomes: ['sunken_sea'], radii: {}, bands: { standard: [[800, 1000]] }, color: '#2f6db5', icon: 'atlantean_worm.webp', since: '1.0' },
  { id: 'nimruza', kind: 'optional_boss', biomes: ['desert'], radii: {}, color: '#c9a227', icon: 'nimruza.webp', since: '1.1' },
  { id: 'sahabar', kind: 'optional_boss', biomes: ['breakers_reach'], radii: {}, color: '#8a8f98', icon: 'sahabar.webp', since: '1.2' },
  { id: 'oblidra', kind: 'optional_boss', biomes: ['breakers_reach'], radii: {}, color: '#7b3fb0', icon: 'oblidra.webp', since: '1.2' },

  // Points of interest
  { id: 'mold_dungeon', kind: 'poi', biomes: ['wilderness'], radii: { standard: [700], classic: [750] }, color: '#6cbbe0', icon: 'poisonous_sickle.png', since: '0.3' },
  { id: 'the_vault', kind: 'poi', biomes: ['sunken_sea'], radii: { standard: [500], classic: [1000] }, color: '#e4ad2a', icon: 'glyph_parchment.png', since: '0.4' },
  { id: 'broken_core_1', kind: 'poi', biomes: ['sunken_sea'], radii: { classic: [1250] }, bands: { standard: [[550, 600]] }, color: '#e4ad2a', icon: 'channeling_gemstone.png', since: '0.4' },
  { id: 'broken_core_2', kind: 'poi', biomes: ['sunken_sea'], radii: { classic: [1550] }, bands: { standard: [[650, 700]] }, color: '#e4ad2a', icon: 'fractured_limbs.png', since: '0.4' },
  { id: 'broken_core_3', kind: 'poi', biomes: ['sunken_sea'], radii: { classic: [1750] }, bands: { standard: [[750, 800]] }, color: '#e4ad2a', icon: 'energy_string.png', since: '0.4' },
  { id: 'titan_temple', kind: 'poi', biomes: ['desert'], radii: { standard: [650], classic: [900] }, color: '#f2df3a', icon: 'godsent_king_mask.png', since: '0.5' },
  { id: 'prince_dungeon', kind: 'poi', biomes: ['desert'], radii: { standard: [500], classic: [1100] }, color: '#239029', icon: 'ra_akar_automaton.png', since: '0.5' },
  { id: 'queen_dungeon', kind: 'poi', biomes: ['desert'], radii: { standard: [600], classic: [1300] }, color: '#a555a4', icon: 'azeos_feather_fan.png', since: '0.5' },
  { id: 'king_dungeon', kind: 'poi', biomes: ['desert'], radii: { standard: [700], classic: [1500] }, color: '#19bdc6', icon: 'omoroth_compass.png', since: '0.5' },
  { id: 'ancient_forge', kind: 'poi', biomes: ['desert'], radii: { standard: [650], classic: [1600] }, color: '#91210b', icon: 'soul_seeker.png', since: '0.5' },
  { id: 'crystal_meteor', kind: 'poi', biomes: ['desert'], radii: { standard: [700], classic: [1200] }, color: '#94f7dd', icon: 'crystal_meteor_shard.png', since: '0.5' },

  // Merchants (their first location, before they move in at the Core)
  { id: 'cloaked_merchant', kind: 'merchant', biomes: ['ruins'], radii: { standard: [270] }, color: '#4fa7c9', icon: 'cloaked_merchant.webp', since: '0.1' },
  { id: 'fishing_merchant', kind: 'merchant', biomes: ['wilderness'], radii: { standard: [500] }, color: '#3fb6a8', icon: 'fishing_merchant.webp', since: '0.3' },
];

export const poiById = new Map(POIS.map((p) => [p.id, p]));
