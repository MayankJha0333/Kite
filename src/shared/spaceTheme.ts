// A Space's theme: two colours, how strongly they show, grain, and light/dark/auto.
// The first colour tints the window frame (one flat tint, by Intensity); the second is the
// accent. Instead of the plain tint the frame can show one background: a built-in picture,
// your own picture, or your own gradient (only one at a time).
//
// The swatches are the three rows Arc's colour picker offers (pastel, muted, grey; nine
// each, measured from Arc's asset catalogue), and the wheel gives any other hue.

import { SWATCHES, hexToHsl, hslToHex, wheelColors } from './designTokens';
import type { SpaceTheme, ThemeMode } from './types';
import { isBackdrop } from './backdrops';

export type SwatchRowId = 'pastel' | 'muted' | 'grey';
export const SWATCH_ROWS: { id: SwatchRowId; name: string; colors: readonly string[] }[] = [
  { id: 'pastel', name: 'Pastel', colors: SWATCHES.pastel },
  { id: 'muted', name: 'Muted', colors: SWATCHES.muted },
  { id: 'grey', name: 'Grey', colors: SWATCHES.grey },
];

export const MODES: ThemeMode[] = ['light', 'dark', 'system'];

/**
 * Calm Air, Kite's own look: a chart of still air. The window frame is one flat sheet of
 * tinted chart paper (sea-glass by day, night-chart slate after dark), the page lies on it,
 * and one accent, chart magenta, marks what matters. These are the values it is drawn to;
 * theme.ts paints every Space from them.
 */
export const CALM_AIR = {
  light: { shell: '#e9f0ee', card: '#ffffff', ink: '#14211f', accent: '#c2187a', accentInk: '#ffffff' },
  dark: { shell: '#141c22', card: '#1b242b', ink: '#e6eef0', accent: '#e27aa8', accentInk: '#1b0a13' },
} as const;

/**
 * Kite's default theme: plain colours at a low strength, following the system's light or
 * dark. The first colour (sea-glass) tints the window frame; the second (chart magenta) is
 * the accent. No gradient, grain or pattern, so the page is what you look at.
 */
export const DEFAULT_THEME: SpaceTheme = { colors: ['#6c948b', CALM_AIR.light.accent], mode: 'system', intensity: 0.2, grain: false };

/** The lively indigo-to-teal gradient Kite once started on; now the “Indigo Tide” preset. */
export const DEFAULT_GRADIENT = { colors: ['#3b39a6', '#6b3fc4', '#16627c'], angle: 160 };

/** Bumped when the default theme changes for everyone (see migrateTheme, used by persistence.ts). */
export const THEME_VERSION = 3;

/** The built-in default of theme version 2 (“Quiet”: slate with a periwinkle accent, always dark). */
const PREVIOUS_DEFAULT: SpaceTheme = { colors: ['#7b82a8', '#8f8cff'], mode: 'dark', intensity: 0.2, grain: false };

/** Patterns drawn softly over the window's colours. Kite's own; made with CSS gradients, so they cost nothing to draw. */
export type PatternId = 'glow' | 'dots' | 'grid' | 'lines' | 'rings';
export const PATTERNS: readonly { id: PatternId; name: string }[] = [
  { id: 'glow', name: 'Glow' },
  { id: 'dots', name: 'Dots' },
  { id: 'grid', name: 'Grid' },
  { id: 'lines', name: 'Lines' },
  { id: 'rings', name: 'Rings' },
];
export const isPattern = (v: unknown): v is PatternId => typeof v === 'string' && PATTERNS.some((p) => p.id === v);
export const DEFAULT_PATTERN_STRENGTH = 0.5;

/** A ready-made look: a gradient, an accent, light or dark, and a pattern. One click sets them all. */
export interface ThemePreset {
  id: string;
  name: string;
  mode: ThemeMode;
  /** Left out for a plain-colour look, which is painted from `base` and the accent. */
  gradient?: { colors: string[]; angle: number };
  /** The first colour of a plain-colour look. */
  base?: string;
  /** How strongly the colours tint the window. */
  intensity: number;
  accent: string;
  /** Left out for a look with no pattern. */
  pattern?: PatternId;
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  // Kite's default look. The id is from the look it replaced ("Quiet"); it stays because the
  // reset in Customize and saved test ids name it.
  { id: 'quiet', name: 'Calm Air', mode: DEFAULT_THEME.mode, base: DEFAULT_THEME.colors[0], intensity: DEFAULT_THEME.intensity, accent: DEFAULT_THEME.colors[1] },
  { id: 'tide', name: 'Indigo Tide', mode: 'dark', intensity: 0.65, gradient: { colors: [...DEFAULT_GRADIENT.colors], angle: DEFAULT_GRADIENT.angle }, accent: '#8f8cff', pattern: 'glow' },
  { id: 'ember', name: 'Ember', mode: 'dark', intensity: 0.65, gradient: { colors: ['#6a2b7a', '#b0456a', '#c8642f'], angle: 160 }, accent: '#ffb38a', pattern: 'glow' },
  { id: 'forest', name: 'Forest', mode: 'dark', intensity: 0.65, gradient: { colors: ['#1f6b5c', '#2f8a5a', '#5a9a3a'], angle: 160 }, accent: '#8fe0a8', pattern: 'glow' },
  { id: 'rosewood', name: 'Rosewood', mode: 'dark', intensity: 0.65, gradient: { colors: ['#6a2a7a', '#a83a8a', '#c8446f'], angle: 160 }, accent: '#ff9ec4', pattern: 'glow' },
  { id: 'graphite', name: 'Graphite', mode: 'dark', intensity: 0.65, gradient: { colors: ['#4a4d57', '#5c606b', '#73788a'], angle: 160 }, accent: '#d5d8e0', pattern: 'dots' },
  { id: 'dawn', name: 'Dawn', mode: 'light', intensity: 0.65, gradient: { colors: ['#f6c9b0', '#e3c4ea', '#b9d4f5'], angle: 160 }, accent: '#4b3fd6', pattern: 'glow' },
];

