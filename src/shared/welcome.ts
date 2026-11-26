// The first run: three short steps a new person walks through, or skips, the first time
// Kite opens on a profile with nothing saved. It is shown once (HomeState.firstRunSeen) and
// can be opened again from the command bar ("Welcome to Kite").
//
//   hello    what Kite is, in one sentence; people coming from Arc can bring their setup
//   sidebar  the one new idea (tabs live in the sidebar), the one habit (the command bar),
//            and a few starter Favorites so the sidebar is not empty
//   look     light or dark, the Space's color, and the default-browser question

import { ARCHIVE_CHOICES } from './defaults';
import type { HomeState } from './home';
import * as ops from './ops';
import { detach, purge } from './tree';
import type { AppState, ID } from './types';
import { hostOf } from './url';

export type WelcomeStep = 'hello' | 'sidebar' | 'look';
export const WELCOME_STEPS: readonly WelcomeStep[] = ['hello', 'sidebar', 'look'];

export const WELCOME_TEXT: Record<WelcomeStep, { title: string; body: string }> = {
  hello: { title: 'Welcome to Kite', body: 'Your tabs, history and settings stay on this Mac: there is no account, and no server that could read them or switch Kite off.' },
  sidebar: { title: 'Your tabs live in the sidebar', body: 'There is no tab bar. Everything you have open is listed beside this page.' },
  look: { title: 'Make it yours', body: 'The window changes as you choose. You can change all of this later in Settings.' },
};

/** The step before (-1) or after (+1) this one; stays put at either end. */
export function stepFrom(step: WelcomeStep, dir: 1 | -1): WelcomeStep {
  const i = WELCOME_STEPS.indexOf(step);
  return WELCOME_STEPS[Math.max(0, Math.min(WELCOME_STEPS.length - 1, (i < 0 ? 0 : i) + dir))];
}

export const isLastStep = (step: WelcomeStep) => step === WELCOME_STEPS[WELCOME_STEPS.length - 1];

/** The copy says "this Mac"; on Windows and Linux it says "this computer". */
export const forPlatform = (text: string, mac: boolean) => (mac ? text : text.replace(/this Mac/g, 'this computer'));

/**
 * Is the first run due? Only on a brand-new profile. A browser driven by automation (the
 * tests open hundreds of new profiles) meets the plain start page instead, unless the
 * address asks for the first run with `firstrun=1`; `firstrun=0` always skips it.
 */
export function firstRunDue(home: Pick<HomeState, 'firstRunSeen'>, query = '', automated = false): boolean {
  if (home.firstRunSeen) return false;
  const asked = new URLSearchParams(query).get('firstrun');
  return asked === '1' || (asked !== '0' && !automated);
}

/** What the sidebar's three places are, with the real tidy-up time from Settings. */
export function sidebarPlaces(archiveAfterMs: number | null): { id: 'favorites' | 'pinned' | 'today'; name: string; text: string }[] {
  const after = archiveAfterMs === null ? null : (ARCHIVE_CHOICES.find((c) => c.ms === archiveAfterMs)?.label ?? `${Math.max(1, Math.round(archiveAfterMs / 3_600_000))} hours`);
  return [
    { id: 'favorites', name: 'Favorites', text: 'The few sites you use every day, as icons at the top. Always one click away.' },
    { id: 'pinned', name: 'Pinned', text: 'Pages you keep. They stay in the list until you remove them, like bookmarks that are already open.' },
    { id: 'today', name: 'Today', text: after ? `Everything else you open. Tabs you have not used for ${after} are tidied into the Archive, where you can get them back.` : 'Everything else you open. These tabs stay until you close them.' },
  ];
}

/** Well-known sites offered as first Favorites. Nothing is added unless it is ticked. */
export const STARTER_FAVORITES: readonly { name: string; url: string }[] = [
  { name: 'Wikipedia', url: 'https://www.wikipedia.org/' },
  { name: 'YouTube', url: 'https://www.youtube.com/' },
  { name: 'Gmail', url: 'https://mail.google.com/' },
  { name: 'Maps', url: 'https://www.google.com/maps' },
  { name: 'Reddit', url: 'https://www.reddit.com/' },
  { name: 'GitHub', url: 'https://github.com/' },
];

const site = (url: string) => hostOf(url).replace(/^www\./, '') + (/google\.com\/maps/.test(url) ? '/maps' : '');

/** The Favorite that already holds this starter site, if any. */
export function starterFavorite(s: Pick<AppState, 'favorites' | 'items'>, url: string): ID | null {
  return (
    s.favorites.find((id) => {
      const it = s.items[id];
      return it?.kind === 'tab' && site(it.homeUrl ?? it.url) === site(url);
    }) ?? null
  );
}

/** Tick or untick a starter site: ticking adds it to Favorites (without opening it), unticking takes it out again. */
export function setStarterFavorite(s: AppState, starter: { name: string; url: string }, on: boolean, now: number): void {
  const have = starterFavorite(s, starter.url);
  if (on && !have) {
    ops.newTab(s, { url: starter.url, title: starter.name, now, list: 'favorites', activate: false, index: s.favorites.length });
    // A site offered but never opened is not somewhere you have been.
    s.history = s.history.filter((h) => !(h.url === starter.url && h.visits === 1 && h.lastVisitAt === now));
  } else if (!on && have) {
    for (const sp of Object.keys(s.activeBySpace)) if (s.activeBySpace[sp] === have) s.activeBySpace[sp] = null;
    detach(s, have);
    purge(s, have);
  }
}
