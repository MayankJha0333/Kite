import { describe, expect, it } from 'vitest';
import { newTab, pinItem, addFavorite, select, activeItemId } from '@shared/ops';
import { createFolder, deleteFolder, dropItem, setAllFolders, ungroupFolder } from '@shared/folders';
import { locate, flatVisible } from '@shared/tree';
import { fresh, run, T0 } from './helpers';
import type { AppState } from '@shared/types';

function setup(n: number, pin = false): [AppState, string[]] {
  let s = fresh();
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    let id: string;
    [s, id] = run(s, (d) => newTab(d, { url: `https://s${i}.com`, now: T0 }));
    ids.push(id);
  }
  if (pin) for (const id of ids) [s] = run(s, (d) => pinItem(d, id)); // pinned order: a, b, c
  return [s, ids];
}

describe('folders', () => {
  it('creates a folder at the bottom of Pinned, optionally filled', () => {
    let [s, [a, b]] = setup(2);
    let f: string;
    [s, f] = run(s, (d) => createFolder(d, { title: 'Work', items: [a, b], now: T0 }));
    expect(s.spaces[0].pinned).toEqual([f]);
    expect(s.items[f]).toMatchObject({ kind: 'folder', title: 'Work', children: [a, b] });
    expect(s.spaces[0].today).toEqual([]);
    expect(s.items[a]).toMatchObject({ homeUrl: 'https://s0.com' });
  });

  it('nests folders and finds items inside them', () => {
    let [s, [a]] = setup(1);
    let outer: string, inner: string;
    [s, outer] = run(s, (d) => createFolder(d, { now: T0 }));
    [s, inner] = run(s, (d) => createFolder(d, { parentId: outer, items: [a], now: T0 }));
    expect(locate(s, a)).toMatchObject({ list: 'pinned', parentId: inner });
    expect(locate(s, inner)).toMatchObject({ parentId: outer });
  });

  it('collapsed folders hide children from ⌘-number order; selecting a child opens its folder', () => {
    let [s, [a, b]] = setup(2);
    let f: string;
    [s, f] = run(s, (d) => createFolder(d, { items: [a], now: T0 }));
    [s] = run(s, (d) => setAllFolders(d, d.activeSpaceId, true));
    expect(flatVisible(s, s.activeSpaceId, false)).toEqual([b]);
    [s] = run(s, (d) => select(d, a, T0));
    expect(s.items[f]).toMatchObject({ collapsed: false });
    expect(activeItemId(s)).toBe(a);
  });

  it('deleting a folder archives what was inside', () => {
    let [s, [a, b]] = setup(2);
    let f: string;
    [s, f] = run(s, (d) => createFolder(d, { items: [a, b], now: T0 }));
    let n: number;
    [s, n] = run(s, (d) => deleteFolder(d, f, T0 + 1));
    expect(n).toBe(2);
    expect(s.items[f]).toBeUndefined();
    expect(s.items[a]).toBeUndefined();
    expect(s.archive.map((e) => e.url).sort()).toEqual(['https://s0.com', 'https://s1.com']);
  });

  it('ungrouping keeps the contents in place', () => {
    let [s, [a, b, c]] = setup(3, true); // pinned: a, b, c
    let f: string;
    [s, f] = run(s, (d) => createFolder(d, { items: [b, c], now: T0 }));
    expect(s.spaces[0].pinned).toEqual([a, f]);
    [s] = run(s, (d) => ungroupFolder(d, f));
    expect(s.spaces[0].pinned).toEqual([a, b, c]);
  });
});