/** What picking a preset changes on a Space theme: its colours, strength, light or dark, and pattern. Grain is left as it is. */
export function presetPatch(id: string): Partial<SpaceTheme> {
  const p = THEME_PRESETS.find((x) => x.id === id);
  if (!p) return {};
  const rest = { backdrop: undefined, photo: undefined, mode: p.mode, intensity: p.intensity, pattern: p.pattern, ...(p.pattern ? {} : { patternStrength: undefined }) };
  if (!p.gradient) return { ...rest, gradient: undefined, colors: [p.base ?? p.accent, p.accent] };
  return { ...rest, gradient: { colors: [...p.gradient.colors], angle: p.gradient.angle }, colors: [p.gradient.colors[0], p.accent] };
}

/** The preset a theme is showing, if its colours (or gradient) and accent still match one. */
export function presetOf(theme: Pick<SpaceTheme, 'colors' | 'gradient'>): string | null {
  const g = theme.gradient;
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((c, i) => c.toLowerCase() === b[i].toLowerCase());
  return THEME_PRESETS.find((p) => (p.gradient ? !!g && same(p.gradient.colors, g.colors) && p.accent.toLowerCase() === theme.colors[1].toLowerCase() : !g && same([p.base ?? p.accent, p.accent], theme.colors)))?.id ?? null;
}

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const clamp01 = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback);

/**
 * One colour becomes the pair the window is painted with: the colour itself, and a
 * deeper companion a little further round the wheel (Arc's "second colour as a hue
 * offset"). Light colours get a mid-tone partner; dark ones a darker one.
 */
export function pairFromColor(hex: string): [string, string] {
  const [h, s, l] = hexToHsl(hex);
  const second = hslToHex(h + 24, Math.min(1, s * 1.1), l > 0.55 ? 0.5 : Math.max(0.18, l - 0.15));
  return [hex.toLowerCase(), second];
}

/** The pair for a hue on the wheel; vivid 0–1 is how saturated. */
export function pairFromHue(hue: number, vivid = 0.7): [string, string] {
  return wheelColors(hue, 32, vivid);
}

/** The swatch a Space's colours came from, if any. */
export function swatchOf(theme: Pick<SpaceTheme, 'colors'>): { row: SwatchRowId; index: number } | null {
  for (const row of SWATCH_ROWS) {
    const i = row.colors.findIndex((c) => c.toLowerCase() === theme.colors[0].toLowerCase());
    if (i >= 0) return { row: row.id, index: i };
  }
  return null;
}

const isPhotoId = (v: unknown): v is string => typeof v === 'string' && /^img-[a-z0-9-]{4,40}$/.test(v);

/** A gradient with 2–4 valid colours and a whole-degree angle, or undefined. */
export function sanitizeGradient(g: unknown): SpaceTheme['gradient'] {
  const o = g as { colors?: unknown; angle?: unknown } | undefined;
  if (!o || !Array.isArray(o.colors)) return undefined;
  const colors = o.colors.filter(isHex).slice(0, 4).map((c) => c.toLowerCase());
  if (colors.length < 2) return undefined;
  const a = typeof o.angle === 'number' && Number.isFinite(o.angle) ? Math.round(o.angle) : 160;
  return { colors, angle: ((a % 360) + 360) % 360 };
}

/**
 * A Space theme with only valid values (anything else falls back). At most one background
 * is kept: your picture, else a built-in one, else your gradient. Other extras from older
 * versions are dropped.
 */
