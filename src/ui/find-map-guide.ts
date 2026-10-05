import { t } from '../i18n/i18n.ts';
import { copyField } from './components.ts';
import { h } from './dom.ts';

export const STEAM_PATH = '%USERPROFILE%\\AppData\\LocalLow\\Pugstorm\\Core Keeper\\Steam\\';
export const SERVER_PATH = '%USERPROFILE%\\AppData\\LocalLow\\Pugstorm\\Core Keeper\\DedicatedServer\\';

/** Step-by-step help for locating the map file (used in the open card and the Help panel). */
export function findMapGuide(): HTMLElement {
  return h(
    'div',
    { class: 'stack guide' },
    h(
      'ol',
      { class: 'steps' },
      h('li', null, () => t('guide.step1')),
      h(
        'li',
        null,
        () => t('guide.step2'),
        copyField({ label: () => t('guide.steamPath'), value: STEAM_PATH }),
      ),
      h('li', null, () => t('guide.step3')),
      h('li', null, () => t('guide.step4')),
    ),
    h('p', { class: 'muted small' }, () => t('guide.server')),
    copyField({ label: () => t('guide.serverPath'), value: SERVER_PATH }),
    h('p', { class: 'muted small' }, () => t('guide.tip')),
  );
}
