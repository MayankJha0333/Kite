const { _electron: electron } = require('@playwright/test');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const OUT = join(__dirname, 'shots');
(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kite-eval-'));
  const t0 = Date.now();
  const app = await electron.launch({ args: ['.'], cwd: '/Users/apple/Personal/MArc', env: { ...process.env, KITE_USER_DATA: dir, KITE_TEST: '1' } });
  const win = await app.firstWindow();
  await win.waitForSelector('[data-testid=sidebar]');
  console.log('launch_to_sidebar_ms', Date.now() - t0);
  const shot = async (name) => {
    const buf = await app.evaluate(async ({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((x) => x.isVisible()) || BrowserWindow.getAllWindows()[0];
      const img = await w.capturePage();
      return img.resize({ width: 1400 }).toJPEG(80).toString('base64');
    });
    writeFileSync(join(OUT, name + '.jpg'), Buffer.from(buf, 'base64'));
  };
  const metrics = async (label) => {
    const m = await app.evaluate(({ app }) => app.getAppMetrics().map((p) => ({ type: p.type, name: p.name, mb: Math.round(p.memory.workingSetSize / 1024), cpu: p.cpu.percentCPUUsage })));
    const total = m.reduce((a, p) => a + p.mb, 0);
    const by = {};
    for (const p of m) by[p.type] = (by[p.type] || 0) + p.mb;
    console.log(label, 'procs', m.length, 'totalMB', total, JSON.stringify(by));
  };
  await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setSize(1400, 900); w.center(); });
  await win.waitForTimeout(1500);
  await shot('01-home');
  await metrics('idle_home');
  const sites = ['en.wikipedia.org/wiki/Kite', 'news.ycombinator.com', 'github.com/electron/electron', 'www.youtube.com', 'www.theverge.com'];
  for (const s of sites) {
    const t = Date.now();
    await win.keyboard.press('Meta+t');
    await win.getByTestId('cb-input').fill(s);
    await win.getByTestId('cb-input').press('Enter');
    await win.waitForTimeout(3500);
  }
  await win.waitForTimeout(4000);
  await shot('02-five-tabs');
  await metrics('five_tabs');
  await win.keyboard.press('Meta+t');
  await win.getByTestId('cb-input').fill('wiki');
  await win.waitForTimeout(500);
  await shot('03-command-bar');
  await win.keyboard.press('Escape');
  await win.keyboard.press('Meta+,');
  await win.waitForTimeout(1200);
  await shot('04-settings');
  await win.keyboard.press('Escape');
  await win.waitForTimeout(400);
  await win.keyboard.press('Meta+Shift+=');
  await win.waitForTimeout(2000);
  await shot('05-split');
  console.log('ua', await app.evaluate(({ session }) => session.defaultSession.getUserAgent()));
  console.log('versions', await app.evaluate(() => process.versions.chrome + ' / electron ' + process.versions.electron));
  await app.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
