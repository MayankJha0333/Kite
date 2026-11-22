// The home page (new tab): widgets you place on it, its scene, and what it shows.
//
// Everything is plain JSON in AppState.home and checked on load (sanitizeHome), so a
// damaged file never breaks the page. Widgets keep their place in pixels from the top
// left of the widget area (snapped to a grid) and are kept inside it when the window
// is smaller than where they were put.

import { newId } from './ids';

export type WidgetKind = 'clock' | 'weather' | 'note' | 'todo' | 'calendar' | 'timer';
export type WidgetSize = 'small' | 'wide' | 'tall' | 'large';
export type SceneId = 'space' | 'aurora' | 'dusk' | 'ocean' | 'forest' | 'ember' | 'night';

export interface Widget {
  id: string;
  kind: WidgetKind;
  /** Where its top-left corner sits, in pixels from the widget area's top left. */
  x: number;
  y: number;
  size: WidgetSize;
  /** The widget's own content and options (notes text, to-do items, city, 24-hour…). */
  data: Record<string, unknown>;
}

export interface HomeState {
  widgets: Widget[];
  /** The background behind the page: the Space's own colours, or a built-in scene. */
  scene: SceneId;
  showGreeting: boolean;
  showFrequent: boolean;
  showHints: boolean;
}

export const WIDGET_KINDS: { id: WidgetKind; name: string; blurb: string; size: WidgetSize }[] = [
  { id: 'clock', name: 'Clock', blurb: 'Time and date', size: 'small' },
  { id: 'weather', name: 'Weather', blurb: 'Now and the next days, for a place you pick', size: 'wide' },
  { id: 'note', name: 'Note', blurb: 'A sticky note that saves as you type', size: 'small' },
  { id: 'todo', name: 'To-do', blurb: 'A short list to tick off', size: 'tall' },
  { id: 'calendar', name: 'Calendar', blurb: 'This month at a glance', size: 'tall' },
  { id: 'timer', name: 'Focus timer', blurb: 'A countdown for a stretch of work', size: 'small' },
];

export const SCENES: { id: SceneId; name: string; note: string; dark: boolean }[] = [
  { id: 'space', name: 'Space colours', note: 'The colours this Space is painted in', dark: false },
  { id: 'aurora', name: 'Aurora', note: 'Teal and green light over a dark sky', dark: true },
  { id: 'dusk', name: 'Dusk', note: 'Violet into ember at the horizon', dark: true },
  { id: 'ocean', name: 'Ocean', note: 'Deep blue with a bright surface', dark: true },
  { id: 'forest', name: 'Forest', note: 'Dark greens and morning mist', dark: true },
  { id: 'ember', name: 'Ember', note: 'Warm coals in the dark', dark: true },
  { id: 'night', name: 'Night', note: 'Near black, a cool glow', dark: true },
];

/** Widget sizes in pixels (width × height); the area lays out on a 20px grid. */
export const WIDGET_PX: Record<WidgetSize, [number, number]> = { small: [230, 150], wide: [470, 150], tall: [230, 320], large: [470, 320] };
export const GRID = 20;
export const MAX_WIDGETS = 12;

export function defaultHome(): HomeState {
  // Frequently visited starts hidden: it is a list of where you have been, shown only when you ask.
  return { widgets: [], scene: 'space', showGreeting: true, showFrequent: false, showHints: true };
}

const MAX_PX = 8000;
const clampPx = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(0, Math.min(MAX_PX, v))) : d);
const SIZES: WidgetSize[] = ['small', 'wide', 'tall', 'large'];

export function sanitizeHome(raw: unknown): HomeState {
  const d = defaultHome();
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
    scene: SCENES.some((s) => s.id === o.scene) ? (o.scene as SceneId) : d.scene,
    showGreeting: typeof o.showGreeting === 'boolean' ? o.showGreeting : d.showGreeting,
    showFrequent: typeof o.showFrequent === 'boolean' ? o.showFrequent : d.showFrequent,
    showHints: typeof o.showHints === 'boolean' ? o.showHints : d.showHints,
  };
}

/** A free spot for a new widget: the first grid cell, left to right then down, that overlaps nothing. */
export function freeSpot(home: HomeState, size: WidgetSize, area: { w: number; h: number }): { x: number; y: number } {
  const [w, h] = WIDGET_PX[size];
  const taken = home.widgets.map((o) => {
    const [ow, oh] = WIDGET_PX[o.size];
    return { l: o.x, t: o.y, r: o.x + ow, b: o.y + oh };
  });
  const cols = Math.max(0, Math.floor((area.w - w) / GRID));
  // Rows keep going below the area: the page scrolls, nothing is ever hidden.
  const rows = Math.max(0, Math.floor((area.h - h) / GRID)) + 40;
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const l = c * GRID;
      const t = r * GRID;
      if (!taken.some((o) => l < o.r + GRID && l + w > o.l - GRID && t < o.b + GRID && t + h > o.t - GRID)) return { x: l, y: t };
    }
  }
  const last = home.widgets[home.widgets.length - 1];
  return { x: clampPx((last?.x ?? 0) + 40), y: clampPx((last?.y ?? 0) + 40) };
}

export function addWidget(home: HomeState, kind: WidgetKind, area: { w: number; h: number }): string | null {
  if (home.widgets.length >= MAX_WIDGETS) return null;
  const def = WIDGET_KINDS.find((k) => k.id === kind);
  if (!def) return null;
  const id = newId('wg');
  const { x, y } = freeSpot(home, def.size, area);
  home.widgets.push({ id, kind, x, y, size: def.size, data: {} });
  return id;
}

export function removeWidget(home: HomeState, id: string): void {
  home.widgets = home.widgets.filter((w) => w.id !== id);
}

export function moveWidget(home: HomeState, id: string, x: number, y: number): void {
  const w = home.widgets.find((x) => x.id === id);
  if (!w) return;
  w.x = clampPx(x);
  w.y = clampPx(y);
}

export function resizeWidget(home: HomeState, id: string, size: WidgetSize): void {
  const w = home.widgets.find((x) => x.id === id);
  if (w && SIZES.includes(size)) w.size = size;
}

/** Bring a widget to the front (last drawn). */
export function raiseWidget(home: HomeState, id: string): void {
  const i = home.widgets.findIndex((x) => x.id === id);
  if (i < 0 || i === home.widgets.length - 1) return;
  const [w] = home.widgets.splice(i, 1);
  home.widgets.push(w);
}

export function updateWidget(home: HomeState, id: string, patch: Record<string, unknown>): void {
  const w = home.widgets.find((x) => x.id === id);
  if (w) w.data = { ...w.data, ...patch };
}

/** Snap a position to the grid and keep the widget inside the area's width (it may extend the page downward). */
export function snapPosition(px: number, py: number, size: WidgetSize, area: { w: number; h: number }): { x: number; y: number } {
  const [w] = WIDGET_PX[size];
  // The furthest grid line the widget can sit on without crossing the right edge.
  const maxX = Math.floor(Math.max(0, area.w - w) / GRID) * GRID;
  const sx = Math.min(maxX, Math.round(Math.max(0, px) / GRID) * GRID);
  const sy = Math.round(Math.max(0, Math.min(MAX_PX, py)) / GRID) * GRID;
  return { x: sx, y: sy };
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
