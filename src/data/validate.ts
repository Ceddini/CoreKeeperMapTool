import { BIOMES, biomeById } from './biomes.ts';
import { POIS } from './pois.ts';
import { TILES, hexToInt } from './tiles.ts';
import { SECTOR_ALIASES, WORLD_LAYOUTS } from './world-layout.ts';
import type { WorldType } from './schema.ts';

export interface DataIssue {
  level: 'error' | 'warning';
  message: string;
}

/** Shapes or groups that may legitimately share a colour with each other. */
function sharesAllowed(a: (typeof TILES)[number], b: (typeof TILES)[number]): boolean {
  if (a.shape !== b.shape) return true; // ore vs boulder: told apart by the 2×2 rule
  if (a.category === b.category) return true; // crate sizes, conveyor directions, …
  return false;
}

export function validateData(opts: { iconExists?: (file: string) => boolean } = {}): DataIssue[] {
  const issues: DataIssue[] = [];
  const err = (message: string) => issues.push({ level: 'error', message });
  const warn = (message: string) => issues.push({ level: 'warning', message });

  const ids = new Set<string>();
  for (const t of TILES) {
    if (ids.has(t.id)) err(`duplicate tile id ${t.id}`);
    ids.add(t.id);
    if (!/^#[0-9a-f]{6}$/.test(t.rgb)) err(`tile ${t.id} has invalid colour ${t.rgb}`);
    if (t.biome && !biomeById.has(t.biome)) err(`tile ${t.id} references unknown biome ${t.biome}`);
  }

  const byRgb = new Map<number, (typeof TILES)[number][]>();
  for (const t of TILES) {
    const k = hexToInt(t.rgb);
    byRgb.set(k, [...(byRgb.get(k) ?? []), t]);
  }
  for (const group of byRgb.values()) {
    for (let i = 1; i < group.length; i++) {
      if (!sharesAllowed(group[0]!, group[i]!))
        warn(`colour ${group[0]!.rgb} shared by "${group[0]!.name}" and "${group[i]!.name}"`);
    }
  }

  const poiIds = new Set<string>();
  for (const p of POIS) {
    if (poiIds.has(p.id)) err(`duplicate poi id ${p.id}`);
    poiIds.add(p.id);
    for (const b of p.biomes) if (!biomeById.has(b)) err(`poi ${p.id} references unknown biome ${b}`);
    if (p.icon && opts.iconExists && !opts.iconExists(p.icon)) err(`poi ${p.id} icon ${p.icon} is missing`);
    for (const world of Object.keys(p.radii) as WorldType[]) {
      const zones = WORLD_LAYOUTS[world].zones;
      for (const r of [...(p.radii[world] ?? []), ...(p.bands?.[world] ?? []).flat()]) {
        const biome = SECTOR_ALIASES[p.biomes[0]!] ?? p.biomes[0]!;
        const zone = zones.find((z) => z.sectors.some((s) => s.biome === biome));
        if (zone && (r < zone.rMin || r > zone.rMax))
          warn(
            `poi ${p.id} radius ${r} (${world}) lies outside its ${zone.id} zone ${zone.rMin}–${zone.rMax}`,
          );
      }
    }
  }

  for (const [world, layout] of Object.entries(WORLD_LAYOUTS)) {
    for (const z of layout.zones) {
      const total = z.sectors.reduce((s, x) => s + x.spanDeg, 0);
      if (total !== 360) err(`${world} zone ${z.id} sectors cover ${total}° instead of 360°`);
      for (const s of z.sectors) {
        if (!biomeById.has(s.biome)) err(`${world} zone ${z.id} references unknown biome ${s.biome}`);
        for (const id of s.evidence?.ids ?? []) if (!ids.has(id)) err(`evidence tile ${id} does not exist`);
      }
    }
  }

  if (BIOMES.length === 0) err('no biomes defined');
  return issues;
}
