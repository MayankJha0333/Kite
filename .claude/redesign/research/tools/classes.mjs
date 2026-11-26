import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const R = '/Users/apple/Personal/MArc/src';
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(tsx?|html|mjs|cjs|js)$/.test(f)) files.push(p); } })(R);
const src = Object.fromEntries(files.map((f) => [f.replace(R + '/', ''), readFileSync(f, 'utf8')]));
const rules = JSON.parse(readFileSync('rules.json', 'utf8'));
const classes = new Map();
for (const r of rules) for (const m of r.sel.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)) { const c = m[1]; if (!classes.has(c)) classes.set(c, []); classes.get(c).push(r.line); }
const out = {};
const dead = [];
for (const [c, lines] of classes) {
  const re = new RegExp(`(?<![\\w-])${c.replace(/[-]/g, '\\-')}(?![\\w-])`);
  const users = Object.entries(src).filter(([, t]) => re.test(t)).map(([f]) => f);
  out[c] = { lines, users };
  if (!users.length) dead.push(c);
}
writeFileSync('classes.json', JSON.stringify(out));
console.log('classes', classes.size, 'dead candidates', dead.length);
// template-literal prefixes in src
const dyn = new Set();
for (const t of Object.values(src)) for (const m of t.matchAll(/[`'" ]([a-z][\w-]*-)\$\{/g)) dyn.add(m[1]);
console.log('dynamic prefixes:', [...dyn].join(' '));
for (const c of dead) { const pre = [...dyn].find((p) => c.startsWith(p)); console.log(c, out[c].lines.join(','), pre ? `(maybe dynamic via ${pre})` : ''); }
