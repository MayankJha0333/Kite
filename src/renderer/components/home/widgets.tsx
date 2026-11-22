// The home page's widgets: clock, weather, note, to-do, calendar, focus timer.
// Each gets its saved data and a `set` that patches it (saved with everything else).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Pause, Play, Plus, RotateCcw, Search, Snowflake, Sun, Trash2, Wind, X } from 'lucide-react';
import type { Widget, WeatherReport } from '@shared/home';
import { toF, weatherText } from '@shared/home';
import { bridge } from '../../platform';
import { toast } from '../../store';
import { playSound } from '../../sound';

export interface WidgetProps {
  widget: Widget;
  data: Record<string, unknown>;
  set(patch: Record<string, unknown>): void;
}

const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const bool = (v: unknown, d = false) => (typeof v === 'boolean' ? v : d);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

// ---- Clock ----------------------------------------------------------------------

export function ClockWidget({ data, set }: WidgetProps) {
  const h24 = bool(data.h24, false);
  const seconds = bool(data.seconds, false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), seconds ? 1000 : 10_000);
    return () => clearInterval(t);
  }, [seconds]);
  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: seconds ? '2-digit' : undefined, hour12: !h24 });
  return (
    <div className="wg-clock">
      <button className="wg-clock-time" title="Click: 12 / 24-hour" onClick={() => set({ h24: !h24 })} data-testid="wg-clock-time">
        {time}
      </button>
      <div className="wg-clock-date">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      <button className="wg-link" onClick={() => set({ seconds: !seconds })}>{seconds ? 'Hide seconds' : 'Show seconds'}</button>
    </div>
  );
}

// ---- Weather --------------------------------------------------------------------

const ICONS = { sun: Sun, 'cloud-sun': CloudSun, cloud: Cloud, fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain, snow: Snowflake, storm: CloudLightning } as const;

