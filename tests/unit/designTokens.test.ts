import { describe, expect, it } from 'vitest';
import { GRAY, GRAY_ALPHA, INDIGO, HARMONIES, SPRINGS, SWATCHES, hexToHsl, hslToHex, scaleVars, springAt, springDuration, springEasing, wheelColors } from '../../src/shared/designTokens';
import { contrast } from '../../src/renderer/theme';

describe('design tokens', () => {
  it('scales have 12 steps and become CSS variables for light and dark', () => {
    for (const s of [GRAY, GRAY_ALPHA, INDIGO]) expect(s).toHaveLength(12);
    const light = scaleVars(false);
    const dark = scaleVars(true);
    expect(light['--gray-12']).toBe('#171717');
    expect(dark['--gray-12']).toBe('#ededed');
    expect(light['--gray-a3']).toBe('rgba(0,0,0,0.047)');
    expect(dark['--gray-a3']).toBe('rgba(255,255,255,0.056)');
    expect(Object.keys(light)).toHaveLength(36);
  });

  it('text steps of the grey scale are readable on the background steps', () => {
    for (const mode of [0, 1] as const) {
      expect(contrast(GRAY[11][mode], GRAY[0][mode])).toBeGreaterThan(12);
      expect(contrast(GRAY[10][mode], GRAY[1][mode])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('swatches are three rows of nine', () => {
    for (const row of Object.values(SWATCHES)) expect(row).toHaveLength(9);
  });
});

describe('springs', () => {
  it('start at 0, end at rest, and a bouncy spring overshoots while a damped one does not', () => {
    for (const s of Object.values(SPRINGS)) {
      expect(springAt(s, 0)).toBeCloseTo(0, 6);
      expect(Math.abs(springAt(s, springDuration(s) / 1000) - 1)).toBeLessThan(0.005);
    }
    const peak = (s: { response: number; damping: number }) => Math.max(...Array.from({ length: 200 }, (_, i) => springAt(s, i / 200)));
    expect(peak(SPRINGS.press)).toBeGreaterThan(1.05);
    expect(peak({ response: 0.3, damping: 1 })).toBeLessThanOrEqual(1);
  });

  it('settle times are interface-length, and quicker springs settle sooner', () => {
    for (const s of Object.values(SPRINGS)) {
      expect(springDuration(s)).toBeGreaterThan(150);
      expect(springDuration(s)).toBeLessThan(800);
    }
    expect(springDuration({ response: 0.2, damping: 0.8 })).toBeLessThan(springDuration({ response: 0.5, damping: 0.8 }));
  });

  it('becomes a CSS linear() easing that starts at 0 and ends exactly at 1', () => {
    const e = springEasing(SPRINGS.default, 16);
    expect(e).toMatch(/^linear\(0, .*, 1\)$/);
    expect(e.split(',')).toHaveLength(17);
  });
});

describe('colour wheel', () => {
  it('converts between hex and HSL', () => {
    expect(hslToHex(0, 1, 0.5)).toBe('#ff0000');
    expect(hslToHex(240, 1, 0.5)).toBe('#0000ff');
    expect(hslToHex(-120, 1, 0.5)).toBe('#0000ff');
    const [h, s, l] = hexToHsl('#3138f9');
    expect(hslToHex(h, s, l)).toBe('#3138f9');
    expect(hexToHsl('#808080')).toEqual([0, 0, 128 / 255]);
  });

  it('gives a light first colour and a deeper second colour offset round the wheel', () => {
    for (const hm of HARMONIES) {
      const [a, b] = wheelColors(210, hm.offset);
      expect(hexToHsl(a)[2]).toBeGreaterThan(hexToHsl(b)[2]);
      const hueGap = (hexToHsl(b)[0] - hexToHsl(a)[0] + 360) % 360;
      expect(Math.min(hueGap, 360 - hueGap)).toBeCloseTo(Math.min(hm.offset, 360 - hm.offset), -1);
    }
    expect(wheelColors(30, 0, 0)).toEqual([hslToHex(0, 0, 0.86), hslToHex(0, 0, 0.5)]);
  });
});
