// Colour and motion maths shared by the window and the tests: the Space colour swatches,
// the colour wheel, and the spring model behind the "Spring" motion feel.
//
// The colours the window is painted with are not here: the Calm Air palette is in
// spaceTheme.ts (CALM_AIR), theme.ts turns it and a Space's colours into CSS variables, and
// the fixed scales (type, shape, fills, surfaces, depth, motion) are tokens in
// src/renderer/styles/foundations.css.
//
// The swatch rows and the shape of the theme model (a primary colour stored as hue /
// saturation / lightness, a second colour as a hue offset, a response + damping spring)
// follow what was measured from Arc 1.171 (see RESEARCH.md §8). Only numbers and structure
// were taken, never Arc's code, art, fonts or sounds; the spring constants are our own.

/** Space colour swatches, three rows of nine (pastel, muted, greyscale). */
export const SWATCHES = {
  pastel: ['#fdfbfa', '#fbeaf3', '#ecd2ea', '#f7cdd2', '#fae1d5', '#fef9e7', '#e4fcec', '#e0f2fb', '#c5c6e2'],
  muted: ['#4b3b58', '#623856', '#854444', '#a77048', '#d1b46a', '#cdcca8', '#84a885', '#34604b', '#2d4468'],
  grey: ['#ffffff', '#e6e6e6', '#cccccc', '#b2b2b2', '#808080', '#666666', '#333333', '#1a1a1a', '#000000'],
} as const;

// ---- Springs --------------------------------------------------------------------

export interface Spring {
  /** Seconds for one undamped swing; smaller is quicker. */
  response: number;
  /** 1 = no overshoot; below 1 bounces a little. */
  damping: number;
}

/** Named springs used across the window. */
export const SPRINGS = {
  /** Panels, the sidebar, popups arriving. */
  default: { response: 0.38, damping: 0.86 },
  /** Settling back after a press: a small, quick bounce. */
  press: { response: 0.3, damping: 0.58 },
  /** Hover cards and small things that pop. */
  pop: { response: 0.32, damping: 0.7 },
} as const satisfies Record<string, Spring>;

/** Position (0 → 1) of a unit-mass spring released from 0 toward 1, at time t seconds. */
export function springAt({ response, damping }: Spring, t: number): number {
  const w0 = (2 * Math.PI) / Math.max(0.01, response);
  const z = Math.max(0.01, damping);
  if (z >= 1) {
    // Critically damped (over-damping is treated the same: it never looks better).
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  }
  const wd = w0 * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
}

/** How long until the spring stays within 0.4% of rest, in milliseconds. */
export function springDuration(s: Spring): number {
  const w0 = (2 * Math.PI) / Math.max(0.01, s.response);
  const decay = Math.min(1, Math.max(0.01, s.damping)) * w0;
  // Envelope e^(-ζω₀t) < 0.004  →  t = ln(250) / ζω₀  (critical damping adds a little tail).
  const t = Math.log(250) / decay + (s.damping >= 1 ? 1.2 / w0 : 0);
  return Math.round(t * 1000);
}

/**
 * The spring as a CSS easing: `linear(…)` sampled over its settle time.
 * Pair it with `springDuration` so the curve and the duration match.
 */
export function springEasing(s: Spring, samples = 32): string {
  const total = springDuration(s) / 1000;
  const pts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const v = i === samples ? 1 : springAt(s, (total * i) / samples);
    pts.push(String(Math.round(v * 10000) / 10000));
  }
  return `linear(${pts.join(', ')})`;
}

// ---- Colour wheel ---------------------------------------------------------------

/** Hue (degrees), saturation and lightness (0–1) to #rrggbb. */
export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(1, s));
  const lig = Math.max(0, Math.min(1, l));
  const k = (n: number) => (n + hue / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** #rrggbb to [hue°, saturation 0–1, lightness 0–1]. */
export function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16) || 0;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

/** How the second colour relates to the first on the wheel. */
export const HARMONIES = [
  { id: 'same', label: 'Same', offset: 0 },
  { id: 'near', label: 'Neighbour', offset: 32 },
  { id: 'triad', label: 'Triad', offset: 120 },
  { id: 'opposite', label: 'Opposite', offset: 180 },
] as const;

export type HarmonyId = (typeof HARMONIES)[number]['id'];

/**
 * A Space's two colours from one point on the colour wheel: a light first
 * colour at `hue`, and a deeper second colour at `hue + offset`.
 * `vivid` (0–1) sets how saturated both are.
 */
export function wheelColors(hue: number, offset: number, vivid = 0.7): [string, string] {
  const s = Math.max(0, Math.min(1, vivid));
  return [hslToHex(hue, s * 0.9, 0.86), hslToHex(hue + offset, Math.min(1, s * 1.05), 0.5)];
}
