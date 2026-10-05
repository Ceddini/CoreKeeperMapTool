import type { Ctx } from '../app/context.ts';
import { computed, effect, scope, untracked } from '../core/signals.ts';
import { DEFAULT_SETTINGS, patchSettings, type PanelId } from '../core/store.ts';
import { LANGS, setLang, t, type Lang, type MsgKey } from '../i18n/i18n.ts';
import { button, segmented, toast, toastRegion } from './components.ts';
import { h, uid } from './dom.ts';
import { relativeTime } from './format.ts';
import { icon, type IconName } from './icons.ts';
import { helpPanel } from './panels/help-panel.ts';
import { layersPanel } from './panels/layers-panel.ts';
import { mapPanel } from './panels/map-panel.ts';
import { tilesPanel } from './panels/tiles-panel.ts';
import { stage, wordmark } from './stage.ts';

const NAV: { id: PanelId; icon: IconName; label: MsgKey; key: string }[] = [
  { id: 'map', icon: 'map', label: 'nav.map', key: '1' },
  { id: 'layers', icon: 'layers', label: 'nav.layers', key: '2' },
  { id: 'tiles', icon: 'tiles', label: 'nav.tiles', key: '3' },
  { id: 'help', icon: 'help', label: 'nav.help', key: '4' },
];

const TITLES: Record<PanelId, MsgKey> = {
  map: 'panel.map',
  layers: 'panel.layers',
  tiles: 'panel.tiles',
  help: 'panel.help',
};

function fileStatus(ctx: Ctx): HTMLElement {
  const { store } = ctx;
  return h(
    'button',
    {
      type: 'button',
      class: () => `file-status file-status--${store.status.value}`,
      onClick: () => ctx.actions.setPanel('map'),
      'aria-label': () => t('fileStatus.label'),
    },
    h('span', { class: 'file-status__dot', 'aria-hidden': 'true' }),
    h('span', { class: 'file-status__text' }, () => {
      const st = store.status.value;
      const f = store.file.value;
      if (st === 'loading') return t('fileStatus.loading');
      if (!f) return t('fileStatus.none');
      const name = f.source === 'example' ? t('mapPanel.exampleName') : f.name;
      const live =
        store.live.value === 'watching'
          ? ` · ${t('fileStatus.live')}`
          : store.live.value === 'paused'
            ? ` · ${t('fileStatus.paused')}`
            : '';
      const when = store.updatedAt.value ? ` · ${relativeTime(store.updatedAt.value)}` : '';
      return `${name}${live}${when}`;
    }),
  );
}

function settingsPopover(ctx: Ctx): HTMLElement {
  const { store } = ctx;
  const id = uid('settings');
  const langId = uid('lang');
  const pop = h(
    'div',
    { id, class: 'popover', popover: 'auto', role: 'dialog', 'aria-label': () => t('settings.title') },
    h('h2', { class: 'popover__title' }, () => t('settings.title')),
    h(
      'div',
      { class: 'field' },
      h('label', { for: langId, class: 'field__label' }, () => t('settings.language')),
      h(
        'select',
        {
          id: langId,
          class: 'input select',
          onChange: (e: Event) => {
            const l = (e.target as HTMLSelectElement).value as Lang;
            patchSettings(store, () => ({ lang: l }));
            void setLang(l);
          },
        },
        LANGS.map((l) =>
          h(
            'option',
            {
              value: l.id,
              selected: () => (store.settings.value.lang ?? document.documentElement.lang) === l.id,
            },
            l.label,
          ),
        ),
      ),
    ),
    segmented({
      label: () => t('settings.theme'),
      options: [
        { value: 'system', label: () => t('settings.theme.system') },
        { value: 'dark', label: () => t('settings.theme.dark') },
        { value: 'light', label: () => t('settings.theme.light') },
      ],
      value: () => store.settings.value.theme,
      onChange: (theme) => patchSettings(store, () => ({ theme })),
    }),
    segmented({
      label: () => t('settings.background'),
      options: [
        { value: 'dark', label: () => t('settings.background.dark') },
        { value: 'light', label: () => t('settings.background.light') },
        { value: 'checker', label: () => t('settings.background.checker') },
      ],
      value: () => store.settings.value.mapBackground,
      onChange: (mapBackground) => patchSettings(store, () => ({ mapBackground })),
    }),
    button({
      label: () => t('settings.reset'),
      icon: 'undo',
      variant: 'ghost',
      size: 'sm',
      onClick: () => ctx.actions.resetSettings(),
    }),
  );
  return pop;
}

