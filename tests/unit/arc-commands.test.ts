import { describe, expect, it } from 'vitest';
import { activeItemId, closeItem, newTab, pinItem, pinnedRootOf, resetSpaceTabs, select, toggleFolder, togglePinnedSection, updateTab } from '@shared/ops';
import { createFolder } from '@shared/folders';
import { loadState } from '@shared/persistence';
import { fresh, run, T0 } from './helpers';

function twoPinned() {
  let s = fresh();
  let a: string, b: string;
  [s, a] = run(s, (d) => newTab(d, { url: 'https://a.com', now: T0 }));
  [s, b] = run(s, (d) => newTab(d, { url: 'https://b.com', now: T0 + 1 }));
  [s] = run(s, (d) => void pinItem(d, a));
  [s] = run(s, (d) => void pinItem(d, b));
  return { s, a, b };
}

describe('Arc sidebar commands', () => {
  it('Reset All Tabs in This Space sends wandered pinned tabs home, in folders too, and says which moved', () => {
    let { s, a, b } = twoPinned();
    let f: string;
    [s, f] = run(s, (d) => createFolder(d, { now: T0 + 2, items: [a] }));
    [s] = run(s, (d) => updateTab(d, a, { url: 'https://a.com/deep' }, T0 + 3));
    [s] = run(s, (d) => updateTab(d, b, { url: 'https://b.com/deep' }, T0 + 4));
    let moved: string[];
    [s, moved] = run(s, (d) => resetSpaceTabs(d, d.activeSpaceId));
    expect(moved.sort()).toEqual([a, b].sort());
    expect(s.items[a]).toMatchObject({ url: 'https://a.com', homeUrl: 'https://a.com' });
    expect(s.items[b]).toMatchObject({ url: 'https://b.com' });
    expect(s.items[f].kind).toBe('folder');
    [s, moved] = run(s, (d) => resetSpaceTabs(d, d.activeSpaceId));
    expect(moved).toEqual([]);
  });

  it('the Pinned section collapses and expands per Space, and the fold survives a reload; the open pinned tab (or its folder) is the one left in view', () => {
    let { s, a, b } = twoPinned();
    const sp = s.activeSpaceId;
    [s] = run(s, (d) => togglePinnedSection(d, sp));
    expect(s.spaces[0].pinnedCollapsed).toBe(true);
    expect(loadState(JSON.parse(JSON.stringify(s))).spaces[0].pinnedCollapsed).toBe(true);
    [s] = run(s, (d) => select(d, a, T0 + 5));
    expect(pinnedRootOf(s, sp, a)).toBe(a);
    let f: string;
    [s, f] = run(s, (d) => createFolder(d, { now: T0 + 6, items: [b] }));
    expect(pinnedRootOf(s, sp, b)).toBe(f);
    expect(pinnedRootOf(s, sp, 'nope')).toBeNull();
    [s] = run(s, (d) => togglePinnedSection(d, sp));
    expect(s.spaces[0].pinnedCollapsed).toBeUndefined();
    [s] = run(s, (d) => togglePinnedSection(d, sp, true));
    expect(s.spaces[0].pinnedCollapsed).toBe(true);
  });

  it('closing the open pinned tab inside a closed folder moves to a neighbour, not nothing', () => {
    let { s, a, b } = twoPinned();
    let f: string;
    [s, f] = run(s, (d) => createFolder(d, { now: T0 + 2, items: [a, b] }));
    [s] = run(s, (d) => select(d, a, T0 + 3));
    [s] = run(s, (d) => toggleFolder(d, f, true));
    expect(s.items[f]).toMatchObject({ collapsed: true });
    [s] = run(s, (d) => closeItem(d, a, T0 + 4));
    expect(activeItemId(s)).toBe(b);
    // The folder opens to show it, as Arc does.
    expect(s.items[f]).toMatchObject({ collapsed: true });
    [s] = run(s, (d) => select(d, b, T0 + 5));
    expect(s.items[f]).toMatchObject({ collapsed: false });
  });
});