describe('drag and drop', () => {
  it('reorders within a list (down and up)', () => {
    let [s, [a, b, c]] = setup(3, true);
    [s] = run(s, (d) => dropItem(d, a, { type: 'after', id: c }));
    expect(s.spaces[0].pinned).toEqual([b, c, a]);
    [s] = run(s, (d) => dropItem(d, a, { type: 'before', id: b }));
    expect(s.spaces[0].pinned).toEqual([a, b, c]);
    [s] = run(s, (d) => dropItem(d, c, { type: 'before', id: b }));
    expect(s.spaces[0].pinned).toEqual([a, c, b]);
  });

  it('Today → Pinned pins, Pinned → Today unpins', () => {
    let [s, [a, b]] = setup(2); // today: b, a
    [s] = run(s, (d) => dropItem(d, a, { type: 'end', list: 'pinned', spaceId: d.activeSpaceId }));
    expect(s.spaces[0].pinned).toEqual([a]);
    expect(s.items[a]).toMatchObject({ homeUrl: 'https://s0.com' });
    [s] = run(s, (d) => dropItem(d, a, { type: 'before', id: b }));
    expect(s.spaces[0].today).toEqual([a, b]);
    expect((s.items[a] as { homeUrl?: string }).homeUrl).toBeUndefined();
  });

  it('drops into a folder and out again', () => {
    let [s, [a, b]] = setup(2, true);
    let f: string;
    [s, f] = run(s, (d) => createFolder(d, { now: T0 }));
    [s] = run(s, (d) => dropItem(d, a, { type: 'into', folderId: f }));
    expect(s.items[f]).toMatchObject({ children: [a] });
    [s] = run(s, (d) => dropItem(d, b, { type: 'before', id: a }));
    expect(s.items[f]).toMatchObject({ children: [b, a] });
    [s] = run(s, (d) => dropItem(d, a, { type: 'end', list: 'pinned', spaceId: d.activeSpaceId }));
    expect(s.spaces[0].pinned).toEqual([f, a]);
  });

  it('refuses impossible drops', () => {
    let [s, [a]] = setup(1, true);
    let f: string, g: string;
    [s, f] = run(s, (d) => createFolder(d, { now: T0 }));
    [s, g] = run(s, (d) => createFolder(d, { parentId: f, now: T0 }));
    const before = s;
    let ok: boolean;
    [s, ok] = run(s, (d) => dropItem(d, f, { type: 'into', folderId: g })); // into own child
    expect(ok).toBe(false);
    [s, ok] = run(s, (d) => dropItem(d, f, { type: 'into', folderId: f })); // into itself
    expect(ok).toBe(false);
    [s, ok] = run(s, (d) => dropItem(d, f, { type: 'end', list: 'today', spaceId: d.activeSpaceId })); // folders stay pinned
    expect(ok).toBe(false);
    [s, ok] = run(s, (d) => dropItem(d, f, { type: 'end', list: 'favorites', spaceId: null })); // only tabs in favorites
    expect(ok).toBe(false);
    [s, ok] = run(s, (d) => dropItem(d, a, { type: 'before', id: a }));
    expect(ok).toBe(false);
    expect(s).toEqual(before);
  });

  it('drops into Favorites at a position', () => {
    let [s, [a, b, c]] = setup(3);
    [s] = run(s, (d) => addFavorite(d, a));
    [s] = run(s, (d) => addFavorite(d, b));
    [s] = run(s, (d) => dropItem(d, c, { type: 'before', id: b }));
    expect(s.favorites).toEqual([a, c, b]);
  });

  it('drops onto another Space keep the same section', () => {
    let [s, [a, b]] = setup(2);
    [s] = run(s, (d) => pinItem(d, b));
    [s] = run(s, (d) => {
      d.spaces.push({ ...d.spaces[0], id: 'sp2', name: 'Two', pinned: [], today: [] });
    });
    [s] = run(s, (d) => dropItem(d, a, { type: 'space', spaceId: 'sp2' }));
    [s] = run(s, (d) => dropItem(d, b, { type: 'space', spaceId: 'sp2' }));
    expect(s.spaces[1].today).toEqual([a]);
    expect(s.spaces[1].pinned).toEqual([b]);
    expect(s.spaces[0].today).toEqual([]);
  });
});

