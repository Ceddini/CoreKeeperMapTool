import { computed, type ReadSignal } from '../core/signals.ts';
import type { AppStore, Spot } from '../core/store.ts';
import type { MapView } from './map-view.ts';

export interface RankedSpot extends Spot {
  dist: number;
}

export interface SpotNav {
  /** Spots sorted by distance from the origin (nearest first). */
  ranked: ReadSignal<RankedSpot[]>;
  /** Distances are measured from the player marker when it is shown, else from the Core. */
  origin: ReadSignal<'core' | 'marker'>;
  next(): void;
  prev(): void;
}

export function createSpotNav(store: AppStore, view: MapView): SpotNav {
  const origin = computed<'core' | 'marker'>(() => (store.settings.value.player.on ? 'marker' : 'core'));
  const originPos = computed(() => {
    const p = store.settings.value.player;
    return p.on ? { x: p.x + 0.5, y: p.y + 0.5 } : { x: 0, y: 0 };
  });

  const ranked = computed<RankedSpot[]>(() => {
    const s = store.spots.value;
    if (!s) return [];
    const o = originPos.value;
    return s.all
      .map((sp) => ({ ...sp, dist: Math.hypot(sp.x + 0.5 - o.x, sp.y + 0.5 - o.y) }))
      .sort((a, b) => a.dist - b.dist);
  });

  const go = (step: 1 | -1) => {
    const s = store.spots.peek();
    const list = ranked.peek();
    if (!s || !list.length) return;
    const index =
      s.index < 0 ? (step > 0 ? 0 : list.length - 1) : (s.index + step + list.length) % list.length;
    store.spots.value = { ...s, index };
    view.focusSpot(list[index]!);
  };

  return { ranked, origin, next: () => go(1), prev: () => go(-1) };
}
