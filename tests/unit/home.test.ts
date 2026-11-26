import { describe, expect, it } from 'vitest';
import { addWidget, BAR_HINT_USES, columnsFor, defaultHome, freeSpot, frequentSites, layoutWidgets, moveWidget, removeWidget, resizeWidget, sanitizeHome, updateWidget, weatherText, MAX_WIDGETS, PITCH_X, PITCH_Y, type Widget } from '@shared/home';
import { loadState } from '@shared/persistence';
import { createInitialState } from '@shared/defaults';

const cells = (ws: Widget[], cols?: number) => Object.fromEntries(layoutWidgets(ws, cols).map((p) => [p.id, [p.col, p.row]]));

/** True when no two placed widgets share a cell. */
function noOverlap(ws: Widget[], cols?: number): boolean {
  const seen = new Set<string>();
  for (const p of layoutWidgets(ws, cols)) {
    for (let x = p.col; x < p.col + p.cols; x++) {
      for (let y = p.row; y < p.row + p.rows; y++) {
        if (seen.has(`${x},${y}`)) return false;
        seen.add(`${x},${y}`);
      }
    }
  }
  return true;
}

describe('home page state', () => {
  it('starts empty on the Space colors, and saved files are checked on load', () => {
    expect(defaultHome()).toEqual({ widgets: [], showGreeting: true, showFrequent: false, showHints: false, firstRunSeen: false, barUses: 0 });
    expect(loadState(null).home).toEqual(defaultHome());
    const h = sanitizeHome({ widgets: [{ id: 'a', kind: 'clock', x: 20.4, y: -1, size: 'huge', data: { h24: true } }, { id: 'b', kind: 'nope' }, 'junk'], scene: 'mars', showFrequent: true });
    expect(h.widgets).toEqual([{ id: 'a', kind: 'clock', x: 20, y: 0, size: 'small', data: { h24: true } }]);
    expect(h.showFrequent).toBe(true);
  });

  it('only a brand-new profile is due the first run and the command-bar hint', () => {
    // No saved file at all: a new person.
    expect(loadState(null).home).toMatchObject({ firstRunSeen: false, barUses: 0 });
    // A file from before the first run existed is someone already using Kite.
    const old = JSON.parse(JSON.stringify(createInitialState()));
    delete old.home.firstRunSeen;
    delete old.home.barUses;
    expect(loadState(old).home).toMatchObject({ firstRunSeen: true, barUses: BAR_HINT_USES });
    delete old.home;
    expect(loadState(old).home).toMatchObject({ firstRunSeen: true, barUses: BAR_HINT_USES });
    // What the file says is kept, and a nonsense count is not.
    expect(sanitizeHome({ firstRunSeen: false, barUses: 1 })).toMatchObject({ firstRunSeen: false, barUses: 1 });
    expect(sanitizeHome({ barUses: 999 }).barUses).toBe(BAR_HINT_USES);
    expect(sanitizeHome({ barUses: -4 }).barUses).toBe(BAR_HINT_USES);
  });

  it('new widgets take the first free cell, left to right then down, and never overlap', () => {
    const home = defaultHome();
    const a = addWidget(home, 'clock')!;
    const b = addWidget(home, 'note')!;
    expect(home.widgets.map((w) => w.id)).toEqual([a, b]);
    expect(home.widgets[0]).toMatchObject({ x: 0, y: 0, size: 'small' });
    expect(home.widgets[1]).toMatchObject({ x: PITCH_X, y: 0 });
    // A wide one (two cells) no longer fits beside them: it starts the next row.
    addWidget(home, 'weather');
    expect(home.widgets[2]).toMatchObject({ x: 0, y: PITCH_Y, size: 'wide' });
    // The third cell of the first row is still free for a small one.
    expect(freeSpot(home, 'small')).toEqual({ x: 2 * PITCH_X, y: 0 });
    expect(freeSpot(home, 'large').y).toBeGreaterThan(PITCH_Y);
    expect(noOverlap(home.widgets)).toBe(true);
  });

  it('a dropped widget lands on the nearest cell and whatever was there makes room', () => {
    const home = defaultHome();
    const a = addWidget(home, 'clock')!;
    const b = addWidget(home, 'note')!;
    // Dropped a little off the second cell: it snaps onto it, and the note that was there moves along.
    moveWidget(home, a, PITCH_X + 37, 22);
    expect(cells(home.widgets)).toEqual({ [a]: [1, 0], [b]: [0, 0] });
    moveWidget(home, b, PITCH_X - 10, 5);
    expect(cells(home.widgets)[b]).toEqual([1, 0]);
    expect(noOverlap(home.widgets)).toBe(true);
    // Never past the right edge, never above the top; downward the page just grows.
    moveWidget(home, a, 5000, -80);
    expect(home.widgets.find((w) => w.id === a)).toMatchObject({ x: 2 * PITCH_X, y: 0 });
    moveWidget(home, a, 0, 3 * PITCH_Y + 12);
    expect(home.widgets.find((w) => w.id === a)).toMatchObject({ x: 0, y: 3 * PITCH_Y });
  });

  it('resize keeps the grid tidy; update and remove work', () => {
    const home = defaultHome();
    const a = addWidget(home, 'todo')!;
    const b = addWidget(home, 'clock')!;
    resizeWidget(home, a, 'large');
    expect(home.widgets[0].size).toBe('large');
    expect(noOverlap(home.widgets)).toBe(true);
    expect(cells(home.widgets)[b]).toEqual([2, 0]); // the clock moved out from under it
    updateWidget(home, a, { items: [{ id: '1', text: 'x', done: false }] });
    expect(home.widgets[0].data.items).toHaveLength(1);
    removeWidget(home, a);
    expect(home.widgets.map((w) => w.id)).toEqual([b]);
  });

  it('a narrow window lays the same widgets out in fewer columns, in reading order', () => {
    expect([columnsFor(640), columnsFor(406), columnsFor(300)]).toEqual([3, 2, 1]);
    const home = defaultHome();
    const ids = (['clock', 'note', 'timer', 'weather', 'calendar'] as const).map((k) => addWidget(home, k)!);
    expect(cells(home.widgets, 2)).toEqual({ [ids[0]]: [0, 0], [ids[1]]: [1, 0], [ids[2]]: [0, 1], [ids[3]]: [0, 2], [ids[4]]: [0, 3] });
    expect(noOverlap(home.widgets, 2)).toBe(true);
    // One column: everything stacks, and a wide widget is one cell across.
    const one = layoutWidgets(home.widgets, 1);
    expect(one.every((p) => p.col === 0 && p.cols === 1)).toBe(true);
    expect(noOverlap(home.widgets, 1)).toBe(true);
  });

  it('positions saved by the old free-form page are tidied onto the grid without overlap', () => {
    const old: Widget[] = [
      { id: 'a', kind: 'clock', x: 0, y: 0, size: 'small', data: {} },
      { id: 'b', kind: 'todo', x: 260, y: 0, size: 'tall', data: {} },
      { id: 'c', kind: 'calendar', x: 520, y: 40, size: 'tall', data: {} },
      { id: 'd', kind: 'note', x: 240, y: 20, size: 'small', data: {} },
      { id: 'e', kind: 'weather', x: 900, y: 340, size: 'wide', data: {} },
    ];
    expect(noOverlap(old)).toBe(true);
    expect(cells(old).e[0]).toBe(1); // a wide one never hangs past the right edge
  });

  it('stops at the widget limit', () => {
    const home = defaultHome();
    for (let i = 0; i < MAX_WIDGETS; i++) expect(addWidget(home, 'note')).not.toBeNull();
    expect(addWidget(home, 'note')).toBeNull();
    expect(noOverlap(home.widgets)).toBe(true);
  });

  it('reads the weather codes', () => {
    expect(weatherText(0)).toEqual({ label: 'Clear', icon: 'sun' });
    expect(weatherText(63).label).toBe('Rain');
    expect(weatherText(95).icon).toBe('storm');
  });
});

