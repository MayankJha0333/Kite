import { describe, expect, it } from 'vitest';
import { ACTION_CATALOG, matchRanges, matchScore, searchEngineName, STARTER_ACTIONS, suggest } from '@shared/commandbar';
import { newTab, pinItem, recordVisit, select } from '@shared/ops';
import { createSpace } from '@shared/spaces';
import { fresh, run, T0 } from './helpers';

describe('matchScore', () => {
  it('ranks exact > prefix > word start > substring > fuzzy > none', () => {
    const scores = [
      matchScore('git', 'git'),
      matchScore('git', 'github'),
      matchScore('git', 'my github'),
      matchScore('git', 'legitimate'),
      matchScore('gthb', 'github'),
      matchScore('xyz', 'github'),
    ];
    for (let i = 0; i < scores.length - 1; i++) expect(scores[i]).toBeGreaterThan(scores[i + 1]);
    expect(scores[5]).toBe(0);
  });
  it('is case-insensitive and handles regex characters', () => {
    expect(matchScore('GIT', 'GitHub')).toBeGreaterThan(0);
    expect(matchScore('c++', 'learn c++ fast')).toBeGreaterThan(0);
  });
  it('ignores letters scattered far apart', () => {
    expect(matchScore('new', 'en.wikipedia.org/wiki/kite')).toBe(0);
  });
  it('a short query has to be contiguous or sit on word starts: three scattered letters match nothing', () => {
    // What "git" used to drag in.
    for (const noise of ['Toggle Light / Dark', 'en.wikipedia.org/wiki/Kite', 'visited pages sites recent browsing', 'Customize Kite']) expect(matchScore('git', noise)).toBe(0);
    expect(matchScore('ghb', 'github')).toBe(0);
    // One or two letters only count at the start of a word.
    expect(matchScore('i', 'Kite')).toBe(0);
    expect(matchScore('it', 'Kite')).toBe(0);
    expect(matchScore('ki', 'en.wikipedia.org/wiki/Kite')).toBeGreaterThan(0);
  });
  it('accepts initials, every typed word in any order, and a skipped letter in a longer word', () => {
    expect(matchScore('hn', 'Hacker News')).toBeGreaterThan(0);
    expect(matchScore('gh', 'GitHub')).toBeGreaterThan(0);
    expect(matchScore('docs mdn', 'MDN Web Docs')).toBeGreaterThan(0);
    expect(matchScore('docs rust', 'MDN Web Docs')).toBe(0);
    expect(matchScore('settngs', 'Settings')).toBeGreaterThan(0);
    // The strict form, used for whole addresses and keywords, takes none of the guesses.
    expect(matchScore('hn', 'Hacker News', false)).toBe(0);
    expect(matchScore('settngs', 'Settings', false)).toBe(0);
    // A real word always beats a guess.
    expect(matchScore('hn', 'hn.algolia.com')).toBeGreaterThan(matchScore('hn', 'Hacker News'));
  });
  it('highlights the letters that matched, in runs', () => {
    expect(matchRanges('hub', 'GitHub')).toEqual([[3, 6]]);
    expect(matchRanges('ghb', 'GitHub')).toEqual([]);
    expect(matchRanges('hn', 'Hacker News')).toEqual([[0, 1], [7, 8]]);
    expect(matchRanges('web mdn', 'MDN Web Docs')).toEqual([[0, 3], [4, 7]]);
    expect(matchRanges('gthub', 'GitHub')).toEqual([[0, 1], [2, 6]]);
    expect(matchRanges('zz', 'GitHub')).toEqual([]);
  });
  it('names the search engine for "Search Google for …"', () => {
    expect(searchEngineName('https://www.google.com/search?q=%s')).toBe('Google');
    expect(searchEngineName('https://search.brave.com/search?q=%s')).toBe('Brave Search');
    expect(searchEngineName('https://www.ecosia.org/search?q=%s')).toBe('Ecosia');
    expect(searchEngineName('nonsense')).toBe('the web');
  });
});

