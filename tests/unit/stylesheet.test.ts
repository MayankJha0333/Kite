import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// The stylesheet is one file per surface (see the header of app.css, which only sets the
// order). A file with an unclosed comment or brace fails silently in the browser: every
// rule after it is ignored. This catches that before anyone has to spot it on screen.
const dir = resolve(__dirname, '../../src/renderer/styles');
const read = (name: string) => readFileSync(resolve(dir, name), 'utf8');
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const entry = read('app.css');
const imported = [...strip(entry).matchAll(/@import\s+'\.\/([\w-]+\.css)';/g)].map((m) => m[1]);
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.css') && f !== 'app.css')
  .sort();

describe('app.css', () => {
  it('only lists the surface files, each one once, and none is left out', () => {
    expect(strip(entry).replace(/@import\s+'\.\/[\w-]+\.css';/g, '').trim()).toBe('');
    expect([...imported].sort()).toEqual(files);
    expect(new Set(imported).size).toBe(imported.length);
    // Shared styles first, Reduce Motion last (see the header of app.css).
    expect(imported.slice(0, 2)).toEqual(['foundations.css', 'controls.css']);
    expect(imported.at(-1)).toBe('motion.css');
  });

  for (const name of ['app.css', ...files]) {
    it(`${name} has every comment and block closed`, () => {
      const css = read(name);
      expect(css.split('/*').length).toBe(css.split('*/').length);
      const code = strip(css);
      expect(code).not.toMatch(/\/\*|\*\//);
      let depth = 0;
      for (const ch of code) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
        expect(depth).toBeGreaterThanOrEqual(0);
      }
      expect(depth).toBe(0);
    });
  }

  // Keyframes are global: a surface may use one that foundations.css defines.
  const all = imported.map((name) => strip(read(name))).join('\n');
  it('names only keyframes that some file defines, and defines each once', () => {
    const names = [...all.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)].map((m) => m[1]);
    const defined = new Set(names);
    expect(names.length).toBe(defined.size);
    for (const m of all.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)) {
      for (const part of m[1].split(',')) {
        const name = part.trim().split(/\s+/).find((w) => /^[a-z][\w-]*$/i.test(w) && !/^(none|infinite|alternate|ease|ease-in|ease-out|ease-in-out|linear|both|forwards|backwards|reverse|normal|running|paused|var|calc)$/.test(w) && !w.startsWith('var'));
        if (name && !/^(calc|var)\b/.test(name)) expect(defined, `animation "${name}"`).toContain(name);
      }
    }
  });
});

// What foundations.css promises every other surface.
describe('foundations.css', () => {
  const css = strip(read('foundations.css'));
  const rule = (selector: string) => {
    const at = css.indexOf(`${selector} {`);
    expect(at, selector).toBeGreaterThanOrEqual(0);
    return css.slice(at, css.indexOf('}', at));
  };

  it('keeps the keyboard focus ring one real outline in the accent, for the keyboard only', () => {
    const rings = [...css.matchAll(/([^{}]*):focus-visible\s*\{([^}]*)\}/g)];
    expect(rings).toHaveLength(1);
    expect(rings[0][2]).toMatch(/outline:\s*2px solid var\(--accent\)/);
    expect(rings[0][2]).toMatch(/outline-offset:\s*2px/);
    expect(css).not.toMatch(/:focus\s*[{,]/);
  });

  it('sidebar rows are 28, 32 or 36px tall with the density setting', () => {
    expect(css).toMatch(/--row-h:\s*32px/);
    expect(rule(".app[data-density='compact']")).toMatch(/--row-h:\s*28px/);
    expect(rule(".app[data-density='roomy']")).toMatch(/--row-h:\s*36px/);
  });

  it('moves things one way: no ease-in, nothing from nothing, no blur, a short rise', () => {
    const frames = [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^}]*\})*)\s*\}/g)];
    expect(frames.map((m) => m[1])).toEqual(expect.arrayContaining(['arrive', 'leave', 'fade-in', 'fade-out', 'thread-run']));
    for (const [, name, body] of frames) {
      expect(body, name).not.toMatch(/scale\(0\)|blur\(|width|height|margin|padding|top|left/);
      for (const m of body.matchAll(/translateY\((-?[\d.]+)px\)/g)) expect(Math.abs(Number(m[1])), name).toBeLessThanOrEqual(4);
    }
    // No rule in the two shared files eases in (the --ease-in name is an alias of ease-out until its last use elsewhere is gone).
    for (const file of ['foundations.css', 'motion.css']) {
      const code = strip(read(file)).replace(/--ease-in-out|ease-in-out|--ease-in:\s*var\(--ease-out\)/g, '');
      expect(code, file).not.toMatch(/ease-in/);
      expect(code, file).not.toMatch(/transition:\s*all/);
    }
  });

  it('Reduce Motion: sheets and pages are exactly a 140ms fade, for Kite\'s switch and for the system setting', () => {
    const motion = strip(read('motion.css'));
    const fades = [...motion.matchAll(/:is\(([^)]*)\)\s*\{\s*animation:\s*fade-in 140ms ease-out !important;/g)];
    expect(fades).toHaveLength(2);
    for (const f of fades) expect(f[1]).toContain('.sheet, .kite-page');
    expect(fades[0][1]).toBe(fades[1][1]);
    // The string stands still in both.
    expect([...motion.matchAll(/\.thread\[data-busy\]::after\s*\{\s*animation:\s*none !important;/g)]).toHaveLength(2);
  });

  it('the contour field is one still drawing: lines only, used as a mask in the theme\'s ink', () => {
    const svg = readFileSync(resolve(dir, '../assets/contour-field.svg'), 'utf8');
    expect(svg).toContain('viewBox="0 0 1600 1000"');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('non-scaling-stroke');
    expect(svg).not.toMatch(/<text|<animate|<image|<script|fill="#/);
    const field = rule('.contour-field');
    expect(field).toMatch(/mask-image:\s*url\('\.\.\/assets\/contour-field\.svg'\)/);
    expect(field).toMatch(/background-color:\s*var\(--contour\)/);
    expect(field).toMatch(/pointer-events:\s*none/);
    expect(field).not.toMatch(/animation|transition/);
  });

  it('paints nothing in the warm creams and browns of the old look', () => {
    for (const file of ['foundations.css', 'motion.css']) expect(read(file), file).not.toMatch(/f4f1ec|1e1c1a|f1efea|f3efe9|40,\s*30,\s*20|60,\s*40,\s*20|241,\s*239,\s*234/i);
  });
});

