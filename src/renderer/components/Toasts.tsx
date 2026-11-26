import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { activeItemId } from '@shared/ops';
import { useKite, setUi, type Toast } from '../store';

/** After the pointer leaves a toast (or the window comes back), it stays at least this long. */
const GRACE_MS = 1200;
/** If the exit cannot play (a hidden window draws nothing), the toast is removed after this. */
const EXIT_FALLBACK_MS = 400;

const leave = (id: number) => setUi((u) => ({ toasts: u.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)) }));
const remove = (id: number) => setUi((u) => ({ toasts: u.toasts.filter((t) => t.id !== id || !t.leaving) }));

/** True while the window cannot be seen (minimized, hidden, another tab of a browser in web mode). */
function useHidden() {
  const [hidden, setHidden] = useState(() => document.hidden);
  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return hidden;
}

function ToastItem({ t, hidden }: { t: Toast; hidden: boolean }) {
  // Under the pointer or holding keyboard focus: someone is reading it or about to act on it.
  const [held, setHeld] = useState(false);
  const left = useRef(t.ms);

  // Shown again (the same message, or a new one in its place): the clock starts over.
  useEffect(() => {
    left.current = t.ms;
  }, [t.shown, t.ms]);

  // The clock only runs while the toast can be read and nobody is on it.
  useEffect(() => {
    if (t.leaving || held || hidden) return;
    const started = performance.now();
    const timer = setTimeout(() => leave(t.id), left.current);
    return () => {
      clearTimeout(timer);
      left.current = Math.max(GRACE_MS, left.current - (performance.now() - started));
    };
  }, [t.id, t.shown, t.leaving, held, hidden]);

  useEffect(() => {
    if (!t.leaving) return;
    const timer = setTimeout(() => remove(t.id), EXIT_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [t.id, t.leaving]);

  return (
    <div
      className="toast"
      data-testid="toast"
      data-leaving={t.leaving || undefined}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      onTransitionEnd={(e) => t.leaving && e.target === e.currentTarget && e.propertyName === 'opacity' && remove(t.id)}
    >
      <span className="toast-text">{t.text}</span>
      {t.action && (
        <button
          className="toast-action"
          onClick={() => {
            t.action!();
            leave(t.id);
          }}
        >
          {t.actionLabel}
        </button>
      )}
      <button className="toast-close" aria-label="Dismiss" onClick={() => leave(t.id)}>
        <X size={12} aria-hidden="true" />
      </button>
    </div>
  );
}

export function Toasts() {
  const toasts = useKite((st) => st.ui.toasts);
  // Centered on the page, not on the window: the stack keeps clear of the sidebar.
  const sidebar = useKite((st) => (st.s.settings.sidebarCollapsed ? 0 : st.s.settings.sidebarWidth));
  const side = useKite((st) => st.s.settings.sidebarSide);
  const onNote = useKite((st) => st.s.items[activeItemId(st.s) ?? '']?.kind === 'note');
  const hidden = useHidden();
  return (
    <div className="toasts" role="status" aria-live="polite" data-over={onNote ? 'note' : undefined} style={{ left: side === 'left' ? sidebar : 0, right: side === 'right' ? sidebar : 0 }}>
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} hidden={hidden} />
      ))}
    </div>
  );
}
