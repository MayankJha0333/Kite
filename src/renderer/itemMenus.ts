// Right-click menus for sidebar items.

import * as ops from '@shared/ops';
import { locate } from '@shared/tree';
import type { ID } from '@shared/types';
import type { ContextMenuItem } from './store';
import { act, getS, getUi, setUi } from './store';
import { closeItemCmd, selectItem, copyActiveUrl, copyActiveMarkdown, sleepTab, navigateTab, newFolderCmd, deleteFolderCmd, splitWithCmd, switchSpaceCmd, undoable } from './commands';
import { toast } from './store';
import { visibleRows } from './selection';
import { setOrientation } from '@shared/split';
import { dropItems, duplicateItem, folderLinks, folderToSpace, ungroupFolder } from '@shared/folders';
import { getSpace } from '@shared/tree';
import { dropItem } from '@shared/folders';
import { archiveItem } from '@shared/archive';
import { formatShortcut } from '@shared/shortcuts';
import { isMac } from './platform';
import { now } from './platform';

function shortcutHint(action: string) {
  return formatShortcut(getS().settings.shortcuts[action] ?? '', isMac);
}

export function itemMenu(id: ID): ContextMenuItem[] {
  const s = getS();
  const it = s.items[id];
  if (!it) return [];
  const loc = locate(s, id);
  const items: ContextMenuItem[] = [];

  const activeNow = ops.activeItemId(s);
  if (it.kind === 'tab' && activeNow && activeNow !== id && ['tab', 'split'].includes(s.items[activeNow]?.kind)) {
    items.push({ label: 'Open in Split View', testId: 'menu-split-with', onSelect: () => splitWithCmd(id) });
  }
  if (it.kind === 'split') {
    items.push(
      { label: it.orientation === 'row' ? 'Stack Vertically' : 'Side by Side', testId: 'menu-split-flip', onSelect: () => act((d) => setOrientation(d, id, it.orientation === 'row' ? 'column' : 'row')) },
      { label: 'Separate All Pages', testId: 'menu-unsplit', onSelect: () => act((d) => void ops.unsplit(d, id, now())) },
      { separator: true, label: '' },
    );
  }
  if (it.kind === 'tab') {
    items.push(
      { label: 'Copy URL', testId: 'menu-copy-url', onSelect: () => { selectItem(id); void copyActiveUrl(); } },
      { label: 'Copy as Markdown Link', testId: 'menu-copy-md', onSelect: () => void copyActiveMarkdown(id) },
      ...(getUi().loaded.includes(id) && activeNow !== id ? [{ label: 'Put to Sleep', testId: 'menu-sleep', onSelect: () => sleepTab(id) }] : []),
      { label: 'Duplicate', testId: 'menu-duplicate', onSelect: () => { const n = act((d) => ops.duplicateTab(d, id, now())); if (n) selectItem(n); } },
    );
  }
  items.push({ label: 'Rename…', testId: 'menu-rename', onSelect: () => setUi({ renaming: id }) });
  items.push({ separator: true, label: '' });
  if (loc?.list === 'favorites') {
    items.push(
      { label: 'Remove from Favorites', testId: 'menu-unfavorite', onSelect: () => act((d) => ops.removeFavorite(d, id)) },
      { label: 'Move to Pinned', testId: 'menu-fav-to-pinned', onSelect: () => act((d) => ops.removeFavorite(d, id, 'pinned')) },
    );
  } else if (it.kind !== 'folder') {
    if (it.kind === 'tab') items.push({ label: 'Add to Favorites', testId: 'menu-favorite', onSelect: () => act((d) => ops.addFavorite(d, id)) });
    items.push(
      loc?.list === 'today'
        ? { label: 'Pin', hint: shortcutHint('togglePin'), testId: 'menu-pin', onSelect: () => act((d) => ops.pinItem(d, id)) }
        : { label: 'Unpin', hint: shortcutHint('togglePin'), testId: 'menu-unpin', onSelect: () => act((d) => ops.unpinItem(d, id)) },
    );
  }
  if (it.kind === 'tab' && it.homeUrl && it.url !== it.homeUrl) {
    items.push(
      { label: 'Back to Pinned Page', testId: 'menu-go-home', onSelect: () => navigateTab(id, it.homeUrl!) },
      { label: 'Make This Page the Pinned Page', testId: 'menu-set-home', onSelect: () => act((d) => ops.setHomeHere(d, id)) },
    );
  }
  items.push({ separator: true, label: '' });
  if (it.kind !== 'folder' && loc?.list !== 'favorites') {
    const folders = foldersIn(loc?.spaceId ?? s.activeSpaceId).filter((f) => f.id !== loc?.parentId);
    items.push({
      label: 'Move to Folder',
      testId: 'menu-move-folder',
      submenu: [
        { label: 'New Folder…', testId: 'menu-new-folder-with', onSelect: () => newFolderCmd({ items: [id] }) },
        ...(folders.length ? [{ separator: true, label: '' }] : []),
        ...folders.map((f) => ({ label: `${'  '.repeat(f.depth)}${f.title}`, testId: `menu-folder-${f.id}`, onSelect: () => act((d) => dropItem(d, id, { type: 'into', folderId: f.id })) })),
      ],
    });
  }
  if (it.kind === 'folder') {
    const links = folderLinks(s, id);
    items.push(
      { label: 'New Nested Folder', testId: 'menu-subfolder', onSelect: () => newFolderCmd({ parentId: id }) },
      { label: it.collapsed ? 'Open Folder' : 'Close Folder', testId: 'menu-folder-toggle', onSelect: () => act((d) => ops.toggleFolder(d, id)) },
      { separator: true, label: '' },
      { label: 'Copy Links', testId: 'menu-copy-links', disabled: links.length === 0, onSelect: () => void copyText(links.map((l) => l.url).join('\n'), `Copied ${links.length} link${links.length === 1 ? '' : 's'}`) },
      { label: 'Copy Links as Markdown', testId: 'menu-copy-links-md', disabled: links.length === 0, onSelect: () => void copyText(links.map((l) => `- [${l.title.replace(/([\[\]])/g, '\\$1')}](${l.url.replace(/\)/g, '%29')})`).join('\n'), 'Copied as Markdown') },
      { label: 'Duplicate Folder', testId: 'menu-duplicate-folder', onSelect: () => act((d) => duplicateItem(d, id, now())) },
      { separator: true, label: '' },
      { label: 'Turn into Space', testId: 'menu-folder-to-space', onSelect: () => undoable(`“${it.title}” is now a Space`, (d) => void folderToSpace(d, id)) },
      { label: 'Ungroup (keep contents)', testId: 'menu-ungroup', onSelect: () => act((d) => ungroupFolder(d, id)) },
    );
  }
  const spaces = moveToSpaceMenu([id]);
  if (spaces) items.push(spaces);
  if (it.kind === 'folder') {
    items.push(
      { separator: true, label: '' },
      { label: 'Delete Folder…', danger: true, testId: 'menu-delete-folder', onSelect: () => deleteFolderCmd(id) },
    );
  }
  if (it.kind !== 'folder') {
    const keeps = it.kind === 'tab' && (loc?.list === 'pinned' || loc?.list === 'favorites');
    items.push({ label: keeps ? 'Close (keep in sidebar)' : 'Close', hint: '', testId: 'menu-close', onSelect: () => closeItemCmd(id) });
  }
  return items;
}

