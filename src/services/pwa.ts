import { registerSW } from 'virtual:pwa-register';
import { t } from '../i18n/i18n.ts';
import { toast } from '../ui/components.ts';

/** Registers the service worker and offers a reload when a new version is ready. */
export function setupPwa(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const update = registerSW({
    onNeedRefresh() {
      toast({
        message: t('pwa.update'),
        action: { label: t('pwa.reload'), onClick: () => void update(true) },
        duration: 30000,
      });
    },
  });
}
