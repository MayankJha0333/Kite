import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import type { ID, Space } from '@shared/types';
import { ARCHIVE_CHOICES } from '@shared/defaults';
import { createSpace, deleteSpace, updateSpace, moveSpace } from '@shared/spaces';
import { spaceToFolder } from '@shared/folders';
import { act, getS, setUi, toast, useKite, type ContextMenuItem } from '../store';
import { actions, resetSpaceTabsCmd, undoable, switchSpaceCmd } from '../commands';
import { togglePinnedSection } from '@shared/ops';
import { openMenu } from './ContextMenu';
import { DropZone } from '../dnd';
import { Sheet, Field, Toggle } from './Sheet';
import { ThemeControls } from './ThemeEditor';
import { mix } from '../theme';
import { backdropById } from '@shared/backdrops';
import { backdropUrl } from '../backdrops';
import { now } from '../platform';

/**
 * The Space's name, as the label over its list. Its menu ("…") and the fold for its pinned
 * tabs wait at the right end until the header is pointed at or focused.
 */
export function SpaceHeader({ space }: { space: Space }) {
  const renaming = useKite((st) => st.ui.renamingSpace === space.id);
  const folded = !!space.pinnedCollapsed;
  return (
    <div
      className="space-header"
      data-testid="space-header"
      data-renaming={renaming || undefined}
      role="button"
      tabIndex={0}
      aria-haspopup="menu"
      aria-label={`${space.name} Space options`}
      title="Double-click to rename · right-click for options"
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        openSpaceMenuBelow(e.currentTarget, space.id);
      }}
      onContextMenu={(e) => !renaming && openMenu(e, spaceMenu(space.id))}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('button, input')) return;
        setUi({ menu: null, renamingSpace: space.id });
      }}
    >
      <span className="space-icon">{space.icon}</span>
      {renaming ? <SpaceNameInput space={space} /> : <span className="space-name" data-testid="space-name">{space.name}</span>}
      {space.isolated && !renaming && <span className="space-badge" title="This Space has its own logins and cookies" data-testid="space-isolated-badge">Separate logins</span>}
      {!renaming && space.pinned.length > 0 && (
        <button
          className="sb-pin-toggle"
          data-testid="pinned-toggle"
          aria-expanded={!folded}
          aria-label={folded ? 'Expand Pinned Section' : 'Collapse Pinned Section'}
          title={folded ? 'Expand Pinned Section' : 'Collapse Pinned Section'}
          onClick={() => act((d) => togglePinnedSection(d, space.id))}
        >
          {folded && <span>{space.pinned.length} pinned</span>}
          {folded ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </button>
      )}
      {!renaming && (
        <button className="icon-btn small space-more" aria-label="Space menu" title="Space menu" data-testid="space-menu" onClick={(e) => openMenu(e, spaceMenu(space.id))}>
          <MoreHorizontal size={16} />
        </button>
      )}
    </div>
  );
}

/** Arc renames a Space right in its header: Enter keeps it, Esc puts it back. */
function SpaceNameInput({ space }: { space: Space }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    const v = ref.current?.value ?? '';
    if (save && v.trim()) act((d) => updateSpace(d, space.id, { name: v }));
    setUi({ renamingSpace: null });
  };
  return (
    <input
      ref={ref}
      className="rename space-rename"
      data-testid="space-rename-input"
      aria-label="Space name"
      defaultValue={space.name}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      }}
      onBlur={() => finish(true)}
    />
  );
}

function openSpaceMenuBelow(el: HTMLElement, id: ID) {
  const r = el.getBoundingClientRect();
  openMenu({ clientX: r.left + 4, clientY: r.bottom + 4 }, spaceMenu(id));
}

export function openSpaceEditor(id: ID) {
  setUi({ panel: 'space', panelArg: id });
}

export function newSpaceCmd() {
  const id = act((d) => createSpace(d, {}));
  openSpaceEditor(id);
  return id;
}

export function deleteSpaceCmd(id: ID) {
  const sp = getS().spaces.find((x) => x.id === id);
  if (!sp || getS().spaces.length <= 1) return;
  setUi({ panel: null });
  undoable(`Deleted Space “${sp.name}”`, (d) => void deleteSpace(d, id, now()));
}

/**
 * The Space's menu. What people reach for stays at the top level (rename, edit, a new
 * folder, fold the pinned tabs); the housekeeping lives one step away under "More".
 */
