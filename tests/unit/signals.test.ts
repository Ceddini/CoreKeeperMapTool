import { describe, expect, it } from 'vitest';
import { batch, computed, effect, scope, signal } from '../../src/core/signals.ts';

describe('signals', () => {
  it('re-runs effects when dependencies change', () => {
    const a = signal(1);
    const seen: number[] = [];
    effect(() => void seen.push(a.value));
    a.value = 2;
    a.value = 2;
    expect(seen).toEqual([1, 2]);
  });

  it('computes lazily and propagates', () => {
    const a = signal(2);
    let runs = 0;
    const sq = computed(() => (runs++, a.value * a.value));
    const seen: number[] = [];
    effect(() => void seen.push(sq.value));
    a.value = 3;
    expect(seen).toEqual([4, 9]);
    expect(runs).toBe(2);
  });

  it('batches updates into one effect run', () => {
    const a = signal(1);
    const b = signal(1);
    let runs = 0;
    effect(() => {
      void a.value;
      void b.value;
      runs++;
    });
    batch(() => {
      a.value = 5;
      b.value = 6;
    });
    expect(runs).toBe(2);
  });

  it('disposes effects created in a scope and nested effects on re-run', () => {
    const a = signal(0);
    const outer = signal(0);
    let inner = 0;
    const dispose = scope(() => {
      effect(() => {
        void outer.value;
        effect(() => {
          void a.value;
          inner++;
        });
      });
    });
    outer.value = 1; // recreates the inner effect, disposing the old one
    a.value = 1; // only one inner effect should run
    expect(inner).toBe(3);
    dispose();
    a.value = 2;
    expect(inner).toBe(3);
  });
});
