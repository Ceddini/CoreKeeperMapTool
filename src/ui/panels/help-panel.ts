import type { Ctx } from '../../app/context.ts';
import { TILE_DATA_INFO } from '../../data/tiles.ts';
import { t, type MsgKey } from '../../i18n/i18n.ts';
import { button, section } from '../components.ts';
import { h } from '../dom.ts';
import { findMapGuide } from '../find-map-guide.ts';
import { icon } from '../icons.ts';
import { FEEDBACK_URL } from './tiles-panel.ts';

const FAQ: string[] = [
  'faq.private',
  'faq.which',
  'faq.rings',
  'faq.maze',
  'faq.gemstone',
  'faq.unknown',
  'faq.mobile',
];

interface Credit {
  name: string;
  role: MsgKey;
  /** The first link goes on the name, the others are listed after the role. */
  links?: { label: string; href: string }[];
}

const CREDITS: Credit[] = [
  {
    name: 'Ceddini',
    role: 'credits.ceddini',
    links: [{ label: 'GitHub', href: 'https://github.com/Ceddini' }],
  },
  {
    name: 'Soul Wade',
    role: 'credits.soulwade',
    links: [{ label: 'Twitter', href: 'https://twitter.com/soul_wade' }],
  },
  {
    name: 'Dakon The Mad',
    role: 'credits.dakon',
    links: [{ label: 'YouTube', href: 'https://www.youtube.com/c/DakonTheMad' }],
  },
];

/** People who worked on earlier versions of the tool. */
const EARLIER_CREDITS: Credit[] = [
  {
    name: 'ZeroGravitas',
    role: 'credits.zerogravitas',
    links: [
      { label: 'YouTube', href: 'https://www.youtube.com/c/ZeroGravitas' },
      {
        label: 'Steam guides',
        href: 'https://steamcommunity.com/profiles/76561197971318812/myworkshopfiles/?section=guides&appid=1621690',
      },
    ],
  },
  {
    name: 'Craigins',
    role: 'credits.craigins',
    links: [{ label: 'GitHub', href: 'https://github.com/craigins' }],
  },
  { name: 'MzHub', role: 'credits.mzhub', links: [{ label: 'GitHub', href: 'https://github.com/MzHub' }] },
  { name: 'user004', role: 'credits.user004' },
  { name: 'Micke', role: 'credits.micke' },
  { name: 'nineforty', role: 'credits.nineforty' },
];

function creditList(list: Credit[]): HTMLElement {
  const ext = (l: { label: string; href: string }, text: string) =>
    h('a', { href: l.href, target: '_blank', rel: 'noopener' }, text);
  return h(
    'ul',
    { class: 'credits' },
    list.map((c) => {
      const [main, ...more] = c.links ?? [];
      return h(
        'li',
        null,
        main ? ext(main, c.name) : h('strong', null, c.name),
        h('span', { class: 'muted' }, () => ` · ${t(c.role)}`),
        more.map((l) => [h('span', { class: 'muted' }, ' · '), ext(l, l.label)]),
      );
    }),
  );
}

function extLink(href: string, label: () => string): HTMLElement {
  return h(
    'a',
    { href, target: '_blank', rel: 'noopener', class: 'link-row' },
    h('span', null, label),
    icon('external', 14),
  );
}

export function helpPanel(ctx: Ctx): HTMLElement {
  return h(
    'div',
    { class: 'panel-content' },
    section({ title: () => t('help.findMap'), children: [findMapGuide()] }),
    section({
      title: () => t('help.shortcuts'),
      open: false,
      children: [
        h('p', { class: 'muted small' }, () => t('help.shortcutsHelp')),
        button({
          label: () => t('help.showShortcuts'),
          icon: 'keyboard',
          onClick: () => ctx.actions.openShortcuts(),
          kbd: '?',
        }),
      ],
    }),
    section({
      title: () => t('help.faq'),
      open: false,
      children: FAQ.map((k) =>
        h(
          'details',
          { class: 'faq' },
          h('summary', { class: 'faq__q' }, () => t(`${k}.q` as MsgKey)),
          h('p', { class: 'faq__a' }, () => t(`${k}.a` as MsgKey)),
        ),
      ),
    }),
    section({
      title: () => t('help.about'),
      open: false,
      children: [
        h('p', { class: 'small' }, () => t('help.aboutText')),
        h(
          'div',
          { class: 'link-list' },
          extLink(FEEDBACK_URL, () => t('help.feedback')),
          extLink('https://www.youtube.com/watch?v=ZeM61AjhiS4', () => t('help.video')),
          extLink('https://github.com/Ceddini/CoreKeeperMapTool', () => t('help.source')),
          extLink('https://linktr.ee/ceddini', () => t('help.support')),
          h(
            'a',
            { href: './privacy.html', class: 'link-row' },
            h('span', null, () => t('help.privacy')),
          ),
        ),
        h(
          'p',
          { class: 'muted small' },
          () => t('help.data', { version: TILE_DATA_INFO.gameVersion }),
          ' ',
          h(
            'a',
            {
              href: 'https://corekeeper.fandom.com/wiki/Core_Keeper_Wiki',
              target: '_blank',
              rel: 'noopener',
            },
            'Core Keeper Wiki',
          ),
          ` (${TILE_DATA_INFO.license}).`,
        ),
        h('p', { class: 'muted small' }, () => t('help.dataDistances')),
      ],
    }),
    section({
      title: () => t('help.credits'),
      open: false,
      children: [
        creditList(CREDITS),
        h('h4', { class: 'credits__title' }, () => t('help.creditsEarlier')),
        creditList(EARLIER_CREDITS),
      ],
    }),
  );
}
