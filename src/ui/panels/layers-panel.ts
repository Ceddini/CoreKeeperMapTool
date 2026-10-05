import type { Ctx } from '../../app/context.ts';
import { computed } from '../../core/signals.ts';
import { patchSettings, type Settings } from '../../core/store.ts';
import { POIS } from '../../data/pois.ts';
import type { PoiDef, PoiKind } from '../../data/schema.ts';
import { biomeName, fmt, poiName, t, tn, type MsgKey } from '../../i18n/i18n.ts';
import { placeBiome } from '../../render/overlay-scene.ts';
import {
  badge,
  button,
  checkRow,
  numberField,
  section,
  segmented,
  slider,
  switchControl,
} from '../components.ts';
import type { ChunkSize } from '../../data/world-layout.ts';
import { h } from '../dom.ts';
import { poiIconUrl } from '../poi-icons.ts';
import { historySection } from './history-section.ts';
import { addPin, currentPins, exportPins, focusPinName, importPins, removePin, updatePin } from '../pins.ts';
import { saveBlob } from '../../services/file-access.ts';
import { toast } from '../components.ts';
import { uid } from '../dom.ts';
import type { Pin } from '../../core/store.ts';

function pinsSection(ctx: Ctx): HTMLElement {
  const { store } = ctx;
  const pins = computed(() => currentPins(store));
  const row = (p: Pin) => {
    const nameId = uid('pin');
    return h(
      'li',
      { class: 'pin-row' },
      h(
        'label',
        { class: 'color-input pin-row__color' },
        h('span', { class: 'visually-hidden' }, t('pins.color', { name: p.label })),
        h('input', {
          type: 'color',
          value: p.color,
          onChange: (e: Event) => updatePin(store, p.id, { color: (e.target as HTMLInputElement).value }),
        }),
      ),
      h('label', { for: nameId, class: 'visually-hidden' }, t('pins.name')),
      h('input', {
        id: nameId,
        class: 'input pin-row__name',
        value: p.label,
        maxlength: '60',
        'data-pin-name': p.id,
        onChange: (e: Event) => {
          const label = (e.target as HTMLInputElement).value.trim();
          if (label) updatePin(store, p.id, { label });
        },
        onKeydown: (e: KeyboardEvent) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        },
      }),
      h('span', { class: 'pin-row__coords muted' }, `${fmt(p.x)}, ${fmt(p.y)}`),
      button({
        label: t('pins.goTo', { name: p.label }),
        icon: 'locate',
        iconOnly: true,
        size: 'sm',
        variant: 'ghost',
        onClick: () => ctx.actions.goTo(p.x + 0.5, p.y + 0.5, Math.max(store.camera.peek().zoom, 4)),
      }),
      button({
        label: t('pins.remove', { name: p.label }),
        icon: 'close',
        iconOnly: true,
        size: 'sm',
        variant: 'ghost',
        onClick: () => removePin(store, p.id),
      }),
    );
  };

  const importInput = h('input', {
    type: 'file',
    accept: '.json,application/json',
    hidden: true,
    onChange: async (e: Event) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      try {
        const n = importPins(store, await file.text());
        toast({ message: tn('pins.imported', n), tone: n ? 'success' : 'warning' });
      } catch {
        toast({ message: t('pins.importFailed'), tone: 'danger' });
      }
    },
  });

  return section({
    id: 'pins-section',
    title: () => t('pins.title'),
    badge: () => (pins.value.length ? badge(fmt(pins.value.length)) : null),
    children: [
      () => {
        if (!store.summary.value) return h('p', { class: 'muted small' }, t('pins.noMap'));
        const list = pins.value;
        return h(
          'div',
          { class: 'stack' },
          list.length
            ? [
                switchControl({
                  label: () => t('pins.show'),
                  checked: () => store.settings.value.showPins,
                  onChange: (showPins) => patchSettings(store, () => ({ showPins })),
                }),
                h('ul', { class: 'pin-list', 'aria-label': t('pins.title') }, list.map(row)),
              ]
            : h('p', { class: 'muted small' }, t('pins.empty')),
          h(
            'div',
            { class: 'button-row' },
            button({
              label: t('pins.addCenter'),
              icon: 'pin',
              size: 'sm',
              onClick: () => {
                const c = store.camera.peek();
                const pin = addPin(store, Math.floor(c.x), Math.floor(c.y));
                if (pin) focusPinName(pin.id);
              },
            }),
            list.length
              ? button({
                  label: t('pins.export'),
                  icon: 'download',
                  size: 'sm',
                  variant: 'ghost',
                  onClick: () => void saveBlob(exportPins(store), 'core-keeper-pins.json'),
                })
              : null,
            button({
              label: t('pins.import'),
              icon: 'upload',
              size: 'sm',
              variant: 'ghost',
              onClick: () => importInput.click(),
            }),
            importInput,
          ),
        );
      },
    ],
  });
}

