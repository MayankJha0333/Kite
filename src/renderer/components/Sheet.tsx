import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { setUi, useKite } from '../store';
import { playSound } from '../sound';

// The sheet (Archive, History, Boosts, the Space editor…) and the shared controls that
// have behavior of their own: search field, segmented control, switch, slider.

/** Esc closes the panel, except while a shortcut is being recorded. */
function useEscToClose(close: () => void) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target as HTMLElement).closest?.('[data-recording="true"]')) {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [close]);
}

/** How long a panel's exit takes: the stylesheet's --t-exit (0 when motion is reduced). */
function exitMs(): number {
  const { s } = useKite.getState();
  const reduce = s.settings.reduceMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  return reduce ? 0 : Math.round(140 / (s.settings.motionSpeed || 1));
}

/**
 * Close with a short exit animation (faster than the entrance).
 *
 * Panels in `ui.panel`: the panel leaves the state at once and is drawn a little
 * longer as `ui.leaving`, so opening another panel (or the same one again) during
 * the exit always gets a fresh, fully open panel. Returns whether this panel is
 * the one leaving.
 */
function useLeave(close?: () => void): [boolean, () => void] {
  const ghost = useKite((st) => st.ui.panel === null && st.ui.leaving !== null);
  const [leavingLocal, setLeavingLocal] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const leave = useCallback(() => {
    const ms = exitMs();
    if (close) {
      // A panel with its own state: play the exit here, then tell it.
      if (leavingLocal || timer.current) return;
      if (!ms) return close();
      setLeavingLocal(true);
      timer.current = setTimeout(() => {
        timer.current = null;
        close();
      }, ms);
      return;
    }
    const { panel, panelArg } = useKite.getState().ui;
    if (!panel) return;
    setUi({ panel: null, panelArg: undefined, leaving: ms ? { panel, panelArg } : null });
    if (ms) window.setTimeout(() => setUi((u) => (u.leaving && u.leaving.panel === panel && u.leaving.panelArg === panelArg ? { leaving: null } : {})), ms);
  }, [close, leavingLocal]);
  return [close ? leavingLocal : ghost, leave];
}

/**
 * A full page inside the page area (Settings): the sidebar stays usable beside it,
 * picking any tab goes back to it, and Esc or the close button returns to your page.
 */
export function Page({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  const [leaving, leave] = useLeave();
  useEscToClose(leave);
  return (
    <section className="kite-page" role="region" aria-label={title} data-testid={testId} data-leaving={leaving || undefined}>
      <button className="icon-btn page-close" aria-label={`Close ${title}`} title={`Close ${title} (esc)`} data-testid="sheet-close" onClick={leave}>
        <X size={16} />
      </button>
      {children}
    </section>
  );
}

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Keeps keyboard focus where a sheet needs it. On opening, focus moves into the sheet
 * (unless something inside asked for it already); on closing it goes back to whatever
 * had it before. A modal sheet also keeps Tab from walking out into the window behind.
 */
function useSheetFocus(ref: React.RefObject<HTMLElement>, modal: boolean) {
  // Noted while rendering: by the time effects run, a field inside may already have taken focus.
  const [before] = useState(() => document.activeElement as HTMLElement | null);
  useLayoutEffect(() => {
    const sheet = ref.current;
    if (!sheet) return;
    if (!sheet.contains(document.activeElement)) sheet.focus({ preventScroll: true });
    return () => {
      // Only when focus would otherwise be lost: if it has moved on by itself, leave it.
      const lost = !document.activeElement || document.activeElement === document.body || sheet.contains(document.activeElement);
      if (lost && before && before !== document.body && before.isConnected) before.focus({ preventScroll: true });
    };
  }, [ref, before]);
  useEffect(() => {
    const sheet = ref.current;
    if (!sheet || !modal) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const stops = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!stops.length) return e.preventDefault();
      const first = stops[0];
      const last = stops[stops.length - 1];
      const at = document.activeElement;
      if (e.shiftKey ? at === first || at === sheet : at === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    sheet.addEventListener('keydown', key);
    return () => sheet.removeEventListener('keydown', key);
  }, [ref, modal]);
}

/**
 * The one sheet. Its top edge is always in the same place, it comes in three widths, its
 * body scrolls by itself, and its footer is right-aligned with the primary button last.
 * Esc or a click outside closes it.
 */
export function Sheet({ title, subtitle, children, onClose, testId, size, wide, footer, dock }: { title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; onClose?: () => void; testId?: string; /** 440, 560 (the default) or 720 wide. */ size?: 'small' | 'medium' | 'large'; /** The old way to ask for the large size. */ wide?: boolean; footer?: React.ReactNode; /** Sits at the side without dimming the window, so the page stays usable behind it. */ dock?: boolean }) {
  const [leaving, close] = useLeave(onClose);
  useEscToClose(close);
  const ref = useRef<HTMLElement>(null);
  useSheetFocus(ref, !dock);
  const titleId = useId();
  const width = size ?? (wide ? 'large' : 'medium');
  return (
    <div className="sheet-scrim" data-dock={dock || undefined} data-leaving={leaving || undefined} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section ref={ref} className="sheet" data-size={width === 'medium' ? undefined : width} role="dialog" aria-modal={dock ? undefined : 'true'} aria-labelledby={titleId} tabIndex={-1} data-testid={testId}>
        <header className="sheet-head">
          <div>
            <h2 className="sheet-title" id={titleId}>{title}</h2>
            {subtitle && <p className="sheet-sub">{subtitle}</p>}
          </div>
          <button className="icon-btn" aria-label="Close" title="Close (esc)" data-testid="sheet-close" onClick={close}>
            <X size={16} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </section>
    </div>
  );
}

export function Field({ label, hint, children, inline }: { label: string; hint?: React.ReactNode; children: React.ReactNode; inline?: boolean }) {
  return (
    <label className="field" data-inline={inline || undefined}>
      <span className="field-label">
        {label}
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      <span className="field-control">{children}</span>
    </label>
  );
}

/** The one search field: a magnifier, the input, and a clear button while there is text. */
export function SearchField({ value, onChange, placeholder, label, testId, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; /** Read out by screen readers; the placeholder when left out. */ label?: string; testId?: string; autoFocus?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <label className="search-field">
      <Search size={14} aria-hidden="true" />
      <input
        ref={input}
        type="search"
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        value={value}
        data-testid={testId}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Esc empties the field first; only an empty field lets it close the sheet.
          if (e.key === 'Escape' && value) {
            e.stopPropagation();
            e.preventDefault();
            onChange('');
          }
        }}
      />
      {value && (
        <button type="button" className="icon-btn small" aria-label="Clear search" onClick={() => { onChange(''); input.current?.focus(); }}>
          <X size={14} />
        </button>
      )}
    </label>
  );
}

