import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const R = '/Users/apple/Personal/MArc/src';
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(tsx?|html)$/.test(f)) files.push(p); } })(R);
const classes = JSON.parse(readFileSync('classes.json', 'utf8'));
const attr = {}; const other = {};
const add = (m, k, f) => (m[k] ??= new Set()).add(f);
for (const f of files) {
  const rel = f.replace(R + '/', '');
  const t = readFileSync(f, 'utf8');
  // className attribute values
  const re = /className\s*[=:]\s*/g; let m;
  while ((m = re.exec(t))) {
    let i = re.lastIndex; let val = '';
    const ch = t[i];
    if (ch === '"' || ch === "'") { const j = t.indexOf(ch, i + 1); val = t.slice(i + 1, j); }
    else if (ch === '{') { let d = 0; let j = i; for (; j < t.length; j++) { if (t[j] === '{') d++; if (t[j] === '}') { d--; if (!d) break; } } val = t.slice(i + 1, j); }
    else if (ch === '`') { const j = t.indexOf('`', i + 1); val = t.slice(i + 1, j); }
    else { const j = t.indexOf('\n', i); val = t.slice(i, j); }
    for (const s of val.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) for (const tk of s[2].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) if (tk) add(attr, tk, rel);
    if (ch === '"' || ch === "'") for (const tk of val.split(/\s+/)) if (tk) add(attr, tk, rel);
    // nested string literals inside template expressions
    for (const s of val.matchAll(/['"]([\w -]+)['"]/g)) for (const tk of s[1].split(/\s+/)) if (tk) add(attr, tk, rel);
  }
  for (const s of t.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) for (const tk of s[2].replace(/\$\{[^}]*\}/g, ' ').split(/[\s.]+/)) if (tk) add(other, tk.replace(/^[.#]/, ''), rel);
}
const out = {};
for (const [c, v] of Object.entries(classes)) out[c] = { lines: v.lines, attr: [...(attr[c] ?? [])], other: [...(other[c] ?? [])] };
writeFileSync('classes4.json', JSON.stringify(out));
for (const [c, v] of Object.entries(out)) if (!v.attr.length) console.log(c, '| css', v.lines.slice(0, 8).join(','), '| otherStr:', v.other.join(' '));
// reverse: className tokens with no CSS
const noCss = Object.keys(attr).filter((k) => !classes[k] && /^[a-z][\w-]*$/.test(k));
console.log('\nclassName tokens with no CSS rule (' + noCss.length + '):', noCss.join(' '));