describe('suggest', () => {
  function world() {
    let s = fresh();
    [s] = run(s, (d) => newTab(d, { url: 'https://github.com/kite', title: 'Kite repo', now: T0 }));
    [s] = run(s, (d) => newTab(d, { url: 'https://news.ycombinator.com', title: 'Hacker News', now: T0 + 5 }));
    [s] = run(s, (d) => {
      recordVisit(d, 'https://developer.mozilla.org/en-US/docs/Web', 'MDN Web Docs', T0);
      recordVisit(d, 'https://github.com/kite', 'Kite repo', T0); // already open as a tab
      recordVisit(d, 'https://www.figma.com/file/1', 'Design', T0);
      recordVisit(d, 'https://www.figma.com/file/2', 'Design', T0);
    });
    [s] = run(s, (d) => createSpace(d, { name: 'Work', activate: false }));
    // The page being looked at while the command bar is open.
    [s] = run(s, (d) => newTab(d, { url: 'https://example.com/now', title: 'Reading now', now: T0 + 9 }));
    return s;
  }

  it('with nothing typed, shows the other tabs of this Space, most recent first, then four starter actions', () => {
    const r = suggest(world(), '');
    expect(r.filter((x) => x.kind === 'tab').map((x) => x.title)).toEqual(['Hacker News', 'Kite repo']);
    expect(r.slice(2).map((x) => (x.kind === 'action' ? x.actionId : x.kind))).toEqual(STARTER_ACTIONS);
    expect(STARTER_ACTIONS).toHaveLength(4);
    // Only what can run right now is offered.
    expect(suggest(world(), '', { actions: [] }).every((x) => x.kind === 'tab')).toBe(true);
  });

  it('never offers the tab you are on, the Space you are in, or an empty new tab', () => {
    let s = world();
    expect(suggest(s, '').some((x) => x.title === 'Reading now')).toBe(false);
    expect(suggest(s, 'reading').some((x) => x.kind === 'tab')).toBe(false);
    expect(suggest(s, 'example.com/now').some((x) => x.kind === 'tab' || x.kind === 'history')).toBe(false);
    expect(suggest(s, s.spaces[0].name).some((x) => x.kind === 'space')).toBe(false);
    [s] = run(s, (d) => newTab(d, { url: 'kite://newtab', title: 'New Tab', now: T0 + 20 }));
    [s] = run(s, (d) => newTab(d, { url: 'https://example.com/later', title: 'Later', now: T0 + 21 }));
    expect(suggest(s, '').some((x) => x.title === 'New Tab')).toBe(false);
    expect(suggest(s, 'new tab').some((x) => x.kind === 'tab')).toBe(false);
  });

  it('among equally good matches: open tabs, then pinned tabs, then history, then actions, then Spaces', () => {
    let s = fresh();
    let pinned: string, open: string;
    [s, pinned] = run(s, (d) => newTab(d, { url: 'https://a.example/1', title: 'Split pea soup', now: T0 }));
    [s] = run(s, (d) => void pinItem(d, pinned));
    [s, open] = run(s, (d) => newTab(d, { url: 'https://a.example/2', title: 'Split the bill', now: T0 + 1 }));
    [s] = run(s, (d) => newTab(d, { url: 'https://a.example/3', title: 'Elsewhere', now: T0 + 2 }));
    [s] = run(s, (d) => void recordVisit(d, 'https://a.example/4', 'Split infinitives', T0));
    [s] = run(s, (d) => createSpace(d, { name: 'Split tests', activate: false }));
    const r = suggest(s, 'split', { limit: 20 });
    // The best one goes above the search row; the rest follow in the same order.
    expect(r.map((x) => x.kind)).toEqual(['tab', 'search', 'tab', 'history', 'space', 'action', 'action', 'action']);
    expect(r[0]).toMatchObject({ itemId: open });
    expect(r[2]).toMatchObject({ itemId: pinned });
    // "Split tests" starts with the query; the actions only contain the word, so the Space outranks them.
    expect(r.filter((x) => x.kind === 'action').map((x) => x.title)).toEqual(expect.arrayContaining(['Add Split View', 'Separate Split View', 'Flip Split View']));
    [s] = run(s, (d) => select(d, open, T0 + 5));
    expect(suggest(s, 'split')[0]).toMatchObject({ kind: 'tab', itemId: pinned });
  });

  it('one kind never fills the list: actions stay reachable behind a pile of history', () => {
    let s = fresh();
    [s] = run(s, (d) => {
      for (let i = 0; i < 200; i++) recordVisit(d, `https://shop.example/zoom-lens-${i}`, `Zoom lens ${i}`, T0 + i);
    });
    const r = suggest(s, 'zoom');
    expect(r).toHaveLength(8);
    expect(r.filter((x) => x.kind === 'history').length).toBeLessThanOrEqual(4);
    expect(r.filter((x) => x.kind === 'action').map((x) => x.title)).toEqual(expect.arrayContaining(['Zoom In', 'Zoom Out']));
  });

  it('the search row names the engine; every menu action is in the catalog', () => {
    const s = world();
    expect(suggest(s, 'kites')[0]).toMatchObject({ kind: 'search', title: 'kites', engine: 'Google' });
    const ids = ACTION_CATALOG.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['copyMarkdown', 'toggleMute', 'muteAll', 'capture', 'captureFull', 'newSplit', 'unsplit', 'flipSplit', 'duplicateTab', 'removeFavorite', 'setHomeHere', 'routeSiteHere', 'back', 'forward', 'nextTab', 'prevTab', 'nextSpace', 'prevSpace', 'renameSpace', 'editSpace', 'checkUpdates', 'viewSource', 'settings', 'customize'])
      expect(ids).toContain(id);
  });

  it('a strong match on an open tab comes first, then search', () => {
    const r = suggest(world(), 'hack');
    expect(r[0]).toMatchObject({ kind: 'tab', title: 'Hacker News' });
    expect(r[1]).toMatchObject({ kind: 'search', title: 'hack' });
  });

  it('weak matches put search first', () => {
    const r = suggest(world(), 'mdn docs');
    expect(r[0].kind).toBe('search');
  });

  it('a URL offers "open" first and still offers search', () => {
    const r = suggest(world(), 'example.org');
    expect(r[0]).toMatchObject({ kind: 'open', url: 'https://example.org' });
    expect(r.some((x) => x.kind === 'search')).toBe(true);
  });

  it('history skips pages that are already open and merges same-title pages on noisy sites', () => {
    const r = suggest(world(), 'design');
    const hist = r.filter((x) => x.kind === 'history');
    expect(hist).toHaveLength(1);
    const k = suggest(world(), 'kite');
    expect(k.filter((x) => x.kind === 'history')).toHaveLength(0);
    expect(k.filter((x) => x.kind === 'tab')).toHaveLength(1);
  });

  it('finds actions by title or keyword, and Spaces by name', () => {
    expect(suggest(world(), 'new note').some((x) => x.kind === 'action' && x.actionId === 'newNote')).toBe(true);
    expect(suggest(world(), 'preferences').some((x) => x.kind === 'action' && x.actionId === 'settings')).toBe(true);
    expect(suggest(world(), 'work').some((x) => x.kind === 'space')).toBe(true);
  });

  it('finds notes by title', () => {
    let s = world();
    [s] = run(s, (d) => {
      d.items.n = { id: 'n', kind: 'note', title: 'Recipe ideas', html: '', createdAt: 0, updatedAt: 0, lastActiveAt: 0 };
      d.spaces[0].today.push('n');
    });
    expect(suggest(s, 'recipe')[0]).toMatchObject({ kind: 'note', itemId: 'n' });
  });

  it('never returns more than the limit or duplicate keys', () => {
    const r = suggest(world(), 'e', { limit: 5 });
    expect(r.length).toBeLessThanOrEqual(5);
    expect(new Set(r.map((x) => x.key)).size).toBe(r.length);
  });
});
