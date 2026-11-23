// A Space's theme, the way Arc does it: a colour (with a second one that follows it),
// how strongly it tints the window, grain, and light/dark/auto. Nothing else.
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

/** The theme a new copy of Kite starts with: clear blue, calm. */
export const DEFAULT_THEME: SpaceTheme = { colors: ['#cfe4ff', '#4a7fe0'], mode: 'system', intensity: 0.5, grain: true };

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

/** A Space theme with only valid values (anything else falls back). A picture is kept only if it is one of Kite's own; other extras from older versions are dropped. */
export function sanitizeTheme(t: Partial<SpaceTheme> | undefined, fallback: SpaceTheme): SpaceTheme {
  const colors = Array.isArray(t?.colors) && t!.colors.length === 2 && t!.colors.every(isHex) ? ([t!.colors[0].toLowerCase(), t!.colors[1].toLowerCase()] as [string, string]) : fallback.colors;
  return {
    colors,
    mode: MODES.includes(t?.mode as ThemeMode) ? (t!.mode as ThemeMode) : fallback.mode,
    intensity: clamp01(t?.intensity, fallback.intensity),
    grain: typeof t?.grain === 'boolean' ? t.grain : fallback.grain,
    ...(isBackdrop(t?.backdrop) ? { backdrop: t!.backdrop } : {}),
  };
}

/** The theme a new Space gets: the default for the first, then a pastel swatch each. */
export function defaultTheme(index = 0): SpaceTheme {
  if (index === 0) return { ...DEFAULT_THEME, colors: [...DEFAULT_THEME.colors] as [string, string] };
  const pastel = SWATCHES.pastel;
  return { ...DEFAULT_THEME, colors: pairFromColor(pastel[(index + 1) % pastel.length]) };
}
