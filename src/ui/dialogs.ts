import type { Ctx } from '../app/context.ts';
import { signal } from '../core/signals.ts';
import { patchSettings } from '../core/store.ts';
import { POIS } from '../data/pois.ts';
import { TILES } from '../data/tiles.ts';
import { fmt, poiName, t, tileName } from '../i18n/i18n.ts';
import { screenToWorld } from '../render/camera.ts';
import { saveBlob } from '../services/file-access.ts';
import { MAX_EXPORT_PIXELS } from '../core/constants.ts';
import { button, dialog, segmented, switchControl, toast } from './components.ts';
import { h, uid } from './dom.ts';
import { icon, type IconName } from './icons.ts';

// ---------------------------------------------------------------- Export

export function exportDialog(ctx: Ctx): { open(): void } {
  const { store, view, service } = ctx;
  const region = signal<'map' | 'view'>('map');
  const scale = signal<'1' | '2' | '4'>('1');
  const overlays = signal(true);
  const background = signal<'transparent' | 'dark'>('dark');
  const busy = signal<{ done: number; total: number } | null>(null);
  let abort: AbortController | null = null;

  const bounds = () => {
    if (region.value === 'view') {
      const cam = store.camera.value;
      const r = view.canvas.getBoundingClientRect();
      const vp = { width: r.width, height: r.height };
      const [x0, y1] = screenToWorld(cam, vp, 0, 0);
      const [x1, y0] = screenToWorld(cam, vp, vp.width, vp.height);
      return { minX: Math.floor(x0), minY: Math.floor(y0), maxX: Math.ceil(x1) - 1, maxY: Math.ceil(y1) - 1 };
    }
    const explored = store.stats.value?.bounds;
    if (explored) return explored;
    const b = store.summary.value!.bounds;
    return {
      minX: b.minCx * 256,
      minY: b.minCy * 256,
      maxX: (b.maxCx + 1) * 256 - 1,
      maxY: (b.maxCy + 1) * 256 - 1,
    };
  };
  const dims = () => {
    if (!store.summary.value) return { w: 0, h: 0 };
    const b = bounds();
    const s = Number(scale.value);
    return { w: (b.maxX - b.minX + 1) * s, h: (b.maxY - b.minY + 1) * s };
  };
  const tooLarge = () => dims().w * dims().h > MAX_EXPORT_PIXELS;

  const run = async () => {
    abort = new AbortController();
    busy.value = { done: 0, total: 1 };
    const scene = view.overlay();
    const m = store.settings.peek().maze;
    try {
      const paint = store.settings.peek().paint;
      const blob = await service.export(
        {
          scale: Number(scale.peek()) as 1 | 2 | 4,
          region: bounds(),
          background: background.peek(),
          lut: view.lut(),
          dim: store.settings.peek().alpha.dim,
          customColor: parseInt(paint.color.slice(1), 16),
          primitives: overlays.peek() ? scene.primitives : [],
          labels: overlays.peek() ? scene.labels : [],
          mazeClasses: overlays.peek() ? (m.small ? 1 : 0) | (m.medium ? 2 : 0) | (m.large ? 4 : 0) : 0,
        },
        (done, total) => (busy.value = { done, total }),
        abort.signal,
      );
      const name = `core-keeper-map-${new Date().toISOString().slice(0, 10)}.png`;
      const saved = await saveBlob(blob, name);
      dlg.close();
      if (saved)
        toast({ message: t('export.saved', { name, w: fmt(dims().w), h: fmt(dims().h) }), tone: 'success' });
    } catch {
      if (!abort.signal.aborted) toast({ message: t('export.failed'), tone: 'danger' });
    } finally {
      busy.value = null;
      abort = null;
    }
  };

  const dlg = dialog({
    title: () => t('export.title'),
    onClose: () => abort?.abort(),
    body: h(
      'div',
      { class: 'stack' },
      segmented({
        label: () => t('export.region'),
        options: [
          { value: 'map', label: () => t('export.region.map') },
          { value: 'view', label: () => t('export.region.view') },
        ],
        value: () => region.value,
        onChange: (v) => (region.value = v),
      }),
      segmented({
        label: () => t('export.scale'),
        options: [
          { value: '1', label: '1×' },
          { value: '2', label: '2×' },
          { value: '4', label: '4×' },
        ],
        value: () => scale.value,
        onChange: (v) => (scale.value = v),
      }),
      segmented({
        label: () => t('export.background'),
        options: [
          { value: 'dark', label: () => t('export.background.dark') },
          { value: 'transparent', label: () => t('export.background.transparent') },
        ],
        value: () => background.value,
        onChange: (v) => (background.value = v),
      }),
      switchControl({
        label: () => t('export.overlays'),
        description: () => t('export.overlaysDesc'),
        checked: () => overlays.value,
        onChange: (v) => (overlays.value = v),
      }),
      h('p', { class: () => (tooLarge() ? 'notice notice--warning' : 'muted small') }, () =>
        tooLarge() ? t('export.tooLarge') : t('export.size', { w: fmt(dims().w), h: fmt(dims().h) }),
      ),
      () => {
        const b = busy.value;
        if (!b) return null;
        const pct = Math.round((b.done / Math.max(1, b.total)) * 100);
        return h(
          'div',
          {
            class: 'progress',
            role: 'progressbar',
            'aria-label': t('export.progress'),
            'aria-valuenow': String(pct),
            'aria-valuemin': '0',
            'aria-valuemax': '100',
          },
          h('div', { class: 'progress__bar', style: { width: `${pct}%` } }),
        );
      },
    ),
    footer: [
      button({
        label: () => t('common.cancel'),
        variant: 'ghost',
        onClick: () => (busy.value ? abort?.abort() : dlg.close()),
      }),
      button({
        label: () => (busy.value ? t('export.exporting') : t('export.button')),
        icon: 'download',
        variant: 'primary',
        disabled: () => !!busy.value || tooLarge() || !store.summary.value,
        onClick: () => void run(),
      }),
    ],
  });
  return { open: () => dlg.open() };
}

