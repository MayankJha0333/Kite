import { describe, expect, it } from 'vitest';
import { CALM_AIR, DEFAULT_THEME, THEME_VERSION, migrateTheme, MODES, SWATCH_ROWS, defaultTheme, gradientPatch, pairFromColor, pairFromHue, photoPatch, sanitizeGradient, sanitizeTheme, starterGradient, swatchOf, PLAIN, PATTERNS, THEME_PRESETS, presetOf, presetPatch } from '@shared/spaceTheme';
import { createInitialState } from '@shared/defaults';
import { loadState } from '@shared/persistence';
import { setSpaceTheme } from '@shared/spaces';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { themeVars, readability, contrast, mix, patternCss } from '../../src/renderer/theme';
import { fresh, run } from './helpers';

const hex = /^#[0-9a-f]{6}$/;
/** A see-through colour like rgba(20,33,31,0.66), as the solid colour it makes on a background. */
const over = (rgba: string, bg: string) => {
  const [r, g, b, a] = rgba.match(/[\d.]+/g)!.map(Number);
  return mix(bg, `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`, a);
};
const foundations = readFileSync(resolve(__dirname, '../../src/renderer/styles/foundations.css'), 'utf8');

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

  it('a new Kite starts on Calm Air, following the system\'s light or dark; each new Space gets the same design in its own hue', () => {
    const s = createInitialState();
    expect(s.spaces[0].theme).toEqual(DEFAULT_THEME);
    expect(DEFAULT_THEME).toMatchObject({ mode: 'system', grain: false, intensity: 0.2 });
    expect(DEFAULT_THEME.colors[1]).toBe(CALM_AIR.light.accent);
    expect(DEFAULT_THEME.gradient).toBeUndefined(); // plain colours
    expect(s.settings.themeVersion).toBe(THEME_VERSION);
    expect(loadState(null).spaces[0].theme).toEqual(DEFAULT_THEME);
    const hues = [0, 1, 2, 3].map((i) => defaultTheme(i).colors[0]);
    expect(new Set(hues).size).toBe(4);
    for (let i = 0; i < 4; i++) expect(defaultTheme(i)).toMatchObject({ mode: 'system', intensity: 0.2, grain: false });
  });

  it('the default look is exactly Calm Air: sea-glass by day, night chart after dark, one flat tint', () => {
    const s = fresh();
    for (const [systemDark, look] of [[false, CALM_AIR.light], [true, CALM_AIR.dark]] as const) {
      const v = themeVars(DEFAULT_THEME, s.settings, systemDark);
      // The frame is one colour, not a gradient.
      expect(v['--backdrop']).toBe(look.shell);
      expect([v['--chrome-a'], v['--chrome-b'], v['--chrome-mid']]).toEqual([look.shell, look.shell, look.shell]);
      expect(v['--card']).toBe(look.card);
      expect(v['--ink']).toBe(look.ink);
      expect(v['--accent']).toBe(look.accent);
      expect(v['--accent-ink']).toBe(look.accentInk);
      expect(v.colorScheme).toBe(systemDark ? 'dark' : 'light');
      // Each sheet of paper a label can lie on: the frame, the page card, and the raised surfaces of foundations.css.
      const block = systemDark ? foundations.slice(foundations.indexOf(".app[data-theme='dark'] {")) : foundations;
      const surfaces = [1, 2, 3].map((n) => block.match(new RegExp(`--surface-${n}: (#[0-9a-f]{6});`))![1]);
      for (const bg of [look.shell, look.card, ...surfaces]) {
        expect(contrast(look.ink, bg), `ink on ${bg}`).toBeGreaterThanOrEqual(7);
        // Secondary and tertiary text are still text; the accent works as a link.
        expect(contrast(over(v['--ink-2'], bg), bg), `ink-2 on ${bg}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(over(v['--ink-3'], bg), bg), `ink-3 on ${bg}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(look.accent, bg), `accent on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      // A hovered or selected row (the ink-tinted fills of foundations.css) on the frame or the page card: its small print still reads.
      const fill = (name: string) => Number(block.match(new RegExp(`--fill-${name}: color-mix\\(in srgb, var\\(--ink\\) (\\d+)%, transparent\\);`))![1]) / 100;
      expect(fill('hover')).toBeLessThan(fill('press'));
      expect(fill('press')).toBeLessThan(fill('selected'));
      for (const paper of [look.shell, look.card]) {
        for (const strength of [fill('hover'), fill('selected')]) {
          const row = mix(paper, look.ink, strength);
          expect(contrast(over(v['--ink-2'], row), row), `ink-2 on a ${strength} row on ${paper}`).toBeGreaterThanOrEqual(4.5);
          expect(contrast(over(v['--ink-3'], row), row), `ink-3 on a ${strength} row on ${paper}`).toBeGreaterThanOrEqual(4.5);
        }
        // And the selected row can be told from the paper it lies on.
        expect(contrast(mix(paper, look.ink, fill('selected')), paper)).toBeGreaterThanOrEqual(1.25);
      }
      // Four ink levels, each fainter than the last; the hairline comes from the ink.
      const strength = (name: string) => Number(v[name].match(/[\d.]+\)$/)![0].slice(0, -1));
      expect(strength('--ink-2')).toBeLessThan(1);
      expect(strength('--ink-3')).toBeLessThan(strength('--ink-2'));
      expect(strength('--ink-4')).toBeLessThan(strength('--ink-3'));
      expect(v['--line']).toBe(systemDark ? 'rgba(230,238,240,0.12)' : 'rgba(20,33,31,0.1)');
      expect(contrast(look.accentInk, look.accent)).toBeGreaterThanOrEqual(4.5);
    }
    // No warm creams left in what the window is painted with.
    const all = JSON.stringify([themeVars(DEFAULT_THEME, s.settings, false), themeVars(DEFAULT_THEME, s.settings, true)]);
    expect(all).not.toMatch(/f4f1ec|1e1c1a|f1efea|40,30,20|60,40,20/);
    // Names older rules still use are aliases in the stylesheet, so they are not set inline (inline would beat the tokens).
    const v = themeVars(DEFAULT_THEME, s.settings, false);
    for (const name of ['--hover', '--active', '--overlay', '--shadow', '--blur']) {
      expect(v[name], name).toBeUndefined();
      expect(foundations).toMatch(new RegExp(`${name}: (var\\(--[a-z0-9-]+\\)|0px);`));
    }
  });

  it('the label on an accent-filled button always reads (4.5:1), whatever colour the Space picked', () => {
    const s = fresh();
    const picks = [...SWATCH_ROWS.flatMap((r) => r.colors.map((c) => pairFromColor(c))), ...[0, 40, 80, 120, 160, 200, 240, 280, 320].map((h) => pairFromHue(h, 0.9)), ...[0, 1, 2, 3, 4, 5, 6].map((i) => defaultTheme(i).colors)];
    for (const colors of picks) {
      for (const mode of ['light', 'dark'] as const) {
        for (const intensity of [0, 0.2, 0.6, 1]) {
          const v = themeVars({ colors, mode, intensity, grain: false }, s.settings, false);
          expect(contrast(v['--accent-ink'], v['--accent']), `${colors} ${mode} ${intensity}`).toBeGreaterThanOrEqual(4.5);
          expect(contrast(v['--accent'], v['--chrome-mid']), `${colors} ${mode} ${intensity} accent`).toBeGreaterThanOrEqual(3);
          expect(contrast(over(v['--ink-3'], v['--chrome-mid']), v['--chrome-mid']), `${colors} ${mode} ${intensity} ink-3`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('keeps only the four fields: extras from older versions and bad values are dropped', () => {
    const fb = DEFAULT_THEME;
    const t = sanitizeTheme({ colors: ['#ABCDEF', '#123456'], mode: 'dark', intensity: 7, grain: 'yes' as never, gradient: { kind: 'mesh' }, motion: { kind: 'drift' }, image: { id: 'x' } } as never, fb);
    expect(t).toEqual({ colors: ['#abcdef', '#123456'], mode: 'dark', intensity: 1, grain: false });
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
    expect(s.spaces[0].theme).toEqual({ colors: ['#ffeedd', '#001122'], mode: DEFAULT_THEME.mode, intensity: 1, grain: false });
  });

  it('paints the window from the Space\'s colours: the first tints the frame, one flat tint, stronger with intensity; the second is the accent', () => {
    const s = fresh();
    const v = themeVars({ colors: ['#f2c9a0', '#e58f65'], mode: 'light', intensity: 0.55, grain: true }, s.settings, false);
    expect(v['--card']).toBe(CALM_AIR.light.card);
    expect(v['--ink']).toBe(CALM_AIR.light.ink);
    // A plain colour is one tint, never a gradient; the page card and the text do not change with it.
    expect(v['--backdrop']).toMatch(hex);
    expect(v['--backdrop']).toBe(v['--chrome-mid']);
    expect(v['--tint-1']).toBe('#f2c9a0');
    expect(v['--tint-2']).toBe('#e58f65');
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(v['--backdrop'].slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(b); // the frame took the Space's warm hue
    expect(g).toBeGreaterThan(b);
    const faint = themeVars({ colors: ['#f2c9a0', '#e58f65'], mode: 'light', intensity: 0, grain: true }, s.settings, false);
    expect(contrast(faint['--backdrop'], '#ffffff')).toBeLessThan(contrast(v['--backdrop'], '#ffffff'));
    // San Francisco on a Mac; the bundled Figtree everywhere else.
    expect(v['--font']).toMatch(/^-apple-system, .*'Figtree'/);
    expect(v['--grain-opacity']).toBe('.16');
    const dark = themeVars({ colors: ['#f2c9a0', '#e58f65'], mode: 'dark', intensity: 0.55, grain: false }, s.settings, false);
    expect(dark['--card']).toBe(CALM_AIR.dark.card);
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
          expect(r.accent, `${row.id} ${c} ${mode} accent`).toBeGreaterThanOrEqual(3);
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

describe('your own gradient and picture; the new default for everyone', () => {
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

  it('every Space of a file from before theme versions moves to the default once; after that its theme is left alone', () => {
    const old = createInitialState();
    delete (old.settings as { themeVersion?: number }).themeVersion;
    old.spaces[0].theme = { colors: ['#cfe4ff', '#4a7fe0'], mode: 'light', intensity: 0.5, grain: false };
    const once = loadState(JSON.parse(JSON.stringify(old)));
    expect(once.spaces[0].theme).toEqual(DEFAULT_THEME);
    expect(once.settings.themeVersion).toBe(THEME_VERSION);
    once.spaces[0].theme = { colors: ['#cfe4ff', '#4a7fe0'], mode: 'light', intensity: 0.5, grain: false };
    expect(loadState(JSON.parse(JSON.stringify(once))).spaces[0].theme.mode).toBe('light');
  });

  it('moving to Calm Air: a Space still on the previous default moves to it in its own hue', () => {
    // What Kite saved before Calm Air: theme version 2, the first Space on "Quiet", the second on Quiet in the second Space's hue.
    const quiet = { colors: ['#7b82a8', '#8f8cff'], mode: 'dark', intensity: 0.2, grain: false } as const;
    const old = createInitialState();
    old.settings.themeVersion = 2;
    old.spaces[0].theme = { ...quiet, colors: [...quiet.colors] };
    old.spaces.push({ ...old.spaces[0], id: 'space-two', name: 'Work', theme: { ...quiet, colors: ['#7ba89a', '#8cffef'] } });
    const s = loadState(JSON.parse(JSON.stringify(old)));
    expect(s.spaces[0].theme).toEqual(DEFAULT_THEME);
    expect(s.spaces[1].theme).toEqual(defaultTheme(1));
    expect(s.settings.themeVersion).toBe(THEME_VERSION);
    // The hue goes with the Space, not with where it now is in the list.
    expect(migrateTheme({ ...quiet, colors: ['#7ba89a', '#8cffef'] }, 2, 0)).toEqual(defaultTheme(1));
    expect(migrateTheme({ ...quiet, colors: ['#a87b95', '#ff8cb9'] }, 2, 5)).toEqual(defaultTheme(2));
  });

  it('moving to Calm Air: a Space you changed in any way is left exactly as it was', () => {
    const quiet = { colors: ['#7b82a8', '#8f8cff'] as [string, string], mode: 'dark' as const, intensity: 0.2, grain: false };
    const changed = [
      { ...quiet, mode: 'light' as const },
      { ...quiet, intensity: 0.35 },
      { ...quiet, grain: true },
      { ...quiet, colors: ['#7b82a8', '#ff8a4c'] as [string, string] },
      { ...quiet, pattern: 'dots' as const },
      { ...quiet, backdrop: 'dawn' as const },
      { ...quiet, gradient: { colors: ['#101020', '#5050a0'], angle: 90 } },
      { colors: ['#2d4468', '#1f3a7a'] as [string, string], mode: 'dark' as const, intensity: 0.6, grain: false },
    ];
    for (const theme of changed) {
      const old = createInitialState();
      old.settings.themeVersion = 2;
      old.spaces[0].theme = theme;
      const s = loadState(JSON.parse(JSON.stringify(old)));
      expect(s.spaces[0].theme, JSON.stringify(theme)).toEqual(theme);
      expect(s.settings.themeVersion).toBe(THEME_VERSION);
    }
    // Already on this version: nothing moves, even a theme that looks like the old default.
    expect(migrateTheme(quiet, THEME_VERSION, 0)).toBe(quiet);
  });

  it('text on the chrome stays readable on the default and every new Space hue, in both modes', () => {
    const s = fresh();
    for (let i = 0; i < 7; i++) {
      const theme = defaultTheme(i);
      for (const systemDark of [false, true]) {
        const v = themeVars(theme, s.settings, systemDark);
        expect(v['--backdrop']).toMatch(hex); // one flat tint
        expect(readability(theme, s.settings, systemDark).text, `space ${i}`).toBeGreaterThanOrEqual(4.5);
        expect(readability(theme, s.settings, systemDark).accent, `space ${i} accent`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('Theme presets and patterns', () => {
  it('offers seven presets, the default (Calm Air) first; picking one sets its gradient, accent, mode and pattern in one go', () => {
    expect(THEME_PRESETS.map((p) => p.id)).toEqual(['quiet', 'tide', 'ember', 'forest', 'rosewood', 'graphite', 'dawn']);
    let s = fresh();
    const id = s.spaces[0].id;
    // A new Kite is already on the first preset, Calm Air (its id is from the look it replaced): no pattern, no grain.
    expect(THEME_PRESETS[0].name).toBe('Calm Air');
    expect(presetOf(s.spaces[0].theme)).toBe('quiet');
    expect(s.spaces[0].theme.pattern).toBeUndefined();
    for (const p of THEME_PRESETS) {
      [s] = run(s, (d) => setSpaceTheme(d, id, presetPatch(p.id)));
      const t = s.spaces[0].theme;
      expect(t).toMatchObject({ mode: p.mode, intensity: p.intensity, colors: [p.gradient ? p.gradient.colors[0] : p.base, p.accent] });
      expect(t.gradient).toEqual(p.gradient);
      expect(t.pattern).toBe(p.pattern);
      expect(t.backdrop).toBeUndefined();
      expect(presetOf(t)).toBe(p.id);
      // Every preset stays readable at the default intensity.
      expect(readability(t, s.settings, false).ok, p.id).toBe(true);
    }
    expect(presetPatch('nope')).toEqual({});
    // Changing a colour by hand leaves the preset.
    [s] = run(s, (d) => setSpaceTheme(d, id, { ...PLAIN, colors: ['#112233', '#445566'] }));
    expect(presetOf(s.spaces[0].theme)).toBeNull();
  });

  it('keeps a valid pattern and its strength, and drops anything else', () => {
    const fb = DEFAULT_THEME;
    expect(PATTERNS.map((p) => p.id)).toEqual(['glow', 'dots', 'grid', 'lines', 'rings']);
    expect(sanitizeTheme({ ...fb, pattern: 'dots', patternStrength: 4 }, fb)).toMatchObject({ pattern: 'dots', patternStrength: 1 });
    const bad = sanitizeTheme({ ...fb, pattern: 'zebra' as never, patternStrength: 0.4 }, fb);
    expect(bad.pattern).toBeUndefined();
    expect(bad.patternStrength).toBeUndefined();
    // A pattern stays when the background changes to a picture or plain colours.
    let s = fresh();
    const id = s.spaces[0].id;
    [s] = run(s, (d) => setSpaceTheme(d, id, { pattern: 'grid', patternStrength: 0.8 }));
    [s] = run(s, (d) => setSpaceTheme(d, id, { ...PLAIN, colors: ['#aabbcc', '#223344'] }));
    expect(s.spaces[0].theme).toMatchObject({ pattern: 'grid', patternStrength: 0.8 });
    // Turning it off removes both fields.
    [s] = run(s, (d) => setSpaceTheme(d, id, { pattern: undefined, patternStrength: undefined }));
    expect(s.spaces[0].theme.pattern).toBeUndefined();
    expect(s.spaces[0].theme.patternStrength).toBeUndefined();
  });

  it('draws each pattern as CSS layers with one size per layer, light marks on dark and dark on light', () => {
    expect(patternCss(undefined, true)).toEqual({ image: 'none', size: 'auto' });
    for (const p of PATTERNS) {
      const d = patternCss(p.id, true);
      const l = patternCss(p.id, false);
      expect(d.image).toContain('255,255,255');
      expect(l.image).toContain('20,33,31'); // the ink, never a warm brown
      const layers = d.image.split(/,\s*(?=(?:repeating-)?(?:linear|radial)-gradient)/).length;
      expect(d.size.split(',').length, p.id).toBe(layers);
      // Stronger means more visible, never past the cap.
      const a = (css: string) => Math.max(...[...css.matchAll(/,([\d.]+)\)/g)].map((m) => Number(m[1])));
      expect(a(patternCss(p.id, true, 1).image)).toBeGreaterThan(a(patternCss(p.id, true, 0.2).image));
      expect(a(patternCss(p.id, true, 1).image)).toBeLessThanOrEqual(0.6);
    }
    const v = themeVars({ ...DEFAULT_THEME, pattern: 'dots' }, fresh().settings, false);
    expect(v['--pattern']).toContain('radial-gradient');
    expect(v['--pattern-size']).toBe('18px 18px');
    expect(themeVars(DEFAULT_THEME, fresh().settings, false)['--pattern']).toBe('none');
  });
});
