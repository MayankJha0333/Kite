import { memo, useEffect, useRef, useState } from 'react';
import { X, Undo2, Loader2, StickyNote, Columns2, Folder, FolderOpen, Volume2, VolumeX, PictureInPicture2, MoreHorizontal } from 'lucide-react';
import { toggleMute } from '../pipRuntime';

const shallowEq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
import type { ID, Item, ListName } from '@shared/types';
import { displayTitle } from '@shared/ops';
import { act, setUi, useKite } from '../store';
import { closeItemCmd, selectItem, navigateTab, warmTab } from '../commands';
import { SiteIcon } from './SiteIcon';
import { openMenu } from './ContextMenu';
import { itemMenu, selectionMenu } from '../itemMenus';
import { clickRow } from '../selection';
import * as ops from '@shared/ops';
import { hostOf } from '@shared/url';
import { useDragRow } from '../dnd';
import { splitTitle } from './SplitView';

interface Props {
  id: ID;
  list: ListName;
  depth: number;
  /** The folder this row is in, and whether it's the folder's last row (for dropping after the folder). */
  parentId?: ID;
  last?: boolean;
}

const indent = (depth: number) => 8 + depth * 14;

/** Arrow keys move between rows; Enter / Space act on the focused one. */
export function rowKeys(e: React.KeyboardEvent, activate: () => void, extra?: (key: string) => boolean) {
  if (e.target !== e.currentTarget) return; // typing in a rename box, or a button inside the row
  if (extra?.(e.key)) {
    e.preventDefault();
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    activate();
    return;
  }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  const rows = [...document.querySelectorAll<HTMLElement>('.sb-scroll [data-flip][role]')].filter((r) => r.offsetParent !== null);
  const i = rows.indexOf(e.currentTarget as HTMLElement);
  const next = rows[i + (e.key === 'ArrowDown' ? 1 : -1)];
  next?.focus();
}

/** Attributes that tell a drag where this row sits in the tree. */
function treeAttrs(depth: number, parentId?: ID, last?: boolean) {
  return { 'data-dnd-parent': parentId, 'data-dnd-last': last ? 'true' : undefined, 'data-dnd-indent': indent(depth) };
}

