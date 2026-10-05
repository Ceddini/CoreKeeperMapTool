import { biomeById } from '../data/biomes.ts';
import { POIS } from '../data/pois.ts';
import type { BiomeId, PoiDef, WorldType, ZoneDef } from '../data/schema.ts';
import { CHUNK_GRID, MOB_GRID, SECTOR_ALIASES, WORLD_LAYOUTS } from '../data/world-layout.ts';

/** Linear RGBA in 0–1. */
export type RGBA = [number, number, number, number];

/** Angles are compass degrees: 0 = north, clockwise. Distances are in tiles from the Core. */
export type OverlayPrimitive =
  | { kind: 'ring'; r: number; halfWidth: number; color: RGBA }
  | { kind: 'sector'; r0: number; r1: number; startDeg: number; spanDeg: number; color: RGBA }
  | { kind: 'grid'; spacing: number; color: RGBA; strong: boolean }
  | { kind: 'marker'; x: number; y: number; radius: number; color: RGBA };

export interface OverlayLabel {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  icon?: string;
}

export interface OverlayScene {
  primitives: OverlayPrimitive[];
  labels: OverlayLabel[];
}

export interface OverlayInputs {
  world: WorldType;
  pois: ReadonlySet<string>;
  cropToBiome: boolean;
  sectors: { show: boolean; rotations: Partial<Record<ZoneDef['id'], number>> };
  customRing: { on: boolean; r: number };
  grids: { chunk: boolean; mob: boolean };
  player: { on: boolean; x: number; y: number; r: number; color: string };
  alpha: { rings: number; sectors: number; grid: number };
  poiName(p: PoiDef): string;
  playerLabel: string;
}

export const RING_HALF_WIDTH = 10;

export function hexToRgba(hex: string, alpha = 1): RGBA {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, alpha];
}

interface Placement {
  zone: ZoneDef;
  startDeg: number;
  spanDeg: number;
}

/** Where a biome sits in the world layout (sector start/span), given the zone rotations. */
export function placeBiome(
  world: WorldType,
  biome: BiomeId,
  rotations: Partial<Record<ZoneDef['id'], number>>,
): Placement | null {
  const target = (SECTOR_ALIASES[biome] as BiomeId | undefined) ?? biome;
  for (const zone of WORLD_LAYOUTS[world].zones) {
    const s = zone.sectors.find((x) => x.biome === target);
    if (!s) continue;
    const rot = zone.sectors.length > 1 ? (rotations[zone.id] ?? 0) : 0;
    return { zone, startDeg: (rot + s.offsetDeg) % 360, spanDeg: s.spanDeg };
  }
  return null;
}

/** Point at compass angle `deg` and distance `r` from the Core. */
export function polar(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [Math.sin(a) * r, Math.cos(a) * r];
}

