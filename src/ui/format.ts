import { signal } from '../core/signals.ts';
import { lang } from '../i18n/i18n.ts';

/** Ticks every few seconds so relative times shown in the UI stay fresh. */
export const now = signal(Date.now());
setInterval(() => (now.value = Date.now()), 5000);

export function relativeTime(ts: number, at = now.value): string {
  const diff = Math.round((ts - at) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang.value, { numeric: 'auto', style: 'short' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.min(0, diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}
