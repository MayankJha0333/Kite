// Drag and drop for the sidebar: reorder, pin/unpin, drop into folders,
// onto Favorites, onto another Space, or onto the page to make a split view.
//
// Works like Arc's sidebar (an outline view with before / after / on drops):
// - a row's top half drops before it, its bottom half after it;
// - a folder takes the whole middle of its row ("on" the folder → inside, at the end);
//   just under an open folder's name drops at the top of its contents;
// - anywhere in an open folder's contents, or its "Drop tabs here" placeholder, drops inside it;
// - past the last item of a folder, move left to drop after the folder instead;
// - hold over a closed folder and it opens; hold over a Space and the sidebar switches to it;
// - near the top or bottom edge, the list scrolls;
// - dragging one of several selected rows moves them all.

import { create } from 'zustand';
import { useRef } from 'react';
import type { ID } from '@shared/types';
import type { DropTarget } from '@shared/folders';
import { canDrop, dropItems } from '@shared/folders';
import { displayTitle, toggleFolder } from '@shared/ops';
import { act, getS, getUi, setUi } from './store';
import { switchSpace } from '@shared/spaces';
import { visibleRows } from './selection';

export type Zone = Extract<DropTarget, { type: 'end' } | { type: 'space' }> | { type: 'stage' };
export type Target = DropTarget | { type: 'stage' };

interface DndState {
  dragging: ID | null;
  /** Everything that moves with this drag (the selection, or just the dragged row). */
  group: ID[];
  target: Target | null;
}

export const useDnd = create<DndState>(() => ({ dragging: null, group: [], target: null }));

/** Handlers for when something is dropped on the page area (split view). */
let stageDropHandler: ((id: ID) => void) | null = null;
export function onStageDrop(fn: (id: ID) => void) {
  stageDropHandler = fn;
}

/** How a held-over Space is brought forward (commands.ts also loads its selected page). */
let springSpace: (id: ID) => void = (id) => act((d) => void switchSpace(d, id));
export function onSpringSpace(fn: (id: ID) => void) {
  springSpace = fn;
}

const THRESHOLD = 5;
/** How long to hold over a closed folder / another Space before it opens. */
export const SPRING_MS = 550;
const EDGE = 36;
let suppressClick = false;

function zoneKey(t: Target | null): string | null {
  if (!t) return null;
  if (t.type === 'end') return `end:${t.list}:${t.spaceId ?? ''}`;
  if (t.type === 'space') return `space:${t.spaceId}`;
  if (t.type === 'stage') return 'stage';
  return null;
}

export function targetKey(t: Target | null): string {
  if (!t) return '';
  if (t.type === 'before' || t.type === 'after') return `${t.type}:${t.id}`;
  if (t.type === 'into') return `into:${t.folderId}:${t.at ?? 'end'}`;
  return zoneKey(t) ?? '';
}

/** The element under the pointer; in the sidebar's side padding, the row beside it counts. */
function hitAt(x: number, y: number): HTMLElement | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el || el.closest('[data-dnd-row], [data-dnd-into], [data-dnd-zone]')) return el;
  const sc = el.closest('.sb-scroll') as HTMLElement | null;
  if (!sc) return el;
  const r = sc.getBoundingClientRect();
  const px = Math.max(r.left + 16, Math.min(r.right - 16, x));
  return px === x ? el : ((document.elementFromPoint(px, y) as HTMLElement | null) ?? el);
}

