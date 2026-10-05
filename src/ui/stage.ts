import type { Ctx } from '../app/context.ts';
import { computed } from '../core/signals.ts';
import type { AppStore } from '../core/store.ts';
import { fmt, t, type MsgKey } from '../i18n/i18n.ts';
import { button } from './components.ts';
import { h } from './dom.ts';
import { icon } from './icons.ts';
import { describeTile, formatDistance } from './map-view.ts';
import { findMapGuide } from './find-map-guide.ts';
import wordmarkDark from '../assets/wordmark-dark.png';
import wordmarkLight from '../assets/wordmark-light.png';

export function wordmark(cls: string, alt = ''): HTMLElement {
  return h(
    'span',
    { class: `wordmark ${cls}` },
    h('img', { class: 'wordmark--dark', src: wordmarkDark, alt, width: '402', height: '107' }),
    h('img', {
      class: 'wordmark--light',
      src: wordmarkLight,
      alt: '',
      'aria-hidden': 'true',
      width: '402',
      height: '107',
    }),
  );
}

export function errorMessage(err: AppStore['error']['value']): string {
  if (!err) return '';
  if (err.kind === 'internal') return t('error.internal', { message: err.message });
  if (err.kind === 'wrong-file' && 'hint' in err && err.hint === 'world') return t('error.world');
  return t(`error.${err.kind}` as MsgKey);
}

/** Empty state: what this is, how to open a map, where the file lives. */
function openCard(ctx: Ctx): HTMLElement {
  const { store, actions } = ctx;
  return h(
    'section',
    { class: 'open-card', 'aria-labelledby': 'open-title' },
    wordmark('open-card__logo'),
    h('h2', { id: 'open-title', class: 'open-card__title' }, () => t('open.title')),
    h('p', { class: 'open-card__lead' }, () => t('open.lead')),
    () => {
      const err = store.error.value;
      return err && !store.summary.value
        ? h(
            'div',
            { class: 'notice notice--danger', role: 'alert' },
            icon('warning', 18),
            h('span', null, errorMessage(err)),
          )
        : null;
    },
    h(
      'div',
      { class: 'open-card__actions' },
      () => {
        const r = store.canReopen.value;
        return r
          ? button({
              label: t('open.continue', { name: r.name }),
              icon: 'refresh',
              variant: 'primary',
              size: 'lg',
              onClick: () => void actions.reopen(),
            })
          : null;
      },
      () =>
        button({
          label: t('open.choose'),
          icon: 'folder',
          variant: store.canReopen.value ? 'secondary' : 'primary',
          size: 'lg',
          onClick: () => void actions.open(),
          kbd: 'O',
        }),
      button({
        label: () => t('open.example'),
        icon: 'map',
        variant: 'ghost',
        onClick: () => void actions.example('standard'),
      }),
      h(
        'button',
        { type: 'button', class: 'link-button small', onClick: () => void actions.example('classic') },
        () => t('open.exampleClassic'),
      ),
    ),
    h(
      'p',
      { class: 'open-card__drop muted small' },
      icon('upload', 16),
      h('span', null, () => t('open.drop')),
    ),
    h(
      'details',
      { class: 'open-card__guide' },
      h(
        'summary',
        null,
        icon('help', 16),
        h('span', null, () => t('open.where')),
      ),
      findMapGuide(),
    ),
    h('p', { class: 'open-card__privacy muted small' }, () => t('open.privacy')),
  );
}

function progressCard(ctx: Ctx): HTMLElement {
  const { store } = ctx;
  const pct = computed(() => {
    const p = store.progress.value;
    if (!p) return 0;
    return p.phase === 'decode' ? 100 : Math.min(99, Math.round((p.loaded / Math.max(1, p.total)) * 100));
  });
  return h(
    'div',
    { class: 'progress-card', role: 'status', 'aria-live': 'polite' },
    h(
      'div',
      { class: 'progress-card__row' },
      icon('loader', 18),
      h('span', { class: 'progress-card__label' }, () =>
        store.progress.value?.phase === 'decode'
          ? t('progress.decode')
          : t('progress.read', { pct: pct.value }),
      ),
      button({
        label: () => t('common.cancel'),
        size: 'sm',
        variant: 'ghost',
        onClick: () => ctx.service.cancel(),
      }),
    ),
    h(
      'div',
      {
        class: 'progress',
        role: 'progressbar',
        'aria-label': () => t('progress.label'),
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': () => String(pct.value),
      },
      h('div', { class: 'progress__bar', style: { width: () => `${pct.value}%` } }),
    ),
  );
}