/** One choice out of a few. A single tab stop; the arrow keys move the choice, as in a native radio group. */
export function Segmented<T extends string>({ value, options, onChange, testId, label, fill }: { value: T; options: { value: T; label: React.ReactNode }[]; onChange: (v: T) => void; testId?: string; label?: string; /** Take the full width, every segment the same size. */ fill?: boolean }) {
  const group = useRef<HTMLDivElement>(null);
  const chosen = options.findIndex((o) => o.value === value);
  const step = (e: React.KeyboardEvent, i: number) => {
    const by = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!by) return;
    e.preventDefault();
    const next = (i + by + options.length) % options.length;
    onChange(options[next].value);
    group.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  };
  return (
    <div ref={group} className={fill ? 'segmented fill' : 'segmented'} role="radiogroup" aria-label={label} data-testid={testId}>
      {options.map((o, i) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} tabIndex={i === Math.max(chosen, 0) ? 0 : -1} data-on={value === o.value || undefined} data-testid={testId ? `${testId}-${o.value}` : undefined} onKeyDown={(e) => step(e, i)} onClick={(e) => { e.preventDefault(); onChange(o.value); }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, testId, label }: { checked: boolean; onChange: (v: boolean) => void; testId?: string; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="toggle" data-on={checked || undefined} data-testid={testId} onClick={(e) => { e.preventDefault(); playSound('toggle'); onChange(!checked); }}>
      <span className="toggle-knob" />
    </button>
  );
}

/** The one slider: a native range input, so the arrow keys, Home and End work. It tells the stylesheet how full it is. */
export function Slider({ value, min = 0, max = 100, step, onChange, label, testId, disabled }: { value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; label: string; testId?: string; disabled?: boolean }) {
  const part = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  return <input type="range" className="slider" aria-label={label} min={min} max={max} step={step} value={value} disabled={disabled} data-testid={testId} style={{ ['--p' as string]: part }} onChange={(e) => onChange(Number(e.target.value))} />;
}

/** A titled card of settings rows. */
export function Group({ title, desc, children, testId }: { title?: React.ReactNode; desc?: React.ReactNode; children: React.ReactNode; testId?: string }) {
  return (
    <section className="set-group" data-testid={testId}>
      {(title || desc) && (
        <header className="set-group-head">
          {title && <h3 className="set-group-title">{title}</h3>}
          {desc && <p className="set-group-desc">{desc}</p>}
        </header>
      )}
      <div className="set-card">{children}</div>
    </section>
  );
}

/** One setting: what it is on the left, its control on the right (or below, with `stack`). */
export function Row({ title, desc, value, children, stack, off }: { title: React.ReactNode; desc?: React.ReactNode; value?: React.ReactNode; children: React.ReactNode; stack?: boolean; off?: boolean }) {
  return (
    <div className="set-row" data-stack={stack || undefined} data-off={off || undefined}>
      <span className="set-row-text">
        <span className="set-row-title">
          {title}
          {value !== undefined && <span className="set-row-value">{value}</span>}
        </span>
        {desc && <span className="set-row-desc">{desc}</span>}
      </span>
      {/* A fieldset so "off" really disables every control in the row (keyboard included), not just dims it. */}
      <fieldset className="set-row-control" disabled={off || undefined}>
        {children}
      </fieldset>
    </div>
  );
}

/** An on/off setting. The whole row is clickable. */
export function SwitchRow({ title, desc, checked, onChange, testId, label, off, sub }: { title: React.ReactNode; desc?: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; testId?: string; label?: string; off?: boolean; sub?: boolean }) {
  return (
    <label className="set-row set-switch" data-off={off || undefined} data-sub={sub || undefined}>
      <span className="set-row-text">
        <span className="set-row-title">{title}</span>
        {desc && <span className="set-row-desc">{desc}</span>}
      </span>
      <Toggle checked={checked} onChange={onChange} testId={testId} label={label ?? (typeof title === 'string' ? title : undefined)} />
    </label>
  );
}
