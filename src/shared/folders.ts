// Folders and drag-and-drop moves in the sidebar.

import { newId } from './ids';
import type { AppState, ID, Item, Location } from './types';
import { attach, canPlace, descendants, detach, getSpace, listAt, locate } from './tree';
import { archiveItem } from './archive';
import { makeSpace, defaultTheme } from './defaults';

export interface NewFolderOpts {
  spaceId?: ID;
  title?: string;
  parentId?: ID | null;
  /** Items to put inside straight away (e.g. a multi-selection). */
  items?: ID[];
  now: number;
}

/** Create a folder at the bottom of Pinned (or inside another folder). */
export function createFolder(s: AppState, o: NewFolderOpts): ID {
  const id = newId('folder');
  s.items[id] = { id, kind: 'folder', title: o.title?.trim() || 'New Folder', children: [], collapsed: false, createdAt: o.now };
  const spaceId = o.spaceId ?? s.activeSpaceId;
  const parentId = o.parentId ?? null;
  const list = parentId ? listAt(s, 'pinned', spaceId, parentId) : getSpace(s, spaceId).pinned;
  attach(s, id, { list: 'pinned', spaceId, parentId, index: list.length });
  for (const item of o.items ?? []) {
    const it = s.items[item];
    if (!it || item === id) continue;
    if (!canPlace(s, item, { list: 'pinned', parentId: id })) continue;
    detach(s, item);
    (s.items[id] as { children: ID[] }).children.push(item);
    if (it.kind === 'tab' && !it.homeUrl) it.homeUrl = it.url;
  }
  return id;
}

/** Delete a folder. Its contents are archived (so nothing is lost). */
export function deleteFolder(s: AppState, id: ID, now: number): number {
  const f = s.items[id];
  if (!f || f.kind !== 'folder') return 0;
  return archiveItem(s, id, now, 'manual');
}

/** Remove the folder but keep its contents where the folder was. */
export function ungroupFolder(s: AppState, id: ID): void {
  const f = s.items[id];
  if (!f || f.kind !== 'folder') return;
  const loc = locate(s, id);
  if (!loc) return;
  const arr = listAt(s, loc.list, loc.spaceId, loc.parentId);
  arr.splice(loc.index, 1, ...f.children);
  delete s.items[id];
}

export function setAllFolders(s: AppState, spaceId: ID, collapsed: boolean): void {
  const walk = (ids: ID[]) => {
    for (const x of ids) {
      const it = s.items[x];
      if (it?.kind === 'folder') {
        it.collapsed = collapsed;
        walk(it.children);
      }
    }
  };
  walk(getSpace(s, spaceId).pinned);
}

export type DropTarget =
  | { type: 'before' | 'after'; id: ID }
  /** Inside a folder: at its end (dropped on the folder) or at its top (just under an open folder's name). */
  | { type: 'into'; folderId: ID; at?: 'start' | 'end' }
  | { type: 'end'; list: 'pinned' | 'today' | 'favorites'; spaceId: ID | null }
  | { type: 'space'; spaceId: ID };

/** Where would this drop put the item? null if it isn't allowed. */
export function resolveDrop(s: AppState, id: ID, target: DropTarget): Omit<Location, 'index'> & { index: number | 'end' } | null {
  if (target.type === 'before' || target.type === 'after') {
    if (target.id === id) return null;
    const loc = locate(s, target.id);
    if (!loc) return null;
    return { list: loc.list, spaceId: loc.spaceId, parentId: loc.parentId, index: loc.index + (target.type === 'after' ? 1 : 0) };
  }
  if (target.type === 'into') {
    if (target.folderId === id) return null;
    const loc = locate(s, target.folderId);
    if (!loc) return null;
    return { list: 'pinned', spaceId: loc.spaceId, parentId: target.folderId, index: target.at === 'start' ? 0 : 'end' };
  }
  if (target.type === 'end') {
    return { list: target.list, spaceId: target.list === 'favorites' ? null : target.spaceId ?? s.activeSpaceId, parentId: null, index: 'end' };
  }
  // Dropped on another Space: same section there (Favorites go to Pinned).
  const from = locate(s, id);
  const list = !from || from.list === 'favorites' ? 'pinned' : from.list;
  const spaceId = (target as Extract<DropTarget, { type: 'space' }>).spaceId;
  return { list, spaceId, parentId: null, index: list === 'today' ? 0 : 'end' };
}

/** Move an item to where it was dropped. Returns false if the drop isn't allowed. */
export function dropItem(s: AppState, id: ID, target: DropTarget): boolean {
  const it = s.items[id];
  const where = resolveDrop(s, id, target);
  if (!it || !where) return false;
  if (!canPlace(s, id, where)) return false;
  const from = locate(s, id);
  if (!from) return false;
  // Removing the item first shifts later siblings up by one.
  const sameList = from.list === where.list && from.spaceId === where.spaceId && from.parentId === where.parentId;
  detach(s, id);
  let index = where.index === 'end' ? listAt(s, where.list, where.spaceId, where.parentId).length : where.index;
  if (sameList && where.index !== 'end' && from.index < where.index) index -= 1;
  attach(s, id, { list: where.list, spaceId: where.spaceId, parentId: where.parentId, index });
  if (it.kind === 'tab') {
    if (where.list === 'today') it.homeUrl = undefined;
    else if (!it.homeUrl) it.homeUrl = it.url;
  }
  return true;
}