export function buildOverlayScene(inp: OverlayInputs): OverlayScene {
  const primitives: OverlayPrimitive[] = [];
  const labels: OverlayLabel[] = [];
  const layout = WORLD_LAYOUTS[inp.world];

  if (inp.sectors.show) {
    for (const zone of layout.zones) {
      const rot = zone.sectors.length > 1 ? (inp.sectors.rotations[zone.id] ?? 0) : 0;
      for (const s of zone.sectors) {
        primitives.push({
          kind: 'sector',
          r0: zone.rMin,
          r1: zone.rMax,
          startDeg: (rot + s.offsetDeg) % 360,
          spanDeg: s.spanDeg,
          color: hexToRgba(biomeById.get(s.biome)!.color, inp.alpha.sectors),
        });
      }
    }
  }

  for (const poi of POIS) {
    if (!inp.pois.has(poi.id)) continue;
    const name = inp.poiName(poi);
    const label = (id: string, x: number, y: number) =>
      labels.push({ id, x, y, text: name, color: poi.color, ...(poi.icon ? { icon: poi.icon } : {}) });

    // Rings are narrow bands; wiki ranges and roaming areas are wider, fainter bands.
    const bands: { r0: number; r1: number; alpha: number; key: string }[] = [
      ...(poi.radii[inp.world] ?? []).map((r) => ({
        r0: r - RING_HALF_WIDTH,
        r1: r + RING_HALF_WIDTH,
        alpha: inp.alpha.rings,
        key: String(r),
      })),
      ...(poi.bands?.[inp.world] ?? []).map(([a, b]) => ({
        r0: a,
        r1: b,
        alpha: inp.alpha.rings * 0.55,
        key: `${a}-${b}`,
      })),
    ];

    if (!bands.length) {
      const hint = poi.hint?.[inp.world];
      if (hint) {
        const [x, y] = polar(hint.bearingDeg, hint.r);
        label(poi.id, x, y);
        continue;
      }
      // Spawns anywhere in its biome: show the biome area faintly.
      const place = placeBiome(inp.world, poi.biomes[0]!, inp.sectors.rotations);
      if (!place) continue;
      primitives.push({
        kind: 'sector',
        r0: place.zone.rMin,
        r1: place.zone.rMax,
        startDeg: place.startDeg,
        spanDeg: place.spanDeg,
        color: hexToRgba(poi.color, inp.alpha.rings * 0.35),
      });
      const [x, y] = polar(place.startDeg + place.spanDeg / 2, (place.zone.rMin + place.zone.rMax) / 2);
      label(poi.id, x, y);
      continue;
    }

    for (const band of bands) {
      const color = hexToRgba(poi.color, band.alpha);
      const mid = (band.r0 + band.r1) / 2;
      const places = inp.cropToBiome
        ? poi.biomes.map((b) => placeBiome(inp.world, b, inp.sectors.rotations))
        : [];
      const sectors = places.filter((p): p is Placement => !!p && p.spanDeg < 360);
      if (!inp.cropToBiome || sectors.length === 0 || sectors.length < places.length) {
        primitives.push({ kind: 'ring', r: mid, halfWidth: (band.r1 - band.r0) / 2, color });
        const [x, y] = polar(0, mid);
        label(`${poi.id}:${band.key}`, x, y);
        continue;
      }
      for (const p of sectors) {
        primitives.push({
          kind: 'sector',
          r0: band.r0,
          r1: band.r1,
          startDeg: p.startDeg,
          spanDeg: p.spanDeg,
          color,
        });
      }
      const first = sectors[0]!;
      const [x, y] = polar(first.startDeg + first.spanDeg / 2, mid);
      label(`${poi.id}:${band.key}`, x, y);
    }
  }

  if (inp.customRing.on && inp.customRing.r > 0) {
    primitives.push({
      kind: 'ring',
      r: inp.customRing.r,
      halfWidth: RING_HALF_WIDTH / 2,
      color: [1, 1, 1, inp.alpha.rings],
    });
  }
  if (inp.grids.mob)
    primitives.push({
      kind: 'grid',
      spacing: MOB_GRID,
      color: [0.85, 0.85, 0.85, inp.alpha.grid * 0.7],
      strong: false,
    });
  if (inp.grids.chunk)
    primitives.push({
      kind: 'grid',
      spacing: CHUNK_GRID,
      color: [0.75, 0.75, 0.75, inp.alpha.grid],
      strong: true,
    });
  if (inp.player.on) {
    primitives.push({
      kind: 'marker',
      x: inp.player.x + 0.5,
      y: inp.player.y + 0.5,
      radius: inp.player.r,
      color: hexToRgba(inp.player.color, Math.max(inp.alpha.rings, 0.6)),
    });
    labels.push({
      id: 'player',
      x: inp.player.x + 0.5,
      y: inp.player.y + 0.5,
      text: inp.playerLabel,
      color: inp.player.color,
    });
  }
  return { primitives, labels };
}
