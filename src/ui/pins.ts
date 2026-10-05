import { mapKey, patchSettings, type AppStore, type Pin } from '../core/store.ts';
import { t } from '../i18n/i18n.ts';
import { toast } from './components.ts';

const COLORS = ['#ffcf70', '#7fe3d9', '#ff8fa3', '#9ec5ff', '#b6f29a', '#d7a6ff'];

export function currentPins(store: AppStore): Pin[] {
  const key = mapKey(store);
  return key ? (store.settings.value.pins[key] ?? []) : [];
}

function setPins(store: AppStore, fn: (pins: Pin[]) => Pin[]): void {
  const key = mapKey(store);
  if (!key) return;
  patchSettings(store, (s) => {
    const next = fn(s.pins[key] ?? []);
    const pins = { ...s.pins };
    if (next.length) pins[key] = next;
    else delete pins[key];
    return { pins, showPins: true };
  });
}

/** Adds a pin and returns it (so the UI can focus its name field). */
export function addPin(store: AppStore, x: number, y: number): Pin | null {
  if (!mapKey(store)) return null;
  const existing = currentPins(store);
  const pin: Pin = {
    id: Math.random().toString(36).slice(2, 10),
    x,
    y,
    label: t('pins.defaultName', { n: existing.length + 1 }),
    color: COLORS[existing.length % COLORS.length]!,
  };
  setPins(store, (pins) => [...pins, pin]);
  return pin;
}

export function updatePin(store: AppStore, id: string, patch: Partial<Omit<Pin, 'id'>>): void {
  setPins(store, (pins) => pins.map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

export function removePin(store: AppStore, id: string): void {
  const before = currentPins(store);
  const pin = before.find((p) => p.id === id);
  if (!pin) return;
  setPins(store, (pins) => pins.filter((p) => p.id !== id));
  toast({
    message: t('pins.removed', { name: pin.label }),
    action: { label: t('common.undo'), onClick: () => setPins(store, () => before) },
  });
}

/** Pins as a small JSON file, e.g. to share with friends on the same world. */
export function exportPins(store: AppStore): Blob {
  const pins = currentPins(store).map(({ x, y, label, color }) => ({ x, y, label, color }));
  return new Blob([JSON.stringify({ type: 'ck-map-tool-pins', version: 1, pins }, null, 2)], {
    type: 'application/json',
  });
}

/** Adds pins from an exported file; returns how many were added. */
export function importPins(store: AppStore, text: string): number {
  const data = JSON.parse(text) as { pins?: unknown };
  const list = Array.isArray(data.pins) ? data.pins : [];
  const valid = list.filter(
    (p): p is Omit<Pin, 'id'> =>
      !!p &&
      typeof p === 'object' &&
      Number.isFinite((p as Pin).x) &&
      Number.isFinite((p as Pin).y) &&
      typeof (p as Pin).label === 'string',
  );
  const added: Pin[] = valid.map((p) => ({
    id: Math.random().toString(36).slice(2, 10),
    x: Math.round(p.x),
    y: Math.round(p.y),
    label: p.label.slice(0, 60),
    color: /^#[0-9a-f]{6}$/i.test(p.color ?? '') ? p.color : COLORS[0]!,
  }));
  if (added.length) setPins(store, (pins) => [...pins, ...added]);
  return added.length;
}

/** Focus (and select) a pin's name field, opening its section first. Retries briefly, since the
 * Layers panel may still be loading when a pin is added from the map. */
export function focusPinName(id: string, tries = 20): void {
  const sec = document.getElementById('pins-section') as HTMLDetailsElement | null;
  const input = document.querySelector<HTMLInputElement>(`[data-pin-name="${id}"]`);
  if (!sec || !input) {
    if (tries > 0) setTimeout(() => focusPinName(id, tries - 1), 50);
    return;
  }
  sec.open = true;
  input.scrollIntoView({ block: 'nearest' });
  input.focus();
  input.select();
}
