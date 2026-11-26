// Recapture for the finish review: current build, web mode, settled motion.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const SP = '/private/tmp/claude-501/-Users-apple-Personal-MArc/77deb0da-8950-4039-9159-d14524519f6f/scratchpad';
const OUT = '/Users/apple/Personal/MArc/.impeccable/review';
const state = JSON.parse(fs.readFileSync(SP + '/split/seed-state.json', 'utf8'));
const settle = (page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
(async () => {
  const browser = await chromium.launch();
  // History over the current start page, light, 1000x640.
  {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 }, deviceScaleFactor: 2, colorScheme: 'light' });
    const page = await ctx.newPage();
    const h = JSON.parse(JSON.stringify(state));
    const now = Date.now();
    const H = 3600e3;
    h.history = [
      ['https://github.com/electron/electron', 'GitHub - electron/electron', 3, 0.3],
      ['https://www.apple.com/mac/', 'Mac - Apple', 2, 2],
      ['https://www.theverge.com/tech', 'The Verge', 3, 5],
      ['https://en.wikipedia.org/wiki/Kite', 'Kite - Wikipedia', 4, 26],
      ['https://news.ycombinator.com/', 'Hacker News', 6, 30],
      ['https://www.figma.com/files', 'Figma', 2, 52],
      ['https://linear.app/', 'Linear – The system for product development', 1, 55],
    ].map(([url, title, visits, ago]) => ({ url, title, visits, lastVisitAt: now - ago * H }));
    await page.addInitScript((s) => localStorage.setItem('kite-state', JSON.stringify(s)), h);
    await page.goto('http://localhost:5174/?platform=darwin&firstrun=0');
    await page.waitForSelector('[data-testid=sidebar]');
    await page.keyboard.press('Meta+Shift+h');
    await page.waitForTimeout(500);
    await settle(page);
    const row = page.locator('[data-testid=history] .list-row, .sheet .list-row').nth(1);
    if (await row.count()) await row.hover();
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${OUT}/small-history-light.png` });
    await ctx.close();
  }
  // First run, step 1 and 2, dark, 1280x800 (the string as progress, no stray H).
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('http://localhost:5174/?platform=darwin&firstrun=1');
    await page.waitForSelector('[data-testid=sidebar]');
    await page.waitForTimeout(900);
    await settle(page);
    await page.screenshot({ path: `${OUT}/desktop-first-run-dark.png` });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    await settle(page);
    await page.screenshot({ path: `${OUT}/desktop-first-run-step2-dark.png` });
    await ctx.close();
  }
  // Start page with widgets, light (no double date); Settings appearance (chevron).
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, colorScheme: 'light' });
    const page = await ctx.newPage();
    const st = JSON.parse(JSON.stringify(state));
    await page.addInitScript((s) => localStorage.setItem('kite-state', JSON.stringify(s)), st);
    await page.goto('http://localhost:5174/?platform=darwin&firstrun=0');
    await page.waitForSelector('[data-testid=sidebar]');
    await page.waitForTimeout(700);
    await settle(page);
    await page.screenshot({ path: `${OUT}/desktop-start-light.png` });
    await page.keyboard.press('Meta+Comma');
    await page.waitForTimeout(500);
    await page.getByTestId('settings-appearance').click().catch(() => undefined);
    await page.waitForTimeout(500);
    await settle(page);
    await page.screenshot({ path: `${OUT}/desktop-settings-appearance-light.png` });
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
