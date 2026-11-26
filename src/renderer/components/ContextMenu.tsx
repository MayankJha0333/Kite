import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import { setUi, useKite, type ContextMenuItem } from '../store';

/** Open a menu at the mouse position. */
export function openMenu(e: { clientX: number; clientY: number; preventDefault?: () => void; stopPropagation?: () => void }, items: ContextMenuItem[]) {
  e.preventDefault?.();
  e.stopPropagation?.();
  setUi({ menu: { x: e.clientX, y: e.clientY, items } });
}

/**
 * Which list the keyboard is steering: the one the pointer or the arrow keys entered last.
 * A menu and its submenus are separate lists on screen; only one of them answers the keys.
 */
const Steering = createContext<{ owner: string; claim: (id: string) => void; leaving: boolean; onGone: () => void }>({ owner: '', claim: () => undefined, leaving: false, onGone: () => undefined });

/** How long a pause ends a typed word ("mo" jumps to Move; a later "c" starts again at Copy). */
const TYPE_AHEAD_MS = 600;

interface ListProps {
  items: ContextMenuItem[];
  x: number;
  y: number;
  onClose: () => void;
  level?: number;
  flipX?: number;
  /** Counts up each time the keyboard steps into this submenu: the highlight goes to its first item. */
  entered?: number;
  /** ← in a submenu: hand the keys back to the parent. */
  onBack?: () => void;
}