export function sanitizeTheme(t: Partial<SpaceTheme> | undefined, fallback: SpaceTheme): SpaceTheme {
  if (!t || typeof t !== 'object') t = fallback;
  const colors = Array.isArray(t?.colors) && t!.colors.length === 2 && t!.colors.every(isHex) ? ([t!.colors[0].toLowerCase(), t!.colors[1].toLowerCase()] as [string, string]) : fallback.colors;
  const photo = t?.photo && isPhotoId(t.photo.id) ? { id: t.photo.id, tone: t.photo.tone === 'light' ? ('light' as const) : ('dark' as const) } : undefined;
  const backdrop = !photo && isBackdrop(t?.backdrop) ? t!.backdrop : undefined;
  const gradient = !photo && !backdrop ? sanitizeGradient(t?.gradient) : undefined;
  return {
    colors,
    mode: MODES.includes(t?.mode as ThemeMode) ? (t!.mode as ThemeMode) : fallback.mode,
    intensity: clamp01(t?.intensity, fallback.intensity),
    grain: typeof t?.grain === 'boolean' ? t.grain : fallback.grain,
    ...(photo ? { photo } : {}),
    ...(backdrop ? { backdrop } : {}),
    ...(gradient ? { gradient } : {}),
    ...(isPattern(t?.pattern) ? { pattern: t!.pattern } : {}),
    ...(isPattern(t?.pattern) && typeof t?.patternStrength === 'number' && Number.isFinite(t.patternStrength) ? { patternStrength: clamp01(t.patternStrength, DEFAULT_PATTERN_STRENGTH) } : {}),
  };
}

/** Back to plain colours: no picture and no gradient. */
export const PLAIN: Partial<SpaceTheme> = { backdrop: undefined, photo: undefined, gradient: undefined };

/** Your own picture as the background: its colours and light or dark come with it. */
export function photoPatch(id: string, luma: number, colors: [string, string]): Partial<SpaceTheme> {
  const tone = luma < 0.5 ? 'dark' : 'light';
  return { ...PLAIN, photo: { id, tone }, colors, mode: tone };
}

/** Your own gradient as the background; the theme's two colours follow its ends. */
export function gradientPatch(g: { colors: string[]; angle: number }): Partial<SpaceTheme> {
  const clean = sanitizeGradient(g);
  if (!clean) return PLAIN;
  return { ...PLAIN, gradient: clean, colors: [clean.colors[0], clean.colors[clean.colors.length - 1]] };
}

/** A gradient to start from: the theme's colours with a midpoint between them. */
export function starterGradient(theme: Pick<SpaceTheme, 'colors' | 'gradient'>): { colors: string[]; angle: number } {
  if (theme.gradient) return { colors: [...theme.gradient.colors], angle: theme.gradient.angle };
  const [a, b] = theme.colors;
  const [h1, s1, l1] = hexToHsl(a);
  const [h2, s2, l2] = hexToHsl(b);
  return { colors: [a, hslToHex((h1 + h2) / 2 + (Math.abs(h1 - h2) > 180 ? 180 : 0), (s1 + s2) / 2, (l1 + l2) / 2), b], angle: 160 };
}

/** Relative brightness 0–1 of a gradient's colours on average (decides light or dark text over it). */
export function gradientLuma(g: { colors: string[] }): number {
  const lum = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  };
  return g.colors.reduce((s, c) => s + lum(c), 0) / g.colors.length;
}

/**
 * Hues for further Spaces: the default colours turned round the colour wheel, so each Space
 * is told apart. The turns are picked so no accent lands on yellow, which has to be darkened
 * to a dull olive before it reads on light paper.
 */
const SPACE_HUES = [0, -70, 250, 150, -130, 40, 200];
/** The turns theme version 2 used (its third Space differed). */
const PREVIOUS_HUES = [0, -70, 95, 150, -130, 40, 200];

/** A default theme turned round the wheel for the Space at `index`: the first is the default itself. */
function inSpaceHue(theme: SpaceTheme, index: number, hues = SPACE_HUES): SpaceTheme {
  const turn = hues[index % hues.length];
  const base: SpaceTheme = { ...theme, colors: [...theme.colors] as [string, string] };
  if (!turn) return base;
  const rotate = (hex: string) => {
    const [h, s, l] = hexToHsl(hex);
    return hslToHex(h + turn, s, l);
  };
  return { ...base, colors: [rotate(base.colors[0]), rotate(base.colors[1])] };
}

/** The theme a new Space gets: Calm Air for the first, then the same look in another hue for each. */
export function defaultTheme(index = 0): SpaceTheme {
  return inSpaceHue(DEFAULT_THEME, index);
}

/**
 * A saved Space theme, brought to the current default look.
 *
 * - From theme version 2: a Space still exactly on that version's built-in default (in any
 *   of the new-Space hues) moves to Calm Air in the same hue. A Space you changed in any way
 *   is left as it is.
 * - From before version 2: every Space moves to the default, as that version promised.
 */
export function migrateTheme(theme: SpaceTheme, fromVersion: number | undefined, index: number): SpaceTheme {
  if (typeof fromVersion === 'number' && fromVersion >= THEME_VERSION) return theme;
  if (typeof fromVersion !== 'number' || fromVersion < 2) return defaultTheme(index);
  const same = (a: SpaceTheme, b: SpaceTheme) =>
    a.colors[0].toLowerCase() === b.colors[0] && a.colors[1].toLowerCase() === b.colors[1] && a.mode === b.mode && a.intensity === b.intensity && a.grain === b.grain;
  const plain = !theme.photo && !theme.backdrop && !theme.gradient && !theme.pattern;
  const slot = plain ? PREVIOUS_HUES.findIndex((_, i) => same(theme, inSpaceHue(PREVIOUS_DEFAULT, i, PREVIOUS_HUES))) : -1;
  return slot >= 0 ? defaultTheme(slot) : theme;
}
