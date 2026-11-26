// The home page (new tab): widgets you place on it, and what it shows. Its background is
// the Space's theme (colours, or one of Kite's pictures).
//
// Everything is plain JSON in AppState.home and checked on load (sanitizeHome), so a
// damaged file never breaks the page. Widgets sit on the page's own column grid: three
// cells across, as many rows as needed. A saved position is the cell's top-left corner
// in pixels of the full three-column layout; a narrower window lays the same widgets out
// again in fewer columns, in the same reading order, so nothing ever overlaps or is cut.

import { newId } from './ids';
import type { HistoryEntry } from './types';
import { hostOf } from './url';

export type WidgetKind = 'clock' | 'weather' | 'note' | 'todo' | 'calendar' | 'timer';
export type WidgetSize = 'small' | 'wide' | 'tall' | 'large';

export interface Widget {
  id: string;
  kind: WidgetKind;
  /** Its cell's top-left corner, in pixels from the widget area's top left (three columns across). */
  x: number;
  y: number;
  size: WidgetSize;
  /** The widget's own content and options (notes text, to-do items, city, 24-hour…). */
  data: Record<string, unknown>;
}

export interface HomeState {
  widgets: Widget[];
  showGreeting: boolean;
  showFrequent: boolean;
  showHints: boolean;
  /** The first run has been shown on this profile (it is shown once, on a brand-new one). */
  firstRunSeen: boolean;
  /** How often the command bar has been opened, counted only until the page stops hinting at it. */
  barUses: number;
}

/** The start page reminds a new person of the command bar until they have opened it this often. */
export const BAR_HINT_USES = 3;

export const WIDGET_KINDS: { id: WidgetKind; name: string; blurb: string; size: WidgetSize }[] = [
  { id: 'clock', name: 'Clock', blurb: 'Time and date', size: 'small' },
  { id: 'weather', name: 'Weather', blurb: 'Now and the next days', size: 'wide' },
  { id: 'note', name: 'Note', blurb: 'Saves as you type', size: 'small' },
  { id: 'todo', name: 'To-do', blurb: 'A short list to tick off', size: 'tall' },
  { id: 'calendar', name: 'Calendar', blurb: 'This month at a glance', size: 'tall' },
  { id: 'timer', name: 'Focus timer', blurb: 'A countdown for focus', size: 'small' },
];

/** The widget grid: three cells across the page's 640px column, 20px apart. */
export const COLS = 3;
export const CELL_W = 200;
export const CELL_H = 140;
export const GAP = 20;
/** From one cell's corner to the next. */
export const PITCH_X = CELL_W + GAP;
export const PITCH_Y = CELL_H + GAP;
/** How many cells a size takes (across × down). */
export const WIDGET_SPAN: Record<WidgetSize, [number, number]> = { small: [1, 1], wide: [2, 1], tall: [1, 2], large: [2, 2] };
/** Widget sizes in pixels (width × height) at full width. */
export const WIDGET_PX: Record<WidgetSize, [number, number]> = { small: [CELL_W, CELL_H], wide: [CELL_W * 2 + GAP, CELL_H], tall: [CELL_W, CELL_H * 2 + GAP], large: [CELL_W * 2 + GAP, CELL_H * 2 + GAP] };
export const MAX_WIDGETS = 12;

/** A brand-new profile: nothing placed, the first run not yet shown, the command bar not yet used. */
export function defaultHome(): HomeState {
  // Frequently visited starts hidden: it is a list of where you have been, shown only when you ask.
  return { widgets: [], showGreeting: true, showFrequent: false, showHints: false, firstRunSeen: false, barUses: 0 };
}

const MAX_PX = 8000;
const clampPx = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(0, Math.min(MAX_PX, v))) : d);
const SIZES: WidgetSize[] = ['small', 'wide', 'tall', 'large'];

/** The home page from a saved file. A file is someone already using Kite: unless it says
 *  otherwise, they are past the first run and past the command-bar hint. */
