import { readFileSync } from 'node:fs';
const rules = JSON.parse(readFileSync('rules.json', 'utf8'));
const Z = {
  'A Foundations': [[1,126],[1068,1084],[1127,1147],[4186,4210],[4244,4359],[4983,5133],[6135,6157],[6671,6683]],
  'B Sidebar': [[127,221],[252,888],[1317,1358],[1359,1417],[2468,2481],[3544,3565],[4166,4185],[4360,4449],[5969,5977],[6544,6585],[6640,6650]],
  'C Command bar, menus, toasts': [[1114,1126],[1148,1188],[1189,1316],[1977,2118],[5557,5587]],
  'D Sheets, shared controls, list panels': [[222,251],[1418,1976],[2182,2187],[2339,2348],[2460,2467],[2482,2640],[2853,2934],[3566,3570],[4211,4243],[4608,4982],[5588,5633],[5978,5985],[6455,6491],[6786,6841]],
  'E Settings + theme editor': [[2935,3543],[5134,5240],[5684,5874],[5986,6000],[6492,6543],[6586,6639],[6684,6785]],
  'F Home page + widgets': [[5241,5556],[5634,5683],[6158,6454],[6651,6670]],
  'G Page area': [[889,984],[1085,1113],[2119,2181],[2188,2338],[2349,2358],[2641,2852],[4450,4607],[5875,5968],[6001,6134]],
  'H Little window + pip': [[985,1067],[2359,2459],[3571,4165]],
};
const owner = new Array(6842).fill(null);
for (const [z, rs] of Object.entries(Z)) for (const [a, b] of rs) for (let i = a; i <= b; i++) { if (owner[i]) console.log('OVERLAP', i, owner[i], z); owner[i] = z; }
const miss = []; for (let i = 1; i <= 6841; i++) if (!owner[i]) miss.push(i);
console.log('missing', miss.length, miss.slice(0, 40).join(','));
for (const [z, rs] of Object.entries(Z)) { const n = rs.reduce((s, [a, b]) => s + b - a + 1, 0); const rn = rules.filter((r) => owner[r.line] === z).length; console.log(z, '| lines', n, '| rules', rn, '| ranges', rs.length); }
// rules that straddle boundaries
for (const r of rules) if (owner[r.line] !== owner[r.end]) console.log('STRADDLE', r.line, r.end, r.sel);