export const ItemRow = memo(function ItemRow({ id, list, depth, parentId, last }: Props) {
  const item = useKite((st) => st.s.items[id]);
  const active = useKite((st) => st.s.activeBySpace[st.s.activeSpaceId] === id);
  const loading = useKite((st) => !!st.ui.loading[id]);
  // A tab whose page was unloaded to save memory (it reloads when opened).
  const asleep = useKite((st) => st.s.items[id]?.kind === 'tab' && !st.ui.loaded.includes(id) && st.s.activeBySpace[st.s.activeSpaceId] !== id);
  const renaming = useKite((st) => st.ui.renaming === id);
  const closeOnHover = useKite((st) => st.s.settings.showTabCloseOnHover);
  const sound = useKite((st) => {
    const it = st.s.items[id];
    const tabs = !it ? [] : it.kind === 'tab' ? [id] : it.kind === 'split' ? it.panes : [];
    const playingTab = tabs.find((t) => st.ui.playing[t]);
    return playingTab ? { tab: playingTab, muted: !!st.ui.muted[playingTab], pipped: st.ui.pipped.includes(playingTab) } : null;
  }, shallowEq);
  const drag = useDragRow(id, item?.kind === 'folder');
  const picked = useKite((st) => st.ui.selected.includes(id));
  const liveTitle = useKite((st) => {
    const it = st.s.items[id];
    return !it ? '' : it.kind === 'split' ? splitTitle(it, st.s.items) : displayTitle(it);
  });
  if (!item) return null;
  const title = liveTitle;

  if (item.kind === 'folder') return <FolderRow item={item} depth={depth} renaming={renaming} drag={drag} picked={picked} tree={treeAttrs(depth, parentId, last)} />;

  const awayFromHome = item.kind === 'tab' && item.homeUrl && hostOf(item.homeUrl) !== '' && item.url !== item.homeUrl;

  return (
    <div
      ref={drag.setRef}
      {...drag.handlers}
      {...treeAttrs(depth, parentId, last)}
      className="row"
      role="treeitem"
      tabIndex={active ? 0 : -1}
      data-flip={id}
      aria-selected={active || picked}
      data-active={active || undefined}
      data-picked={picked || undefined}
      data-kind={item.kind}
      data-asleep={asleep || undefined}
      data-drop={drag.dropHint ?? undefined}
      data-testid={`row-${id}`}
      data-title={title}
      style={{ paddingLeft: indent(depth), ['--indent' as string]: `${indent(depth)}px` }}
      onClick={(e) => clickRow(e, id, () => selectItem(id))}
      onPointerEnter={() => warmTab(id)}
      onKeyDown={(e) => rowKeys(e, () => selectItem(id))}
      onAuxClick={(e) => e.button === 1 && closeItemCmd(id)}
      onDoubleClick={(e) => !(e.metaKey || e.ctrlKey || e.shiftKey) && setUi({ renaming: id })}
      onContextMenu={(e) => openMenu(e, picked ? selectionMenu(id) : itemMenu(id))}
      title={item.kind === 'tab' ? `${title}\n${item.url}${asleep ? '\nAsleep to save memory. Opens instantly when you click.' : ''}` : title}
    >
      <RowIcon item={item} />
      {renaming ? (
        <RenameInput id={id} initial={title} />
      ) : (
        <span className="row-title">
          {awayFromHome && <span className="row-home-sep">{title}</span>}
          {!awayFromHome && title}
        </span>
      )}
      {loading && <Loader2 size={13} className="spin row-status" aria-label="Loading" />}
      {sound && (
        <button
          className="row-sound"
          data-testid={`sound-${id}`}
          data-muted={sound.muted || undefined}
          title={sound.pipped ? 'Playing in a floating window — click to mute' : sound.muted ? 'Unmute' : 'Mute'}
          aria-label={sound.muted ? 'Unmute' : 'Mute'}
          onClick={(e) => {
            e.stopPropagation();
            toggleMute(sound.tab);
          }}
        >
          {sound.muted ? <VolumeX size={13} /> : sound.pipped ? <PictureInPicture2 size={13} /> : <Volume2 size={13} />}
        </button>
      )}
      {awayFromHome && (
        <button
          className="row-btn"
          title="Back to pinned page"
          data-testid={`home-${id}`}
          onClick={(e) => {
            e.stopPropagation();
            if (item.kind === 'tab' && item.homeUrl) navigateTab(id, item.homeUrl);
          }}
        >
          <Undo2 size={13} />
        </button>
      )}
      {(closeOnHover || active) && list !== 'favorites' && (
        <button
          className="row-btn row-close"
          aria-label="Close"
          data-testid={`close-${id}`}
          onClick={(e) => {
            e.stopPropagation();
            closeItemCmd(id);
          }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
});

function RowIcon({ item }: { item: Item }) {
  const items = useKite((st) => st.s.items);
  if (item.kind === 'tab') return <SiteIcon url={item.url} favicon={item.favicon} title={item.title} />;
  if (item.kind === 'note') return <StickyNote size={15} className="row-glyph" />;
  if (item.kind === 'split') {
    return (
      <span className="split-icons">
        <Columns2 size={14} className="row-glyph" />
        {item.panes.slice(0, 2).map((p) => {
          const t = items[p];
          return t?.kind === 'tab' ? <SiteIcon key={p} url={t.url} favicon={t.favicon} title={t.title} size={12} /> : null;
        })}
      </span>
    );
  }
  return null;
}

function FolderRow({ item, depth, renaming, drag, picked, tree }: { item: Extract<Item, { kind: 'folder' }>; depth: number; renaming: boolean; drag: ReturnType<typeof useDragRow>; picked: boolean; tree: ReturnType<typeof treeAttrs> }) {
  const Icon = item.collapsed ? Folder : FolderOpen;
  // Arc: a closed folder still shows the open tab inside it, just under the folder.
  const peekId = useKite((st) => {
    if (!item.collapsed) return null;
    const a = st.s.activeBySpace[st.s.activeSpaceId];
    if (!a) return null;
    const find = (ids: ID[]): ID | null => {
      for (const c of ids) {
        const it = st.s.items[c];
        if (c === a || (it?.kind === 'split' && it.panes.includes(a))) return c;
        if (it?.kind === 'folder') {
          const f = find(it.children);
          if (f) return f;
        }
      }
      return null;
    };
    return find(item.children);
  });
  const holdsActive = peekId !== null;
  const dropping = drag.dropHint === 'into' || drag.dropHint === 'into-start';
  const menu = (e: React.MouseEvent) => openMenu(e, picked ? selectionMenu(item.id) : itemMenu(item.id));
  return (
    <div className="folder" data-testid={`folder-${item.id}`} data-collapsed={item.collapsed || undefined} data-drop-target={dropping || undefined}>
      <div
        ref={drag.setRef}
        {...drag.handlers}
        {...tree}
        data-dnd-collapsed={item.collapsed ? 'true' : 'false'}
        className="row folder-row"
        role="treeitem"
        tabIndex={-1}
        data-flip={item.id}
        aria-expanded={!item.collapsed}
        aria-selected={picked}
        data-picked={picked || undefined}
        data-holds-active={holdsActive || undefined}
        data-drop={drag.dropHint ?? undefined}
        data-testid={`row-${item.id}`}
        data-title={item.title}
        style={{ paddingLeft: indent(depth), ['--indent' as string]: `${indent(depth)}px`, ['--child-indent' as string]: `${indent(depth + 1)}px` }}
        onClick={(e) => clickRow(e, item.id, () => act((d) => ops.toggleFolder(d, item.id)))}
        onKeyDown={(e) =>
          rowKeys(e, () => act((d) => ops.toggleFolder(d, item.id)), (key) => {
            if (key === 'ArrowRight' && item.collapsed) return act((d) => ops.toggleFolder(d, item.id)), true;
            if (key === 'ArrowLeft' && !item.collapsed) return act((d) => ops.toggleFolder(d, item.id)), true;
            return false;
          })
        }
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!(e.metaKey || e.ctrlKey || e.shiftKey)) setUi({ renaming: item.id });
        }}
        onContextMenu={menu}
      >
        <Icon size={15} className="row-glyph folder-glyph" />
        {renaming ? <RenameInput id={item.id} initial={item.title} /> : <span className="row-title">{item.title}</span>}
        {item.collapsed && item.children.length > 0 && <span className="row-count">{item.children.length}</span>}
        <button
          className="row-btn folder-more"
          aria-label="Folder options"
          title="Folder options"
          data-testid={`folder-more-${item.id}`}
          onClick={(e) => {
            e.stopPropagation();
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            openMenu({ clientX: r.left, clientY: r.bottom + 4 }, itemMenu(item.id));
          }}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
      {peekId && (
        <div className="folder-children folder-peek" role="group" data-testid={`folder-peek-${item.id}`}>
          <ItemRow id={peekId} list="pinned" depth={depth + 1} parentId={item.id} last />
        </div>
      )}
      {!item.collapsed && (
        // Dropping anywhere in an open folder's contents puts the tab inside it.
        <div className="folder-children" role="group" data-dnd-into={item.id} data-testid={`folder-children-${item.id}`}>
          {item.children.length === 0 && (
            <div className="folder-empty" data-testid={`folder-empty-${item.id}`} style={{ paddingLeft: indent(depth + 1) + 22 }}>
              Drop tabs here
            </div>
          )}
          {item.children.map((c, i) => (
            <ItemRow key={c} id={c} list="pinned" depth={depth + 1} parentId={item.id} last={i === item.children.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function RenameInput({ id, initial }: { id: ID; initial: string }) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const done = (save: boolean) => {
    if (save) act((d) => ops.renameItem(d, id, v));
    setUi({ renaming: null });
  };
  return (
    <input
      ref={ref}
      className="rename"
      data-testid="rename-input"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') done(true);
        if (e.key === 'Escape') done(false);
      }}
      onBlur={() => done(true)}
    />
  );
}