export function sanitizeHome(raw: unknown): HomeState {
  const d: HomeState = { ...defaultHome(), firstRunSeen: true, barUses: BAR_HINT_USES };
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<HomeState>;
  const widgets = Array.isArray(o.widgets)
    ? o.widgets
        .filter((w): w is Widget => !!w && typeof w === 'object' && typeof (w as Widget).id === 'string' && WIDGET_KINDS.some((k) => k.id === (w as Widget).kind))
        .slice(0, MAX_WIDGETS)
        .map((w) => ({ id: w.id, kind: w.kind, x: clampPx(w.x), y: clampPx(w.y), size: SIZES.includes(w.size) ? w.size : WIDGET_KINDS.find((k) => k.id === w.kind)!.size, data: w.data && typeof w.data === 'object' && !Array.isArray(w.data) ? { ...w.data } : {} }))
    : [];
  return {
    widgets,
    showGreeting: typeof o.showGreeting === 'boolean' ? o.showGreeting : d.showGreeting,
    showFrequent: typeof o.showFrequent === 'boolean' ? o.showFrequent : d.showFrequent,
    showHints: typeof o.showHints === 'boolean' ? o.showHints : d.showHints,
    firstRunSeen: typeof o.firstRunSeen === 'boolean' ? o.firstRunSeen : d.firstRunSeen,
    barUses: typeof o.barUses === 'number' && o.barUses >= 0 ? Math.min(BAR_HINT_USES, Math.round(o.barUses)) : d.barUses,
  };
}

/** Where a widget sits on the grid: its first cell and how many it takes. */
export interface Placed {
  id: string;
  col: number;
  row: number;
  cols: number;
  rows: number;
}

/**
 * Lay the widgets out on a grid `cols` cells wide so that none overlap.
 *
 * At full width each widget takes the cell nearest its saved position; if another widget
 * already holds it, it moves to the next free place in reading order. `first` (the widget
 * just dropped or resized) is placed before the others, so it stays where it was put and
 * its neighbors move. In fewer columns the widgets keep their reading order and fill the
 * rows from the top.
 */
export function layoutWidgets(widgets: Widget[], cols = COLS, first?: string): Placed[] {
  const want = widgets.map((w, i) => {
    const [cw, ch] = WIDGET_SPAN[w.size];
    return { id: w.id, i, cols: cw, rows: ch, col: Math.max(0, Math.min(COLS - cw, Math.round(w.x / PITCH_X))), row: Math.max(0, Math.round(w.y / PITCH_Y)) };
  });
  const order = (list: typeof want) => [...list].sort((a, b) => Number(b.id === first) - Number(a.id === first) || a.row - b.row || a.col - b.col || a.i - b.i);
  const place = (list: typeof want, width: number, keepCell: boolean): Placed[] => {
    const taken = new Set<string>();
    const free = (c: number, r: number, cw: number, ch: number) => {
      if (c < 0 || c + cw > width) return false;
      for (let x = c; x < c + cw; x++) for (let y = r; y < r + ch; y++) if (taken.has(`${x},${y}`)) return false;
      return true;
    };
    return list.map((w) => {
      const cw = Math.min(w.cols, width);
      let spot = keepCell && free(w.col, w.row, cw, w.rows) ? { col: w.col, row: w.row } : null;
      for (let r = keepCell ? w.row : 0; !spot; r++) for (let c = 0; c + cw <= width && !spot; c++) if (free(c, r, cw, w.rows)) spot = { col: c, row: r };
      for (let x = spot.col; x < spot.col + cw; x++) for (let y = spot.row; y < spot.row + w.rows; y++) taken.add(`${x},${y}`);
      return { id: w.id, col: spot.col, row: spot.row, cols: cw, rows: w.rows };
    });
  };
  const full = place(order(want), COLS, true);
  if (cols >= COLS) return full;
  // Narrower: the same widgets in the order they read at full width.
  const read = full.map((p) => ({ ...want.find((w) => w.id === p.id)!, col: p.col, row: p.row })).sort((a, b) => a.row - b.row || a.col - b.col);
  return place(read, Math.max(1, cols), false);
}

/** How many grid columns fit in a widget area this wide (a cell is never squeezed below 180px). */
export function columnsFor(width: number): number {
  return Math.max(1, Math.min(COLS, Math.floor((width + GAP) / (180 + GAP))));
}

/** Save every widget at the cell it is drawn in, so the file never holds an overlap. */
export function tidyWidgets(home: HomeState, first?: string): void {
  for (const p of layoutWidgets(home.widgets, COLS, first)) {
    const w = home.widgets.find((x) => x.id === p.id)!;
    w.x = p.col * PITCH_X;
    w.y = p.row * PITCH_Y;
  }
}

