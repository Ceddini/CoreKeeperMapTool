import { effect, signal } from '../core/signals.ts';
import { t } from '../i18n/i18n.ts';
import { h, uid, type Child } from './dom.ts';
import { icon, type IconName } from './icons.ts';

type R<T> = T | (() => T);

// ---------------------------------------------------------------- Button

export interface ButtonOpts {
  label: R<string>;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  onClick?: (e: MouseEvent) => void;
  disabled?: R<boolean>;
  /** Hide the text visually (icon-only) but keep it as the accessible name. */
  iconOnly?: boolean;
  pressed?: () => boolean;
  title?: R<string>;
  kbd?: string;
  type?: 'button' | 'submit';
  class?: string;
}

export function button(o: ButtonOpts): HTMLButtonElement {
  const cls = [
    'btn',
    `btn--${o.variant ?? 'secondary'}`,
    `btn--${o.size ?? 'md'}`,
    o.iconOnly ? 'btn--icon' : '',
    o.class ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return h(
    'button',
    {
      type: o.type ?? 'button',
      class: cls,
      onClick: o.onClick,
      disabled: o.disabled,
      'aria-pressed': o.pressed ? () => String(o.pressed!()) : undefined,
      'aria-label': o.iconOnly ? o.label : undefined,
      title: o.title ?? (o.iconOnly ? o.label : undefined),
      'aria-keyshortcuts': o.kbd,
    },
    o.icon ? icon(o.icon, o.size === 'sm' ? 16 : 18) : null,
    o.iconOnly ? null : h('span', { class: 'btn__label' }, typeof o.label === 'function' ? o.label : o.label),
  );
}

// ---------------------------------------------------------------- Switch

export interface SwitchOpts {
  label: R<string>;
  description?: R<string>;
  checked: () => boolean;
  onChange: (v: boolean) => void;
  disabled?: R<boolean>;
}

export function switchControl(o: SwitchOpts): HTMLElement {
  const id = uid('sw');
  const descId = o.description ? uid('desc') : undefined;
  const input = h('input', {
    id,
    type: 'checkbox',
    role: 'switch',
    class: 'switch__input',
    checked: o.checked,
    disabled: o.disabled,
    'aria-describedby': descId,
    onChange: (e: Event) => o.onChange((e.target as HTMLInputElement).checked),
  });
  return h(
    'div',
    { class: 'switch' },
    h('label', { for: id, class: 'switch__label' }, typeof o.label === 'function' ? o.label : o.label),
    input,
    h('span', { class: 'switch__track', 'aria-hidden': 'true' }, h('span', { class: 'switch__thumb' })),
    o.description
      ? h(
          'p',
          { id: descId, class: 'switch__desc' },
          typeof o.description === 'function' ? o.description : o.description,
        )
      : null,
  );
}

// ---------------------------------------------------------------- Check row (tiles, POIs)

export interface CheckRowOpts {
  label: R<string>;
  checked: () => boolean;
  indeterminate?: () => boolean;
  onChange: (v: boolean) => void;
  swatch?: R<string>;
  image?: string | null;
  meta?: R<Child>;
  disabled?: R<boolean>;
  extra?: Child;
  /** Extra detail on hover (e.g. the tiles merged into this row). */
  title?: string;
  /** Show meta on a second line under the label (long names). */
  stacked?: boolean;
}

export function checkRow(o: CheckRowOpts): HTMLElement {
  const id = uid('cb');
  const input = h('input', {
    id,
    type: 'checkbox',
    class: 'check__input',
    checked: o.checked,
    disabled: o.disabled,
    onChange: (e: Event) => o.onChange((e.target as HTMLInputElement).checked),
  });
  if (o.indeterminate)
    effect(() => {
      input.indeterminate = o.indeterminate!();
    });
  return h(
    'div',
    { class: o.stacked ? 'check-row check-row--stacked' : 'check-row' },
    input,
    h(
      'label',
      { for: id, class: 'check-row__label', title: o.title },
      h('span', { class: 'check__box', 'aria-hidden': 'true' }, icon('check', 14)),
      o.swatch !== undefined
        ? h('span', { class: 'swatch', 'aria-hidden': 'true', style: { '--swatch': o.swatch as R<string> } })
        : null,
      o.image
        ? h('img', {
            class: 'check-row__img',
            src: o.image,
            alt: '',
            width: '22',
            height: '22',
            loading: 'lazy',
          })
        : null,
      o.stacked
        ? h(
            'span',
            { class: 'check-row__stack' },
            h('span', { class: 'check-row__text' }, typeof o.label === 'function' ? o.label : o.label),
            o.meta !== undefined ? h('span', { class: 'check-row__meta' }, o.meta as Child) : null,
          )
        : [
            h('span', { class: 'check-row__text' }, typeof o.label === 'function' ? o.label : o.label),
            o.meta !== undefined ? h('span', { class: 'check-row__meta' }, o.meta as Child) : null,
          ],
    ),
    o.extra ?? null,
  );
}

// ---------------------------------------------------------------- Slider

export interface SliderOpts {
  label: R<string>;
  value: () => number;
  min: number;
  max: number;
  step?: number;
  onInput: (v: number) => void;
  unit?: string;
  /** Show and accept values as percent of 0–1. */
  percent?: boolean;
  disabled?: R<boolean>;
}

export function slider(o: SliderOpts): HTMLElement {
  const id = uid('sl');
  const numId = uid('num');
  const toUi = (v: number) => (o.percent ? Math.round(v * 100) : v);
  const fromUi = (v: number) => (o.percent ? v / 100 : v);
  const min = toUi(o.min);
  const max = toUi(o.max);
  const clampUi = (v: number) => Math.min(max, Math.max(min, v));
  const commit = (raw: string) => {
    const v = Number(raw);
    if (Number.isFinite(v)) o.onInput(fromUi(clampUi(v)));
  };
  return h(
    'div',
    { class: 'slider' },
    h('label', { for: id, class: 'slider__label' }, typeof o.label === 'function' ? o.label : o.label),
    h(
      'div',
      { class: 'slider__row' },
      h('input', {
        id,
        type: 'range',
        class: 'slider__range',
        min: String(min),
        max: String(max),
        step: String(o.step ?? 1),
        value: () => String(toUi(o.value())),
        disabled: o.disabled,
        'aria-valuetext': () => `${toUi(o.value())}${o.percent ? ' %' : (o.unit ?? '')}`,
        style: { '--fill': () => `${((toUi(o.value()) - min) / (max - min)) * 100}%` },
        onInput: (e: Event) => commit((e.target as HTMLInputElement).value),
      }),
      h(
        'span',
        { class: 'slider__num' },
        h('input', {
          id: numId,
          type: 'number',
          inputmode: 'numeric',
          class: 'input input--num',
          min: String(min),
          max: String(max),
          step: String(o.step ?? 1),
          value: () => String(toUi(o.value())),
          disabled: o.disabled,
          'aria-label': o.label,
          onChange: (e: Event) => commit((e.target as HTMLInputElement).value),
        }),
        o.percent || o.unit
          ? h('span', { class: 'slider__unit', 'aria-hidden': 'true' }, o.percent ? '%' : o.unit)
          : null,
      ),
    ),
  );
}

// ---------------------------------------------------------------- Number field

export function numberField(o: {
  label: R<string>;
  value: () => number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}): HTMLElement {
  const id = uid('nf');
  return h(
    'div',
    { class: 'field' },
    h('label', { for: id, class: 'field__label' }, typeof o.label === 'function' ? o.label : o.label),
    h('input', {
      id,
      type: 'number',
      inputmode: 'numeric',
      class: 'input',
      value: () => String(o.value()),
      min: o.min !== undefined ? String(o.min) : undefined,
      max: o.max !== undefined ? String(o.max) : undefined,
      step: String(o.step ?? 1),
      onChange: (e: Event) => {
        const v = Number((e.target as HTMLInputElement).value);
        if (Number.isFinite(v)) o.onChange(v);
      },
    }),
  );
}

// ---------------------------------------------------------------- Segmented control (radio group)

export function segmented<T extends string>(o: {
  label: R<string>;
  options: { value: T; label: R<string> }[];
  value: () => T;
  onChange: (v: T) => void;
  hideLabel?: boolean;
}): HTMLElement {
  const name = uid('seg');
  return h(
    'fieldset',
    { class: 'segmented' },
    h(
      'legend',
      { class: o.hideLabel ? 'visually-hidden' : 'segmented__legend' },
      typeof o.label === 'function' ? o.label : o.label,
    ),
    h(
      'div',
      { class: 'segmented__track' },
      o.options.map((opt) => {
        const id = uid('opt');
        return h(
          'span',
          { class: 'segmented__item' },
          h('input', {
            id,
            type: 'radio',
            name,
            class: 'segmented__input',
            value: opt.value,
            checked: () => o.value() === opt.value,
            onChange: () => o.onChange(opt.value),
          }),
          h(
            'label',
            { for: id, class: 'segmented__label' },
            typeof opt.label === 'function' ? opt.label : opt.label,
          ),
        );
      }),
    ),
  );
}

// ---------------------------------------------------------------- Section (disclosure)

export function section(o: {
  title: R<string>;
  open?: boolean;
  badge?: R<Child>;
  children: Child[];
  id?: string;
}): HTMLElement {
  return h(
    'details',
    { class: 'section', open: o.open ?? true, id: o.id },
    h(
      'summary',
      { class: 'section__summary' },
      h('h3', { class: 'section__title' }, typeof o.title === 'function' ? o.title : o.title),
      o.badge !== undefined ? h('span', { class: 'section__badge' }, o.badge as Child) : null,
      h('span', { class: 'section__chevron', 'aria-hidden': 'true' }, icon('chevron', 16)),
    ),
    h('div', { class: 'section__body' }, ...o.children),
  );
}

// ---------------------------------------------------------------- Copy field

export function copyField(o: { label: R<string>; value: string }): HTMLElement {
  const id = uid('copy');
  const copied = signal(false);
  return h(
    'div',
    { class: 'field' },
    h('label', { for: id, class: 'field__label' }, typeof o.label === 'function' ? o.label : o.label),
    h(
      'div',
      { class: 'copy-field' },
      h('input', {
        id,
        class: 'input input--mono',
        readonly: true,
        value: o.value,
        onFocus: (e: Event) => (e.target as HTMLInputElement).select(),
      }),
      button({
        label: () => (copied.value ? t('common.copied') : t('common.copy')),
        icon: 'copy',
        size: 'sm',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(o.value);
            copied.value = true;
            setTimeout(() => (copied.value = false), 1600);
          } catch {
            document.getElementById(id)?.focus();
          }
        },
      }),
    ),
  );
}

