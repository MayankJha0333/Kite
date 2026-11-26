// The Customize panel: the handful of look-and-layout choices people change most, as named
// steps instead of raw numbers. Each one maps onto a setting that already exists, so the
// full Settings page and this panel always agree.

import { defaultSettings } from './defaults';
import type { Density, MotionFeel, Settings } from './types';

export type CornerId = 'square' | 'soft' | 'round';
export const CORNERS: readonly { id: CornerId; name: string; radius: number }[] = [
  { id: 'square', name: 'Square', radius: 4 },
  { id: 'soft', name: 'Soft', radius: 12 },
  { id: 'round', name: 'Round', radius: 20 },
];

export type MarginId = 'edge' | 'float' | 'airy';
/** `short` is the name where there is little room (the Customize panel). */
export const MARGINS: readonly { id: MarginId; name: string; short: string; gap: number }[] = [
  { id: 'edge', name: 'Edge to edge', short: 'Edge', gap: 0 },
  { id: 'float', name: 'Floating', short: 'Floating', gap: 8 },
  { id: 'airy', name: 'Airy', short: 'Airy', gap: 14 },
];

/** Kite's own text size (web pages keep theirs), as four steps inside the limits of the setting. */
export type TextSizeId = 'small' | 'regular' | 'large' | 'larger';
export const TEXT_SIZES: readonly { id: TextSizeId; name: string; scale: number }[] = [
  { id: 'small', name: 'Small', scale: 0.9 },
  { id: 'regular', name: 'Regular', scale: 1 },
  { id: 'large', name: 'Large', scale: 1.1 },
  { id: 'larger', name: 'Larger', scale: 1.2 },
];

export const DENSITIES: readonly { id: Density; name: string }[] = [
  { id: 'compact', name: 'Compact' },
  { id: 'comfortable', name: 'Regular' },
  { id: 'roomy', name: 'Roomy' },
];

export const FEELS: readonly { id: MotionFeel; name: string }[] = [
  { id: 'style', name: 'Calm' },
  { id: 'snappy', name: 'Snappy' },
  { id: 'bouncy', name: 'Bouncy' },
];

const nearest = <T extends { id: string }>(list: readonly T[], value: number, of: (x: T) => number): T => list.reduce((best, x) => (Math.abs(of(x) - value) < Math.abs(of(best) - value) ? x : best));

/** The named step closest to a radius set anywhere (the Settings slider can land between steps). */
export const cornerOf = (radius: number): CornerId => nearest(CORNERS, radius, (c) => c.radius).id;
export const marginOf = (gap: number): MarginId => nearest(MARGINS, gap, (m) => m.gap).id;
export const textSizeOf = (scale: number): TextSizeId => nearest(TEXT_SIZES, scale, (t) => t.scale).id;
/** The feel shown as picked: the two less common ones (smooth, spring) read as Calm. */
export const feelOf = (feel: MotionFeel): MotionFeel => (FEELS.some((f) => f.id === feel) ? feel : 'style');

/** What “Reset” puts back: only the settings this panel can change. */
export function customizeDefaults(): Pick<Settings, 'sidebarSide' | 'density' | 'radius' | 'gap' | 'motionFeel' | 'reduceMotion'> {
  const d = defaultSettings();
  return { sidebarSide: d.sidebarSide, density: d.density, radius: d.radius, gap: d.gap, motionFeel: d.motionFeel, reduceMotion: d.reduceMotion };
}