/** What's under the pointer, before checking whether it's allowed. */
function rawTargetAt(x: number, y: number, dragId: ID): Target | null {
  const el = hitAt(x, y);
  if (!el) return null;
  const row = el.closest('[data-dnd-row]') as HTMLElement | null;
  if (row) {
    const id = row.dataset.dndRow!;
    if (id === dragId) return null;
    const r = row.getBoundingClientRect();
    const horizontal = row.dataset.dndAxis === 'x';
    const ratio = horizontal ? (x - r.left) / r.width : (y - r.top) / r.height;
    if (row.dataset.dndFolder === 'true') {
      if (ratio < 0.25) return { type: 'before', id };
      if (row.dataset.dndCollapsed === 'true') return ratio > 0.75 ? { type: 'after', id } : { type: 'into', folderId: id };
      // An open folder: its contents start right under its name.
      return ratio > 0.72 ? { type: 'into', folderId: id, at: 'start' } : { type: 'into', folderId: id };
    }
    const before = ratio < 0.5;
    // Below the last thing in a folder: pull left to drop after the folder itself.
    const parent = row.dataset.dndParent;
    if (!before && !horizontal && parent && row.dataset.dndLast === 'true') {
      const indent = Number(row.dataset.dndIndent ?? 0);
      if (x < r.left + indent - 4) return { type: 'after', id: parent };
    }
    return { type: before ? 'before' : 'after', id };
  }
  // An open folder's contents or its empty placeholder: inside the folder.
  const into = el.closest('[data-dnd-into]') as HTMLElement | null;
  if (into) return { type: 'into', folderId: into.dataset.dndInto! };
  const zone = el.closest('[data-dnd-zone]') as HTMLElement | null;
  if (zone) {
    try {
      return JSON.parse(zone.dataset.dndZone!) as Target;
    } catch {
      return null;
    }
  }
  return null;
}

/** What's under the pointer, if dropping there is allowed (otherwise no indicator, and no drop). */
export function targetAt(x: number, y: number, dragId: ID, group: ID[] = [dragId]): Target | null {
  const t = rawTargetAt(x, y, dragId);
  if (!t || t.type === 'stage') return t;
  if ((t.type === 'before' || t.type === 'after') && group.includes(t.id)) return null;
  if (t.type === 'into' && group.includes(t.folderId)) return null;
  return canDrop(getS(), group, t) ? t : null;
}

function finishDrop(id: ID, group: ID[], t: Target | null) {
  if (!t) return;
  if (t.type === 'stage') {
    stageDropHandler?.(id);
    return;
  }
  const moved = act((d) => dropItems(d, group, t));
  if (moved && group.length > 1) setUi({ selected: [] });
  // Dropped into a closed folder: open it so you can see where it went (Arc does the same).
  if (moved && t.type === 'into') act((d) => toggleFolder(d, t.folderId, false));
}