describe('frequently visited', () => {
  const at = (url: string, title: string, visits: number, favicon?: string) => ({ url, title, visits, lastVisitAt: visits, favicon });

  it('lists the most visited sites once each, without Favorites', () => {
    const history = [at('https://a.com/', 'Site A', 2), at('https://a.com/deep', 'Deep page', 9), at('https://b.com/', 'Site B', 5), at('https://fav.com/', 'Fav', 50), at('kite://new', 'New Tab', 99)];
    expect(frequentSites(history, new Set(['fav.com']), 8).map((h) => h.url)).toEqual(['https://a.com/deep', 'https://b.com/']);
    expect(frequentSites(history, new Set(), 1)).toHaveLength(1);
  });

  it('never lists an address that failed to load', () => {
    const history = [
      at('https://kite-audit-nonexistent-domain.test/', 'kite-audit-nonexistent-domain.test', 7), // a typo: the tab only ever had its address for a name
      at('https://also-missing.test/path', 'also-missing.test/path', 4),
      at('https://untitled.test/', '', 3),
      at('https://plain.example/', 'plain.example', 2, 'data:image/png;base64,AAAA'), // loaded: it reported an icon
      at('https://real.example/', 'A real page', 1),
    ];
    expect(frequentSites(history, new Set(), 8).map((h) => h.url)).toEqual(['https://plain.example/', 'https://real.example/']);
  });
});
