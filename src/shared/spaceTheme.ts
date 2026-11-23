// A Space's theme, the way Arc does it: a colour (with a second one that follows it),
// how strongly it tints the window, grain, and light/dark/auto. Instead of plain colours
// the window can show one background: a built-in picture, your own picture, or your own
// gradient (only one at a time).
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
 * Kite's default: a dark theme. Deep indigo into violet and a dark teal, shown softly
 * behind the sidebar and in full on the home page, with a periwinkle accent.
 */
export const DEFAULT_GRADIENT = { colors: ['#3b39a6', '#6b3fc4', '#16627c'], angle: 160 };
export const DEFAULT_THEME: SpaceTheme = { colors: ['#3b39a6', '#8f8cff'], mode: 'dark', intensity: 0.65, grain: true, gradient: { colors: [...DEFAULT_GRADIENT.colors], angle: DEFAULT_GRADIENT.angle } };

/** Bumped when the default theme changes for everyone (see persistence.ts). */
export const THEME_VERSION = 2;

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

/** Hues for further Spaces: the default dark gradient turned round the colour wheel, so each Space is told apart. */
const SPACE_HUES = [0, -70, 95, 150, -130, 40, 200];

/** The theme a new Space gets: the dark default for the first, then the same design in another hue for each. */
export function defaultTheme(index = 0): SpaceTheme {
  const turn = SPACE_HUES[index % SPACE_HUES.length];
  const rotate = (hex: string) => {
    const [h, s, l] = hexToHsl(hex);
    return hslToHex(h + turn, s, l);
  };
  const colors = DEFAULT_GRADIENT.colors.map(rotate);
  return { ...DEFAULT_THEME, colors: [colors[0], rotate(DEFAULT_THEME.colors[1])], gradient: { colors, angle: DEFAULT_GRADIENT.angle } };
}