// ---------------------------------------------------------------- Badge / kbd

export function badge(
  text: R<Child>,
  tone: 'neutral' | 'success' | 'warning' | 'info' = 'neutral',
): HTMLElement {
  return h('span', { class: `badge badge--${tone}` }, text as Child);
}

export function kbd(...keys: string[]): HTMLElement {
  return h(
    'span',
    { class: 'kbd-group' },
    keys.map((k) => h('kbd', { class: 'kbd' }, k)),
  );
}

// ---------------------------------------------------------------- Toasts

export interface ToastOpts {
  message: R<string>;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  action?: { label: string; onClick: () => void };
  duration?: number;
}

let toastHost: HTMLElement | null = null;

export function toastRegion(): HTMLElement {
  toastHost = h('div', {
    class: 'toasts',
    role: 'status',
    'aria-live': 'polite',
    'aria-relevant': 'additions',
  });
  return toastHost;
}

export function toast(o: ToastOpts): void {
  if (!toastHost) return;
  const node: HTMLElement = h(
    'div',
    { class: `toast toast--${o.tone ?? 'neutral'}` },
    h('span', { class: 'toast__msg' }, typeof o.message === 'function' ? o.message : o.message),
    o.action
      ? button({
          label: o.action.label,
          variant: 'ghost',
          size: 'sm',
          onClick: () => {
            o.action!.onClick();
            close();
          },
        })
      : null,
    button({
      label: t('common.dismiss'),
      icon: 'close',
      iconOnly: true,
      variant: 'ghost',
      size: 'sm',
      onClick: () => close(),
    }),
  );
  const close = () => {
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 200);
  };
  toastHost.appendChild(node);
  while (toastHost.children.length > 3) toastHost.firstElementChild?.remove();
  setTimeout(close, o.duration ?? (o.action ? 8000 : 4000));
}

