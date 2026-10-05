import { effect, scope, untracked } from '../core/signals.ts';

export type Child = Node | string | number | null | undefined | false | (() => Child) | Child[];

type Reactive<T> = T | (() => T);

export type Props = {
  [key: string]: unknown;
  class?: Reactive<string | undefined | false>;
  style?: Partial<Record<string, Reactive<string | number | undefined>>> | string;
  ref?: (el: HTMLElement) => void;
};

const PROPERTIES = new Set(['value', 'checked', 'indeterminate', 'disabled', 'hidden', 'selected', 'open']);

function setAttr(el: Element, key: string, v: unknown): void {
  if (PROPERTIES.has(key)) {
    (el as unknown as Record<string, unknown>)[key] = key === 'value' ? String(v ?? '') : !!v;
    if (key === 'hidden' || key === 'disabled') {
      if (v) el.setAttribute(key, '');
      else el.removeAttribute(key);
    }
    return;
  }
  if (v === false || v === null || v === undefined) el.removeAttribute(key);
  else el.setAttribute(key, v === true ? '' : String(v));
}

function bind<T>(value: Reactive<T>, apply: (v: T) => void): void {
  if (typeof value === 'function') effect(() => apply((value as () => T)()));
  else apply(value);
}

function applyProps(el: HTMLElement | SVGElement, props: Props): void {
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (key === 'ref') continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'class') {
      bind(value as Reactive<string | undefined | false>, (v) => el.setAttribute('class', v || ''));
    } else if (key === 'style') {
      if (typeof value === 'string') el.setAttribute('style', value);
      else
        for (const [prop, v] of Object.entries(
          value as Record<string, Reactive<string | number | undefined>>,
        )) {
          bind(v, (x) => {
            if (x === undefined || x === '') el.style.removeProperty(prop);
            else el.style.setProperty(prop, String(x));
          });
        }
    } else if (typeof value === 'function') {
      effect(() => setAttr(el, key, (value as () => unknown)()));
    } else {
      setAttr(el, key, value);
    }
  }
  (props.ref as ((el: HTMLElement | SVGElement) => void) | undefined)?.(el);
}

/** Append children; functions become reactive regions. */
export function append(parent: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(parent, c);
    else if (typeof c === 'function') parent.appendChild(dynamic(c));
    else if (c instanceof Node) parent.appendChild(c);
    else parent.appendChild(document.createTextNode(String(c)));
  }
}

/**
 * A reactive region: re-renders when signals read by `fn` change. Text results update a single
 * text node in place; node results replace the region (disposing effects of the old content).
 */
export function dynamic(fn: () => Child): Node {
  const start = document.createComment('');
  const frag = document.createDocumentFragment();
  frag.appendChild(start);
  let nodes: Node[] = [];
  let text: Text | null = null;
  let dispose: (() => void) | null = null;
  effect(() => {
    const v = fn();
    if (typeof v === 'string' || typeof v === 'number') {
      if (text && nodes.length === 1 && nodes[0] === text) {
        text.data = String(v);
        return;
      }
    }
    untracked(() => {
      dispose?.();
      for (const n of nodes) n.parentNode?.removeChild(n);
      nodes = [];
      text = null;
      const holder = document.createDocumentFragment();
      dispose = scope(() => {
        if (typeof v === 'string' || typeof v === 'number') {
          text = document.createTextNode(String(v));
          holder.appendChild(text);
        } else append(holder, [v]);
      });
      nodes = [...holder.childNodes];
      const parent = start.parentNode;
      if (parent) parent.insertBefore(holder, start.nextSibling);
      else frag.appendChild(holder);
    });
    return () => {
      // Region removed entirely: handled by the outer scope.
    };
  });
  return frag;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) applyProps(el, props);
  append(el, children);
  return el;
}

/** Render a keyed-less list that rebuilds when `items` changes. */
export function list<T>(items: () => readonly T[], render: (item: T, index: number) => Child): Node {
  return dynamic(() => items().map((it, i) => untracked(() => render(it, i))) as Child[]);
}

let idCounter = 0;
export function uid(prefix = 'id'): string {
  return `${prefix}-${++idCounter}`;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}
