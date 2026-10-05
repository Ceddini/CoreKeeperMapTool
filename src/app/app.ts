import { effect } from '../core/signals.ts';
import { createStore, patchSettings, type FileInfo, type PanelId } from '../core/store.ts';
import { tilesByRgb } from '../data/tiles.ts';
import { detectLang, setLang, t } from '../i18n/i18n.ts';
import {
  fromDrop,
  lastHandle,
  onLaunch,
  pickFile,
  reopenLast,
  supportsHandles,
  type PickedFile,
} from '../services/file-access.ts';
import { FileWatcher } from '../services/file-watch.ts';
import { MapService } from '../services/map-service.ts';
import { setupPwa } from '../services/pwa.ts';
import { showMenu, toast } from '../ui/components.ts';
import { commandPalette, exportDialog, shortcutsDialog } from '../ui/dialogs.ts';
import { createMapView } from '../ui/map-view.ts';
import { confirmReset, shell } from '../ui/shell.ts';
import { errorMessage } from '../ui/stage.ts';
import { INDEX_MASK } from '../workers/model/palette.ts';
import type { Actions, Ctx } from './context.ts';

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function parseDeepLink(): { x: number; y: number; zoom: number } | null {
  const at = new URLSearchParams(location.search).get('at');
  if (!at) return null;
  const [x, y, z] = at.split(',').map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: x!, y: y!, zoom: Number.isFinite(z) && z! > 0 ? z! : 4 };
}

