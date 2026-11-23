// Kite's built-in theme pictures. Each one paints the window frame and the home page,
// and brings the two colours (and light or dark) that match it, so the sidebar, accent
// and page chrome agree with the picture. The pictures themselves are drawn by
// scripts/backgrounds/make.mjs and bundled with the app.

import type { SpaceTheme } from './types';

export type BackdropId = 'dawn' | 'dunes' | 'meadow' | 'forest' | 'haze' | 'bloom' | 'aurora' | 'dusk' | 'ocean' | 'ember' | 'night';

export interface Backdrop {
  id: BackdropId;
  name: string;
  /** Light pictures take dark text; dark pictures take light text. */
  tone: 'light' | 'dark';
  /** The theme colours that go with it: the sky, and an accent picked from the scene. */
  colors: [string, string];
}

export const BACKDROPS: readonly Backdrop[] = [
  { id: 'dawn', name: 'Dawn', tone: 'light', colors: ['#e9d6ee', '#6b55a0'] },
  { id: 'dunes', name: 'Dunes', tone: 'light', colors: ['#f4dcc4', '#c4703f'] },
  { id: 'meadow', name: 'Meadow', tone: 'light', colors: ['#d7e9f3', '#4d8a4a'] },
  { id: 'forest', name: 'Forest', tone: 'light', colors: ['#c3d3cd', '#2f5e50'] },
  { id: 'haze', name: 'Haze', tone: 'light', colors: ['#f3e6f2', '#9a7fd6'] },
  { id: 'bloom', name: 'Bloom', tone: 'dark', colors: ['#8a4fff', '#ff7aa8'] },
  { id: 'aurora', name: 'Aurora', tone: 'dark', colors: ['#1b3646', '#3cf2b4'] },
  { id: 'dusk', name: 'Dusk', tone: 'dark', colors: ['#5b3a7c', '#ff9f8a'] },
  { id: 'ocean', name: 'Ocean', tone: 'dark', colors: ['#0f2f57', '#7fb7ff'] },
  { id: 'ember', name: 'Ember', tone: 'dark', colors: ['#5c1a24', '#ff8a4c'] },
  { id: 'night', name: 'Night', tone: 'dark', colors: ['#0b1326', '#9c8cff'] },
];

export const isBackdrop = (v: unknown): v is BackdropId => typeof v === 'string' && BACKDROPS.some((b) => b.id === v);
export const backdropById = (id: string | undefined): Backdrop | undefined => BACKDROPS.find((b) => b.id === id);

/** What picking a picture changes on a Space theme: the picture, its colours and its light or dark. Null goes back to plain colours. */
export function backdropPatch(id: BackdropId | null): Partial<SpaceTheme> {
  const b = id ? backdropById(id) : undefined;
  if (!b) return { backdrop: undefined };
  return { backdrop: b.id, colors: [...b.colors] as [string, string], mode: b.tone };
}