/** Every folder in a Space, depth-first, for the "Move to Folder" menu. */
function foldersIn(spaceId: ID): { id: ID; title: string; depth: number }[] {
  const s = getS();
  const out: { id: ID; title: string; depth: number }[] = [];
  const walk = (ids: ID[], depth: number) => {
    for (const x of ids) {
      const f = s.items[x];
      if (f?.kind === 'folder') {
        out.push({ id: x, title: f.title, depth });
        walk(f.children, depth + 1);
      }
    }
  };
  walk(getSpace(s, spaceId).pinned, 0);
  return out;
}

async function copyText(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* clipboard may be unavailable in tests */
  }
  toast(done);
}

/** "Move to Space ▸": Pinned (or Today) of another Space, as in Arc. */
function moveToSpaceMenu(ids: ID[]): ContextMenuItem | null {
  const s = getS();
  const first = locate(s, ids[0]);
  if (!first || first.list === 'favorites') return null;
  const others = s.spaces.filter((sp) => sp.id !== first.spaceId);
  if (others.length === 0) return null;
  const hasFolder = ids.some((x) => s.items[x]?.kind === 'folder');
  const sub: ContextMenuItem[] = [];
  for (const sp of others) {
    sub.push({
      label: `${sp.icon}  ${sp.name}`,
      testId: `menu-to-space-${sp.id}`,
      submenu: [
        { label: 'Pinned', testId: `menu-to-space-${sp.id}-pinned`, onSelect: () => moveAll(ids, { type: 'end', list: 'pinned', spaceId: sp.id }, sp.id) },
        { label: 'Today', testId: `menu-to-space-${sp.id}-today`, disabled: hasFolder, onSelect: () => moveAll(ids, { type: 'end', list: 'today', spaceId: sp.id }, sp.id) },
      ],
    });
  }
  return { label: 'Move to Space', testId: 'menu-move-space', submenu: sub };
}

function moveAll(ids: ID[], target: Parameters<typeof dropItems>[2], spaceId: ID) {
  const ok = act((d) => dropItems(d, ids, target));
  setUi({ selected: [], selAnchor: null });
  const sp = getS().spaces.find((x) => x.id === spaceId);
  if (ok && sp) toast(`Moved to ${sp.name}`, 'Show', () => switchSpaceCmd(spaceId));
}

/** The menu for several picked rows (Arc: right-click a multi-selection). */
export function selectionMenu(id: ID): ContextMenuItem[] {
  const s = getS();
  const order = visibleRows(s);
  const ids = getUi().selected.filter((x) => s.items[x]).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  if (!ids.includes(id) || ids.length < 2) return itemMenu(id);
  const n = ids.length;
  const inFavorites = ids.some((x) => locate(s, x)?.list === 'favorites');
  const items: ContextMenuItem[] = [
    {
      label: `New Folder with ${n} Items`,
      testId: 'menu-sel-folder',
      disabled: inFavorites,
      onSelect: () => {
        setUi({ selected: [], selAnchor: null });
        newFolderCmd({ items: ids });
      },
    },
  ];
  const spaces = moveToSpaceMenu(ids);
  if (spaces && !inFavorites) items.push(spaces);
  items.push(
    { separator: true, label: '' },
    {
      label: `Archive ${n} Items`,
      testId: 'menu-sel-archive',
      onSelect: () => {
        setUi({ selected: [], selAnchor: null });
        undoable(`Archived ${n} item${n === 1 ? '' : 's'}`, (d) => {
          for (const x of ids) if (d.items[x]) archiveItem(d, x, now(), 'manual');
        });
      },
    },
    { label: 'Deselect', testId: 'menu-sel-clear', onSelect: () => setUi({ selected: [], selAnchor: null }) },
  );
  return items;
}