function topbar(ctx: Ctx): HTMLElement {
  const pop = settingsPopover(ctx);
  const settingsBtn = button({
    label: () => t('settings.title'),
    icon: 'settings',
    iconOnly: true,
    variant: 'ghost',
  });
  settingsBtn.setAttribute('popovertarget', pop.id);
  settingsBtn.setAttribute('aria-haspopup', 'dialog');
  pop.addEventListener('toggle', (e) => {
    const open = (e as ToggleEvent).newState === 'open';
    settingsBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      const r = settingsBtn.getBoundingClientRect();
      pop.style.top = `${r.bottom + 6}px`;
      pop.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
      (pop.querySelector('select, input, button') as HTMLElement | null)?.focus();
    }
  });
  return h(
    'header',
    { class: 'topbar' },
    h('h1', { class: 'topbar__brand' }, wordmark('topbar__logo', 'Core Keeper Map Tool')),
    fileStatus(ctx),
    h('div', { class: 'topbar__spacer' }),
    h(
      'button',
      {
        type: 'button',
        class: 'search-trigger',
        onClick: () => ctx.actions.openPalette(),
        'aria-keyshortcuts': 'Control+K Meta+K /',
        // The visible text is hidden on small screens, so name the button explicitly.
        'aria-label': () => t('palette.label'),
      },
      icon('search', 16),
      h('span', { class: 'search-trigger__text' }, () => t('palette.trigger')),
      h(
        'kbd',
        { class: 'kbd search-trigger__kbd', 'aria-hidden': 'true' },
        navigator.platform.startsWith('Mac') ? '⌘K' : 'Ctrl K',
      ),
    ),
    settingsBtn,
    pop,
  );
}

function nav(ctx: Ctx): HTMLElement {
  const { store } = ctx;
  return h(
    'nav',
    { class: 'rail', 'aria-label': () => t('nav.label') },
    NAV.map((n) =>
      h(
        'button',
        {
          type: 'button',
          class: 'rail__item',
          'aria-pressed': () => String(store.settings.value.panel === n.id),
          'aria-controls': 'panel',
          'aria-keyshortcuts': n.key,
          onClick: () => ctx.actions.togglePanel(n.id),
        },
        icon(n.icon, 20),
        h('span', { class: 'rail__label' }, () => t(n.label)),
      ),
    ),
  );
}

function panelHost(ctx: Ctx): HTMLElement {
  const { store } = ctx;
  const panels: Record<PanelId, () => HTMLElement> = {
    map: () => mapPanel(ctx),
    layers: () => layersPanel(ctx),
    tiles: () => tilesPanel(ctx),
    help: () => helpPanel(ctx),
  };
  const cache = new Map<PanelId, HTMLElement>();
  const body = h('div', { class: 'panel__body' });
  const host = h(
    'aside',
    {
      id: 'panel',
      class: 'panel',
      'aria-labelledby': 'panel-title',
      hidden: () => store.settings.value.panel === null,
    },
    h(
      'header',
      { class: 'panel__header' },
      h('h2', { id: 'panel-title', class: 'panel__title' }, () => {
        const p = store.settings.value.panel;
        return p ? t(TITLES[p]) : '';
      }),
      button({
        label: () => t('panel.close'),
        icon: 'close',
        iconOnly: true,
        variant: 'ghost',
        onClick: () => ctx.actions.setPanel(null),
        kbd: '[',
      }),
    ),
    body,
  );
  // Panels are built once and kept, so scroll position and inputs survive switching.
  let shown: HTMLElement | null = null;
  const show = (p: PanelId | null) => {
    if (!p) return;
    let el = cache.get(p);
    if (!el) {
      // Own scope: the panel lives on when another panel is shown.
      let built: HTMLElement | null = null;
      untracked(() => scope(() => void (built = panels[p]())));
      el = built!;
      cache.set(p, el);
      body.appendChild(el);
    }
    if (shown && shown !== el) shown.hidden = true;
    el.hidden = false;
    shown = el;
  };
  const current = computed(() => store.settings.value.panel);
  effect(() => show(current.value));
  return host;
}

export function shell(ctx: Ctx): HTMLElement {
  return h(
    'div',
    { class: () => `app${ctx.store.settings.value.panel ? ' app--panel-open' : ''}` },
    h(
      'a',
      {
        href: '#map',
        class: 'skip-link',
        onClick: (e: Event) => (e.preventDefault(), ctx.view.canvas.focus()),
      },
      () => t('skip.toMap'),
    ),
    topbar(ctx),
    nav(ctx),
    panelHost(ctx),
    stage(ctx),
    toastRegion(),
  );
}

export function confirmReset(ctx: Ctx): void {
  const prev = ctx.store.settings.peek();
  ctx.store.settings.value = { ...DEFAULT_SETTINGS, lang: prev.lang, panel: prev.panel };
  toast({
    message: t('settings.resetDone'),
    action: { label: t('common.undo'), onClick: () => (ctx.store.settings.value = prev) },
  });
}
