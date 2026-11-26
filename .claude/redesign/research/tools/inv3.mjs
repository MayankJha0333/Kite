import { readFileSync } from 'node:fs';
const decls = JSON.parse(readFileSync('decls.json', 'utf8'));
const kf = JSON.parse(readFileSync('keyframes.json', 'utf8'));
const sec = (t) => console.log('\n===== ' + t);
const show = (m, n = 8) => [...m.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, l]) => `${String(l.length).padStart(4)} × ${k}   @ ${[...new Set(l)].slice(0, n).join(',')}`).join('\n');
const add = (m, k, l) => { if (!m.has(k)) m.set(k, []); m.get(k).push(l); };
// borders
const b = new Map(); const bw = new Map();
for (const d of decls.filter((d) => /^(border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-color)?|outline(-color)?)$/.test(d.prop))) {
  const v = d.value;
  if (/^(none|0|inherit)$/.test(v)) { add(b, `${d.prop.startsWith('outline') ? 'outline' : 'border'}: ${v}`, d.line); continue; }
  const m = v.match(/^([\d.]+px)\s+(solid|dashed|dotted)\s+(.*)$/);
  if (m) { add(b, `${d.prop.startsWith('outline') ? 'OUTLINE ' : ''}${m[3]}`, d.line); add(bw, `${d.prop.startsWith('outline') ? 'outline ' : ''}${m[1]} ${m[2]}`, d.line); } else add(b, `${d.prop}: ${v}`, d.line);
}
sec('border / outline colours'); console.log(show(b));
sec('border widths/styles'); console.log(show(bw));
sec('outline-offset'); const oo = new Map(); for (const d of decls.filter((d) => d.prop === 'outline-offset')) add(oo, d.value, d.line); console.log(show(oo));
// hard-coded colours
const colourRe = /#[0-9a-fA-F]{3,8}\b|rgba?\([^()]*\)|hsla?\([^()]*\)|\b(white|black)\b/g;
const groups = new Map(); const total = new Map();
const purpose = (p) => /shadow/.test(p) ? 'shadow' : /^(background|background-color|background-image)$/.test(p) ? 'background' : /^(color|fill|stroke|caret-color|accent-color)$/.test(p) ? 'text/icon' : /border|outline/.test(p) ? 'border' : p.startsWith('--') ? 'custom-prop' : 'other:' + p;
let n = 0;
for (const d of decls) { const ms = d.value.match(colourRe); if (!ms) continue; for (const c of ms) { n++; const norm = c.replace(/\s+/g, ''); const g = purpose(d.prop); if (!groups.has(g)) groups.set(g, new Map()); add(groups.get(g), norm, d.line); add(total, norm, d.line); } }
for (const k of kf) { const ms = k.body.match(colourRe); if (ms) for (const c of ms) { n++; add(total, c.replace(/\s+/g, ''), k.line); if (!groups.has('keyframes')) groups.set('keyframes', new Map()); add(groups.get('keyframes'), c.replace(/\s+/g, ''), k.line); } }
sec(`hard-coded colours: ${n} occurrences, ${total.size} distinct`);
for (const [g, m] of groups) { const cnt = [...m.values()].reduce((s, l) => s + l.length, 0); console.log(`\n-- ${g}: ${cnt} occurrences, ${m.size} distinct`); console.log(show(m, 6)); }
// colour families
const fam = new Map();
for (const [c, l] of total) { let f = 'other'; if (/^rgba?\(0,0,0/.test(c) || c === '#000' || c === 'black') f = 'black-alpha'; else if (/^rgba?\(255,255,255/.test(c) || /^rgb\(255255255/.test(c) || /^#fff/i.test(c) || c === 'white') f = 'white(-alpha)'; else if (/^rgba?\(40,30,20/.test(c)) f = 'warm-ink 40,30,20'; else if (/^rgba?\(60,40,20/.test(c)) f = 'warm-ink 60,40,20'; else if (/^rgba?\(20,16,12/.test(c)) f = 'warm-ink 20,16,12'; else if (/214,69,69|#d64545|#c0392b|255,69,58|#ff453a|#e5484d|#d93025|#c33|#b3261e|#e5/.test(c)) f = 'red/danger'; add(fam, f, ...[l.length]); fam.get(f).c = (fam.get(f).c ?? 0) + l.length; }
sec('colour families'); for (const [f, v] of fam) console.log(f, 'distinct', v.length, 'occurrences', v.c);
sec('color-mix usage'); const cm = new Map(); for (const d of decls) for (const m of d.value.matchAll(/color-mix\(in srgb, ([^,]+?) ([\d.]+%), ([^)]+)\)/g)) add(cm, `${m[1]} ${m[2]} → ${m[3]}`, d.line); console.log('distinct', cm.size, 'total', [...cm.values()].reduce((s, l) => s + l.length, 0)); console.log(show(cm, 4));
