// Turns a Space theme + settings into CSS variables for the whole window.

import type { Settings, SpaceTheme } from '@shared/types';
import { scaleVars, SPRINGS, springDuration, springEasing } from '@shared/designTokens';
import { backdropUrl } from './backdrops';
import { DEFAULT_PATTERN_STRENGTH, type PatternId } from '@shared/spaceTheme';

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
const FONT = "'Figtree', ui-sans-serif, system-ui, sans-serif";

/** Animation feels you can pick instead of the default. */
export const FEEL: Partial<Record<Settings['motionFeel'], { ease: string; ms: number }>> = {
  smooth: { ease: 'cubic-bezier(0.32, 0.72, 0, 1)', ms: 300 },
  snappy: { ease: 'cubic-bezier(0.2, 0, 0, 1)', ms: 130 },
  bouncy: { ease: 'cubic-bezier(0.34, 1.45, 0.64, 1)', ms: 320 },
  // A real spring (response + damping), drawn as a CSS linear() curve.
  spring: { ease: springEasing(SPRINGS.default), ms: springDuration(SPRINGS.default) },
};

/** Release after a press: a small spring bounce, used by rows, favourites and buttons. */
const PRESS = { ease: springEasing(SPRINGS.press), ms: springDuration(SPRINGS.press) };

const ROW: Record<Settings['density'], number> = { compact: 30, comfortable: 36, roomy: 42 };