export async function startApp(root: HTMLElement): Promise<void> {
  const store = createStore();
  await setLang(detectLang(store.settings.peek().lang));

  // Theme: resolved onto <html data-theme> so CSS tokens can switch.
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const applyTheme = () => {
    const pref = store.settings.peek().theme;
    document.documentElement.dataset.theme = pref === 'system' ? (dark.matches ? 'dark' : 'light') : pref;
  };
  effect(() => (void store.settings.value.theme, applyTheme()));
  dark.addEventListener('change', applyTheme);

  // On phones the sheet would cover the open card: start with it closed until a map is loaded.
  if (matchMedia('(max-width: 719px)').matches) patchSettings(store, () => ({ panel: null }));

  const service = new MapService(store);
  const view = createMapView(store, service);
  let handle: FileSystemFileHandle | null = null;
  const deepLink = parseDeepLink();
  let firstLoad = true;

  const watcher = new FileWatcher(
    async (file) => {
      const info = store.file.peek();
      return service.load(
        file,
        {
          ...(info ?? { name: file.name, source: 'picker' }),
          size: file.size,
          lastModified: file.lastModified,
        },
        true,
      );
    },
    (state) => (store.live.value = state),
  );

  async function load(file: Blob, info: FileInfo, h: FileSystemFileHandle | null): Promise<void> {
    const ok = await service.load(file, info);
    if (!ok) {
      const err = store.error.peek();
      if (err && store.summary.peek()) toast({ message: errorMessage(err), tone: 'danger' });
      return;
    }
    handle = h;
    watcher.setHandle(h, file instanceof File ? file : undefined);
    watcher.setEnabled(!!h && store.settings.peek().liveRefresh);
    store.canReopen.value = null;
    if (firstLoad) {
      firstLoad = false;
      if (deepLink) view.flyTo(deepLink.x, deepLink.y, deepLink.zoom);
      else store.camera.value = { x: 0, y: 0, zoom: innerWidth < 720 ? 0.5 : 1 };
    }
    // Next step after the first load: show the layers, but only where the panel docks beside the
    // map. On smaller screens it would cover the map at the very moment it appears.
    if (!store.settings.peek().onboarded) {
      const docked = matchMedia('(min-width: 1024px)').matches;
      patchSettings(store, (s) => ({ onboarded: true, panel: docked ? (s.panel ?? 'layers') : s.panel }));
    }
    const s = store.summary.peek()!;
    toast({ message: t('toast.loaded', { n: s.chunkCount }), tone: 'success' });
  }

  const actions: Actions = {
    async open() {
      const p = await pickFile();
      if (p) await actions.loadPicked(p, 'picker');
    },
    async reopen() {
      try {
        const p = await reopenLast();
        if (p) await actions.loadPicked(p, 'picker');
        else toast({ message: t('toast.reopenDenied'), tone: 'warning' });
      } catch {
        store.canReopen.value = null;
        toast({ message: t('toast.reopenFailed'), tone: 'warning' });
      }
    },
    async example() {
      store.status.value = 'loading';
      store.progress.value = { phase: 'read', loaded: 0, total: 1 };
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}example/example.mapparts.gzip`);
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        await load(
          blob,
          { name: 'example.mapparts.gzip', size: blob.size, lastModified: Date.now(), source: 'example' },
          null,
        );
      } catch {
        store.status.value = store.summary.peek() ? 'ready' : 'idle';
        store.progress.value = null;
        toast({ message: t('toast.exampleFailed'), tone: 'danger' });
      }
    },
    async loadPicked(p: PickedFile, source) {
      await load(
        p.file,
        { name: p.file.name, size: p.file.size, lastModified: p.file.lastModified, source },
        p.handle,
      );
    },
    async loadDropped(e) {
      const p = await fromDrop(e);
      if (p) await actions.loadPicked(p, 'drop');
    },
    async refresh() {
      if (!handle) return void actions.open();
      const file = await handle.getFile();
      await load(
        file,
        { name: file.name, size: file.size, lastModified: file.lastModified, source: 'picker' },
        handle,
      );
    },
    setLive(on) {
      patchSettings(store, () => ({ liveRefresh: on }));
      watcher.setEnabled(on && !!handle);
      if (on && !handle) toast({ message: t('toast.liveNeedsPicker'), tone: 'warning' });
    },
    openExport: () => exportDlg.open(),
    openShortcuts: () => shortcutsDlg.open(),
    openPalette: () => palette.open(),
    setPanel(id: PanelId | null) {
      patchSettings(store, () => ({ panel: id }));
    },
    togglePanel(id) {
      patchSettings(store, (s) => ({ panel: s.panel === id ? null : id }));
    },
    goTo(x, y, zoom) {
      view.flyTo(x, y, zoom ?? Math.max(store.camera.peek().zoom, 4));
      if (innerWidth < 720) actions.setPanel(null);
    },
    resetSettings: () => confirmReset(ctx),
  };

  const ctx: Ctx = { store, service, view, actions, supportsLive: supportsHandles };
  const exportDlg = exportDialog(ctx);
  const shortcutsDlg = shortcutsDialog();
  const palette = commandPalette(ctx);

  root.append(shell(ctx));
  setupPwa();

  // Picking a tile on the map highlights its type (or its colour if unknown).
  view.onPick = (_x, _y, cell) => {
    const idx = cell & INDEX_MASK;
    if (!idx) return toast({ message: t('pick.unexplored'), tone: 'warning' });
    const rgb = store.palette.peek().colors[idx]!;
    const tiles = tilesByRgb.get(rgb);
    if (tiles?.length) {
      patchSettings(store, (s) => ({
        highlight: [...new Set([...s.highlight, ...tiles.map((x) => x.id)])],
        panel: 'tiles',
      }));
    } else {
      patchSettings(store, () => ({ pickedColor: rgb, panel: 'tiles' }));
    }
  };

  view.onContextMenu = (x, y, sx, sy) => {
    const coords = `${x}, ${y}`;
    showMenu(
      sx,
      sy,
      [
        {
          label: t('menu.placePlayer'),
          icon: 'pin',
          onSelect: () => patchSettings(store, (s) => ({ player: { ...s.player, on: true, x, y } })),
        },
        {
          label: t('menu.highlightTile'),
          icon: 'pipette',
          onSelect: async () => view.onPick?.(x, y, await service.probe(x, y)),
        },
        {
          label: t('menu.copyCoords'),
          icon: 'copy',
          onSelect: () =>
            void navigator.clipboard
              ?.writeText(coords)
              .then(() => toast({ message: t('toast.copied', { text: coords }) })),
        },
        {
          label: t('menu.copyLink'),
          icon: 'external',
          onSelect: () => {
            const url = `${location.origin}${location.pathname}?at=${x},${y},${Math.round(store.camera.peek().zoom * 10) / 10}`;
            void navigator.clipboard?.writeText(url).then(() => toast({ message: t('toast.linkCopied') }));
          },
        },
      ],
      coords,
      view.el,
    );
  };

  // Global keyboard shortcuts.
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      return palette.open();
    }
    if (e.key === 'Escape' && store.pickMode.peek() !== 'none') {
      store.pickMode.value = 'none';
      return;
    }
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    const has = !!store.summary.peek();
    const k = e.key;
    const map: Record<string, () => void> = {
      '/': () => palette.open(),
      '?': () => shortcutsDlg.open(),
      o: () => void actions.open(),
      '1': () => actions.togglePanel('map'),
      '2': () => actions.togglePanel('layers'),
      '3': () => actions.togglePanel('tiles'),
      '4': () => actions.togglePanel('help'),
      '[': () => patchSettings(store, (s) => ({ panel: s.panel ? null : 'map' })),
    };
    if (has) {
      Object.assign(map, {
        c: () => view.centerCore(),
        f: () => view.fit(),
        '+': () => view.zoomBy(2),
        '=': () => view.zoomBy(2),
        '-': () => view.zoomBy(0.5),
        g: () => patchSettings(store, (s) => ({ grids: { ...s.grids, chunk: !s.grids.chunk } })),
        G: () => patchSettings(store, (s) => ({ grids: { ...s.grids, mob: !s.grids.mob } })),
        b: () => patchSettings(store, (s) => ({ sectors: { ...s.sectors, show: !s.sectors.show } })),
        l: () => supportsHandles && actions.setLive(!store.settings.peek().liveRefresh),
        r: () => void actions.refresh(),
        e: () => actions.openExport(),
      });
    }
    const fn = map[k] ?? map[k.toLowerCase()];
    if (fn && !(k === 'G' && !e.shiftKey)) {
      e.preventDefault();
      fn();
    }
  });

  // Opening a .gzip from the OS with the installed app (Chromium file handlers).
  onLaunch((p) => void actions.loadPicked(p, 'launch'));

  // Offer to continue with the last file.
  void lastHandle().then((h) => {
    if (h && !store.summary.peek()) store.canReopen.value = { name: h.name };
  });

  if (deepLink) store.camera.value = { x: deepLink.x, y: deepLink.y, zoom: deepLink.zoom };
}