function mapControls(ctx: Ctx): HTMLElement {
  const { view } = ctx;
  return h(
    'div',
    {
      class: 'map-controls',
      role: 'toolbar',
      'aria-label': () => t('controls.label'),
      'aria-orientation': 'vertical',
    },
    button({
      label: () => t('controls.zoomIn'),
      icon: 'plus',
      iconOnly: true,
      onClick: () => view.zoomBy(2),
      kbd: '+',
    }),
    button({
      label: () => t('controls.zoomOut'),
      icon: 'minus',
      iconOnly: true,
      onClick: () => view.zoomBy(0.5),
      kbd: '-',
    }),
    button({
      label: () => t('controls.center'),
      icon: 'crosshair',
      iconOnly: true,
      onClick: () => view.centerCore(),
      kbd: 'C',
    }),
    button({
      label: () => t('controls.fit'),
      icon: 'fit',
      iconOnly: true,
      onClick: () => view.fit(),
      kbd: 'F',
    }),
  );
}

function statusBar(ctx: Ctx): HTMLElement {
  const { store } = ctx;
  return h(
    'div',
    { class: 'status-bar' },
    h('span', { class: 'status-bar__text' }, () => {
      const hov = store.hover.value;
      if (!hov) return t(matchMedia('(pointer: coarse)').matches ? 'status.hintTouch' : 'status.hint');
      return describeTile(store, hov.x, hov.y, hov.cell, hov.time);
    }),
    h('span', { class: 'status-bar__zoom', title: () => t('status.zoom') }, () => {
      const z = store.camera.value.zoom;
      return z >= 1 ? `${fmt(z, 1)}×` : `1:${fmt(1 / z, 1)}`;
    }),
  );
}

/** Result of a finished measurement, with a text equivalent of the line on the map. */
function rulerCard(ctx: Ctx): () => HTMLElement | null {
  return () => {
    const r = ctx.store.ruler.value;
    if (!r?.b || ctx.store.pickMode.value !== 'none') return null;
    const [ax, ay] = r.a;
    const [bx, by] = r.b;
    const steps = t('ruler.steps', { dx: fmt(Math.abs(bx - ax)), dy: fmt(Math.abs(by - ay)) });
    return h(
      'div',
      { class: 'pick-banner pick-banner--info', role: 'status' },
      icon('ruler', 16),
      h(
        'span',
        null,
        formatDistance(ax, ay, bx, by),
        h('span', { class: 'pick-banner__detail' }, ` · ${steps}`),
      ),
      button({
        label: t('ruler.again'),
        size: 'sm',
        variant: 'ghost',
        onClick: () => {
          ctx.store.ruler.value = null;
          ctx.store.pickMode.value = 'measure';
        },
      }),
      button({
        label: t('ruler.clear'),
        size: 'sm',
        variant: 'ghost',
        onClick: () => (ctx.store.ruler.value = null),
      }),
    );
  };
}

function pickBanner(ctx: Ctx): () => HTMLElement | null {
  return () => {
    const mode = ctx.store.pickMode.value;
    if (mode === 'none') return null;
    return h(
      'div',
      { class: 'pick-banner', role: 'status' },
      icon(mode === 'tile' ? 'pipette' : mode === 'measure' ? 'ruler' : 'pin', 16),
      h(
        'span',
        null,
        t(
          mode === 'tile'
            ? 'pick.tile'
            : mode === 'player'
              ? 'pick.player'
              : ctx.store.ruler.value
                ? 'pick.measureEnd'
                : 'pick.measureStart',
        ),
      ),
      button({
        label: t('common.cancel'),
        size: 'sm',
        variant: 'ghost',
        onClick: () => {
          if (mode === 'measure') ctx.store.ruler.value = null;
          ctx.store.pickMode.value = 'none';
        },
      }),
    );
  };
}

export function stage(ctx: Ctx): HTMLElement {
  const { store } = ctx;
  const drop = h(
    'div',
    { class: 'drop-overlay', 'aria-hidden': 'true' },
    icon('upload', 32),
    h('span', null, () => t('open.dropHere')),
  );
  const el = h(
    'main',
    {
      class: () => `stage stage--bg-${store.settings.value.mapBackground}`,
      id: 'map',
      tabindex: '-1',
      'aria-label': () => t('stage.label'),
    },
    ctx.view.el,
    () => (!store.summary.value && store.status.value !== 'loading' ? openCard(ctx) : null),
    () => (store.status.value === 'loading' ? progressCard(ctx) : null),
    pickBanner(ctx),
    rulerCard(ctx),
    () => (store.summary.value ? mapControls(ctx) : null),
    () => (store.summary.value ? statusBar(ctx) : null),
    drop,
  );

  let depth = 0;
  el.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    depth++;
    el.classList.add('is-dropping');
  });
  el.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
  });
  el.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) el.classList.remove('is-dropping');
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    el.classList.remove('is-dropping');
    void ctx.actions.loadDropped(e);
  });
  return el;
}
