import type { Ctx } from '../../app/context.ts';
import { patchSettings } from '../../core/store.ts';
import { tilesByRgb } from '../../data/tiles.ts';
import { fmt, t, tn } from '../../i18n/i18n.ts';
import { badge, button, section, segmented, switchControl } from '../components.ts';
import { h } from '../dom.ts';
import { relativeTime } from '../format.ts';

export function mapPanel(ctx: Ctx): HTMLElement {
  const { store, actions } = ctx;

  const fileCard = () => {
    const f = store.file.value;
    const s = store.summary.value;
    if (!f || !s) {
      return h(
        'div',
        { class: 'stack' },
        h('p', { class: 'muted' }, t('mapPanel.noMap')),
        h(
          'div',
          { class: 'button-row' },
          button({
            label: t('open.choose'),
            icon: 'folder',
            variant: 'primary',
            onClick: () => void actions.open(),
          }),
          button({ label: t('open.example'), icon: 'map', onClick: () => void actions.example() }),
        ),
      );
    }
    return h(
      'div',
      { class: 'stack' },
      h(
        'div',
        { class: 'file-card' },
        h(
          'div',
          { class: 'file-card__name', title: f.name },
          f.source === 'example' ? t('mapPanel.exampleName') : f.name,
        ),
        h('div', { class: 'file-card__meta' }, tn('mapPanel.chunks', s.chunkCount), ' · ', () =>
          t('mapPanel.loadedAgo', { time: relativeTime(store.updatedAt.value ?? Date.now()) }),
        ),
      ),
      h(
        'div',
        { class: 'button-row' },
        button({ label: t('mapPanel.openAnother'), icon: 'folder', onClick: () => void actions.open() }),
        f.source !== 'example'
          ? button({
              label: t('mapPanel.reload'),
              icon: 'refresh',
              onClick: () => void actions.refresh(),
              kbd: 'R',
            })
          : null,
      ),
      s.warnings.length
        ? h('p', { class: 'notice notice--warning' }, tn('mapPanel.corruptParts', s.warnings.length))
        : null,
    );
  };

  const liveControl = () =>
    ctx.supportsLive
      ? switchControl({
          label: () => t('mapPanel.live'),
          description: () =>
            store.live.value === 'paused'
              ? t('mapPanel.livePaused')
              : store.live.value === 'watching'
                ? t('mapPanel.liveOn')
                : t('mapPanel.liveDesc'),
          checked: () => store.settings.value.liveRefresh,
          onChange: (v) => actions.setLive(v),
          disabled: () => !store.summary.value || store.file.value?.source === 'example',
        })
      : h('p', { class: 'muted small' }, () => t('mapPanel.liveUnsupported'));

  const unknownCount = () => {
    const st = store.stats.value;
    if (!st) return 0;
    const pal = store.palette.value;
    let n = 0;
    for (let i = 1; i < pal.size; i++) if (st.counts[i] && !tilesByRgb.has(pal.colors[i]!)) n++;
    return n;
  };

  return h(
    'div',
    { class: 'panel-content' },
    section({ title: () => t('mapPanel.file'), children: [fileCard, liveControl] }),
    section({
      title: () => t('mapPanel.world'),
      children: [
        segmented({
          label: () => t('mapPanel.worldType'),
          options: [
            { value: 'standard', label: () => t('world.standard') },
            { value: 'classic', label: () => t('world.classic') },
          ],
          value: () => store.settings.value.world,
          onChange: (world) => {
            patchSettings(store, () => ({ world }));
            void ctx.service.refreshAnalysis();
          },
          hideLabel: true,
        }),
        h('p', { class: 'muted small' }, () => t('mapPanel.worldHelp')),
      ],
    }),
    section({
      title: () => t('mapPanel.export'),
      children: [
        h('p', { class: 'muted small' }, () => t('mapPanel.exportHelp')),
        button({
          label: () => t('mapPanel.exportButton'),
          icon: 'image',
          onClick: () => actions.openExport(),
          disabled: () => !store.summary.value,
          kbd: 'E',
        }),
      ],
    }),
    () =>
      store.stats.value
        ? section({
            title: () => t('mapPanel.summary'),
            children: [
              h(
                'dl',
                { class: 'stats' },
                h('dt', null, t('mapPanel.explored')),
                h('dd', null, () => fmt(store.stats.value?.explored ?? 0)),
                h('dt', null, t('mapPanel.colours')),
                h('dd', null, () => fmt(store.palette.value.size - 1)),
                h('dt', null, t('mapPanel.unknown')),
                h('dd', null, () => {
                  const n = unknownCount();
                  return n ? badge(fmt(n), 'warning') : fmt(0);
                }),
                h('dt', null, t('mapPanel.loadTime')),
                h('dd', null, () => `${fmt(store.summary.value?.ms ?? 0)} ms`),
              ),
            ],
          })
        : null,
  );
}