// ---------------------------------------------------------------- Dialog

export function dialog(o: {
  title: R<string>;
  body: Child;
  footer?: Child;
  wide?: boolean;
  onClose?: () => void;
}): {
  el: HTMLDialogElement;
  open(): void;
  close(): void;
} {
  const titleId = uid('dlg');
  let opener: HTMLElement | null = null;
  const el: HTMLDialogElement = h(
    'dialog',
    { class: `dialog${o.wide ? ' dialog--wide' : ''}`, 'aria-labelledby': titleId },
    h(
      'header',
      { class: 'dialog__header' },
      h('h2', { id: titleId, class: 'dialog__title' }, typeof o.title === 'function' ? o.title : o.title),
      button({
        label: () => t('common.close'),
        icon: 'close',
        iconOnly: true,
        variant: 'ghost',
        onClick: () => api.close(),
      }),
    ),
    h('div', { class: 'dialog__body' }, o.body),
    o.footer ? h('footer', { class: 'dialog__footer' }, o.footer) : null,
  );
  el.addEventListener('close', () => {
    o.onClose?.();
    opener?.focus();
  });
  el.addEventListener('click', (e) => {
    if (e.target === el) api.close();
  });
  const api = {
    el,
    open() {
      opener = document.activeElement as HTMLElement | null;
      if (!el.isConnected) document.body.appendChild(el);
      el.showModal();
      // Start on the first control of the content rather than the close button.
      (
        el.querySelector(
          '.dialog__body input, .dialog__body select, .dialog__body button, .dialog__body [tabindex]',
        ) as HTMLElement | null
      )?.focus();
    },
    close() {
      if (el.open) el.close();
    },
  };
  return api;
}