export function spaceMenu(id: ID): ContextMenuItem[] {
  const s = getS();
  const i = s.spaces.findIndex((x) => x.id === id);
  const sp = s.spaces[i];
  const others = s.spaces.filter((x) => x.id !== id);
  // One entry per Space this one could become a folder in: no third level of menus.
  const intoFolder: ContextMenuItem[] = others.length
    ? others.map((o) => ({
        label: `Turn into Folder in ${o.name}`,
        testId: `menu-space-to-folder-${o.id}`,
        onSelect: () => {
          undoable(`“${sp?.name}” is now a folder in ${o.name}`, (d) => void spaceToFolder(d, id, o.id, now()));
          switchSpaceCmd(getS().activeSpaceId);
        },
      }))
    : [{ label: 'Turn into Folder', testId: 'menu-space-to-folder', disabled: true }];
  const more: ContextMenuItem[] = [
    { label: 'Collapse All Folders', testId: 'menu-collapse-all', onSelect: actions.collapseFolders },
    { label: 'Expand All Folders', testId: 'menu-expand-all', onSelect: actions.expandFolders },
    { label: 'Reset All Tabs in This Space', testId: 'menu-reset-space', onSelect: () => { if (getS().activeSpaceId !== id) switchSpaceCmd(id); resetSpaceTabsCmd(); } },
    { separator: true, label: '' },
    { label: 'Move Left', disabled: i <= 0, testId: 'menu-space-left', onSelect: () => act((d) => moveSpace(d, id, i - 1)) },
    { label: 'Move Right', disabled: i >= s.spaces.length - 1, testId: 'menu-space-right', onSelect: () => act((d) => moveSpace(d, id, i + 1)) },
    ...intoFolder,
  ];
  return [
    { label: 'Rename Space', testId: 'menu-rename-space', onSelect: () => setUi({ renamingSpace: id, menu: null }) },
    { label: 'Edit Space…', testId: 'menu-edit-space', onSelect: () => openSpaceEditor(id) },
    { separator: true, label: '' },
    { label: 'New Folder', testId: 'menu-new-folder', onSelect: actions.newFolder },
    { label: sp?.pinnedCollapsed ? 'Expand Pinned Section' : 'Collapse Pinned Section', testId: 'menu-pinned-toggle', onSelect: () => act((d) => togglePinnedSection(d, id)) },
    { label: 'More', testId: 'menu-more', submenu: more },
    { separator: true, label: '' },
    { label: 'Delete Space…', danger: true, disabled: s.spaces.length <= 1, testId: 'menu-delete-space', onSelect: () => deleteSpaceCmd(id) },
  ];
}