/** Makes a sidebar row draggable and a drop target. */
export function useDragRow(id: ID, isFolder: boolean, axis: 'x' | 'y' = 'y') {
  const el = useRef<HTMLElement | null>(null);
  const dropHint = useDnd((st) => {
    const t = st.target;
    if (!t || st.dragging === id) return null;
    if ((t.type === 'before' || t.type === 'after') && t.id === id) return t.type;
    if (t.type === 'into' && t.folderId === id) return t.at === 'start' ? 'into-start' : 'into';
    return null;
  });
  const isDragging = useDnd((st) => st.dragging !== null && st.group.includes(id));

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if ((e.target as HTMLElement).closest('button.row-btn, button.row-sound, button.folder-more, input')) return;
    const sx = e.clientX;
    const sy = e.clientY;
    let started = false;
    let ghost: HTMLDivElement | null = null;
    let group: ID[] = [id];
    let lastX = sx;
    let lastY = sy;
    let springKey = '';
    let springTimer: ReturnType<typeof setTimeout> | null = null;
    let scrollTimer: ReturnType<typeof setInterval> | null = null;
    const scroller = () => (el.current?.closest('.sb-scroll') as HTMLElement | null) ?? (document.querySelector('.sb-scroll') as HTMLElement | null);

    const clearSpring = () => {
      if (springTimer) clearTimeout(springTimer);
      springTimer = null;
      springKey = '';
    };
    const update = () => {
      const t = targetAt(lastX, lastY, id, group);
      useDnd.setState({ target: t });
      // Spring-loading: a closed folder opens, another Space comes forward.
      let key = '';
      if (t?.type === 'into' && (getS().items[t.folderId] as { collapsed?: boolean } | undefined)?.collapsed) key = `f:${t.folderId}`;
      if (t?.type === 'space' && t.spaceId !== getS().activeSpaceId) key = `s:${t.spaceId}`;
      if (key !== springKey) {
        clearSpring();
        springKey = key;
        if (key) {
          springTimer = setTimeout(() => {
            springTimer = null;
            if (!useDnd.getState().dragging) return;
            if (key.startsWith('f:')) act((d) => toggleFolder(d, key.slice(2), false));
            else springSpace(key.slice(2));
            // The list changed under the pointer.
            requestAnimationFrame(update);
          }, SPRING_MS);
        }
      }
    };

    const move = (ev: PointerEvent) => {
      if (!started) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < THRESHOLD) return;
        started = true;
        const sel = getUi().selected;
        const order = visibleRows(getS());
        group = sel.includes(id) && sel.length > 1 ? sel.filter((x) => getS().items[x]).sort((a, b) => order.indexOf(a) - order.indexOf(b)) : [id];
        if (!sel.includes(id) && sel.length) setUi({ selected: [] });
        useDnd.setState({ dragging: id, group, target: null });
        document.body.classList.add('dragging');
        ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        ghost.dataset.testid = 'drag-ghost';
        const it = getS().items[id];
        const label = it ? displayTitle(it) : '';
        ghost.textContent = group.length > 1 ? `${label}  +${group.length - 1}` : label;
        if (group.length > 1) ghost.dataset.count = String(group.length);
        (el.current?.closest('.app') ?? document.body).appendChild(ghost);
        // Near the top or bottom edge, the list scrolls.
        scrollTimer = setInterval(() => {
          const sc = scroller();
          if (!sc) return;
          const r = sc.getBoundingClientRect();
          if (lastX < r.left || lastX > r.right) return;
          let dy = 0;
          if (lastY < r.top + EDGE) dy = -Math.ceil((r.top + EDGE - lastY) / 3);
          else if (lastY > r.bottom - EDGE) dy = Math.ceil((lastY - (r.bottom - EDGE)) / 3);
          if (dy) {
            sc.scrollTop += dy;
            update();
          }
        }, 16);
      }
      lastX = ev.clientX;
      lastY = ev.clientY;
      if (ghost) {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
      }
      update();
    };
    const end = (commit: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key, true);
      clearSpring();
      if (scrollTimer) clearInterval(scrollTimer);
      ghost?.remove();
      document.body.classList.remove('dragging');
      const t = useDnd.getState().target;
      useDnd.setState({ dragging: null, group: [], target: null });
      if (started) {
        suppressClick = true;
        setTimeout(() => (suppressClick = false), 0);
        if (commit) finishDrop(id, group, t);
      }
    };
    const up = () => end(true);
    const cancel = () => end(false);
    const key = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        end(false);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key, true);
  };

  return {
    setRef: (node: HTMLElement | null) => {
      el.current = node;
    },
    dropHint,
    handlers: {
      onPointerDown,
      onClickCapture: (e: React.MouseEvent) => {
        if (suppressClick) {
          e.stopPropagation();
          e.preventDefault();
        }
      },
      // Native drag (of text or an image in the row) would steal the pointer mid-drag.
      onDragStart: (e: React.DragEvent) => e.preventDefault(),
      'data-dnd-row': id,
      'data-dnd-folder': isFolder ? 'true' : undefined,
      'data-dnd-axis': axis,
      'data-dragging': isDragging || undefined,
    },
  };
}

/** An area that accepts drops (end of a list, a Space button, the page). */
export function DropZone({ zone, children, className, testId, ...rest }: { zone: Zone; children?: React.ReactNode; className?: string; testId?: string } & React.HTMLAttributes<HTMLDivElement>) {
  const key = zoneKey(zone);
  const over = useDnd((st) => st.dragging !== null && zoneKey(st.target) === key);
  return (
    <div {...rest} className={className} data-testid={testId} data-dnd-zone={JSON.stringify(zone)} data-over={over || undefined}>
      {children}
    </div>
  );
}