// ---------------------------------------------------------------- Menu (context menu / popover)

export interface MenuItem {
  label: string;
  icon?: IconName;
  onSelect: () => void;
  disabled?: boolean;
}

let openMenu: HTMLElement | null = null;

export function showMenu(
  x: number,
  y: number,
  items: MenuItem[],
  heading?: string,
  container: HTMLElement = document.body,
): void {
  closeMenu();
  const prev = document.activeElement as HTMLElement | null;
  const buttons = items.map((it) =>
    h(
      'button',
      {
        type: 'button',
        role: 'menuitem',
        class: 'menu__item',
        disabled: it.disabled,
        tabindex: '-1',
        onClick: () => {
          closeMenu();
          prev?.focus();
          it.onSelect();
        },
      },
      it.icon ? icon(it.icon, 16) : null,
      h('span', null, it.label),
    ),
  );
  const menu = h(
    'div',
    { class: 'menu', role: 'menu', 'aria-label': heading ?? '' },
    heading ? h('div', { class: 'menu__heading', 'aria-hidden': 'true' }, heading) : null,
    ...buttons,
  );
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  container.appendChild(menu);
  // Keep inside the container.
  const r = menu.getBoundingClientRect();
  const c = container.getBoundingClientRect();
  if (r.right > c.right - 8) menu.style.left = `${Math.max(8, x - r.width)}px`;
  if (r.bottom > c.bottom - 8) menu.style.top = `${Math.max(8, y - r.height)}px`;
  openMenu = menu;
  let focus = 0;
  buttons[0]?.focus();
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      focus = (focus + (e.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
      buttons[focus]!.focus();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      closeMenu();
      prev?.focus();
    }
  });
  setTimeout(() => document.addEventListener('pointerdown', outside, { capture: true }), 0);
}

function outside(e: Event): void {
  if (openMenu && !openMenu.contains(e.target as Node)) closeMenu();
}

export function closeMenu(): void {
  openMenu?.remove();
  openMenu = null;
  document.removeEventListener('pointerdown', outside, { capture: true });
}
