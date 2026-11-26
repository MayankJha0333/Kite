import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const require = createRequire('/Users/apple/Personal/MArc/package.json');
const postcss = require('postcss');
const css = readFileSync('/Users/apple/Personal/MArc/src/renderer/styles/app.css', 'utf8');
const root = postcss.parse(css);
const rules = [];
const comments = [];
const decls = [];
const keyframes = [];
root.walk((n) => {
  if (n.type === 'comment') comments.push({ line: n.source.start.line, end: n.source.end.line, text: n.text, top: n.parent.type === 'root' });
  if (n.type === 'atrule' && /keyframes/.test(n.name)) keyframes.push({ name: n.params, line: n.source.start.line, end: n.source.end.line, body: n.nodes.map((x) => x.toString().replace(/\s+/g, ' ')).join(' ') });
  if (n.type === 'rule') {
    let ctx = [];
    for (let p = n.parent; p && p.type !== 'root'; p = p.parent) if (p.type === 'atrule') ctx.unshift(`@${p.name} ${p.params}`);
    if (ctx.some((c) => /keyframes/.test(c))) return;
    rules.push({ sel: n.selector.replace(/\s+/g, ' '), line: n.source.start.line, end: n.source.end.line, ctx: ctx.join(' | ') });
  }
  if (n.type === 'decl') {
    let ctx = [];
    let sel = '';
    for (let p = n.parent; p && p.type !== 'root'; p = p.parent) {
      if (p.type === 'atrule') ctx.unshift(`@${p.name} ${p.params}`);
      if (p.type === 'rule' && !sel) sel = p.selector.replace(/\s+/g, ' ');
    }
    decls.push({ prop: n.prop, value: n.value.replace(/\s+/g, ' '), line: n.source.start.line, sel, ctx: ctx.join(' | '), important: !!n.important });
  }
});
writeFileSync('rules.json', JSON.stringify(rules));
writeFileSync('comments.json', JSON.stringify(comments));
writeFileSync('decls.json', JSON.stringify(decls));
writeFileSync('keyframes.json', JSON.stringify(keyframes));
console.log('rules', rules.length, 'decls', decls.length, 'comments', comments.length, 'keyframes', keyframes.length);
const ats = {};
root.walkAtRules((a) => { const k = `@${a.name} ${/keyframes/.test(a.name) ? '' : a.params}`; (ats[k] ??= []).push(a.source.start.line + '-' + a.source.end.line); });
for (const [k, v] of Object.entries(ats)) console.log(k, v.length, v.join(' '));
