import { themeVars, readability, contrast, FEEL } from '/Users/apple/Personal/MArc/src/renderer/theme';
import { DEFAULT_THEME, THEME_PRESETS, presetPatch, sanitizeTheme, defaultTheme } from '/Users/apple/Personal/MArc/src/shared/spaceTheme';
import { defaultSettings } from '/Users/apple/Personal/MArc/src/shared/defaults';
import { SPRINGS, springDuration } from '/Users/apple/Personal/MArc/src/shared/designTokens';
const s = defaultSettings();
const pick = (v: Record<string, string>) => Object.fromEntries(Object.entries(v).filter(([k]) => !/^--(gray|indigo)-/.test(k)));
console.log('SETTINGS', JSON.stringify({ density: s.density, fontScale: s.fontScale, radius: s.radius, gap: s.gap, sidebarWidth: s.sidebarWidth, sidebarSide: s.sidebarSide, motionFeel: s.motionFeel, motionSpeed: s.motionSpeed, reduceMotion: s.reduceMotion, sounds: s.sounds, soundVolume: s.soundVolume, favoritesColumns: (s as any).favoritesColumns, showUrlBar: (s as any).showUrlBar }));
for (const mode of ['dark', 'light'] as const) {
  const t = { ...DEFAULT_THEME, mode };
  const v = themeVars(t, s, false);
  console.log('\n== DEFAULT (Quiet)', mode);
  for (const [k, val] of Object.entries(pick(v))) console.log(`${k}: ${val.length > 150 ? val.slice(0, 150) + '…' : val}`);
  const cm = v['--chrome-mid'];
  const blend = (fg: string, a: number, bg: string) => { const h = (x: string) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16)); const f = h(fg), b = h(bg); return '#' + f.map((c, i) => Math.round(c * a + b[i] * (1 - a)).toString(16).padStart(2, '0')).join(''); };
  const al = (s: string) => Number(s.match(/,([\d.]+)\)$/)![1]);
  for (const k of ['--ink-2', '--ink-3', '--ink-4']) { const a = al(v[k]); console.log(`  contrast ${k} on chrome-mid: ${contrast(blend(v['--ink'], a, cm), cm).toFixed(2)}  on card: ${contrast(blend(v['--ink'], a, v['--card']), v['--card']).toFixed(2)}`); }
  console.log('  contrast ink/chrome-mid', contrast(v['--ink'], cm).toFixed(2), 'ink/card', contrast(v['--ink'], v['--card']).toFixed(2), 'accent/chrome-mid', contrast(v['--accent'], cm).toFixed(2), 'accent/card', contrast(v['--accent'], v['--card']).toFixed(2), 'accent-ink/accent', contrast(v['--accent-ink'], v['--accent']).toFixed(2));
  console.log('  readability', JSON.stringify(readability(t, s, false)));
}
console.log('\nFEEL', JSON.stringify(Object.fromEntries(Object.entries(FEEL).map(([k, v]) => [k, { ms: v!.ms, ease: v!.ease.slice(0, 60) }]))));
console.log('SPRINGS ms', JSON.stringify(Object.fromEntries(Object.entries(SPRINGS).map(([k, v]) => [k, springDuration(v)]))));
for (const p of THEME_PRESETS) { const t = sanitizeTheme({ ...DEFAULT_THEME, ...presetPatch(p.id) }, DEFAULT_THEME); const v = themeVars(t, s, false); console.log('PRESET', p.id, p.mode, 'a', v['--chrome-a'], 'mid', v['--chrome-mid'], 'b', v['--chrome-b'], 'accent', v['--accent'], 'accent-ink', v['--accent-ink'], 'text', readability(t, s, false).text, 'acc', readability(t, s, false).accent); }
for (let i = 0; i < 7; i++) { const t = defaultTheme(i); const v = themeVars(t, s, false); console.log('SPACE', i, t.colors.join(','), 'mid', v['--chrome-mid'], 'accent', v['--accent']); }
