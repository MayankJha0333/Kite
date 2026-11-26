// Lead's quick look: the app in web mode with a realistic state, light and dark.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const SP = '/private/tmp/claude-501/-Users-apple-Personal-MArc/77deb0da-8950-4039-9159-d14524519f6f/scratchpad';
const state = JSON.parse(fs.readFileSync(SP + '/split/seed-state.json', 'utf8'));
const tag = process.argv[2] || 'now';
(async () => {
  const browser = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, colorScheme: scheme });
    const page = await ctx.newPage();
    await page.addInitScript((s) => localStorage.setItem('kite-state', JSON.stringify(s)), state);
    await page.goto('http://localhost:5174/?platform=darwin');
    await page.waitForSelector('[data-testid=sidebar]');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SP}/lead/${tag}-${scheme}-main.png` });
    await page.keyboard.press('Meta+t');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SP}/lead/${tag}-${scheme}-cmd.png` });
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
