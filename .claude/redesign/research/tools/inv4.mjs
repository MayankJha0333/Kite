import { readFileSync } from 'node:fs';
const decls = JSON.parse(readFileSync('decls.json', 'utf8'));
const want = /^(height|min-height|max-height|width|min-width|padding|padding-(left|right|top|bottom|inline|block)|border-radius|font-size|font-weight|gap|line-height)$/;
const sels = process.argv.slice(2);
// group by (sel,line-of-rule) -> show only base selectors that have height or padding
const bySel = new Map();
for (const d of decls) { if (!want.test(d.prop)) continue; const k = d.sel + (d.ctx ? ' {' + d.ctx + '}' : ''); if (!bySel.has(k)) bySel.set(k, { line: d.line, p: {} }); bySel.get(k).p[d.prop] = d.value.replace(/calc\(([\d.]+px) \* var\(--scale\)\)/, '$1·s'); }
const hs = new Map();
for (const [k, v] of bySel) {
  if (!('height' in v.p || 'min-height' in v.p)) continue;
  const h = v.p.height ?? 'min ' + v.p['min-height'];
  if (!/^(min )?[\d.]+px$|var\(--row-h\)/.test(h)) continue;
  const n = parseFloat(h.replace('min ', ''));
  if (n < 18 || n > 64) continue;
  console.log(`${String(v.line).padStart(5)} h=${h.padEnd(8)} pad=${(v.p.padding ?? '-').padEnd(14)} r=${(v.p['border-radius'] ?? '-').padEnd(12)} fs=${(v.p['font-size'] ?? '-').padEnd(9)} fw=${v.p['font-weight'] ?? '-'} w=${v.p.width ?? '-'}  ${k.slice(0, 80)}`);
  const key = h; if (!hs.has(key)) hs.set(key, 0); hs.set(key, hs.get(key) + 1);
}
console.log('\nheight histogram:', [...hs.entries()].sort((a, b) => parseFloat(a[0].replace('min ', '')) - parseFloat(b[0].replace('min ', ''))).map(([k, n]) => `${k}×${n}`).join('  '));