const GROUPS: { kind: PoiKind; title: MsgKey }[] = [
  { kind: 'boss', title: 'layers.bosses' },
  { kind: 'optional_boss', title: 'layers.optionalBosses' },
  { kind: 'poi', title: 'layers.pois' },
  { kind: 'merchant', title: 'layers.merchants' },
];

export function layersPanel(ctx: Ctx): HTMLElement {
  const { store, view } = ctx;
  const s = () => store.settings.value;
  const patch = (fn: (s: Settings) => Partial<Settings>) => patchSettings(store, fn);

  /** POIs that can be shown for the current world type. */
  const world = computed(() => s().world);
  const visiblePois = computed(() => {
    const w = world.value;
    return POIS.filter(
      (p) => p.radii[w]?.length || p.bands?.[w]?.length || placeBiome(w, p.biomes[0]!, {}) !== null,
    );
  });

  const setPois = (ids: string[], on: boolean) =>
    patch((st) => {
      const set = new Set(st.pois);
      for (const id of ids) {
        if (on) set.add(id);
        else set.delete(id);
      }
      return { pois: [...set] };
    });

  const poiMeta = (p: PoiDef) => {
    const w = s().world;
    const where = p.biomes.map(biomeName).join(', ');
    const dist = [
      ...(p.radii[w] ?? []).map((x) => fmt(x)),
      ...(p.bands?.[w] ?? []).map(([a, b]) => `${fmt(a)}–${fmt(b)}`),
    ];
    if (dist.length) return `${dist.join(', ')} · ${where}`;
    return t('layers.anywhere', { biome: where });
  };

  const locations = () =>
    GROUPS.map((g) => {
      const items = visiblePois.value.filter((p) => p.kind === g.kind);
      if (!items.length) return null;
      const ids = items.map((p) => p.id);
      const count = () => ids.filter((id) => s().pois.includes(id)).length;
      return h(
        'div',
        { class: 'group', role: 'group', 'aria-label': t(g.title) },
        checkRow({
          label: () => t(g.title),
          checked: () => count() === ids.length,
          indeterminate: () => count() > 0 && count() < ids.length,
          onChange: (on) => setPois(ids, on),
          meta: () => `${count()}/${ids.length}`,
        }),
        h(
          'div',
          { class: 'group__items' },
          items.map((p) =>
            checkRow({
              label: () => poiName(p),
              checked: () => s().pois.includes(p.id),
              onChange: (on) => setPois([p.id], on),
              swatch: p.color,
              image: p.icon ? poiIconUrl(p.icon) : null,
              meta: () => poiMeta(p),
              stacked: true,
            }),
          ),
        ),
      );
    });

  const manual = computed(() => s().sectors.manual);
  const maze = computed(() => s().maze);
  const zone = (id: 'inner' | 'outer') => store.analysis.value?.zones.find((z) => z.zone === id);

  const detection = () => {
    if (!store.summary.value) return badge(t('layers.sectors.noMap'));
    if (manual.value) return badge(t('layers.sectors.manual'), 'info');
    const inner = zone('inner');
    if (!inner) return badge(t('layers.sectors.detecting'));
    // Zones nobody has explored yet say nothing about the detection quality.
    const outer = zone('outer');
    const conf = Math.min(inner.confidence, outer && outer.evidence >= 500 ? outer.confidence : 1);
    const low = inner.evidence < 500 || conf < 0.7;
    return badge(
      low ? t('layers.sectors.low') : t('layers.sectors.auto', { pct: Math.round(conf * 100) }),
      low ? 'warning' : 'success',
    );
  };

  const sectors = section({
    title: () => t('layers.sectors'),
    badge: detection,
    children: [
      switchControl({
        label: () => t('layers.sectors.show'),
        checked: () => s().sectors.show,
        onChange: (show) => patch((st) => ({ sectors: { ...st.sectors, show } })),
      }),
      switchControl({
        label: () => t('layers.crop'),
        description: () => t('layers.crop.desc'),
        checked: () => s().cropToBiome,
        onChange: (cropToBiome) => patch(() => ({ cropToBiome })),
      }),
      () => {
        if (!manual.value) {
          return h(
            'div',
            { class: 'stack' },
            () => {
              const inner = zone('inner');
              return inner && (inner.evidence < 500 || inner.confidence < 0.7)
                ? h('p', { class: 'notice notice--warning' }, t('layers.sectors.lowHelp'))
                : null;
            },
            button({
              label: () => t('layers.sectors.adjust'),
              icon: 'settings',
              size: 'sm',
              onClick: () => {
                const r = view.rotations();
                patch((st) => ({
                  sectors: {
                    ...st.sectors,
                    manual: true,
                    show: true,
                    inner: Math.round(r.inner ?? 0),
                    outer: Math.round(r.outer ?? 0),
                  },
                }));
              },
            }),
          );
        }
        return h(
          'div',
          { class: 'stack' },
          slider({
            label: () => t('layers.sectors.inner'),
            value: () => s().sectors.inner,
            min: 0,
            max: 359,
            unit: '°',
            onInput: (inner) => patch((st) => ({ sectors: { ...st.sectors, inner } })),
          }),
          slider({
            label: () => t('layers.sectors.outer'),
            value: () => s().sectors.outer,
            min: 0,
            max: 359,
            unit: '°',
            onInput: (outer) => patch((st) => ({ sectors: { ...st.sectors, outer } })),
          }),
          button({
            label: () => t('layers.sectors.resetAuto'),
            icon: 'undo',
            size: 'sm',
            onClick: () => patch((st) => ({ sectors: { ...st.sectors, manual: false } })),
          }),
        );
      },
      slider({
        label: () => t('layers.sectors.opacity'),
        value: () => s().alpha.sectors,
        min: 0.05,
        max: 1,
        percent: true,
        onInput: (v) => patch((st) => ({ alpha: { ...st.alpha, sectors: v } })),
      }),
    ],
  });

  const mazeChip = (key: 'small' | 'medium' | 'large', label: MsgKey) =>
    checkRow({
      label: () => t(label),
      checked: () => s().maze[key],
      onChange: (on) => patch((st) => ({ maze: { ...st.maze, [key]: on } })),
      swatch: key === 'small' ? '#ff00ff' : key === 'medium' ? '#00ffff' : '#1aff33',
      meta: () => {
        const holes = store.maze.value?.holes.filter((x) => x.size === key).length;
        return holes === undefined ? '' : fmt(holes);
      },
    });

  const mazeResults = () => {
    const m = maze.value;
    if (!m.small && !m.medium && !m.large) return null;
    if (!store.summary.value) return null;
    if (store.mazeBusy.value) return h('p', { class: 'muted small' }, t('layers.maze.searching'));
    const holes = (store.maze.value?.holes ?? []).filter((x) => m[x.size]);
    if (!holes.length) return h('p', { class: 'muted small' }, t('layers.maze.none'));
    return h(
      'ul',
      { class: 'result-list', 'aria-label': t('layers.maze.results') },
      holes.slice(0, 12).map((hole) =>
        h(
          'li',
          { class: 'result-list__item' },
          h(
            'span',
            null,
            h('strong', null, t(`layers.maze.${hole.size}` as MsgKey)),
            h('span', { class: 'muted' }, ` · ${fmt(Math.round(hole.fitX))}, ${fmt(Math.round(hole.fitY))}`),
          ),
          button({
            label: t('common.goTo'),
            size: 'sm',
            variant: 'ghost',
            icon: 'locate',
            onClick: () => ctx.actions.goTo(hole.fitX, hole.fitY, 4),
          }),
        ),
      ),
    );
  };

  return h(
    'div',
    { class: 'panel-content' },
    section({
      title: () => t('layers.locations'),
      badge: () => (world.value === 'classic' ? badge(t('world.classic'), 'info') : null),
      children: [
        () => (!store.summary.value ? h('p', { class: 'muted small' }, t('layers.hintLoad')) : null),
        locations,
        slider({
          label: () => t('layers.ringOpacity'),
          value: () => s().alpha.rings,
          min: 0.1,
          max: 1,
          percent: true,
          onInput: (v) => patch((st) => ({ alpha: { ...st.alpha, rings: v } })),
        }),
      ],
    }),
    pinsSection(ctx),
    sectors,
    historySection(ctx),
    section({
      title: () => t('layers.maze'),
      open: false,
      children: [
        h('p', { class: 'muted small' }, () => t('layers.maze.desc')),
        h(
          'div',
          { class: 'group__items' },
          mazeChip('large', 'layers.maze.large'),
          mazeChip('medium', 'layers.maze.medium'),
          mazeChip('small', 'layers.maze.small'),
        ),
        mazeResults,
      ],
    }),
    section({
      title: () => t('layers.grids'),
      open: false,
      children: [
        switchControl({
          label: () => t('layers.grids.chunk'),
          description: () => t('layers.grids.chunkDesc'),
          checked: () => s().grids.chunk,
          onChange: (chunk) => patch((st) => ({ grids: { ...st.grids, chunk } })),
        }),
        segmented<ChunkSize>({
          label: () => t('layers.grids.chunkSize'),
          options: [
            {
              value: 'auto',
              label: () => t('layers.grids.chunkAuto', { size: s().world === 'classic' ? 64 : 256 }),
            },
            { value: '64', label: '64 × 64' },
            { value: '256', label: '256 × 256' },
          ],
          value: () => s().grids.chunkSize,
          onChange: (chunkSize) => patch((st) => ({ grids: { ...st.grids, chunkSize } })),
        }),
        switchControl({
          label: () => t('layers.grids.mob'),
          description: () => t('layers.grids.mobDesc'),
          checked: () => s().grids.mob,
          onChange: (mob) => patch((st) => ({ grids: { ...st.grids, mob } })),
        }),
        slider({
          label: () => t('layers.grids.opacity'),
          value: () => s().alpha.grid,
          min: 0.1,
          max: 1,
          percent: true,
          onInput: (v) => patch((st) => ({ alpha: { ...st.alpha, grid: v } })),
        }),
      ],
    }),
    section({
      title: () => t('layers.player'),
      open: false,
      children: [
        switchControl({
          label: () => t('layers.player.show'),
          description: () => t('layers.player.desc'),
          checked: () => s().player.on,
          onChange: (on) => patch((st) => ({ player: { ...st.player, on } })),
        }),
        h(
          'div',
          { class: 'field-row' },
          numberField({
            label: 'X',
            value: () => s().player.x,
            onChange: (x) => patch((st) => ({ player: { ...st.player, x } })),
          }),
          numberField({
            label: 'Y',
            value: () => s().player.y,
            onChange: (y) => patch((st) => ({ player: { ...st.player, y } })),
          }),
          numberField({
            label: () => t('layers.player.radius'),
            value: () => s().player.r,
            min: 0,
            max: 5000,
            onChange: (r) => patch((st) => ({ player: { ...st.player, r } })),
          }),
        ),
        h(
          'div',
          { class: 'button-row' },
          button({
            label: () =>
              store.pickMode.value === 'player' ? t('layers.player.placing') : t('layers.player.place'),
            icon: 'pin',
            size: 'sm',
            pressed: () => store.pickMode.value === 'player',
            onClick: () => (store.pickMode.value = store.pickMode.value === 'player' ? 'none' : 'player'),
            disabled: () => !store.summary.value,
          }),
          button({
            label: () => t('common.goTo'),
            icon: 'locate',
            size: 'sm',
            variant: 'ghost',
            onClick: () => ctx.actions.goTo(s().player.x + 0.5, s().player.y + 0.5),
          }),
          h(
            'label',
            { class: 'color-input' },
            h('span', { class: 'visually-hidden' }, () => t('layers.player.color')),
            h('input', {
              type: 'color',
              value: () => s().player.color,
              onInput: (e: Event) => {
                const color = (e.target as HTMLInputElement).value;
                patch((st) => ({ player: { ...st.player, color } }));
              },
            }),
          ),
        ),
      ],
    }),
    section({
      title: () => t('layers.customRing'),
      open: false,
      children: [
        switchControl({
          label: () => t('layers.customRing.show'),
          checked: () => s().customRing.on,
          onChange: (on) => patch((st) => ({ customRing: { ...st.customRing, on } })),
        }),
        slider({
          label: () => t('layers.customRing.radius'),
          value: () => s().customRing.r,
          min: 10,
          max: 3000,
          step: 5,
          onInput: (r) => patch((st) => ({ customRing: { ...st.customRing, r, on: true } })),
        }),
        h('p', { class: 'muted small' }, () => tn('layers.customRing.hint', s().customRing.r)),
      ],
    }),
  );
}