// ---------------------------------------------------------------- Shortcuts

export function shortcutsDialog(): { open(): void } {
  const rows: [string[], () => string][] = [
    [['Ctrl', 'K'], () => t('shortcuts.palette')],
    [['O'], () => t('shortcuts.open')],
    [['1', '–', '4'], () => t('shortcuts.panels')],
    [['['], () => t('shortcuts.panel')],
    [['C'], () => t('shortcuts.center')],
    [['F'], () => t('shortcuts.fit')],
    [['+', '−'], () => t('shortcuts.zoom')],
    [['←', '↑', '→', '↓'], () => t('shortcuts.pan')],
    [['G'], () => t('shortcuts.chunkGrid')],
    [['Shift', 'G'], () => t('shortcuts.mobGrid')],
    [['B'], () => t('shortcuts.sectors')],
    [['L'], () => t('shortcuts.live')],
    [['R'], () => t('shortcuts.reload')],
    [['E'], () => t('shortcuts.export')],
    [['Esc'], () => t('shortcuts.escape')],
    [['?'], () => t('shortcuts.help')],
  ];
  const dlg = dialog({
    title: () => t('shortcuts.title'),
    body: h(
      'table',
      { class: 'shortcuts' },
      h(
        'tbody',
        null,
        rows.map(([keys, label]) =>
          h(
            'tr',
            null,
            h(
              'td',
              null,
              h(
                'span',
                { class: 'kbd-group' },
                keys.map((k) =>
                  k === '–' ? h('span', { class: 'muted' }, '–') : h('kbd', { class: 'kbd' }, k),
                ),
              ),
            ),
            h('td', null, label),
          ),
        ),
      ),
    ),
  });
  return { open: () => dlg.open() };
}

// ---------------------------------------------------------------- Command palette

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  swatch?: string;
  /** Extra search terms (e.g. names of merged tiles). */
  keywords?: string;
  run(): void;
}

