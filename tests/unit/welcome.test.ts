import { describe, expect, it } from 'vitest';
import { STARTER_FAVORITES, WELCOME_STEPS, WELCOME_TEXT, firstRunDue, forPlatform, isLastStep, setStarterFavorite, sidebarPlaces, starterFavorite, stepFrom } from '@shared/welcome';
import { ACTION_CATALOG } from '@shared/commandbar';
import { createInitialState, HOUR } from '@shared/defaults';
import { loadState } from '@shared/persistence';
import * as ops from '@shared/ops';

describe('the first run', () => {
  it('has three steps in order, each with a title and a short text', () => {
    expect(WELCOME_STEPS).toEqual(['hello', 'sidebar', 'look']);
    for (const s of WELCOME_STEPS) {
      expect(WELCOME_TEXT[s].title.length).toBeGreaterThan(3);
      expect(WELCOME_TEXT[s].body.length).toBeGreaterThan(10);
      // Plain words: nothing shouted.
      expect(WELCOME_TEXT[s].title + WELCOME_TEXT[s].body).not.toContain('!');
    }
    expect(forPlatform(WELCOME_TEXT.hello.body, true)).toContain('this Mac');
    expect(forPlatform(WELCOME_TEXT.hello.body, false)).toContain('this computer');
    expect(forPlatform(WELCOME_TEXT.hello.body, false)).not.toContain('Mac');
  });

  it('moves forward and back, and stops at both ends', () => {
    expect(stepFrom('hello', 1)).toBe('sidebar');
    expect(stepFrom('sidebar', 1)).toBe('look');
    expect(stepFrom('look', 1)).toBe('look');
    expect(stepFrom('look', -1)).toBe('sidebar');
    expect(stepFrom('hello', -1)).toBe('hello');
    expect(stepFrom('nope' as never, 1)).toBe('sidebar');
    expect(WELCOME_STEPS.filter(isLastStep)).toEqual(['look']);
  });

  it('can be opened by name from the command bar', () => {
    expect(ACTION_CATALOG.find((a) => a.id === 'welcome')?.title).toBe('Welcome to Kite');
  });

  it('is due once, on a brand-new profile only', () => {
    const fresh = loadState(null);
    expect(firstRunDue(fresh.home)).toBe(true);
    // A profile saved by a Kite from before the first run existed is not new.
    const old = JSON.parse(JSON.stringify(createInitialState()));
    delete old.home.firstRunSeen;
    expect(firstRunDue(loadState(old).home)).toBe(false);
    // Once shown it is saved as seen, and stays seen.
    fresh.home.firstRunSeen = true;
    expect(firstRunDue(loadState(JSON.parse(JSON.stringify(fresh))).home)).toBe(false);
  });

  it('leaves automated runs alone unless they ask for it', () => {
    const home = { firstRunSeen: false };
    expect(firstRunDue(home, '?platform=darwin', true)).toBe(false);
    expect(firstRunDue(home, '?platform=darwin&firstrun=1', true)).toBe(true);
    expect(firstRunDue(home, '?firstrun=0', false)).toBe(false);
    expect(firstRunDue({ firstRunSeen: true }, '?firstrun=1', false)).toBe(false);
  });

  it('describes the sidebar with the real tidy-up time', () => {
    const places = sidebarPlaces(12 * HOUR);
    expect(places.map((p) => p.name)).toEqual(['Favorites', 'Pinned', 'Today']);
    expect(places[2].text).toContain('12 hours');
    expect(sidebarPlaces(HOUR)[2].text).toContain('1 hour');
    expect(sidebarPlaces(5 * HOUR)[2].text).toContain('5 hours');
    // Never archived: no promise of tidying.
    expect(sidebarPlaces(null)[2].text).not.toMatch(/tidied|Archive/);
  });
});

describe('starter Favorites', () => {
  it('offers a handful of sites and adds only the ones that are ticked', () => {
    expect(STARTER_FAVORITES.length).toBeGreaterThanOrEqual(4);
    expect(STARTER_FAVORITES.length).toBeLessThanOrEqual(6);
    const s = createInitialState();
    const [wiki, tube] = STARTER_FAVORITES;
    expect(starterFavorite(s, wiki.url)).toBeNull();
    setStarterFavorite(s, wiki, true, 1);
    setStarterFavorite(s, tube, true, 2);
    expect(s.favorites).toHaveLength(2);
    const id = starterFavorite(s, wiki.url)!;
    expect(s.items[id]).toMatchObject({ kind: 'tab', url: wiki.url, homeUrl: wiki.url, title: wiki.name });
    // In order, not opened, and not in history: nobody has been there yet.
    expect(s.favorites.map((f) => (s.items[f] as { title: string }).title)).toEqual([wiki.name, tube.name]);
    expect(ops.activeItemId(s)).toBeNull();
    expect(s.history).toEqual([]);
    // Ticking twice adds it once.
    setStarterFavorite(s, wiki, true, 3);
    expect(s.favorites).toHaveLength(2);
  });

  it('unticking takes the site out again, leaving nothing behind', () => {
    const s = createInitialState();
    const wiki = STARTER_FAVORITES[0];
    setStarterFavorite(s, wiki, true, 1);
    const id = starterFavorite(s, wiki.url)!;
    setStarterFavorite(s, wiki, false, 2);
    expect(s.favorites).toEqual([]);
    expect(s.items[id]).toBeUndefined();
    expect(s.closed).toEqual([]);
    expect(s.spaces[0].today).toEqual([]);
  });

  it('knows a site that is already a Favorite, however it got there', () => {
    const s = createInitialState();
    ops.newTab(s, { url: 'https://youtube.com/watch?v=1', now: 1, list: 'favorites', activate: false });
    const tube = STARTER_FAVORITES.find((f) => f.name === 'YouTube')!;
    expect(starterFavorite(s, tube.url)).not.toBeNull();
    // Gmail and Maps are both Google, and still two different sites.
    const maps = STARTER_FAVORITES.find((f) => f.name === 'Maps')!;
    const mail = STARTER_FAVORITES.find((f) => f.name === 'Gmail')!;
    setStarterFavorite(s, maps, true, 2);
    expect(starterFavorite(s, mail.url)).toBeNull();
    expect(starterFavorite(s, maps.url)).not.toBeNull();
  });
});
