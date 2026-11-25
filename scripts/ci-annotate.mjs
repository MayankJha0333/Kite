// Prints what failed as GitHub annotations, so the reason shows on the run's page
// (Actions → the run → Annotations) without opening the logs. Used by ci.yml.
import { existsSync, readFileSync } from 'node:fs';

const file = 'test-report/results.json';
if (!existsSync(file)) {
  console.log('::error title=No test report::test-report/results.json was not written: the report script stopped before finishing.');
  process.exit(0);
}
const r = JSON.parse(readFileSync(file, 'utf8'));
const esc = (s) => String(s ?? '').replace(/\u001b\[[0-9;]*m/g, '').replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
const failed = r.tests.filter((t) => t.status === 'failed');
const broken = r.steps.filter((s) => s.status === 'failed');
if (!failed.length && !broken.length) process.exit(0);

// One annotation listing everything, then details for the first few (GitHub shows 10 per step).
const list = [...broken.map((s) => `step: ${s.name}`), ...failed.map((t) => `${t.layer} · ${t.file} · ${t.title}`)];
console.log(`::error title=${failed.length} test(s) failed, ${broken.length} step(s) broken::${esc(list.join('\n').slice(0, 3500))}`);
for (const s of broken.filter((x) => x.tail).slice(0, 3)) console.log(`::error title=${esc(`Step failed: ${s.name}`)}::${esc(s.tail.slice(-1500))}`);
for (const t of failed.slice(0, 6)) console.log(`::error title=${esc(`${t.layer}: ${t.title}`.slice(0, 200))}::${esc(String(t.error ?? '').slice(0, 1500))}`);