/** Would this drop do something allowed (and not leave everything where it is)? */
export function canDrop(s: AppState, ids: ID | ID[], target: DropTarget): boolean {
  const list = Array.isArray(ids) ? ids : [ids];
  if (list.length === 0) return false;
  let any = false;
  for (const id of list) {
    if (target.type === 'before' || target.type === 'after') {
      if (target.id === id) continue;
      // A folder can't go next to something inside itself.
      if (descendants(s, id).includes(target.id)) return false;
    }
    if (target.type === 'into' && (target.folderId === id || descendants(s, id).includes(target.folderId))) return false;
    const where = resolveDrop(s, id, target);
    if (!where || !canPlace(s, id, where)) return false;
    any = true;
  }
  return any;
}

/**
 * Move several items to one drop target, keeping their order (Arc moves a whole
 * selection together). Items inside a moved folder travel with it.
 */
export function dropItems(s: AppState, ids: ID[], target: DropTarget): boolean {
  // Skip anything that's already inside another moved folder.
  const moving = ids.filter((id) => s.items[id] && !ids.some((o) => o !== id && descendants(s, o).includes(id)));
  if (moving.length === 0) return false;
  if (moving.length === 1) return dropItem(s, moving[0], target);
  if (!canDrop(s, moving, target)) return false;
  // Sidebar order, so the group lands the way it looked.
  const order = (id: ID) => {
    const l = locate(s, id);
    return l ? `${l.list === 'favorites' ? 0 : l.list === 'pinned' ? 1 : 2}` : '9';
  };
  moving.sort((a, b) => order(a).localeCompare(order(b)));
  // Anchor: the first item goes to the target; each next one goes after the previous.
  let anchor: DropTarget = target;
  let moved = false;
  for (const id of moving) {
    if ((anchor.type === 'before' || anchor.type === 'after') && anchor.id === id) {
      anchor = { type: 'after', id };
      moved = true;
      continue;
    }
    if (dropItem(s, id, anchor)) {
      moved = true;
      anchor = { type: 'after', id };
    }
  }
  return moved;
}

/** Copy a tab, note, split or folder (deeply), right after the original. */
export function duplicateItem(s: AppState, id: ID, now: number): ID | null {
  const loc = locate(s, id);
  if (!loc || !s.items[id]) return null;
  const copy = (src: ID): ID | null => {
    const it = s.items[src];
    if (!it) return null;
    const nid = newId(it.kind);
    const base = JSON.parse(JSON.stringify(it)) as Item;
    (base as { id: ID }).id = nid;
    if (base.kind === 'folder') base.children = it.kind === 'folder' ? (it.children.map(copy).filter(Boolean) as ID[]) : [];
    if (base.kind === 'split') base.panes = it.kind === 'split' ? (it.panes.map(copy).filter(Boolean) as ID[]) : [];
    if ('createdAt' in base) (base as { createdAt: number }).createdAt = now;
    if (base.kind === 'tab') base.lastActiveAt = now;
    s.items[nid] = base;
    return nid;
  };
  const nid = copy(id);
  if (!nid) return null;
  const it = s.items[nid];
  if (it.kind === 'folder') it.title = `${it.title} copy`;
  attach(s, nid, { ...loc, index: loc.index + 1 });
  return nid;
}

/** Every page address in a folder (nested folders and split views included), top to bottom. */
export function folderLinks(s: AppState, id: ID): { title: string; url: string }[] {
  const out: { title: string; url: string }[] = [];
  const walk = (x: ID) => {
    const it = s.items[x];
    if (!it) return;
    if (it.kind === 'tab') out.push({ title: it.title || it.url, url: it.url });
    else if (it.kind === 'folder') it.children.forEach(walk);
    else if (it.kind === 'split') it.panes.forEach(walk);
  };
  const f = s.items[id];
  if (f?.kind === 'folder') f.children.forEach(walk);
  return out;
}

/** Arc's "Turn into Space": the folder becomes a new Space whose Pinned holds its contents. */
export function folderToSpace(s: AppState, id: ID): ID | null {
  const f = s.items[id];
  if (!f || f.kind !== 'folder') return null;
  const from = locate(s, id);
  if (!from) return null;
  const sp = makeSpace(f.title, '🗂️', s.spaces.length);
  sp.theme = defaultTheme(s.spaces.length);
  const src = from.spaceId ? s.spaces.find((x) => x.id === from.spaceId) : null;
  if (src) sp.theme = { ...src.theme };
  sp.pinned = [...f.children];
  detach(s, id);
  delete s.items[id];
  const at = src ? s.spaces.indexOf(src) + 1 : s.spaces.length;
  s.spaces.splice(at, 0, sp);
  s.activeBySpace[sp.id] = null;
  s.activeSpaceId = sp.id;
  return sp.id;
}

/**
 * Arc's "Turn into Folder": a Space's tabs move into a folder (named after it)
 * at the bottom of another Space's Pinned, and the Space goes away.
 */
export function spaceToFolder(s: AppState, spaceId: ID, destSpaceId: ID, now: number): ID | null {
  if (spaceId === destSpaceId) return null;
  const src = s.spaces.find((x) => x.id === spaceId);
  const dest = s.spaces.find((x) => x.id === destSpaceId);
  if (!src || !dest) return null;
  const id = newId('folder');
  const children = [...src.pinned, ...src.today];
  s.items[id] = { id, kind: 'folder', title: src.name, children, collapsed: false, createdAt: now };
  for (const c of src.today) {
    const it = s.items[c];
    if (it?.kind === 'tab' && !it.homeUrl) it.homeUrl = it.url;
  }
  dest.pinned.push(id);
  const i = s.spaces.indexOf(src);
  s.spaces.splice(i, 1);
  delete s.activeBySpace[spaceId];
  for (const r of s.routes) if (r.target.type === 'space' && r.target.spaceId === spaceId) r.target = { type: 'space', spaceId: destSpaceId };
  if (s.activeSpaceId === spaceId) s.activeSpaceId = destSpaceId;
  return id;
}
