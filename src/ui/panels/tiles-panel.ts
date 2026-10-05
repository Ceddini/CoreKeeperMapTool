import type { Ctx } from '../../app/context.ts';
import { computed, signal } from '../../core/signals.ts';
import { patchSettings } from '../../core/store.ts';
import type { TileCategoryId, TileDef } from '../../data/schema.ts';
import { TILES, TILE_CATEGORIES, hexToInt, intToHex, tileById, tilesByRgb } from '../../data/tiles.ts';
import { fmt, t, tileName, tn, type MsgKey } from '../../i18n/i18n.ts';
import { badge, button, checkRow, slider, switchControl } from '../components.ts';
import { h, uid } from '../dom.ts';
import { icon } from '../icons.ts';

export const FEEDBACK_URL = 'https://github.com/Ceddini/CoreKeeperMapTool/discussions';

export function tilesPanel(ctx: Ctx): HTMLElement {
  const { store } = ctx;
  const s = () => store.settings.value;
  const query = signal('');
  const onlyOnMap = computed(() => s().onlyOnMap);
  const pickedColor = computed(() => s().pickedColor);
  const selectedCount = computed(() => s().highlight.length + (s().pickedColor !== null ? 1 : 0));

  /** Palette index per 24-bit colour present on the map. */
  const indexByRgb = computed(() => {
    const pal = store.palette.value;
    const m = new Map<number, number>();
    for (let i = 1; i < pal.size; i++) m.set(pal.colors[i]!, i);
    return m;
  });

  const countOf = (tile: TileDef): number | null => {
    const st = store.stats.value;
    if (!st) return null;
    const idx = indexByRgb.value.get(hexToInt(tile.rgb));
    if (!idx) return 0;
    const total = st.counts[idx] ?? 0;
    const block = st.blockCounts[idx] ?? 0;
    if (tile.shape === 'block2x2') return Math.round(block / 4);
    const twins = tilesByRgb.get(hexToInt(tile.rgb)) ?? [];
    return twins.some((x) => x.shape === 'block2x2') ? total - block : total;
  };

  const filtered = computed(() => {
    const q = query.value.trim().toLowerCase();
    const only = onlyOnMap.value && !!store.stats.value;
    return TILES.filter((tile) => {
      if (
        q &&
        !tileName(tile).toLowerCase().includes(q) &&
        !tile.rgb.includes(q) &&
        !tile.members?.some((m) => m.toLowerCase().includes(q))
      )
        return false;
      if (only && !countOf(tile)) return false;
      return true;
    });
  });

  /** Ids saved before tiles were merged resolve to their merged entry. */
  const isOn = (tile: TileDef) => s().highlight.some((id) => tileById.get(id) === tile);
  const setHighlight = (tile: TileDef, on: boolean) =>
    patchSettings(store, (st) => {
      const rest = st.highlight.filter((id) => tileById.get(id) !== tile);
      return { highlight: on ? [...rest, tile.id] : rest };
    });

  const row = (tile: TileDef) =>
    checkRow({
      label: () => tileName(tile),
      checked: () => isOn(tile),
      onChange: (on) => setHighlight(tile, on),
      title: tile.members?.join(', '),
      swatch: tile.rgb,
      meta: () => {
        const n = countOf(tile);
        if (n === null) return '';
        return tile.shape === 'block2x2' && n ? `≈${fmt(n)}` : fmt(n);
      },
    });

  const groups = () => {
    const list = filtered.value;
    if (!list.length) {
      return h(
        'div',
        { class: 'empty' },
        h('p', null, t('tiles.noMatch', { q: query.value })),
        button({ label: t('tiles.clearSearch'), size: 'sm', onClick: () => (query.value = '') }),
      );
    }
    const by = new Map<TileCategoryId, TileDef[]>();
    for (const tile of list) by.set(tile.category, [...(by.get(tile.category) ?? []), tile]);
    return TILE_CATEGORIES.filter((c) => by.has(c)).map((cat) => {
      const tiles = by.get(cat)!.sort((a, b) => tileName(a).localeCompare(tileName(b)));
      const headId = uid('cat');
      return h(
        'section',
        { class: 'tile-group', 'aria-labelledby': headId },
        h(
          'h4',
          { id: headId, class: 'tile-group__title' },
          t(`tiles.cat.${cat}` as MsgKey),
          h('span', { class: 'muted' }, ` ${tiles.length}`),
        ),
        tiles.map(row),
      );
    });
  };

  const unknown = () => {
    const st = store.stats.value;
    if (!st) return null;
    const pal = store.palette.value;
    const q = query.value.trim().toLowerCase();
    const rows: { rgb: number; count: number }[] = [];
    for (let i = 1; i < pal.size; i++) {
      const rgb = pal.colors[i]!;
      if (tilesByRgb.has(rgb) || !st.counts[i]) continue;
      if (q && !intToHex(rgb).includes(q) && !t('tiles.unknown').toLowerCase().includes(q)) continue;
      rows.push({ rgb, count: st.counts[i]! });
    }
    if (!rows.length) return null;
    rows.sort((a, b) => b.count - a.count);
    return h(
      'section',
      { class: 'tile-group' },
      h('h4', { class: 'tile-group__title' }, t('tiles.unknown'), ' ', badge(fmt(rows.length), 'warning')),
      h('p', { class: 'muted small' }, t('tiles.unknownHelp')),
      rows.map((r) =>
        checkRow({
          label: intToHex(r.rgb),
          checked: () => s().pickedColor === r.rgb,
          onChange: (on) => patchSettings(store, () => ({ pickedColor: on ? r.rgb : null })),
          swatch: intToHex(r.rgb),
          meta: fmt(r.count),
        }),
      ),
      h(
        'a',
        {
          class: 'btn btn--ghost btn--sm',
          href: `${FEEDBACK_URL}/new?category=ideas&title=${encodeURIComponent('Unknown tile colours')}&body=${encodeURIComponent(
            rows.map((r) => `${intToHex(r.rgb)} (${r.count} tiles)`).join('\n'),
          )}`,
          target: '_blank',
          rel: 'noopener',
        },
        icon('external', 16),
        h('span', null, t('tiles.report')),
      ),
    );
  };

  const searchId = uid('search');

  const picked = () => {
    const rgb = pickedColor.value;
    if (rgb === null) return null;
    const known = tilesByRgb.get(rgb);
    return h(
      'div',
      { class: 'picked' },
      h('span', { class: 'swatch', style: { '--swatch': intToHex(rgb) }, 'aria-hidden': 'true' }),
      h('span', null, known ? known.map(tileName).join(' / ') : intToHex(rgb)),
      button({
        label: t('common.remove'),
        icon: 'close',
        iconOnly: true,
        size: 'sm',
        variant: 'ghost',
        onClick: () => patchSettings(store, () => ({ pickedColor: null })),
      }),
    );
  };

  const spotBar = () => {
    if (!selectedCount.value || !store.summary.value) return null;
    const busy = store.spotsBusy.value;
    const st = store.spots.value;
    const list = ctx.spots.ranked.value;
    let status: string;
    if (busy && !st) status = t('spots.finding');
    else if (!list.length) status = t('spots.none');
    else if (!st || st.index < 0) status = tn('spots.count', list.length);
    else {
      const cur = list[st.index]!;
      status = t('spots.status', {
        i: fmt(st.index + 1),
        n: fmt(list.length),
        dist: fmt(Math.round(cur.dist)),
        from: t(ctx.spots.origin.value === 'marker' ? 'spots.fromMarker' : 'spots.fromCore'),
        size: tn('spots.tiles', cur.count),
      });
    }
    const first = !st || st.index < 0;
    return h(
      'div',
      { class: 'spot-bar' },
      button({
        label: t('spots.prev'),
        icon: 'prev',
        iconOnly: true,
        size: 'sm',
        disabled: !list.length,
        onClick: () => ctx.spots.prev(),
        kbd: 'Shift+N',
      }),
      button({
        label: first ? t('spots.nearest') : t('spots.next'),
        icon: 'next',
        size: 'sm',
        variant: 'primary',
        disabled: !list.length,
        onClick: () => ctx.spots.next(),
        kbd: 'N',
      }),
      h('span', { class: 'spot-bar__status', role: 'status', 'aria-live': 'polite' }, status),
    );
  };

  return h(
    'div',
    { class: 'panel-content panel-content--tiles' },
    h(
      'div',
      { class: 'tiles-toolbar' },
      h('label', { for: searchId, class: 'visually-hidden' }, () => t('tiles.search')),
      h(
        'div',
        { class: 'search' },
        icon('search', 16),
        h('input', {
          id: searchId,
          type: 'search',
          class: 'input search__input',
          placeholder: () => t('tiles.searchPlaceholder'),
          value: () => query.value,
          onInput: (e: Event) => (query.value = (e.target as HTMLInputElement).value),
          autocomplete: 'off',
          spellcheck: 'false',
        }),
      ),
      h(
        'div',
        { class: 'tiles-toolbar__row' },
        switchControl({
          label: () => t('tiles.onlyOnMap'),
          checked: () => s().onlyOnMap,
          onChange: (onlyOnMap) => patchSettings(store, () => ({ onlyOnMap })),
          disabled: () => !store.stats.value,
        }),
        button({
          label: () => (store.pickMode.value === 'tile' ? t('tiles.picking') : t('tiles.pick')),
          icon: 'pipette',
          size: 'sm',
          pressed: () => store.pickMode.value === 'tile',
          disabled: () => !store.summary.value,
          onClick: () => (store.pickMode.value = store.pickMode.value === 'tile' ? 'none' : 'tile'),
        }),
      ),
      () =>
        selectedCount.value
          ? h(
              'div',
              { class: 'selection-bar' },
              h('span', null, t('tiles.selected', { n: selectedCount.value })),
              button({
                label: t('tiles.clear'),
                size: 'sm',
                variant: 'ghost',
                onClick: () => patchSettings(store, () => ({ highlight: [], pickedColor: null })),
              }),
            )
          : null,
      picked,
      spotBar,
    ),
    h('div', { class: 'tile-list' }, groups, unknown),
    h(
      'details',
      { class: 'section section--footer' },
      h(
        'summary',
        { class: 'section__summary' },
        h('h3', { class: 'section__title' }, () => t('tiles.style')),
        h('span', { class: 'section__chevron', 'aria-hidden': 'true' }, icon('chevron', 16)),
      ),
      h(
        'div',
        { class: 'section__body' },
        slider({
          label: () => t('tiles.dim'),
          value: () => s().alpha.dim,
          min: 0,
          max: 1,
          percent: true,
          onInput: (dim) => patchSettings(store, (st) => ({ alpha: { ...st.alpha, dim } })),
        }),
        switchControl({
          label: () => t('tiles.paint'),
          description: () => t('tiles.paintDesc'),
          checked: () => s().paint.on,
          onChange: (on) => patchSettings(store, (st) => ({ paint: { ...st.paint, on } })),
        }),
        h(
          'label',
          { class: 'color-input color-input--labelled' },
          h('span', null, () => t('tiles.paintColor')),
          h('input', {
            type: 'color',
            value: () => s().paint.color,
            onInput: (e: Event) => {
              const color = (e.target as HTMLInputElement).value;
              patchSettings(store, (st) => ({ paint: { ...st.paint, color } }));
            },
          }),
        ),
      ),
    ),
  );
}
