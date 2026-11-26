import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const R = '/Users/apple/Personal/MArc/src';
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(tsx?|html)$/.test(f)) files.push(p); } })(R);
const classes = JSON.parse(readFileSync('classes.json', 'utf8'));
// Collect className contexts: multi-line aware — take text of className=... up to closing
const ctxByFile = {};
for (const f of files) {
  const t = readFileSync(f, 'utf8');
  const chunks = [];
  for (const m of t.matchAll(/class(?:Name)?\s*[=:]\s*(\{[^}]*(?:\{[^}]*\}[^}]*)*\}|"[^"]*"|'[^']*')/g)) chunks.push(m[1]);
  for (const m of t.matchAll(/(?:classList\.(?:add|remove|toggle|contains)|className\s*=|cls\s*=|querySelector(?:All)?|closest|matches)\(?\s*([^;\n]*)/g)) chunks.push(m[1]);
  // any string literal that looks like a class list passed as prop e.g. cls="x", className prop passing
  for (const m of t.matchAll(/\b(?:cls|klass|cn|className|class|extraClass|wrapClass)\w*\s*[:=?]\s*([^;\n]*)/gi)) chunks.push(m[1]);
  ctxByFile[f.replace(R + '/', '')] = chunks.join('\n');
}
const res = {};
const noCtx = [];
for (const [c, v] of Object.entries(classes)) {
  const re = new RegExp(`(?<![\\w-])${c}(?![\\w-])`);
  const users = Object.entries(ctxByFile).filter(([, t]) => re.test(t)).map(([f]) => f);
  res[c] = { lines: v.lines, users, loose: v.users };
  if (!users.length) noCtx.push(c);
}
writeFileSync('classes2.json', JSON.stringify(res));
for (const c of noCtx) console.log(c, '| css lines', res[c].lines.join(','), '| loose:', res[c].loose.join(' '));