export function commandPalette(ctx: Ctx): { open(): void } {
  const { store, actions, view } = ctx;
  const query = signal('');
  const active = signal(0);
  const listId = uid('palette-list');
  const optId = (i: number) => `${listId}-opt-${i}`;

  const toggleSetting = (fn: Parameters<typeof patchSettings>[1]) => patchSettings(store, fn);

  const commands = (): Command[] => {
    const s = store.settings.peek();
    const out: Command[] = [
      { id: 'open', label: t('open.choose'), icon: 'folder', run: () => void actions.open() },
      { id: 'example', label: t('open.example'), icon: 'map', run: () => void actions.example() },
      { id: 'export', label: t('mapPanel.exportButton'), icon: 'image', run: () => actions.openExport() },
      { id: 'center', label: t('controls.center'), icon: 'crosshair', run: () => view.centerCore() },
      { id: 'fit', label: t('controls.fit'), icon: 'fit', run: () => view.fit() },
      {
        id: 'chunk',
        label: t('layers.grids.chunk'),
        hint: s.grids.chunk ? t('common.on') : t('common.off'),
        icon: 'grid',
        run: () => toggleSetting((x) => ({ grids: { ...x.grids, chunk: !x.grids.chunk } })),
      },
      {
        id: 'mob',
        label: t('layers.grids.mob'),
        hint: s.grids.mob ? t('common.on') : t('common.off'),
        icon: 'grid',
        run: () => toggleSetting((x) => ({ grids: { ...x.grids, mob: !x.grids.mob } })),
      },
      {
        id: 'sectors',
        label: t('layers.sectors.show'),
        hint: s.sectors.show ? t('common.on') : t('common.off'),
        icon: 'layers',
        run: () => toggleSetting((x) => ({ sectors: { ...x.sectors, show: !x.sectors.show } })),
      },
      {
        id: 'shortcuts',
        label: t('help.showShortcuts'),
        icon: 'keyboard',
        run: () => actions.openShortcuts(),
      },
      { id: 'findmap', label: t('help.findMap'), icon: 'help', run: () => actions.setPanel('help') },
    ];
    for (const p of POIS) {
      if (!p.radii[s.world]?.length && !p.bands?.[s.world]?.length) continue;
      const on = s.pois.includes(p.id);
      out.push({
        id: `poi:${p.id}`,
        label: poiName(p),
        hint: on ? t('palette.hideRing') : t('palette.showRing'),
        icon: 'locate',
        swatch: p.color,
        run: () => {
          toggleSetting((x) => ({ pois: on ? x.pois.filter((i) => i !== p.id) : [...x.pois, p.id] }));
          const r = p.radii[s.world]?.[0] ?? p.bands?.[s.world]?.[0]?.[1];
          if (!on && r)
            view.flyTo(
              0,
              0,
              Math.min(store.camera.peek().zoom, (Math.min(innerWidth, innerHeight) * 0.42) / r),
            );
        },
      });
    }
    for (const tile of TILES) {
      const on = s.highlight.includes(tile.id);
      out.push({
        id: `tile:${tile.id}`,
        label: tileName(tile),
        hint: on ? t('palette.unhighlight') : t('palette.highlight'),
        icon: 'tiles',
        swatch: tile.rgb,
        keywords: tile.members?.join(' ').toLowerCase(),
        run: () =>
          toggleSetting((x) => ({
            highlight: on ? x.highlight.filter((i) => i !== tile.id) : [...x.highlight, tile.id],
          })),
      });
    }
    return out;
  };

  const results = () => {
    const q = query.value.trim().toLowerCase();
    const all = commands();
    if (!q) return all.slice(0, 10);
    const starts: Command[] = [];
    const contains: Command[] = [];
    for (const c of all) {
      const l = c.label.toLowerCase();
      if (l.startsWith(q)) starts.push(c);
      else if (l.includes(q) || c.keywords?.includes(q)) contains.push(c);
    }
    return [...starts, ...contains].slice(0, 40);
  };

  let current: Command[] = [];
  const execute = (c: Command | undefined) => {
    if (!c) return;
    dlg.close();
    c.run();
  };

  const input = h('input', {
    type: 'text',
    class: 'palette__input',
    role: 'combobox',
    'aria-expanded': 'true',
    'aria-controls': listId,
    'aria-autocomplete': 'list',
    'aria-activedescendant': () => (current.length ? optId(active.value) : undefined),
    'aria-label': () => t('palette.label'),
    placeholder: () => t('palette.placeholder'),
    autocomplete: 'off',
    spellcheck: 'false',
    value: () => query.value,
    onInput: (e: Event) => {
      query.value = (e.target as HTMLInputElement).value;
      active.value = 0;
    },
    onKeydown: (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = current.length;
        if (n) active.value = (active.value + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
        document.getElementById(optId(active.value))?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        execute(current[active.value]);
      }
    },
  });

  const list = h(
    'ul',
    { id: listId, role: 'listbox', class: 'palette__list', 'aria-label': () => t('palette.results') },
    () => {
      current = results();
      if (!current.length)
        return h('li', { class: 'palette__empty', role: 'presentation' }, t('palette.empty'));
      return current.map((c, i) =>
        h(
          'li',
          {
            id: optId(i),
            role: 'option',
            class: 'palette__option',
            'aria-selected': () => String(active.value === i),
            onClick: () => execute(c),
            onPointermove: () => (active.value = i),
          },
          c.swatch
            ? h('span', { class: 'swatch', style: { '--swatch': c.swatch }, 'aria-hidden': 'true' })
            : icon(c.icon, 16),
          h('span', { class: 'palette__label' }, c.label),
          c.hint ? h('span', { class: 'palette__hint' }, c.hint) : null,
        ),
      );
    },
  );

  const dlg = dialog({
    title: () => t('palette.title'),
    body: h(
      'div',
      { class: 'palette' },
      h('div', { class: 'palette__search' }, icon('search', 18), input),
      list,
    ),
  });
  dlg.el.classList.add('dialog--palette');
  return {
    open: () => {
      query.value = '';
      active.value = 0;
      dlg.open();
      input.focus();
    },
  };
}
