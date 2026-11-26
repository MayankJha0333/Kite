import { describe, expect, it } from 'vitest';
import { clearHistory, exportBackup, readBackup, resetAppearance, resetShortcuts, setShortcut, shortcutConflict, updateSettings } from '@shared/settings';
import { DEFAULT_SHORTCUTS } from '@shared/defaults';
import { newTab } from '@shared/ops';
import { themeVars, contrast, mix } from '../../src/renderer/theme';
import { fresh, run, T0 } from './helpers';

describe('settings', () => {
  it('keeps numbers within limits and rejects bad search templates', () => {
    let s = fresh();
    [s] = run(s, (d) => updateSettings(d, { sidebarWidth: 9999, fontScale: 0.1, radius: -4, gap: 12.6, favoritesColumns: 10 }));
    expect(s.settings).toMatchObject({ sidebarWidth: 440, fontScale: 0.85, radius: 0, gap: 13, favoritesColumns: 6 });
    [s] = run(s, (d) => updateSettings(d, { sidebarWidth: NaN }));
    expect(s.settings.sidebarWidth).toBe(264);
    const before = s.settings.searchEngine;
    [s] = run(s, (d) => updateSettings(d, { searchEngine: 'https://no-placeholder.com' }));
    expect(s.settings.searchEngine).toBe(before);
    [s] = run(s, (d) => updateSettings(d, { searchEngine: 'javascript:%s' }));
    expect(s.settings.searchEngine).toBe(before);
    [s] = run(s, (d) => updateSettings(d, { searchEngine: 'https://search.example/?q=%s' }));
    expect(s.settings.searchEngine).toBe('https://search.example/?q=%s');
  });

  it('reset appearance keeps other choices', () => {
    let s = fresh();
    [s] = run(s, (d) => updateSettings(d, { sidebarSide: 'right', radius: 2, archiveAfterMs: null }));
    [s] = run(s, (d) => resetAppearance(d));
    expect(s.settings).toMatchObject({ sidebarSide: 'left', radius: 12, archiveAfterMs: null });
  });
});

describe('shortcuts', () => {
  it('detects conflicts and moves a shortcut from the other action', () => {
    let s = fresh();
    expect(shortcutConflict(s, 'newNote', 'mod+t')).toBe('commandBar');
    let cleared: string | null;
    [s, cleared] = run(s, (d) => setShortcut(d, 'newNote', 'mod+t'));
    expect(cleared).toBe('commandBar');
    expect(s.settings.shortcuts).toMatchObject({ newNote: 'mod+t', commandBar: '' });
  });

  it('the little window shortcut is also the global hotkey', () => {
    let s = fresh();
    [s] = run(s, (d) => setShortcut(d, 'littleWindow', 'mod+shift+l'));
    expect(s.settings.littleHotkey).toBe('mod+shift+l');
  });

  it('resets one or all', () => {
    let s = fresh();
    [s] = run(s, (d) => setShortcut(d, 'newNote', 'mod+t'));
    [s] = run(s, (d) => resetShortcuts(d, 'commandBar'));
    expect(s.settings.shortcuts.commandBar).toBe('mod+t');
    expect(s.settings.shortcuts.newNote).toBe(''); // gave its keys back
    [s] = run(s, (d) => resetShortcuts(d));
    expect(s.settings.shortcuts).toEqual(DEFAULT_SHORTCUTS);
  });
});

