import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const R = '/Users/apple/Personal/MArc/src/renderer';
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx$/.test(f)) files.push(p); } })(R);
const rules = JSON.parse(readFileSync('rules.json', 'utf8'));
const decls = JSON.parse(readFileSync('decls.json', 'utf8'));
const inter = new Map(); // class -> {tags:Set, files:Set}
for (const f of files) {
  const t = readFileSync(f, 'utf8');
  // opening tags (multi-line)
  for (const m of t.matchAll(/<(button|a|input|select|textarea|summary|label|div|span|li|tr)\b([^<>]*?(?:\{[^{}]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[^{}]*)*\}[^<>]*?)*)\/?>/g)) {
    const tag = m[1], attrs = m[2];
    const native = /^(button|a|input|select|textarea|summary)$/.test(tag);
    const clicky = /onClick=|role="(button|menuitem|option|radio|tab|switch|checkbox|link)"|tabIndex=/.test(attrs);
    if (!native && !clicky) continue;
    const cm = attrs.match(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{([^}]*)\})/);
    if (!cm) { const k = `<${tag}> (no class)`; if (!inter.has(k)) inter.set(k, { tags: new Set(), files: new Set(), n: 0 }); inter.get(k).n++; inter.get(k).files.add(f.replace(R + '/', '')); continue; }
    const raw = (cm[1] ?? cm[2] ?? cm[3] ?? '');
    const toks = [...raw.replace(/\$\{[^}]*\}/g, ' ').matchAll(/[a-z][\w-]*/g)].map((x) => x[0]).filter((x) => !/^(undefined|null|true|false|props|className|cls)$/.test(x));
    const first = toks[0]; if (!first) continue;
    const key = toks.slice(0, 3).join('.');
    for (const k of new Set([first])) { if (!inter.has(k)) inter.set(k, { tags: new Set(), files: new Set(), n: 0, variants: new Set() }); const e = inter.get(k); e.tags.add(native ? tag : tag + '[click]'); e.files.add(f.replace(R + '/', '').replace('components/', '')); e.n++; e.variants.add(key); }
  }
}
const has = (cls, pseudo) => rules.some((r) => r.sel.split(',').some((s) => new RegExp(`\\.${cls}(?![\\w-])[^ ,>+~]*${pseudo}`).test(s.trim()) || new RegExp(`\\.${cls}(?![\\w-])[^,]*${pseudo}`).test(s.trim()) && new RegExp(`\\.${cls}(?![\\w-])(\\[[^\\]]*\\]|\\.[\\w-]+)*${pseudo}`).test(s)));
const hasLoose = (cls, re) => rules.some((r) => r.sel.split(',').some((s) => new RegExp(`\\.${cls}(?![\\w-])(\\[[^\\]]*\\]|\\.[\\w-]+|:not\\([^)]*\\))*${re}`).test(s)));
// global press list
const out = [];
for (const [cls, e] of [...inter.entries()].sort()) {
  if (cls.startsWith('<')) { out.push(`${cls.padEnd(28)} n=${e.n} files=${[...e.files].join(',')}`); continue; }
  const hover = hasLoose(cls, ':hover');
  const active = hasLoose(cls, ':active');
  const fv = hasLoose(cls, ':focus-visible') || hasLoose(cls, ':focus(?!-)') || hasLoose(cls, ':focus-within');
  const dis = hasLoose(cls, ':disabled') || hasLoose(cls, '\\[disabled') ;
  const cssExists = rules.some((r) => new RegExp(`\\.${cls}(?![\\w-])`).test(r.sel));
  out.push(`${cls.padEnd(28)} ${[...e.tags].join('/').padEnd(22)} hover=${hover ? 'Y' : '-'} active=${active ? 'Y' : '-'} focus=${fv ? 'Y' : '-'} disabled=${dis ? 'Y' : '-'} css=${cssExists ? 'Y' : 'NO'} n=${e.n} ${[...e.files].slice(0, 4).join(',')}`);
}
console.log(out.join('\n'));
