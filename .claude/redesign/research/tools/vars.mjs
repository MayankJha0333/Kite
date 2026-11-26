import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const decls = JSON.parse(readFileSync('decls.json', 'utf8'));
const kf = JSON.parse(readFileSync('keyframes.json', 'utf8'));
const css = readFileSync('/Users/apple/Personal/MArc/src/renderer/styles/app.css', 'utf8');
const R = '/Users/apple/Personal/MArc/src';
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(tsx?)$/.test(f)) files.push(p); } })(R);
const defs = {};
for (const d of decls) if (d.prop.startsWith('--')) (defs[d.prop] ??= []).push(`${d.line} [${d.sel}${d.ctx ? ' @' + d.ctx : ''}] = ${d.value.slice(0, 90)}`);
const uses = {};
const fallbacks = {};
for (const d of decls) for (const m of d.value.matchAll(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g)) { (uses[m[1]] ??= []).push(d.line); if (m[2]) ((fallbacks[m[1]] ??= {})[m[2].trim()] ??= []).push(d.line); }
for (const k of kf) for (const m of k.body.matchAll(/var\(\s*(--[\w-]+)/g)) (uses[m[1]] ??= []).push(k.line);
// TS side
const tsDefs = {}; const tsUses = {};
for (const f of files) { const t = readFileSync(f, 'utf8'); const rel = f.replace(R + '/', ''); t.split('\n').forEach((ln, i) => { for (const m of ln.matchAll(/['"`](--[\w-]+)['"`]\s*[:\]]/g)) (tsDefs[m[1]] ??= []).push(`${rel}:${i + 1}`); for (const m of ln.matchAll(/var\(\s*(--[\w-]+)/g)) (tsUses[m[1]] ??= []).push(`${rel}:${i + 1}`); for (const m of ln.matchAll(/setProperty\(\s*['"`](--[\w-]+)/g)) (tsDefs[m[1]] ??= []).push(`${rel}:${i + 1} setProperty`); }); }
console.log('=== CSS-defined custom properties');
for (const [k, v] of Object.entries(defs)) console.log(k, '\n   ' + v.join('\n   '), '\n   uses(css):', (uses[k] ?? []).length, ' uses(ts):', (tsUses[k] ?? []).length);
console.log('\n=== TS-defined custom properties (object keys / setProperty)');
for (const [k, v] of Object.entries(tsDefs)) console.log(k, '|', v.join(' '), '| cssUses', (uses[k] ?? []).length, 'tsUses', (tsUses[k] ?? []).length);
console.log('\n=== used in CSS but never defined in CSS');
for (const k of Object.keys(uses)) if (!defs[k]) console.log(k, 'uses', uses[k].length, tsDefs[k] ? '(TS: ' + tsDefs[k][0] + ')' : '!!! UNDEFINED', uses[k].slice(0, 12).join(','));
console.log('\n=== fallbacks');
for (const [k, v] of Object.entries(fallbacks)) console.log(k, Object.entries(v).map(([f, l]) => `"${f}"×${l.length}`).join('  '));
console.log('\n=== TS var() uses'); for (const [k, v] of Object.entries(tsUses)) console.log(k, v.length, v.slice(0, 5).join(' '));
console.log('\n=== scale vars usage'); for (const p of ['--gray-', '--gray-a', '--indigo-']) { const n = Object.keys(uses).filter((k) => k.startsWith(p) && (p !== '--gray-' || !k.startsWith('--gray-a'))); console.log(p, n.map((k) => k + '×' + uses[k].length).join(' ')); }
