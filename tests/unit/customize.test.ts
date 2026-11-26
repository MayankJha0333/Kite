import { describe, expect, it } from 'vitest';
import { CORNERS, DENSITIES, FEELS, MARGINS, TEXT_SIZES, cornerOf, customizeDefaults, feelOf, marginOf, textSizeOf } from '@shared/customize';
import { LIMITS, updateSettings } from '@shared/settings';
import { defaultSettings } from '@shared/defaults';
import { ACTION_CATALOG } from '@shared/commandbar';
import { fresh, run } from './helpers';

describe('Customize panel', () => {
  it('offers named steps that all sit inside the limits of the real settings', () => {
    for (const c of CORNERS) expect(c.radius >= LIMITS.radius[0] && c.radius <= LIMITS.radius[1], c.id).toBe(true);
    for (const m of MARGINS) expect(m.gap >= LIMITS.gap[0] && m.gap <= LIMITS.gap[1], m.id).toBe(true);
    for (const t of TEXT_SIZES) expect(t.scale >= LIMITS.fontScale[0] && t.scale <= LIMITS.fontScale[1], t.id).toBe(true);
    expect(DENSITIES.map((d) => d.id)).toEqual(['compact', 'comfortable', 'roomy']);
    expect(FEELS.map((f) => f.id)).toEqual(['style', 'snappy', 'bouncy']);
  });

  it('shows the nearest step for any value, including ones set with the Settings sliders', () => {
    expect(cornerOf(0)).toBe('square');
    expect(cornerOf(10)).toBe('soft');
    expect(cornerOf(17)).toBe('round');
    expect(marginOf(0)).toBe('edge');
    expect(marginOf(6)).toBe('float');
    expect(marginOf(20)).toBe('airy');
    for (const c of CORNERS) expect(cornerOf(c.radius)).toBe(c.id);
    for (const m of MARGINS) expect(marginOf(m.gap)).toBe(m.id);
    for (const t of TEXT_SIZES) expect(textSizeOf(t.scale)).toBe(t.id);
    // A size set with the old slider lands on the nearest step.
    expect(textSizeOf(1.15)).toBe('large');
    expect(textSizeOf(0.85)).toBe('small');
    expect(feelOf('spring')).toBe('style');
    expect(feelOf('bouncy')).toBe('bouncy');
  });

  it('the default look is one of the steps, and Reset goes back to it', () => {
    const d = defaultSettings();
    expect(cornerOf(d.radius)).toBe('soft');
    expect(marginOf(d.gap)).toBe('float');
    expect(textSizeOf(d.fontScale)).toBe('regular');
    let s = fresh();
    [s] = run(s, (x) => updateSettings(x, { radius: 20, gap: 0, density: 'roomy', sidebarSide: 'right', motionFeel: 'bouncy', reduceMotion: true }));
    expect(s.settings).toMatchObject({ radius: 20, gap: 0, density: 'roomy', sidebarSide: 'right' });
    [s] = run(s, (x) => updateSettings(x, customizeDefaults()));
    expect(s.settings).toMatchObject({ radius: d.radius, gap: d.gap, density: d.density, sidebarSide: d.sidebarSide, motionFeel: d.motionFeel, reduceMotion: d.reduceMotion });
  });

  it('can be opened by name from the command bar', () => {
    expect(ACTION_CATALOG.find((a) => a.id === 'customize')?.title).toBe('Customize Kite');
  });
});
