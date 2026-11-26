import { readFileSync } from 'node:fs';
const decls = JSON.parse(readFileSync('decls.json', 'utf8'));
const kf = JSON.parse(readFileSync('keyframes.json', 'utf8'));
const sec = (t) => console.log('\n===== ' + t);
const splitTop = (v) => { const out = []; let d = 0, cur = ''; for (const ch of v) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; };
const tr = decls.filter((d) => d.prop === 'transition');
sec(`transition declarations: ${tr.length}`);
const durs = new Map(), eases = new Map(), props = new Map();
const layout = /^(width|height|top|left|right|bottom|margin|padding|max-height|max-width|min-width|min-height|flex-basis|flex|grid-template-columns|grid-template-rows|inset|gap|font-size|border-width|line-height)/;
const layoutHits = [], allHits = [], noEase = [];
const add = (m, k, l) => { if (!m.has(k)) m.set(k, []); m.get(k).push(l); };
for (const d of tr) {
  if (d.value === 'none') { add(durs, 'none', d.line); continue; }
  for (const part of splitTop(d.value)) {
    // tokenise respecting parens
    const toks = []; let dp = 0, cur = ''; for (const ch of part) { if (ch === '(') dp++; if (ch === ')') dp--; if (ch === ' ' && dp === 0) { if (cur) toks.push(cur); cur = ''; } else cur += ch; } if (cur) toks.push(cur);
    const prop = toks[0];
    const isTime = (t) => /^[\d.]+m?s$/.test(t) || /^calc\(.*(ms|s)\b.*\)$/.test(t) || /^var\(--(t-|dur|press-dur)/.test(t);
    const times = toks.slice(1).filter(isTime);
    const ease = toks.slice(1).filter((t) => !isTime(t));
    let p = prop; let rest = toks.slice(1);
    if (isTime(prop)) { p = '(all implicit)'; times.unshift(prop); }
    add(props, p, d.line);
    if (p === 'all' || p === '(all implicit)') allHits.push(`${d.line} ${d.sel.slice(0, 50)} :: ${part}`);
    if (layout.test(p)) layoutHits.push(`${d.line} ${d.sel.slice(0, 60)} :: ${part}`);
    add(durs, times[0] ?? '(none)', d.line);
    if (times[1]) add(durs, 'DELAY ' + times[1], d.line);
    add(eases, ease.join(' ') || '(default ease)', d.line);
  }
}
const show = (m, n = 8) => [...m.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, l]) => `${String(l.length).padStart(4)} × ${k}   @ ${[...new Set(l)].slice(0, n).join(',')}`).join('\n');
sec('transition durations'); console.log(show(durs));
sec('transition easings'); console.log(show(eases));
sec('transition properties'); console.log(show(props, 5));
sec('transition: all / implicit all'); console.log(allHits.join('\n'));
sec('transitions on layout properties'); console.log(layoutHits.join('\n'));
sec('transition-* longhands'); for (const d of decls.filter((d) => /^transition-/.test(d.prop))) console.log(d.line, d.sel.slice(0, 60), '::', d.prop, d.value);
sec('animation declarations'); for (const d of decls.filter((d) => /^animation/.test(d.prop))) console.log(d.line, '|', d.sel.slice(0, 70), d.ctx ? '{' + d.ctx + '}' : '', '::', d.prop + ': ' + d.value);
sec('keyframes'); const anims = decls.filter((d) => /^animation(-name)?$/.test(d.prop));
for (const k of kf) { const users = anims.filter((d) => new RegExp(`(^|[\\s,])${k.name}([\\s,]|$)`).test(d.value)); const lay = /(?<![\w-])(width|height|top|left|right|bottom|margin[\w-]*|padding[\w-]*|max-height|max-width|inset|gap|stroke-dashoffset|background-position|box-shadow|filter|clip-path)\s*:/g; const propsIn = [...new Set([...k.body.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1]))]; console.log(`${k.name} @${k.line}-${k.end} props[${propsIn.join(',')}] used ${users.length}× @ ${users.map((u) => u.line).join(',') || 'NONE (in CSS)'}`); }
sec('will-change / contain'); for (const d of decls.filter((d) => /^(will-change|contain|content-visibility)$/.test(d.prop))) console.log(d.line, d.sel.slice(0, 60), '::', d.prop, d.value);
