import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const R = '/Users/apple/Personal/MArc/src';
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(tsx?|html)$/.test(f)) files.push(p); } })(R);
const classes = JSON.parse(readFileSync('classes.json', 'utf8'));
// tokens appearing inside string literals on lines mentioning className/class/classList, plus any string literal tokens anywhere (strict token = whole space-separated word inside quotes)
const strict = {}; // class -> Set(files) where token is in a quoted string on a className-ish line
const anyStr = {};
for (const f of files) {
  const rel = f.replace(R + '/', '');
  const t = readFileSync(f, 'utf8');
  const lines = t.split('\n');
  lines.forEach((ln, i) => {
    const classy = /class(Name|List)?\b|cls\b/.test(ln) || /class(Name)?=\{?$/.test(lines[i - 1] ?? '');
    for (const m of ln.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) {
      const toks = m[2].replace(/\$\{[^}]*\}/g, ' ').split(/[\s]+/);
      for (const tk of toks) { if (!tk) continue; (anyStr[tk] ??= new Set()).add(rel); if (classy) (strict[tk] ??= new Set()).add(rel); }
      // nested quotes inside template expressions
      for (const mm of m[2].matchAll(/['"]([\w -]+)['"]/g)) for (const tk of mm[1].split(/\s+/)) { (anyStr[tk] ??= new Set()).add(rel); if (classy) (strict[tk] ??= new Set()).add(rel); }
    }
  });
}
const out = {};
for (const [c, v] of Object.entries(classes)) out[c] = { lines: v.lines, strict: [...(strict[c] ?? [])], any: [...(anyStr[c] ?? [])], loose: v.users };
writeFileSync('classes3.json', JSON.stringify(out));
for (const [c, v] of Object.entries(out)) if (!v.strict.length) console.log(c, '| css', v.lines.slice(0, 6).join(','), '| anyStr:', v.any.join(' '), '| loose:', v.loose.slice(0, 4).join(' '));
