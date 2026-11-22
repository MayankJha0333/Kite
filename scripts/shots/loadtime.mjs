// Times real page loads in the built app under different settings, and lists network
// errors (handshake failures etc.) by host. Usage: node scripts/shots/loadtime.mjs
import { _electron as electron } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SITES = ['https://example.com', 'https://en.wikipedia.org/wiki/Kite', 'https://news.ycombinator.com', 'https://www.theverge.com'];
const CASES = [
  { name: 'defaults (Shields on, HTTPS-only on)', settings: {} },
  { name: 'Shields off', settings: { shields: { enabled: false } } },
  { name: 'HTTPS-only off', settings: { httpsOnly: false } },
];
for (const c of CASES) {
  const dir = mkdtempSync(join(tmpdir(), 'kite-load-'));
  writeFileSync(join(dir, 'kite-data.json'), JSON.stringify({ version: 1, items: {}, spaces: [], settings: c.settings }));
  const app = await electron.launch({ args: ['.', '--no-sandbox'], env: { ...process.env, KITE_USER_DATA: dir, KITE_TEST: '1', KITE_TEST_QUIET: '1' } });
  const win = await app.firstWindow();
  await win.waitForSelector('[data-testid=sidebar]');
  await app.evaluate(({ session }) => {
    const g = globalThis; g.errs = []; g.reqs = 0;
    const ses = session.fromPartition('persist:kite');
    ses.webRequest.onErrorOccurred((d) => { g.errs.push(`${d.error} ${new URL(d.url).host} ${d.resourceType}`); });
    ses.webRequest.onCompleted(() => { g.reqs++; });
  });
  await win.waitForTimeout(1500); // let the filter lists settle a bit
  console.log(`\n=== ${c.name}`);
  for (const url of SITES) {
    await app.evaluate(() => { globalThis.errs = []; globalThis.reqs = 0; });
    const t0 = Date.now();
    await win.keyboard.press('Meta+t');
    await win.getByTestId('cb-input').fill(url);
    await win.getByTestId('cb-input').press('Enter');
    // Wait for the load bar to go off (did-stop-loading) with a cap.
    await win.locator('.load-bar[data-on]').waitFor({ state: 'attached', timeout: 5000 }).catch(() => undefined);
    const t1 = Date.now();
    await win.locator('.load-bar[data-on]').waitFor({ state: 'detached', timeout: 40000 }).catch(() => undefined);
    const t2 = Date.now();
    const { errs, reqs } = await app.evaluate(() => ({ errs: globalThis.errs, reqs: globalThis.reqs }));
    const counts = {};
    for (const e of errs) counts[e] = (counts[e] ?? 0) + 1;
    console.log(`${url}: first byte ~${t1 - t0}ms, loaded ${t2 - t0}ms, ${reqs} requests ok, ${errs.length} errors`);
    for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log(`   ${n}× ${k}`);
  }
  await app.close();
}
