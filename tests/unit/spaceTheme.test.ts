import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, MODES, SWATCH_ROWS, defaultTheme, gradientPatch, pairFromColor, pairFromHue, photoPatch, sanitizeGradient, sanitizeTheme, starterGradient, swatchOf, PLAIN } from '@shared/spaceTheme';
import { createInitialState } from '@shared/defaults';
import { loadState } from '@shared/persistence';
import { setSpaceTheme } from '@shared/spaces';
import { themeVars, readability, contrast } from '../../src/renderer/theme';
import { fresh, run } from './helpers';

const hex = /^#[0-9a-f]{6}$/;

describe('Space theme (Arc-style: colour, intensity, grain, light/dark/auto)', () => {
  it('has three rows of nine swatches, each giving a valid colour pair', () => {
    expect(SWATCH_ROWS.map((r) => r.id)).toEqual(['pastel', 'muted', 'grey']);
    for (const row of SWATCH_ROWS) {
      expect(row.colors).toHaveLength(9);
      for (const c of row.colors) {
        const pair = pairFromColor(c);
        expect(pair[0]).toBe(c.toLowerCase());
        expect(pair[1]).toMatch(hex);
        expect(swatchOf({ colors: pair })).toEqual({ row: row.id, index: row.colors.indexOf(c) });
      }
    }
    expect(swatchOf({ colors: ['#123456', '#654321'] })).toBeNull();
    expect(pairFromHue(200, 0.7).every((c) => hex.test(c))).toBe(true);
  });

  it('a new Kite starts on the dark default; each new Space gets the same design in its own hue', () => {
    const s = createInitialState();
    expect(s.spaces[0].theme).toEqual(DEFAULT_THEME);
    expect(DEFAULT_THEME).toMatchObject({ mode: 'dark', grain: true, gradient: { angle: 160 } });
    expect(loadState(null).spaces[0].theme).toEqual(DEFAULT_THEME);
    const hues = [0, 1, 2, 3].map((i) => defaultTheme(i).gradient!.colors[0]);
    expect(new Set(hues).size).toBe(4);
    for (let i = 0; i < 4; i++) expect(defaultTheme(i)).toMatchObject({ mode: 'dark', gradient: { angle: 160 } });
  });

  it('keeps only the four fields: extras from older versions and bad values are dropped', () => {
    const fb = DEFAULT_THEME;
    const t = sanitizeTheme({ colors: ['#ABCDEF', '#123456'], mode: 'dark', intensity: 7, grain: 'yes' as never, gradient: { kind: 'mesh' }, motion: { kind: 'drift' }, image: { id: 'x' } } as never, fb);
    expect(t).toEqual({ colors: ['#abcdef', '#123456'], mode: 'dark', intensity: 1, grain: true });
    const { gradient: _g, ...plainFb } = fb;
    expect(sanitizeTheme({ colors: ['red', '#000'] as never, mode: 'neon' as never }, fb)).toEqual(plainFb);
    expect(sanitizeTheme(undefined, fb)).toEqual(fb);
    expect(MODES).toEqual(['light', 'dark', 'system']);
    // Settings no longer carry a look, a font or custom CSS; an old file with them still loads.
    const loaded = loadState({ ...createInitialState(), settings: { ...createInitialState().settings, look: { style: 'halo' }, font: 'mono', chromeCss: 'x{}' } });
    expect((loaded.settings as unknown as Record<string, unknown>).look).toEqual({ style: 'halo' }); // kept as unknown data, never read
    expect(loaded.spaces[0].theme).toEqual(DEFAULT_THEME);
  });

  it('a change to a Space is checked the same way', () => {
    let s = fresh();
    const id = s.spaces[0].id;
    [s] = run(s, (d) => setSpaceTheme(d, id, { intensity: 3, colors: ['#FFEEDD', '#001122'], gradient: {} } as never));
    expect(s.spaces[0].theme).toEqual({ colors: ['#ffeedd', '#001122'], mode: 'dark', intensity: 1, grain: true });
  });

  it('paints the window from the colours alone, and keeps the look Kite had', () => {
    const s = fresh();
    const v = themeVars({ colors: ['#f2c9a0', '#e58f65'], mode: 'light', intensity: 0.55, grain: true }, s.settings, false);
    expect(v['--card']).toBe('#ffffff');
    expect(v['--ink']).toBe('#1e1c1a');
    expect(v['--line']).toBe('rgba(40,30,20,0.100)');
    expect(v['--backdrop']).toMatch(/^linear-gradient\(165deg/);
    expect(v['--font']).toContain('Figtree');
    expect(v['--grain-opacity']).toBe('.16');
    const dark = themeVars({ colors: ['#f2c9a0', '#e58f65'], mode: 'dark', intensity: 0.55, grain: false }, s.settings, false);
    expect(dark['--card']).toBe('#1f2027');
    expect(dark['--grain-opacity']).toBe('0');
  });

  it('text stays readable on every swatch, both modes, at the default intensity', () => {
    const s = fresh();
    for (const row of SWATCH_ROWS) {
      for (const c of row.colors) {
        for (const mode of ['light', 'dark'] as const) {
          const theme = { colors: pairFromColor(c), mode, intensity: DEFAULT_THEME.intensity, grain: false };
          const r = readability(theme, s.settings, false);
          expect(r.text, `${row.id} ${c} ${mode}`).toBeGreaterThanOrEqual(4.5);
          expect(r.accent, `${row.id} ${c} ${mode} accent`).toBeGreaterThanOrEqual(2.9);
          const v = themeVars(theme, s.settings, false);
          expect(contrast(v['--ink'], v['--chrome-mid'])).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});

describe('built-in pictures', () => {
  it('each picture brings its colours and light or dark; none goes back to plain colours; only Kite\'s own ids are kept', async () => {
    const { BACKDROPS, backdropPatch, isBackdrop } = await import('@shared/backdrops');
    expect(BACKDROPS).toHaveLength(11);
    for (const b of BACKDROPS) {
      expect(b.colors.every((c) => hex.test(c))).toBe(true);
      expect(backdropPatch(b.id)).toEqual({ backdrop: b.id, colors: b.colors, mode: b.tone });
    }
    expect(backdropPatch(null)).toEqual({ backdrop: undefined });
    expect(isBackdrop('https://evil.example/x.jpg')).toBe(false);
    expect(sanitizeTheme({ ...DEFAULT_THEME, backdrop: 'dawn' }, DEFAULT_THEME).backdrop).toBe('dawn');
    expect(sanitizeTheme({ ...DEFAULT_THEME, backdrop: '../../etc' as never }, DEFAULT_THEME)).not.toHaveProperty('backdrop');
  });

  it('a home page "scene" saved by an earlier version becomes the Space\'s picture', () => {
    const old = { ...createInitialState(), home: { widgets: [], scene: 'ember', showGreeting: true, showFrequent: false, showHints: true } };
    const s = loadState(JSON.parse(JSON.stringify(old)));
    expect(s.spaces[0].theme).toMatchObject({ backdrop: 'ember', mode: 'dark' });
    expect(s.home).not.toHaveProperty('scene');
  });

  it('the window paints the picture behind a matching colour, and text on the chrome stays readable for every picture', async () => {
    const { BACKDROPS, backdropPatch } = await import('@shared/backdrops');
    const s = fresh();
    for (const b of BACKDROPS) {
      const theme = sanitizeTheme({ ...DEFAULT_THEME, ...backdropPatch(b.id) }, DEFAULT_THEME);
      const v = themeVars(theme, s.settings, false);
      expect(v['--backdrop']).toContain(`${b.id}.jpg") center / cover no-repeat, #`);
      expect(v['--wash']).toMatch(/^rgba\(/);
      expect(readability(theme, s.settings, false).text, b.id).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('your own gradient and picture; the dark default for everyone', () => {
  it('a gradient keeps 2–4 valid colours and a whole angle; picking it sets the theme colours from its ends', () => {
    expect(sanitizeGradient({ colors: ['#AA0000', 'nope', '#00bb00', '#0000cc', '#111111', '#222222'], angle: 725.4 })).toEqual({ colors: ['#aa0000', '#00bb00', '#0000cc', '#111111'], angle: 5 });
    expect(sanitizeGradient({ colors: ['#aa0000'], angle: 0 })).toBeUndefined();
    expect(sanitizeGradient('x')).toBeUndefined();
    expect(gradientPatch({ colors: ['#101020', '#303060', '#5050a0'], angle: 90 })).toMatchObject({ gradient: { colors: ['#101020', '#303060', '#5050a0'], angle: 90 }, colors: ['#101020', '#5050a0'], backdrop: undefined, photo: undefined });
    const start = starterGradient({ colors: ['#ff0000', '#0000ff'] });
    expect(start.colors).toHaveLength(3);
    expect(start.colors[0]).toBe('#ff0000');
  });

  it('only one background at a time: your picture, else a built-in one, else your gradient', () => {
    const fb = DEFAULT_THEME;
    const all = { ...fb, photo: { id: 'img-abc123-xyz', tone: 'dark' as const }, backdrop: 'dawn' as const, gradient: { colors: ['#000000', '#ffffff'], angle: 10 } };
    expect(sanitizeTheme(all, fb)).toMatchObject({ photo: { id: 'img-abc123-xyz', tone: 'dark' } });
    expect(sanitizeTheme(all, fb)).not.toHaveProperty('backdrop');
    expect(sanitizeTheme({ ...all, photo: undefined }, fb)).not.toHaveProperty('gradient');
    expect(sanitizeTheme({ ...all, photo: { id: '../../x', tone: 'dark' } } as never, fb)).toMatchObject({ backdrop: 'dawn' });
    expect(photoPatch('img-1a2b3c', 0.8, ['#eeeeee', '#3366cc'])).toEqual({ ...PLAIN, photo: { id: 'img-1a2b3c', tone: 'light' }, colors: ['#eeeeee', '#3366cc'], mode: 'light' });
    expect(photoPatch('img-1a2b3c', 0.2, ['#111111', '#3366cc']).mode).toBe('dark');
  });

  it('every Space of an earlier version moves to the dark default once; after that its theme is left alone', () => {
    const old = createInitialState();
    delete (old.settings as { themeVersion?: number }).themeVersion;
    old.spaces[0].theme = { colors: ['#cfe4ff', '#4a7fe0'], mode: 'light', intensity: 0.5, grain: false };
    const once = loadState(JSON.parse(JSON.stringify(old)));
    expect(once.spaces[0].theme).toEqual(DEFAULT_THEME);
    expect(once.settings.themeVersion).toBe(2);
    once.spaces[0].theme = { colors: ['#cfe4ff', '#4a7fe0'], mode: 'light', intensity: 0.5, grain: false };
    expect(loadState(JSON.parse(JSON.stringify(once))).spaces[0].theme.mode).toBe('light');
  });

  it('text on the chrome stays readable on the dark default and every new Space hue', () => {
    const s = fresh();
    for (let i = 0; i < 7; i++) {
      const theme = defaultTheme(i);
      const v = themeVars(theme, s.settings, false);
      expect(v['--backdrop']).toMatch(/^linear-gradient\(160deg, #/);
      expect(readability(theme, s.settings, false).text, `space ${i}`).toBeGreaterThanOrEqual(4.5);
      expect(readability(theme, s.settings, false).accent, `space ${i} accent`).toBeGreaterThanOrEqual(3);
    }
  });
});
