import type { Ctx } from '../../app/context.ts';
import { computed, signal } from '../../core/signals.ts';
import type { HistoryState } from '../../core/store.ts';
import { t, tn } from '../../i18n/i18n.ts';
import type { TimelineInfo } from '../../workers/analysis/timeline.ts';
import { button, section, segmented, switchControl } from '../components.ts';
import { h, uid } from '../dom.ts';
import { formatExploreTime } from '../map-view.ts';

/** Shorter than this, the map was revealed in one go (e.g. by a mod) and has no real history. */
const MIN_SPAN_S = 5 * 60;
const REPLAY_MS = 15_000;
const STEPS = 1000;

/** Small bar chart of how much was explored when (decorative: the slider and text carry the info). */
function sparkline(info: TimelineInfo): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const n = info.histogram.length;
  svg.setAttribute('viewBox', `0 0 ${n} 24`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'sparkline');
  svg.setAttribute('aria-hidden', 'true');
  const max = Math.max(...info.histogram, 1);
  info.histogram.forEach((v, i) => {
    if (!v) return;
    const hgt = Math.max(1, (Math.sqrt(v) / Math.sqrt(max)) * 24);
    const r = document.createElementNS(ns, 'rect');
    r.setAttribute('x', String(i));
    r.setAttribute('y', String(24 - hgt));
    r.setAttribute('width', '0.8');
    r.setAttribute('height', String(hgt));
    svg.appendChild(r);
  });
  return svg;
}

export function historySection(ctx: Ctx): HTMLElement {
  const { store } = ctx;
  const info = computed(() => store.timeline.value);
  const hist = () => store.history.value;
  const set = (patch: Partial<HistoryState>) => (store.history.value = { ...store.history.peek(), ...patch });
  let playing = 0;
  const historyOn = computed(() => store.history.value.on);
  const playingSig = signal(false);
  const mode = computed(() => store.history.value.mode);

  const stopReplay = () => {
    cancelAnimationFrame(playing);
    playing = 0;
    playingSig.value = false;
  };

  const startReplay = (i: TimelineInfo) => {
    stopReplay();
    const from = store.history.peek().cut >= i.max ? i.min : store.history.peek().cut;
    const t0 = performance.now() - ((from - i.min) / Math.max(1, i.max - i.min)) * REPLAY_MS;
    set({ on: true, mode: 'replay' });
    playingSig.value = true;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / REPLAY_MS);
      set({ cut: i.min + k * (i.max - i.min) });
      if (k < 1 && store.history.peek().on && store.history.peek().mode === 'replay')
        playing = requestAnimationFrame(tick);
      else stopReplay();
    };
    playing = requestAnimationFrame(tick);
  };

  const body = () => {
    const i = info.value;
    if (!store.summary.value) return h('p', { class: 'muted small' }, t('history.noMap'));
    if (!i) return h('p', { class: 'muted small' }, t('history.none'));
    if (i.max - i.min < MIN_SPAN_S) return h('p', { class: 'muted small' }, t('history.revealed'));

    const sliderId = uid('hist');
    const toStep = (sec: number) => Math.round(((sec - i.min) / (i.max - i.min)) * STEPS);
    const fromStep = (step: number) => i.min + (step / STEPS) * (i.max - i.min);
    const cutLabel = () =>
      hist().mode === 'replay'
        ? t('history.upTo', { when: formatExploreTime(hist().cut) })
        : t('history.since', { when: formatExploreTime(hist().cut) });

    // Start somewhere useful the first time: the latest session.
    const initial = store.history.peek().cut;
    if (initial < i.min || initial > i.max) {
      const last = i.sessions[i.sessions.length - 1];
      queueMicrotask(() => set({ cut: last ? last.start : i.min }));
    }

    return h(
      'div',
      { class: 'stack' },
      h('p', { class: 'muted small' }, () =>
        t('history.range', {
          from: formatExploreTime(i.min),
          to: formatExploreTime(i.max),
          sessions: tn('history.sessions', i.sessions.length),
        }),
      ),
      switchControl({
        label: () => t('history.show'),
        description: () => t('history.desc'),
        checked: () => hist().on,
        onChange: (on) => {
          if (!on) stopReplay();
          set({ on });
        },
      }),
      segmented({
        label: () => t('history.mode'),
        options: [
          { value: 'recent', label: () => t('history.mode.recent') },
          { value: 'replay', label: () => t('history.mode.replay') },
        ],
        value: () => hist().mode,
        onChange: (mode) => {
          stopReplay();
          set({ mode, on: true });
        },
      }),
      i.sessions.length > 1
        ? h(
            'div',
            { class: 'field' },
            h('label', { for: `${sliderId}-s`, class: 'field__label' }, () => t('history.session')),
            h(
              'select',
              {
                id: `${sliderId}-s`,
                class: 'input select',
                onChange: (e: Event) => {
                  const s = i.sessions[Number((e.target as HTMLSelectElement).value)];
                  if (!s) return;
                  stopReplay();
                  set({ on: true, cut: store.history.peek().mode === 'replay' ? s.end : s.start });
                },
              },
              h('option', { value: '' }, () => t('history.sessionPick')),
              [...i.sessions]
                .map((s, idx) => ({ s, idx }))
                .reverse()
                .map(({ s, idx }) =>
                  h(
                    'option',
                    { value: String(idx) },
                    `${formatExploreTime(s.start)} · ${Math.max(1, Math.round((s.end - s.start) / 60))} min · ${tn('history.tiles', s.tiles)}`,
                  ),
                ),
            ),
          )
        : null,
      h(
        'div',
        { class: 'slider' },
        h('label', { for: sliderId, class: 'slider__label' }, cutLabel),
        sparkline(i),
        h('input', {
          id: sliderId,
          type: 'range',
          class: 'slider__range',
          min: '0',
          max: String(STEPS),
          step: '1',
          value: () => String(toStep(hist().cut)),
          'aria-valuetext': cutLabel,
          style: { '--fill': () => `${(toStep(hist().cut) / STEPS) * 100}%` },
          onInput: (e: Event) => {
            stopReplay();
            set({ on: true, cut: fromStep(Number((e.target as HTMLInputElement).value)) });
          },
        }),
      ),
      () =>
        mode.value === 'replay'
          ? button({
              label: () => (playingSig.value ? t('history.pause') : t('history.play')),
              icon: 'play',
              size: 'sm',
              pressed: () => playingSig.value,
              onClick: () => (playing ? stopReplay() : startReplay(i)),
            })
          : null,
    );
  };

  return section({
    id: 'history-section',
    title: () => t('history.title'),
    open: false,
    badge: () => (historyOn.value ? h('span', { class: 'badge badge--info' }, t('common.on')) : null),
    children: [body],
  });
}
