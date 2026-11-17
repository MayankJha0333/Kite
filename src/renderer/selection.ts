// Picking several sidebar rows at once, like Arc: ⌘-click adds or removes a row,
// ⇧-click picks everything between. A plain click (or Esc) goes back to one.
// The picked rows drag together and have their own menu (New Folder with…, Move to Space…).

import type { AppState, ID } from '@shared/types';
import { getSpace } from '@shared/tree';
import { getS, getUi, setUi } from './store';

/** Every row you can see in the active Space, top to bottom (Favorites, Pinned with open folders, Today). */
export function visibleRows(s: AppState): ID[] {
  const sp = getSpace(s, s.activeSpaceId);
  const out: ID[] = [...s.favorites];
  const walk = (ids: ID[]) => {
    for (const id of ids) {
      const it = s.items[id];
      if (!it) continue;
      out.push(id);
      if (it.kind === 'folder' && !it.collapsed) walk(it.children);
    }
  };
  walk(sp.pinned);
  walk(sp.today);
  return out;
}

let escBound = false;
function bindEsc() {
  if (escBound) return;
  escBound = true;
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || getUi().selected.length === 0) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest('input, textarea, [contenteditable="true"]')) return;
    setUi({ selected: [], selAnchor: null });
  });
}

export function clearSelection() {
  if (getUi().selected.length) setUi({ selected: [], selAnchor: null });
}

/** A click on a sidebar row: ⌘ / ⇧ pick rows; a plain click does the row's own thing. */
export function clickRow(e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }, id: ID, plain: () => void) {
  const s = getS();
  const ui = getUi();
  const active = s.activeBySpace[s.activeSpaceId];
  const rows = visibleRows(s);
  if (e.metaKey || e.ctrlKey) {
    bindEsc();
    // The open tab counts as already picked, as in Arc.
    let sel = ui.selected.length ? [...ui.selected] : active && active !== id && rows.includes(active) ? [active] : [];
    sel = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
    setUi({ selected: sel, selAnchor: id });
    return;
  }
  if (e.shiftKey) {
    bindEsc();
    const anchor = ui.selAnchor && rows.includes(ui.selAnchor) ? ui.selAnchor : active && rows.includes(active) ? active : id;
    const a = rows.indexOf(anchor);
    const b = rows.indexOf(id);
    if (a < 0 || b < 0) return plain();
    const range = rows.slice(Math.min(a, b), Math.max(a, b) + 1);
    // Rows inside a picked folder go with it already.
    setUi({ selected: range, selAnchor: anchor });
    return;
  }
  clearSelection();
  plain();
}