/** Space icons in the sidebar footer: click to switch, drop tabs on them to move. */
export function SpaceBar() {
  const spaces = useKite((st) => st.s.spaces);
  const activeId = useKite((st) => st.s.activeSpaceId);
  const bar = useRef<HTMLDivElement>(null);
  const [reordering, setReordering] = useState<ID | null>(null);
  const justDragged = useRef(false);

  // Arc: drag a Space's icon sideways to reorder Spaces.
  const startReorder = (e: React.PointerEvent, id: ID) => {
    if (e.button !== 0) return;
    const sx = e.clientX;
    let started = false;
    const move = (ev: PointerEvent) => {
      if (!started) {
        if (Math.abs(ev.clientX - sx) < 6) return;
        started = true;
        setReordering(id);
        document.body.classList.add('dragging');
      }
      const dots = [...(bar.current?.querySelectorAll<HTMLElement>('[data-space-dot]') ?? [])];
      const from = getS().spaces.findIndex((x) => x.id === id);
      let to = dots.findIndex((d) => {
        const r = d.getBoundingClientRect();
        return ev.clientX < r.left + r.width / 2;
      });
      if (to < 0) to = dots.length - 1;
      else if (to > from) to -= 1;
      if (to !== from) act((d) => moveSpace(d, id, to));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (started) {
        justDragged.current = true;
        setTimeout(() => (justDragged.current = false), 0);
        document.body.classList.remove('dragging');
        setReordering(null);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return (
    <div className="space-bar" role="tablist" aria-label="Spaces" data-testid="space-bar" ref={bar}>
      {spaces.map((sp) => (
        <DropZone key={sp.id} zone={{ type: 'space', spaceId: sp.id }} className="space-dot-wrap">
          <button
            role="tab"
            aria-selected={sp.id === activeId}
            aria-label={sp.name}
            className="space-dot"
            data-space-dot
            data-active={sp.id === activeId || undefined}
            data-reordering={reordering === sp.id || undefined}
            data-testid={`space-${sp.id}`}
            data-name={sp.name}
            title={sp.id === activeId ? `${sp.name} (this Space)` : `Switch to ${sp.name}`}
            onPointerDown={(e) => startReorder(e, sp.id)}
            onClick={() => !justDragged.current && switchSpaceCmd(sp.id)}
            onDoubleClick={() => openSpaceEditor(sp.id)}
            onContextMenu={(e) => openMenu(e, spaceMenu(sp.id))}
          >
            {sp.icon}
          </button>
        </DropZone>
      ))}
      <button className="space-dot" aria-label="New Space" title="New Space" data-testid="btn-new-space" onClick={newSpaceCmd}>
        <Plus size={16} />
      </button>
    </div>
  );
}

/** Two-finger horizontal swipe on the sidebar switches Spaces. */
export function useSpaceSwipe() {
  const acc = useRef(0);
  const cool = useRef(0);
  return (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    const t = Date.now();
    if (t < cool.current) return;
    acc.current += e.deltaX;
    if (Math.abs(acc.current) > 90) {
      (acc.current > 0 ? actions.nextSpace : actions.prevSpace)();
      acc.current = 0;
      cool.current = t + 450;
    }
  };
}

export const EMOJIS = ['🪁', '🏠', '💼', '🎨', '📚', '🧪', '🎧', '🌿', '🔥', '⭐', '🚀', '🧭', '🍳', '🎮', '💡', '🛠️', '📈', '✈️', '🧘', '🐙', '🌙', '☕', '🎬', '🗂️'];

export function SpaceEditor({ id }: { id: ID }) {
  const space = useKite((st) => st.s.spaces.find((x) => x.id === id));
  const count = useKite((st) => st.s.spaces.length);
  if (!space) return null;
  const t = space.theme;
  return (
    <Sheet
      title="Edit Space"
      testId="space-editor"
      footer={
        <>
          {count > 1 && (
            <button className="btn danger" data-testid="btn-delete-space" onClick={() => deleteSpaceCmd(id)}>
              <Trash2 size={14} /> Delete Space
            </button>
          )}
          <span className="spacer" />
          <button className="btn primary" data-testid="space-done" onClick={() => setUi({ panel: null })}>
            Done
          </button>
        </>
      }
    >
      <div className="space-preview" data-tone={t.backdrop ? backdropById(t.backdrop)?.tone : undefined} style={{ background: t.backdrop ? `center / cover url("${backdropUrl(t.backdrop)}")` : t.gradient ? `linear-gradient(${t.gradient.angle}deg, ${t.gradient.colors.join(', ')})` : mix(t.mode === 'dark' ? '#0a0f16' : '#fafcfc', t.colors[0], 0.3) }}>
        <span className="space-preview-icon">{space.icon}</span>
        <span className="space-preview-name">{space.name}</span>
      </div>

      <Field label="Name">
        <input
          className="input"
          data-testid="space-name-input"
          defaultValue={space.name}
          autoFocus
          onChange={(e) => act((d) => updateSpace(d, id, { name: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && setUi({ panel: null })}
        />
      </Field>

      <Field label="Icon" hint="Pick one or type any emoji">
        <div className="emoji-grid">
          {EMOJIS.map((e) => (
            <button key={e} className="emoji" data-on={space.icon === e || undefined} onClick={(ev) => { ev.preventDefault(); act((d) => updateSpace(d, id, { icon: e })); }}>
              {e}
            </button>
          ))}
          <input className="input emoji-input" maxLength={4} placeholder="✎" data-testid="space-icon-input" onChange={(e) => e.target.value && act((d) => updateSpace(d, id, { icon: e.target.value }))} />
        </div>
      </Field>

      <ThemeControls spaceId={id} />

      <label className="field-inline space-isolated">
        <Toggle
          checked={!!space.isolated}
          testId="space-isolated"
          label="Separate logins for this Space"
          onChange={(isolated) => {
            act((d) => updateSpace(d, id, { isolated }));
            toast(isolated ? `“${space.name}” now has its own logins and cookies. Its tabs reloaded.` : `“${space.name}” shares logins with your other Spaces again. Its tabs reloaded.`);
          }}
        />
        <span>
          <b>Separate logins for this Space</b>
          <span className="muted">Its own cookies, sign-ins and site data, so you can use a second account on the same sites. Favorites stay shared.</span>
        </span>
      </label>

      <Field label="Archive unused tabs after" hint="Overrides the global setting for this Space">
        <select
          className="input"
          data-testid="space-archive"
          value={space.archiveAfterMs === undefined ? 'global' : String(space.archiveAfterMs)}
          onChange={(e) => act((d) => updateSpace(d, id, { archiveAfterMs: e.target.value === 'global' ? undefined : e.target.value === 'null' ? null : Number(e.target.value) }))}
        >
          <option value="global">Same as Settings</option>
          {ARCHIVE_CHOICES.map((c) => (
            <option key={c.label} value={String(c.ms)}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
    </Sheet>
  );
}