function MenuList({ items, x, y, onClose, level = 0, flipX, entered = 0, onBack }: ListProps) {
  const id = useId();
  const { owner, claim, leaving, onGone } = useContext(Steering);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const [open, setOpen] = useState<number | null>(null);
  const [focus, setFocus] = useState(-1);
  // True while the arrow keys are steering: the row under a resting pointer stops looking picked.
  const [keys, setKeys] = useState(false);
  const [childEntered, setChildEntered] = useState(0);
  const typed = useRef({ text: '', at: 0 });
  // Hover intent: give the pointer time to travel diagonally into an open submenu.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverRow = (i: number, hasSub: boolean) => {
    claim(id);
    setKeys(false);
    setFocus(i);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (hasSub) setOpen(i);
    else closeTimer.current = setTimeout(() => setOpen(null), 280);
  };
  const keepSub = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  useEffect(() => () => void (closeTimer.current && clearTimeout(closeTimer.current)), []);

  const enabled = items.map((it, i) => (!it.separator && !it.disabled ? i : -1)).filter((i) => i >= 0);

  // The top menu takes the keys as it opens; a submenu takes them when the keyboard steps in.
  // These, and the key listener below, are layout effects: the hand-over is finished before
  // the next key can arrive, however fast the keys are pressed.
  useLayoutEffect(() => {
    if (level === 0) claim(id);
  }, [level, id, claim]);
  useLayoutEffect(() => {
    if (!entered) return;
    claim(id);
    setKeys(true);
    setFocus(enabled[0] ?? -1);
    // Only when the keyboard steps in again, not when the items are rebuilt.
  }, [entered]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // A submenu that does not fit on the right opens on the left of its parent instead of sliding over it.
    const fitsRight = x + r.width + 6 <= window.innerWidth;
    const px = !fitsRight && flipX !== undefined && flipX - r.width >= 6 ? flipX - r.width : x;
    setPos({
      x: Math.max(6, Math.min(px, window.innerWidth - r.width - 6)),
      y: Math.max(6, Math.min(y, window.innerHeight - r.height - 6)),
    });
  }, [x, y, flipX]);

  useLayoutEffect(() => {
    if (owner !== id || leaving) return;
    const key = (e: KeyboardEvent) => {
      // A shortcut (⌘T, ⌘W…) is meant for the app: the menu steps aside and lets it through.
      if ((e.metaKey || e.ctrlKey) && !['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) return onClose();
      const at = enabled.indexOf(focus);
      const go = (i: number | undefined) => {
        if (i === undefined) return;
        setKeys(true);
        setFocus(i);
        setOpen(null);
      };
      const pick = () => {
        const it = items[focus];
        if (!it || focus < 0) return;
        if (it.submenu) {
          setKeys(true);
          setOpen(focus);
          setChildEntered((n) => n + 1);
        } else {
          onClose();
          it.onSelect?.();
        }
      };
      const letter = e.key.length === 1 && !e.altKey && (e.key !== ' ' || typed.current.text !== '');
      if (e.key === 'ArrowDown') go(enabled[(at + 1) % enabled.length]);
      else if (e.key === 'ArrowUp') go(enabled[(at <= 0 ? enabled.length : at) - 1]);
      else if (e.key === 'Home') go(enabled[0]);
      else if (e.key === 'End') go(enabled[enabled.length - 1]);
      else if (e.key === 'ArrowRight') {
        if (items[focus]?.submenu) pick();
      } else if (e.key === 'ArrowLeft') onBack?.();
      else if (e.key === 'Enter' || (e.key === ' ' && !letter)) pick();
      else if (e.key === 'Escape') onClose();
      else if (letter) {
        // Type a name to jump to it, as in any Mac menu.
        const now = Date.now();
        const text = (now - typed.current.at > TYPE_AHEAD_MS ? '' : typed.current.text) + e.key.toLowerCase();
        typed.current = { text, at: now };
        const name = (i: number) => items[i].label.replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase();
        // A single letter pressed again moves on to the next item that starts with it.
        const from = text.length === 1 ? at + 1 : Math.max(0, at);
        const order = [...enabled.slice(from), ...enabled.slice(0, from)];
        go(order.find((i) => name(i).startsWith(text)));
      } else if (e.key !== 'Tab') return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
    // `enabled` is derived from `items`.
  }, [items, focus, onClose, onBack, owner, id, leaving]);

  return (
    <div
      ref={ref}
      className="menu"
      role="menu"
      style={{ left: pos.x, top: pos.y }}
      data-keys={keys || undefined}
      data-leaving={leaving || undefined}
      // A menu on its way out is no longer "the menu" to anything that looks for one.
      data-testid={leaving ? undefined : level === 0 ? 'context-menu' : 'context-submenu'}
      onTransitionEnd={(e) => leaving && level === 0 && e.target === e.currentTarget && e.propertyName === 'opacity' && onGone()}
      // The pointer left the menu: nothing stays picked, unless a submenu hangs off the row.
      onMouseLeave={() => !keys && open === null && setFocus(-1)}
    >
      {items.map((it, i) =>
        it.separator ? (
          <div key={i} className="menu-sep" role="separator" />
        ) : (
          <div key={i} className="menu-row-wrap" data-row-index={i} onMouseMove={() => (focus !== i || keys) && hoverRow(i, !!it.submenu)} onMouseEnter={() => hoverRow(i, !!it.submenu)}>
            <button
              role="menuitem"
              className={`menu-item${it.danger ? ' danger' : ''}${focus === i ? ' focus' : ''}`}
              disabled={it.disabled}
              aria-haspopup={it.submenu ? 'menu' : undefined}
              aria-expanded={it.submenu ? open === i : undefined}
              data-testid={it.testId}
              onClick={(e) => {
                if (it.submenu) {
                  setOpen(i);
                  return;
                }
                e.stopPropagation();
                onClose();
                it.onSelect?.();
              }}
            >
              <span>{it.label}</span>
              {it.hint && <span className="menu-hint">{it.hint}</span>}
              {it.submenu && <ChevronRight size={12} className="menu-chev" aria-hidden="true" />}
            </button>
            {it.submenu && open === i && (
              <div onMouseEnter={keepSub}>
                <SubMenu
                  items={it.submenu}
                  parent={ref}
                  index={i}
                  onClose={onClose}
                  entered={childEntered}
                  onBack={() => {
                    setOpen(null);
                    setKeys(true);
                    claim(id);
                  }}
                />
              </div>
            )}
          </div>
        ),
      )}
    </div>
  );
}

function SubMenu({ items, parent, index, onClose, entered, onBack }: { items: ContextMenuItem[]; parent: React.RefObject<HTMLDivElement>; index: number; onClose: () => void; entered: number; onBack: () => void }) {
  const row = parent.current?.querySelector(`[data-row-index="${index}"]`) as HTMLElement | null;
  const r = row?.getBoundingClientRect();
  const pr = parent.current?.getBoundingClientRect();
  if (!r || !pr) return null;
  // Rendered outside the parent menu, which scrolls and would clip it.
  const host = parent.current?.closest('.app') ?? document.body;
  return createPortal(<MenuList items={items} x={pr.right - 4} y={r.top - 5} flipX={pr.left + 4} onClose={onClose} level={1} entered={entered} onBack={onBack} />, host);
}

type OpenMenu = NonNullable<ReturnType<typeof useKite.getState>['ui']['menu']>;

export function ContextMenuHost() {
  const menu = useKite((st) => st.ui.menu);
  // A menu is on screen at once and fades as it goes: `shown` outlives `menu` by that fade.
  const [shown, setShown] = useState<{ menu: OpenMenu; n: number } | null>(null);
  const [owner, claim] = useState('');
  if (menu && menu !== shown?.menu) setShown({ menu, n: (shown?.n ?? 0) + 1 });
  const leaving = !menu && !!shown;

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.('.menu')) setUi({ menu: null });
    };
    const blur = () => setUi({ menu: null });
    window.addEventListener('mousedown', close, true);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('mousedown', close, true);
      window.removeEventListener('blur', blur);
    };
  }, [menu]);

  // The fade normally ends itself (the menu's transitionend); this is for when it cannot run.
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setShown(null), 400);
    return () => clearTimeout(t);
  }, [leaving]);

  if (!shown) return null;
  return (
    <Steering.Provider value={{ owner, claim, leaving, onGone: () => setShown(null) }}>
      <MenuList key={shown.n} items={shown.menu.items} x={shown.menu.x} y={shown.menu.y} onClose={() => setUi({ menu: null })} />
    </Steering.Provider>
  );
}
