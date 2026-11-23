import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// A stylesheet with an unclosed comment or brace fails silently in the browser: every
// rule after it is ignored. This catches that before anyone has to spot it on screen.
describe('app.css', () => {
  const css = readFileSync(resolve(__dirname, '../../src/renderer/styles/app.css'), 'utf8');
  it('has every comment and block closed', () => {
    expect(css.split('/*').length).toBe(css.split('*/').length);
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/\/\*|\*\//);
    let depth = 0;
    for (const ch of code) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
  });
  it('names only keyframes it defines', () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const defined = new Set([...code.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)].map((m) => m[1]));
    for (const m of code.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)) {
      for (const part of m[1].split(',')) {
        const name = part.trim().split(/\s+/).find((w) => /^[a-z][\w-]*$/i.test(w) && !/^(none|infinite|alternate|ease|ease-in|ease-out|ease-in-out|linear|both|forwards|backwards|reverse|normal|running|paused|var|calc)$/.test(w) && !w.startsWith('var'));
        if (name && !/^(calc|var)\b/.test(name)) expect(defined, `animation "${name}"`).toContain(name);
      }
    }
  });
});
