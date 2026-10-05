/**
 * Minimal synchronous signals: `signal`, `computed`, `effect`, `batch`, plus ownership scopes so
 * effects created while building a piece of UI are disposed together.
 */

type Subscriber = { notify(): void; deps: Set<Source> };
type Source = { subs: Set<Subscriber> };

let current: Subscriber | null = null;
let batchDepth = 0;
const pending = new Set<EffectNode>();

export interface ReadSignal<T> {
  readonly value: T;
  peek(): T;
}

export interface Signal<T> extends ReadSignal<T> {
  value: T;
  set(v: T): void;
  update(fn: (v: T) => T): void;
}

function track(src: Source): void {
  if (current) {
    src.subs.add(current);
    current.deps.add(src);
  }
}

function flush(): void {
  if (batchDepth > 0) return;
  while (pending.size) {
    const list = [...pending];
    pending.clear();
    for (const e of list) e.run();
  }
}

class SignalNode<T> implements Signal<T>, Source {
  subs = new Set<Subscriber>();
  private v: T;
  private readonly eq: (a: T, b: T) => boolean;
  constructor(v: T, eq: (a: T, b: T) => boolean) {
    this.v = v;
    this.eq = eq;
  }
  get value(): T {
    track(this);
    return this.v;
  }
  set value(v: T) {
    this.set(v);
  }
  peek(): T {
    return this.v;
  }
  set(v: T): void {
    if (this.eq(this.v, v)) return;
    this.v = v;
    batchDepth++;
    for (const s of [...this.subs]) s.notify();
    batchDepth--;
    flush();
  }
  update(fn: (v: T) => T): void {
    this.set(fn(this.v));
  }
}

class ComputedNode<T> implements ReadSignal<T>, Source, Subscriber {
  subs = new Set<Subscriber>();
  deps = new Set<Source>();
  private v!: T;
  private dirty = true;
  private readonly fn: () => T;
  constructor(fn: () => T) {
    this.fn = fn;
  }
  notify(): void {
    if (this.dirty) return;
    this.dirty = true;
    if (this.subs.size === 0) return;
    // Recompute eagerly and only propagate when the value actually changed, so derived values
    // like `settings.onlyOnMap` don't re-render their readers on unrelated settings changes.
    const prev = this.v;
    const next = this.peek();
    if (Object.is(prev, next)) return;
    for (const s of [...this.subs]) s.notify();
  }
  get value(): T {
    track(this);
    return this.peek();
  }
  peek(): T {
    if (this.dirty) {
      for (const d of this.deps) d.subs.delete(this);
      this.deps.clear();
      const prev = current;
      current = this;
      try {
        this.v = this.fn();
      } finally {
        current = prev;
      }
      this.dirty = false;
    }
    return this.v;
  }
}

class EffectNode implements Subscriber {
  deps = new Set<Source>();
  private cleanup: (() => void) | void = undefined;
  private disposed = false;
  private readonly children: Owner = { disposers: [] };
  private readonly fn: () => void | (() => void);
  constructor(fn: () => void | (() => void)) {
    this.fn = fn;
  }
  notify(): void {
    if (!this.disposed) pending.add(this);
  }
  run(): void {
    if (this.disposed) return;
    this.cleanup?.();
    for (const d of this.children.disposers.splice(0)) d();
    for (const d of this.deps) d.subs.delete(this);
    this.deps.clear();
    const prev = current;
    const prevOwner = owner;
    current = this;
    owner = this.children;
    try {
      this.cleanup = this.fn();
    } catch (e) {
      // One failing effect must not break unrelated updates.
      console.error(e);
    } finally {
      current = prev;
      owner = prevOwner;
    }
  }
  dispose(): void {
    this.disposed = true;
    this.cleanup?.();
    for (const d of this.children.disposers.splice(0)) d();
    for (const d of this.deps) d.subs.delete(this);
    this.deps.clear();
    pending.delete(this);
  }
}

export function signal<T>(v: T, eq: (a: T, b: T) => boolean = Object.is): Signal<T> {
  return new SignalNode(v, eq);
}

export function computed<T>(fn: () => T): ReadSignal<T> {
  return new ComputedNode(fn);
}

// ---- Ownership

type Owner = { disposers: (() => void)[] };
let owner: Owner | null = null;

/** Run `fn` collecting effects/cleanups; returns a function disposing them all. */
export function scope(fn: () => void): () => void {
  const o: Owner = { disposers: [] };
  const prev = owner;
  owner = o;
  try {
    fn();
  } finally {
    owner = prev;
  }
  return () => {
    for (const d of o.disposers.splice(0)) d();
  };
}

export function onCleanup(fn: () => void): void {
  owner?.disposers.push(fn);
}

export function effect(fn: () => void | (() => void)): () => void {
  const e = new EffectNode(fn);
  // Effects created inside an effect are not tracked by it.
  const prev = current;
  current = null;
  try {
    e.run();
  } finally {
    current = prev;
  }
  const dispose = () => e.dispose();
  owner?.disposers.push(dispose);
  return dispose;
}

export function batch<T>(fn: () => T): T {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    flush();
  }
}

export function untracked<T>(fn: () => T): T {
  const prev = current;
  current = null;
  try {
    return fn();
  } finally {
    current = prev;
  }
}
