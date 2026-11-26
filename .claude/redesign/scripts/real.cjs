// Lead's look at the real app: real sites, light and dark, a fresh profile, first run on.
const { _electron: electron } = require('@playwright/test');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const OUT = '/private/tmp/claude-501/-Users-apple-Personal-MArc/77deb0da-8950-4039-9159-d14524519f6f/scratchpad/lead';
(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kite-real-'));
  const t0 = Date.now();
  const app = await electron.launch({ args: ['.'], cwd: '/Users/apple/Personal/MArc', env: { ...process.env, KITE_USER_DATA: dir, KITE_TEST: '1', KITE_FIRST_RUN: '1' }, colorScheme: null });
  const win = await app.firstWindow();
  await win.waitForSelector('[data-testid=sidebar]');
  console.log('launch_ms', Date.now() - t0);
  await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setSize(1400, 880); w.center(); });
  const shot = async (name) => {
    const b64 = await app.evaluate(async ({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((x) => x.isVisible()) || BrowserWindow.getAllWindows()[0];
      return (await w.capturePage()).toJPEG(85).toString('base64');
    });
    writeFileSync(join(OUT, `real-${name}.jpg`), Buffer.from(b64, 'base64'));
  };
  const theme = (src) => app.evaluate(({ nativeTheme }, s) => { nativeTheme.themeSource = s; }, src);
  await theme('system');
  await win.waitForTimeout(1500);
  await shot('01-first-run-sys');
  // Skip the first run.
  await win.keyboard.press('Escape');
  await win.waitForTimeout(600);
  const open = async (u) => {
    await win.keyboard.press('Meta+t');
    await win.getByTestId('cb-input').fill(u);
    await win.getByTestId('cb-input').press('Enter');
  };
  await open('en.wikipedia.org/wiki/Kite');
  await win.waitForTimeout(350);
  await shot('02-loading-sys');
  await win.waitForTimeout(3500);
  for (const u of ['github.com/electron/electron', 'news.ycombinator.com', 'vercel.com', 'www.theverge.com']) {
    await open(u);
    await win.waitForTimeout(3500);
  }
  await win.waitForTimeout(3000);
  await shot('03-pages-sys');
  const ua = await win.locator('.surface-slot[data-visible] webview').evaluate((el) => el.executeJavaScript('navigator.userAgent'));
  console.log('page_ua', ua);
  await win.waitForTimeout(25000); await win.keyboard.press('Meta+r'); await win.waitForTimeout(6000);
  await win.waitForTimeout(1200);
  await shot('04-verge-after-lists');
  await win.keyboard.press('Meta+t');
  await win.getByTestId('cb-input').fill('git');
  await win.waitForTimeout(400);
  await shot('05-cmd-dark');
  await win.keyboard.press('Escape');
  await win.keyboard.press('Escape');
  await win.keyboard.press('Meta+Comma');
  await win.waitForTimeout(1000);
  await shot('06-settings-dark');
  const m = await app.evaluate(({ app }) => app.getAppMetrics().reduce((a, p) => a + p.memory.workingSetSize, 0) / 1024);
  console.log('memory_mb', Math.round(m));
  await app.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
