// Turns a Space theme + settings into CSS variables for the whole window.

import type { Settings, SpaceTheme } from '@shared/types';
import { hexToHsl, hslToHex, SPRINGS, springDuration, springEasing } from '@shared/designTokens';
import { backdropUrl } from './backdrops';
import { CALM_AIR, DEFAULT_PATTERN_STRENGTH, type PatternId } from '@shared/spaceTheme';

type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (c: RGB) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;

/** Blend a toward b by t (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** Relative brightness 0–1 (WCAG luminance). */
export function luminance(hex: string): number {
  const ch = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function resolveDark(theme: SpaceTheme, systemDark: boolean): boolean {
  return theme.mode === 'dark' || (theme.mode === 'system' && systemDark);
}

/** Kite's own text: one face everywhere (web pages keep their fonts). */
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Figtree', ui-sans-serif, system-ui, sans-serif";

/** How things arrive and travel by default: the stylesheet's --ease-out, at the same length as before. */
const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
const DUR = 220;

/**
 * Animation feels you can pick instead of the default: the curve and length (--ease, --dur)
 * that sheets, panels, the sidebar and a change of Space move with. None of them goes past
 * its resting place: a sheet or a menu that overshoots reads as a wobble, so the bounce of
 * "Bouncy" and "Spring" lives only in the press (below).
 */
export const FEEL: Partial<Record<Settings['motionFeel'], { ease: string; ms: number }>> = {
  smooth: { ease: 'cubic-bezier(0.32, 0.72, 0, 1)', ms: 300 },
  snappy: { ease: 'cubic-bezier(0.2, 0, 0, 1)', ms: 130 },
  bouncy: { ease: EASE, ms: 320 },
  // A real spring (response + damping), drawn as a CSS linear() curve. It is damped enough
  // to pass its resting place by under half a percent, which no one can see.
  spring: { ease: springEasing(SPRINGS.default), ms: springDuration(SPRINGS.default) },
};

/**
 * Letting go of something you pressed (--press-ease, --press-dur). "Bouncy" and "Spring"
 * give it a small bounce; every other feel settles straight back.
 */
const PRESS: Partial<Record<Settings['motionFeel'], { ease: string; ms: number }>> = {
  bouncy: { ease: 'cubic-bezier(0.34, 1.45, 0.64, 1)', ms: 320 },
  spring: { ease: springEasing(SPRINGS.press), ms: springDuration(SPRINGS.press) },
};

const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.round(Math.max(0, Math.min(1, a)) * 1000) / 1000})`;
};

// Calm Air: chart paper. The window frame is one flat tint and the page lies on it like a
// sheet. `base` is the paper before a Space colours it; the Space's first colour is mixed in
// by `tint` (weakest to strongest, following Intensity). The default Space colour at the
// default intensity gives exactly the Calm Air shell. `top` is the lightest paper a label
// can lie on (--surface-3 in foundations.css; a unit test keeps the two the same).
// `inks` are the strengths of secondary, tertiary and decorative text.
const TONE = {
  light: { ...CALM_AIR.light, base: '#fafcfc', top: '#ffffff', tint: [0.04, 0.44] as const, inks: [0.76, 0.67, 0.44] as const },
  dark: { ...CALM_AIR.dark, base: '#0a0f16', top: '#27333d', tint: [0.04, 0.34] as const, inks: [0.74, 0.62, 0.4] as const },
};
/** The weakest strength, from `alpha` up, at which see-through ink still reads as text (4.5:1) on every surface given. */
function textStrength(ink: string, alpha: number, surfaces: string[]): number {
  let a = alpha;
  while (a < 1 && surfaces.some((bg) => contrast(mix(bg, ink, a), bg) < 4.5)) a = Math.min(1, Math.round((a + 0.02) * 100) / 100);
  return a;
}

/** The label colour for something filled with the accent: white or a near-black in the accent's hue, whichever reads better. */
function inkOn(accent: string): string {
  const dark = accent === CALM_AIR.dark.accent ? CALM_AIR.dark.accentInk : hslToHex(hexToHsl(accent)[0], 0.45, 0.07);
  if (contrast('#ffffff', accent) >= 4.5) return '#ffffff';
  return contrast(dark, accent) >= contrast('#ffffff', accent) ? dark : '#ffffff';
}

/**
 * The accent a Space shows, from its second colour. It has to work as a link (4.5:1) on
 * the frame and on every sheet of paper, and carry a readable label when it fills a button,
 * so it is deepened by day and lifted at night, keeping its hue, until it does. Chart
 * magenta is drawn by hand for both modes and starts from its night value in the dark.
 */
function fitAccent(source: string, dark: boolean, surfaces: string[]): string {
  let c = source.toLowerCase() === CALM_AIR.light.accent && dark ? CALM_AIR.dark.accent : source.toLowerCase();
  const [h, s] = hexToHsl(c);
  let l = hexToHsl(c)[2];
  const ok = () => surfaces.every((bg) => contrast(c, bg) >= 4.5) && contrast(inkOn(c), c) >= 4.5;
  for (let i = 0; i < 50 && !ok(); i++) {
    l = dark ? Math.min(1, l + 0.02) : Math.max(0, l - 0.02);
    c = hslToHex(h, s, l);
  }
  return c;
}

/**
 * A Space's pattern as CSS background layers: light marks on dark themes, dark marks on
 * light ones. `size` has one entry per layer, so it can be joined with other layers.
 */
export function patternCss(pattern: PatternId | undefined, dark: boolean, strength = DEFAULT_PATTERN_STRENGTH): { image: string; size: string } {
  if (!pattern) return { image: 'none', size: 'auto' };
  const k = Math.max(0, Math.min(1, strength)) * 2;
  const c = (a: number) => `rgba(${dark ? '255,255,255' : hexToRgb(CALM_AIR.light.ink).join(',')},${Math.round(Math.min(0.6, a * k) * 1000) / 1000})`;
  switch (pattern) {
    case 'glow':
      return { image: `radial-gradient(60% 50% at 16% 0%, ${c(0.11)}, transparent 70%), radial-gradient(50% 45% at 100% 100%, ${c(0.08)}, transparent 70%)`, size: 'auto, auto' };
    case 'dots':
      return { image: `radial-gradient(${c(0.16)} 1px, transparent 1.5px)`, size: '18px 18px' };
    case 'grid':
      return { image: `linear-gradient(${c(0.07)} 1px, transparent 1px), linear-gradient(90deg, ${c(0.07)} 1px, transparent 1px)`, size: '28px 28px, 28px 28px' };
    case 'lines':
      return { image: `repeating-linear-gradient(135deg, ${c(0.06)} 0 1px, transparent 1px 12px)`, size: 'auto' };
    case 'rings':
      return { image: `repeating-radial-gradient(circle at 18% 0%, ${c(0.07)} 0 1px, transparent 1px 34px)`, size: 'auto' };
  }
}

/**
 * Everything the window's look needs, as CSS variables: the Space's colours and
 * light/dark mode, and the layout settings. The fixed scales (type, shape, fills, surfaces,
 * depth, motion) are in foundations.css.
 */
export function themeVars(theme: SpaceTheme, settings: Settings, systemDark: boolean, opts: { photoUrl?: string | null } = {}): Record<string, string> {
  const dark = resolveDark(theme, systemDark);
  const tone = dark ? TONE.dark : TONE.light;
  const base = tone.base;
  const t = Math.max(0, Math.min(1, theme.intensity));
  const k = tone.tint[0] + t * (tone.tint[1] - tone.tint[0]);
  // Every colour is drawn mixed with the base, by the intensity, so text stays readable.
  const paint = (c: string) => mix(base, c, k);
  const g = theme.gradient;
  // A gradient you made is painted like the plain colour: its stops mixed with the base by the intensity.
  const stops = g ? g.colors.map(paint) : null;
  // Plain colours: the frame is one flat tint of the first colour. The second is the accent only.
  const shell = paint(theme.colors[0]);
  const a = stops ? stops[0] : shell;
  const b = stops ? stops[stops.length - 1] : shell;
  const chromeMid = stops ? stops.reduce((acc, c, i) => mix(acc, c, 1 / (i + 1))) : shell;
  const ink = tone.ink;
  const papers = [a, b, chromeMid, tone.card, tone.top];
  const accent = fitAccent(theme.colors[1], dark, [chromeMid, tone.card, tone.top]);
  const picture = theme.photo ? opts.photoUrl ?? undefined : theme.backdrop ? backdropUrl(theme.backdrop) : undefined;
  const gradientCss = stops ? `linear-gradient(${g!.angle}deg, ${stops.map((c, i) => `${c} ${Math.round((i / (stops.length - 1)) * 100)}%`).join(', ')})` : null;
  const feel = FEEL[settings.motionFeel];
  const press = PRESS[settings.motionFeel];
  const speed = settings.motionSpeed || 1;
  const pat = patternCss(theme.pattern, dark, theme.patternStrength);
  return {
    '--chrome-a': a,
    '--chrome-b': b,
    '--chrome-mid': chromeMid,
    '--backdrop': picture ? `url("${picture}") center / cover no-repeat, ${chromeMid}` : gradientCss ?? shell,
    // Over a picture the sidebar is frosted glass: the more intensity, the more picture shows.
    '--wash': dark ? rgba(CALM_AIR.dark.shell, 0.62 - t * 0.36) : `rgba(255,255,255,${(0.66 - t * 0.38).toFixed(3)})`,
    '--ink': ink,
    // The ink at lower strength, so it carries the frame's hue. --ink-2 and --ink-3 are still
    // text: both reach 4.5:1 (WCAG AA) on the frame, the page card and every raised sheet,
    // and are strengthened if a Space's colour would take them under. --ink-4 is decoration
    // only (chevrons, placeholder glyphs, the contour lines).
    '--ink-2': rgba(ink, textStrength(ink, tone.inks[0], papers)),
    '--ink-3': rgba(ink, textStrength(ink, tone.inks[1], papers)),
    '--ink-4': rgba(ink, tone.inks[2]),
    // A true hairline, drawn from the ink.
    '--line': rgba(ink, dark ? 0.12 : 0.1),
    '--card': tone.card,
    '--scrim': dark ? 'rgba(4,8,11,.34)' : rgba(ink, 0.24),
    '--accent': accent,
    '--accent-ink': inkOn(accent),
    '--accent-soft': rgba(accent, dark ? 0.22 : 0.14),
    '--tint-1': theme.colors[0],
    '--tint-2': theme.colors[1],
    '--grain-opacity': theme.grain ? (dark ? '.10' : '.16') : '0',
    '--pattern': pat.image,
    '--pattern-size': pat.size,
    '--font': FONT,
    '--scale': String(settings.fontScale),
    '--radius': `${settings.radius}px`,
    '--gap': `${settings.gap}px`,
    '--ease': feel?.ease ?? EASE,
    '--dur': `${Math.round((feel?.ms ?? DUR) / speed)}ms`,
    '--speed': String(1 / speed),
    '--press-ease': press?.ease ?? EASE,
    '--press-dur': `${Math.round((press?.ms ?? 120) / speed)}ms`,
    colorScheme: dark ? 'dark' : 'light',
  };
}

/**
 * How readable a look is: text on the sidebar, and the accent on the sidebar.
 * Ratios follow WCAG (4.5 is the bar for normal text, 3 for large text and icons).
 */
export function readability(theme: SpaceTheme, settings: Settings, systemDark: boolean): { text: number; accent: number; ok: boolean } {
  const v = themeVars(theme, settings, systemDark);
  const chrome = v['--chrome-mid'];
  const text = contrast(v['--ink'], chrome);
  const accent = contrast(v['--accent'], chrome);
  return { text: Math.round(text * 10) / 10, accent: Math.round(accent * 10) / 10, ok: text >= 4.5 && accent >= 3 };
}

/** The strongest tint (0–1) that keeps text on the sidebar readable. */
export function readableIntensity(theme: SpaceTheme, settings: Settings, systemDark: boolean): number {
  let i = theme.intensity;
  while (i > 0 && readability({ ...theme, intensity: i }, settings, systemDark).text < 4.5) i = Math.max(0, Math.round((i - 0.05) * 100) / 100);
  return i;
}