describe('backup', () => {
  it('round-trips everything and rejects other files', () => {
    let s = fresh();
    [s] = run(s, (d) => newTab(d, { url: 'https://a.com', now: T0 }));
    const back = readBackup(exportBackup(s));
    expect(back.state.items).toEqual(s.items);
    expect(back.state.spaces).toEqual(s.spaces);
    expect(back).toMatchObject({ spaces: 1, tabs: 1, notes: 0, boosts: 0, scriptsRemoved: 0 });
    expect(() => readBackup('{"kind":"other"}')).toThrow(/isn’t a Kite backup/);
    expect(() => readBackup('garbage')).toThrow(/isn’t a Kite backup/);
    expect(() => readBackup('{"kind":"kite-backup","state":null}')).toThrow(/isn’t a Kite backup/);
    expect(() => readBackup('{"kind":"kite-backup","state":{"hello":1}}')).toThrow(/damaged or empty/);
  });

  it('restoring never brings Boost scripts in', () => {
    let s = fresh();
    [s] = run(s, (d) => {
      d.boosts.push({ id: 'b', name: 'x', domain: 'bank.example', enabled: true, css: 'p{}', js: 'steal()', zaps: [], createdAt: 0, updatedAt: 0 });
    });
    const back = readBackup(exportBackup(s));
    expect(back.scriptsRemoved).toBe(1);
    expect(back.state.boosts[0]).toMatchObject({ css: 'p{}', js: '' });
  });

  it('clears history', () => {
    let s = fresh();
    [s] = run(s, (d) => newTab(d, { url: 'https://a.com', now: T0 }));
    expect(s.history).toHaveLength(1);
    [s] = run(s, (d) => clearHistory(d));
    expect(s.history).toEqual([]);
  });
});

describe('theme colors', () => {
  it('accent stays readable on the sidebar for every preset, light and dark', () => {
    const s = fresh();
    for (const colors of [['#f2c9a0', '#e58f65'], ['#fbe38e', '#f29e4c'], ['#3a4256', '#141824'], ['#ffffff', '#ffffff']] as [string, string][]) {
      for (const mode of ['light', 'dark'] as const) {
        const v = themeVars({ colors, mode, intensity: 0.55, grain: true }, s.settings, false);
        expect(contrast(v['--accent'], v['--chrome-mid'])).toBeGreaterThanOrEqual(3);
      }
    }
  });
  it('mixes colors', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('motion feel', () => {
  /** The furthest a CSS easing travels (1 = its resting place; above 1 it overshoots). */
  const peak = (ease: string) => {
    const n = ease.match(/-?[\d.]+/g)!.map(Number);
    if (ease.startsWith('linear(')) return Math.max(...n);
    // cubic-bezier(x1, y1, x2, y2): sample the curve's y.
    const [, y1, , y2] = n;
    return Math.max(...Array.from({ length: 101 }, (_, i) => i / 100).map((u) => 3 * (1 - u) ** 2 * u * y1 + 3 * (1 - u) * u ** 2 * y2 + u ** 3));
  };

  it('no feel sends a sheet, a menu or the sidebar past its resting place; the bounce of Bouncy and Spring is in the press only', () => {
    const s = fresh();
    const vars = (motionFeel: typeof s.settings.motionFeel, motionSpeed = 1) => themeVars(s.spaces[0].theme, { ...s.settings, motionFeel, motionSpeed }, false);
    for (const feel of ['style', 'smooth', 'snappy', 'bouncy', 'spring'] as const) {
      expect(peak(vars(feel)['--ease']), feel).toBeLessThanOrEqual(1.005);
      expect(parseInt(vars(feel)['--dur'])).toBeLessThanOrEqual(400);
    }
    for (const feel of ['style', 'smooth', 'snappy'] as const) expect(peak(vars(feel)['--press-ease']), feel).toBeLessThanOrEqual(1);
    for (const feel of ['bouncy', 'spring'] as const) expect(peak(vars(feel)['--press-ease']), feel).toBeGreaterThan(1.02);
    // The default is the stylesheet's own ease-out, and the speed setting divides every length.
    expect(vars('style')).toMatchObject({ '--ease': 'cubic-bezier(0.23, 1, 0.32, 1)', '--dur': '220ms', '--speed': '1', '--press-dur': '120ms' });
    expect(vars('style', 2)).toMatchObject({ '--dur': '110ms', '--speed': '0.5', '--press-dur': '60ms' });
    expect(vars('bouncy', 2)['--dur']).toBe('160ms');
  });
});