describe('Arc-style folder and Space moves', () => {
  it('a drop at the start of an open folder puts the item first in it', async () => {
    const { canDrop } = await import('@shared/folders');
    let [s, [a, b]] = setup(2);
    let f: string;
    [s, f] = run(s, (d) => createFolder(d, { items: [a], now: T0 }));
    expect(canDrop(s, b, { type: 'into', folderId: f, at: 'start' })).toBe(true);
    [s] = run(s, (d) => dropItem(d, b, { type: 'into', folderId: f, at: 'start' }));
    expect((s.items[f] as { children: string[] }).children).toEqual([b, a]);
  });

  it('canDrop refuses a folder into itself, next to its own contents, or into Today', async () => {
    const { canDrop } = await import('@shared/folders');
    let [s, [a, b]] = setup(2);
    let outer: string, inner: string;
    [s, outer] = run(s, (d) => createFolder(d, { items: [a], now: T0 }));
    [s, inner] = run(s, (d) => createFolder(d, { parentId: outer, now: T0 }));
    expect(canDrop(s, outer, { type: 'into', folderId: inner })).toBe(false);
    expect(canDrop(s, outer, { type: 'into', folderId: outer })).toBe(false);
    expect(canDrop(s, outer, { type: 'before', id: a })).toBe(false);
    expect(canDrop(s, outer, { type: 'before', id: b })).toBe(false); // b is in Today
    expect(canDrop(s, b, { type: 'into', folderId: inner })).toBe(true);
  });

  it('dropItems moves several items together, keeping their order, and skips ones inside a moved folder', async () => {
    const { dropItems } = await import('@shared/folders');
    let [s, ids] = setup(4); // today: s3 s2 s1 s0
    const [a, b, c, d0] = ids;
    let f: string, g: string;
    [s, f] = run(s, (d) => createFolder(d, { now: T0 }));
    [s, g] = run(s, (d) => createFolder(d, { items: [c], now: T0 }));
    [s] = run(s, (d) => dropItems(d, [b, a], { type: 'into', folderId: f }));
    expect((s.items[f] as { children: string[] }).children).toEqual([b, a]);
    // A folder and its own child picked together: the child just rides along.
    [s] = run(s, (d) => dropItems(d, [g, c, d0], { type: 'into', folderId: f }));
    expect((s.items[f] as { children: string[] }).children).toEqual([b, a, g, d0]);
    expect((s.items[g] as { children: string[] }).children).toEqual([c]);
  });

  it('duplicateItem copies a folder deeply with new ids, right after it', async () => {
    const { duplicateItem } = await import('@shared/folders');
    let [s, [a]] = setup(1);
    let f: string, copy: string | null;
    [s, f] = run(s, (d) => createFolder(d, { title: 'Work', items: [a], now: T0 }));
    [s, copy] = run(s, (d) => duplicateItem(d, f, T0));
    expect(s.spaces[0].pinned).toEqual([f, copy]);
    const c = s.items[copy!] as { title: string; children: string[] };
    expect(c.title).toBe('Work copy');
    expect(c.children).toHaveLength(1);
    expect(c.children[0]).not.toBe(a);
    expect(s.items[c.children[0]]).toMatchObject({ kind: 'tab', url: 'https://s0.com' });
  });

  it('folderToSpace and spaceToFolder turn one into the other and back', async () => {
    const { folderToSpace, spaceToFolder, folderLinks } = await import('@shared/folders');
    let [s, [a, b]] = setup(2);
    let f: string, sp: string | null;
    [s, f] = run(s, (d) => createFolder(d, { title: 'Trip', items: [a], now: T0 }));
    expect(folderLinks(s, f)).toEqual([{ title: expect.any(String), url: 'https://s0.com' }]);
    const home = s.spaces[0].id;
    [s, sp] = run(s, (d) => folderToSpace(d, f));
    expect(s.spaces.map((x) => x.name)).toEqual([s.spaces[0].name, 'Trip']);
    expect(s.activeSpaceId).toBe(sp);
    expect(s.spaces[1].pinned).toEqual([a]);
    expect(s.items[f]).toBeUndefined();
    // Back again, with a Today tab too.
    [s] = run(s, (d) => dropItem(d, b, { type: 'space', spaceId: sp! }));
    let nf: string | null;
    [s, nf] = run(s, (d) => spaceToFolder(d, sp!, home, T0));
    expect(s.spaces).toHaveLength(1);
    expect(s.activeSpaceId).toBe(home);
    expect(s.items[nf!]).toMatchObject({ kind: 'folder', title: 'Trip', children: [a, b] });
    expect(s.items[b]).toMatchObject({ homeUrl: 'https://s1.com' });
  });
});