/** A free spot for a new widget: the first cell, left to right then down, where it overlaps nothing. */
export function freeSpot(home: HomeState, size: WidgetSize): { x: number; y: number } {
  const taken = new Set<string>();
  for (const p of layoutWidgets(home.widgets)) for (let x = p.col; x < p.col + p.cols; x++) for (let y = p.row; y < p.row + p.rows; y++) taken.add(`${x},${y}`);
  const [cw, ch] = WIDGET_SPAN[size];
  const fits = (c: number, r: number) => {
    for (let x = c; x < c + cw; x++) for (let y = r; y < r + ch; y++) if (taken.has(`${x},${y}`)) return false;
    return true;
  };
  for (let r = 0; ; r++) for (let c = 0; c + cw <= COLS; c++) if (fits(c, r)) return { x: c * PITCH_X, y: r * PITCH_Y };
}

export function addWidget(home: HomeState, kind: WidgetKind): string | null {
  if (home.widgets.length >= MAX_WIDGETS) return null;
  const def = WIDGET_KINDS.find((k) => k.id === kind);
  if (!def) return null;
  const id = newId('wg');
  tidyWidgets(home);
  const { x, y } = freeSpot(home, def.size);
  home.widgets.push({ id, kind, x, y, size: def.size, data: {} });
  return id;
}

export function removeWidget(home: HomeState, id: string): void {
  home.widgets = home.widgets.filter((w) => w.id !== id);
}

/** Put a widget at the cell nearest (x, y); whatever was there makes room. */
export function moveWidget(home: HomeState, id: string, x: number, y: number): void {
  const w = home.widgets.find((x) => x.id === id);
  if (!w) return;
  w.x = clampPx(x);
  w.y = clampPx(y);
  tidyWidgets(home, id);
}

export function resizeWidget(home: HomeState, id: string, size: WidgetSize): void {
  const w = home.widgets.find((x) => x.id === id);
  if (!w || !SIZES.includes(size)) return;
  w.size = size;
  tidyWidgets(home, id);
}

export function updateWidget(home: HomeState, id: string, patch: Record<string, unknown>): void {
  const w = home.widgets.find((x) => x.id === id);
  if (w) w.data = { ...w.data, ...patch };
}

// ---- Frequently visited ----

/** A page that loaded says something about itself: an icon, or a title that is not just its address.
 *  An address that failed to load (a typo, a site that is down) says neither. */
function everLoaded(h: HistoryEntry): boolean {
  if (h.favicon) return true;
  const title = h.title.trim().toLowerCase();
  if (!title) return false;
  const bare = h.url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  return title !== h.url.toLowerCase() && title !== bare && title !== hostOf(h.url).toLowerCase();
}

/** The sites you visit most, one per site, skipping Favorites and addresses that never loaded. */
export function frequentSites(history: HistoryEntry[], skipHosts: Set<string>, max: number): HistoryEntry[] {
  return history
    .filter((h) => /^https?:/i.test(h.url) && !skipHosts.has(hostOf(h.url)) && everLoaded(h))
    .sort((a, b) => b.visits - a.visits || b.lastVisitAt - a.lastVisitAt)
    .filter((h, i, all) => all.findIndex((x) => hostOf(x.url) === hostOf(h.url)) === i)
    .slice(0, max);
}

// ---- Weather (Open-Meteo WMO codes) ----
export interface WeatherReport {
  place: string;
  current: { temp: number; code: number; wind: number };
  daily: { date: string; max: number; min: number; code: number }[];
  fetchedAt: number;
}

export function weatherText(code: number): { label: string; icon: 'sun' | 'cloud-sun' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm' } {
  if (code === 0) return { label: 'Clear', icon: 'sun' };
  if (code <= 2) return { label: 'Partly cloudy', icon: 'cloud-sun' };
  if (code === 3) return { label: 'Overcast', icon: 'cloud' };
  if (code <= 48) return { label: 'Fog', icon: 'fog' };
  if (code <= 57) return { label: 'Drizzle', icon: 'drizzle' };
  if (code <= 67) return { label: 'Rain', icon: 'rain' };
  if (code <= 77) return { label: 'Snow', icon: 'snow' };
  if (code <= 82) return { label: 'Showers', icon: 'rain' };
  if (code <= 86) return { label: 'Snow showers', icon: 'snow' };
  return { label: 'Thunderstorm', icon: 'storm' };
}

export const toF = (c: number) => Math.round((c * 9) / 5 + 32);