const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.round(Math.max(0, Math.min(1, a)) * 1000) / 1000})`;
};

// The look: soft tinted chrome, the page floating on a card. One set of values, tuned once.
const TONE = {
  light: { base: '#f4f1ec', card: '#ffffff', ink: '#1e1c1a', tint: [0.18, 0.62] as const },
  dark: { base: '#16171c', card: '#1f2027', ink: '#f1efea', tint: [0.12, 0.38] as const },
};
const BORDER = 0.35;
const SHADOW = 0.5;
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const DUR = 220;

/**
 * A Space's pattern as CSS background layers: light marks on dark themes, dark marks on
 * light ones. `size` has one entry per layer, so it can be joined with other layers.
 */
export function patternCss(pattern: PatternId | undefined, dark: boolean, strength = DEFAULT_PATTERN_STRENGTH): { image: string; size: string } {
  if (!pattern) return { image: 'none', size: 'auto' };
  const k = Math.max(0, Math.min(1, strength)) * 2;
  const c = (a: number) => `rgba(${dark ? '255,255,255' : '40,30,20'},${Math.round(Math.min(0.6, a * k) * 1000) / 1000})`;
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

/** How the selected tab and hovered rows look: a lifted card. */
function rowSurfaces(dark: boolean): Record<string, string> {
  return {
    '--hover': dark ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.42)',
    '--active': dark ? 'rgba(255,255,255,.13)' : 'rgba(255,255,255,.78)',
    '--active-shadow': dark ? '0 1px 0 rgba(255,255,255,.06) inset, 0 2px 10px rgba(0,0,0,.25)' : '0 1px 2px rgba(60,40,20,.08), 0 2px 10px rgba(60,40,20,.06)',
  };
}

/**
 * Everything the window's look needs, as CSS variables: the Space's colours and
 * light/dark mode, and the layout settings.
 */
export function themeVars(theme: SpaceTheme, settings: Settings, systemDark: boolean, opts: { photoUrl?: string | null } = {}): Record<string, string> {
  const dark = resolveDark(theme, systemDark);
  const tone = dark ? TONE.dark : TONE.light;
  const base = tone.base;
  const t = Math.max(0, Math.min(1, theme.intensity));
  // In dark mode the tint is held back so colours glow instead of shout.
  const k = tone.tint[0] + t * (tone.tint[1] - tone.tint[0]);
  // Every colour is drawn mixed with the base, by the intensity, so text stays readable.
  const paint = (c: string) => mix(base, c, k);
  const g = theme.gradient;
  // A gradient you made is painted like the plain colours: its stops mixed with the base by the intensity.
  const stops = g ? g.colors.map(paint) : null;
  const a = stops ? stops[0] : paint(theme.colors[0]);
  const b = stops ? stops[stops.length - 1] : paint(theme.colors[1]);
  const chromeMid = stops ? stops.reduce((acc, c, i) => mix(acc, c, 1 / (i + 1))) : mix(a, b, 0.5);
  const ink = tone.ink;
  // The accent is the Space's second colour; it must stay readable on the chrome, so it is
  // pushed toward the ink colour until it is.
  let accent = theme.colors[1];
  for (let i = 0; i < 8 && contrast(accent, chromeMid) < 3; i++) accent = mix(accent, ink, 0.18);
  const lineA = dark ? 0.02 + BORDER * 0.2 : 0.02 + BORDER * 0.2286;
  const lineRgb = dark ? '255,255,255' : '40,30,20';
  const ringA = 0.06 * (BORDER / 0.35);
  const depth = SHADOW / 0.5;
  // A hairline ring, a tight contact shadow and a soft ambient one: depth without a grey halo.
  const shadow = dark
    ? `0 0 0 1px rgba(255,255,255,${Math.min(0.2, ringA).toFixed(3)}), 0 1px 2px rgba(0,0,0,${Math.min(0.5, 0.3 * depth).toFixed(3)}), 0 14px 36px -8px rgba(0,0,0,${Math.min(0.8, 0.5 * depth).toFixed(3)})`
    : `0 0 0 1px rgba(60,40,20,${Math.min(0.2, ringA).toFixed(3)}), 0 1px 2px rgba(60,40,20,${Math.min(0.12, 0.05 * depth).toFixed(3)}), 0 14px 36px -8px rgba(60,40,20,${Math.min(0.32, 0.15 * depth).toFixed(3)})`;
  const overlayA = 0.94;
  const picture = theme.photo ? opts.photoUrl ?? undefined : theme.backdrop ? backdropUrl(theme.backdrop) : undefined;
  const gradientCss = stops ? `linear-gradient(${g!.angle}deg, ${stops.map((c, i) => `${c} ${Math.round((i / (stops.length - 1)) * 100)}%`).join(', ')})` : null;
  const springy = settings.motionFeel === 'spring';
  const pat = patternCss(theme.pattern, dark, theme.patternStrength);
  return {
    ...scaleVars(dark),
    '--chrome-a': a,
    '--chrome-b': b,
    '--chrome-mid': chromeMid,
    '--backdrop': picture ? `url("${picture}") center / cover no-repeat, ${chromeMid}` : gradientCss ?? `linear-gradient(165deg, ${a} 0%, ${chromeMid} 55%, ${b} 100%)`,
    // Over a picture the sidebar is frosted glass: the more intensity, the more picture shows.
    '--wash': dark ? `rgba(14,15,20,${(0.62 - t * 0.36).toFixed(3)})` : `rgba(255,255,255,${(0.66 - t * 0.38).toFixed(3)})`,
    '--ink': ink,
    // Readable greys: --ink-2 and --ink-3 both reach 4.5:1 (WCAG AA for text) on the
    // card and on the sidebar. --ink-4 is fainter and only for decoration (chevrons, arrows).
    '--ink-2': rgba(ink, dark ? 0.78 : 0.72),
    '--ink-3': rgba(ink, dark ? 0.6 : 0.62),
    '--ink-4': rgba(ink, dark ? 0.42 : 0.4),
    ...rowSurfaces(dark),
    '--line': `rgba(${lineRgb},${lineA.toFixed(3)})`,
    '--card': tone.card,
    '--overlay': dark ? rgba(mix(tone.card, '#000000', 0.15), overlayA - 0.02) : rgba(mix(tone.card, base, 0.3), overlayA),
    '--blur': '8px',
    '--scrim': dark ? 'rgba(0,0,0,.45)' : 'rgba(40,30,20,.22)',
    '--accent': accent,
    '--accent-ink': luminance(accent) > 0.45 ? '#1e1c1a' : '#ffffff',
    '--accent-soft': rgba(accent, dark ? 0.22 : 0.14),
    '--tint-1': theme.colors[0],
    '--tint-2': theme.colors[1],
    '--shadow': shadow,
    '--grain-opacity': theme.grain ? (dark ? '.10' : '.16') : '0',
    '--pattern': pat.image,
    '--pattern-size': pat.size,
    '--font': FONT,
    '--scale': String(settings.fontScale),
    '--radius': `${settings.radius}px`,
    '--gap': `${settings.gap}px`,
    '--sidebar-w': `${settings.sidebarWidth}px`,
    '--row-h': `${ROW[settings.density]}px`,
    '--ease': FEEL[settings.motionFeel]?.ease ?? EASE,
    '--dur': `${Math.round((FEEL[settings.motionFeel]?.ms ?? DUR) / (settings.motionSpeed || 1))}ms`,
    '--speed': String(1 / (settings.motionSpeed || 1)),
    '--press-ease': springy ? PRESS.ease : 'cubic-bezier(0.16, 1, 0.3, 1)',
    '--press-dur': `${Math.round((springy ? PRESS.ms : 160) / (settings.motionSpeed || 1))}ms`,
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