export function WeatherWidget({ data, set, widget }: WidgetProps) {
  const place = str(data.place);
  const unit = str(data.unit, 'c') === 'f' ? 'f' : 'c';
  const [draft, setDraft] = useState('');
  const [report, setReport] = useState<WeatherReport | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const deg = (c: number) => `${unit === 'f' ? toF(c) : Math.round(c)}°`;

  useEffect(() => {
    if (!place) return;
    let live = true;
    const load = async () => {
      setBusy(true);
      const r = await bridge.weather(place).catch((e: Error) => ({ error: e.message }) as { error: string; value?: undefined });
      if (!live) return;
      setBusy(false);
      if (r.error || !r.value) {
        setError(r.error ?? 'No answer');
        return;
      }
      setError('');
      setReport(r.value);
    };
    void load();
    const t = setInterval(load, 30 * 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [place]);

  if (!place) {
    return (
      <form
        className="wg-weather-ask"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) set({ place: draft.trim() });
        }}
      >
        <p className="muted">Which place? Only its name is sent, to open-meteo.com.</p>
        <span className="inline-form">
          <input className="input" autoFocus placeholder="City, e.g. Lisbon" aria-label="Place" value={draft} data-testid={`wg-weather-place-${widget.id}`} onChange={(e) => setDraft(e.target.value)} />
          <button className="btn small primary" disabled={!draft.trim()}><Search size={13} /> Show</button>
        </span>
      </form>
    );
  }
  const wide = widget.size === 'wide' || widget.size === 'large';
  const cur = report ? weatherText(report.current.code) : null;
  const Icon = cur ? ICONS[cur.icon] : Cloud;
  return (
    <div className="wg-weather" data-testid="wg-weather">
      {error && !report && (
        <div className="wg-weather-err">
          <span className="muted">{error}</span>
          <button className="wg-link" onClick={() => set({ place: '' })}>Change place</button>
        </div>
      )}
      {!report && !error && <span className="muted">{busy ? 'Fetching…' : ''}</span>}
      {report && (
        <>
          <div className="wg-weather-now">
            <Icon size={34} className="wg-weather-icon" aria-hidden="true" />
            <div className="wg-weather-main">
              <button className="wg-weather-temp" title="Click: °C / °F" onClick={() => set({ unit: unit === 'c' ? 'f' : 'c' })} data-testid="wg-weather-temp">{deg(report.current.temp)}</button>
              <div className="wg-weather-cond">{cur!.label} · <Wind size={11} aria-hidden="true" /> {report.current.wind} km/h</div>
            </div>
            <button className="wg-weather-place wg-link" title="Change place" onClick={() => set({ place: '' })} data-testid="wg-weather-placename">{report.place}</button>
          </div>
          {wide && (
            <div className="wg-weather-days">
              {report.daily.slice(1, 5).map((d) => {
                const t = weatherText(d.code);
                const DayIcon = ICONS[t.icon];
                return (
                  <div key={d.date} className="wg-weather-day" title={t.label}>
                    <span className="muted">{new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</span>
                    <DayIcon size={16} aria-hidden="true" />
                    <span>{deg(d.max)} <span className="muted">{deg(d.min)}</span></span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---- Note -----------------------------------------------------------------------

export function NoteWidget({ data, set, widget }: WidgetProps) {
  return <textarea className="wg-note" placeholder="Jot something down…" aria-label="Note" value={str(data.text)} data-testid={`wg-note-${widget.id}`} onChange={(e) => set({ text: e.target.value })} spellCheck />;
}

// ---- To-do ----------------------------------------------------------------------

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

export function TodoWidget({ data, set, widget }: WidgetProps) {
  const items = useMemo(() => (Array.isArray(data.items) ? (data.items as Todo[]).filter((t) => t && typeof t.text === 'string') : []), [data.items]);
  const [draft, setDraft] = useState('');
  const save = (next: Todo[]) => set({ items: next });
  const left = items.filter((t) => !t.done).length;
  return (
    <div className="wg-todo">
      <form
        className="wg-todo-add"
        onSubmit={(e) => {
          e.preventDefault();
          const t = draft.trim();
          if (!t) return;
          save([...items, { id: `${Date.now().toString(36)}${items.length}`, text: t, done: false }]);
          setDraft('');
        }}
      >
        <input className="input" placeholder="Add a to-do…" aria-label="New to-do" value={draft} data-testid={`wg-todo-input-${widget.id}`} onChange={(e) => setDraft(e.target.value)} />
        <button className="icon-btn tiny" aria-label="Add" disabled={!draft.trim()}><Plus size={14} /></button>
      </form>
      <ul className="wg-todo-list">
        {items.map((t) => (
          <li key={t.id} data-done={t.done || undefined} data-testid="wg-todo-item">
            <button className="wg-todo-check" role="checkbox" aria-checked={t.done} aria-label={t.done ? 'Mark not done' : 'Mark done'} onClick={() => save(items.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}>
              {t.done && <Check size={12} />}
            </button>
            <span className="wg-todo-text">{t.text}</span>
            <button className="icon-btn tiny wg-todo-x" aria-label="Remove" onClick={() => save(items.filter((x) => x.id !== t.id))}><X size={12} /></button>
          </li>
        ))}
      </ul>
      <div className="wg-todo-foot muted">
        {items.length ? `${left} left` : 'Nothing yet'}
        {items.some((t) => t.done) && <button className="wg-link" onClick={() => save(items.filter((t) => !t.done))}>Clear done</button>}
      </div>
    </div>
  );
}

// ---- Calendar -------------------------------------------------------------------

export function CalendarWidget({ data, set }: WidgetProps) {
  const offset = Math.round(num(data.offset, 0));
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  // Weeks start where the locale says (Monday for most of the world).
  const startsMonday = !/^(en-US|en-CA|ja|zh|ko|he|ar)/.test(navigator.language);
  const lead = (first.getDay() - (startsMonday ? 1 : 0) + 7) % 7;
  const names = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, (startsMonday ? 1 : 0) + i).toLocaleDateString(undefined, { weekday: 'narrow' }));
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const isToday = (d: number) => offset === 0 && d === today.getDate();
  return (
    <div className="wg-cal" data-testid="wg-calendar">
      <div className="wg-cal-head">
        <button className="icon-btn tiny" aria-label="Previous month" onClick={() => set({ offset: offset - 1 })}><ChevronLeft size={14} /></button>
        <button className="wg-cal-month" title="Back to this month" onClick={() => set({ offset: 0 })}>{first.toLocaleDateString(undefined, { month: 'long', year: offset ? 'numeric' : undefined })}</button>
        <button className="icon-btn tiny" aria-label="Next month" onClick={() => set({ offset: offset + 1 })}><ChevronRight size={14} /></button>
      </div>
      <div className="wg-cal-grid">
        {names.map((n, i) => <span key={`n${i}`} className="wg-cal-dow">{n}</span>)}
        {cells.map((d, i) => (d === null ? <span key={`e${i}`} /> : <span key={d} className="wg-cal-day" data-today={isToday(d) || undefined}>{d}</span>))}
      </div>
    </div>
  );
}

// ---- Focus timer ----------------------------------------------------------------

export function TimerWidget({ data, set }: WidgetProps) {
  const minutes = Math.round(num(data.minutes, 25));
  const [endAt, setEndAt] = useState<number | null>(null);
  const [left, setLeft] = useState(minutes * 60);
  const paused = useRef<number | null>(null);
  useEffect(() => {
    if (endAt === null) return;
    const tick = () => {
      const s = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        setEndAt(null);
        playSound('done', true);
        toast('Time’s up — take a break.');
      }
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [endAt]);
  useEffect(() => {
    if (endAt === null && paused.current === null) setLeft(minutes * 60);
  }, [minutes, endAt]);
  const running = endAt !== null;
  const start = () => {
    const secs = paused.current ?? minutes * 60;
    paused.current = null;
    setEndAt(Date.now() + secs * 1000);
  };
  const pause = () => {
    paused.current = left;
    setEndAt(null);
  };
  const reset = () => {
    paused.current = null;
    setEndAt(null);
    setLeft(minutes * 60);
  };
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const total = minutes * 60;
  return (
    <div className="wg-timer" data-running={running || undefined} data-testid="wg-timer">
      <div className="wg-timer-time" style={{ '--p': total ? 1 - left / total : 0 } as React.CSSProperties}>{mm}:{ss}</div>
      <div className="wg-timer-ctl">
        {running ? (
          <button className="btn small" onClick={pause} aria-label="Pause"><Pause size={13} /> Pause</button>
        ) : (
          <button className="btn small primary" onClick={start} aria-label="Start" data-testid="wg-timer-start"><Play size={13} /> {paused.current !== null ? 'Resume' : 'Start'}</button>
        )}
        <button className="icon-btn tiny" aria-label="Reset" title="Reset" onClick={reset}><RotateCcw size={13} /></button>
      </div>
      {!running && paused.current === null && (
        <div className="wg-timer-presets">
          {[5, 15, 25, 50].map((m) => (
            <button key={m} className="wg-chip" data-on={m === minutes || undefined} onClick={() => set({ minutes: m })}>{m} min</button>
          ))}
        </div>
      )}
    </div>
  );
}

export { Trash2 as WidgetRemoveIcon };
