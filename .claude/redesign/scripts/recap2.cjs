// Recapture the two stale review shots on the current build: dark start page, dark cert error at 1000x640.
const { chromium } = require('@playwright/test');
const OUT = '/Users/apple/Personal/MArc/.impeccable/review';
const settle = (page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
(async () => {
  const browser = await chromium.launch();
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('http://localhost:5174/?platform=darwin&firstrun=0');
    await page.waitForSelector('[data-testid=sidebar]');
    await page.waitForTimeout(800);
    await settle(page);
    await page.screenshot({ path: `${OUT}/desktop-start-dark.png` });
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 }, deviceScaleFactor: 2, colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('http://localhost:5174/?platform=darwin&firstrun=0');
    await page.waitForSelector('[data-testid=sidebar]');
    await page.keyboard.press('Meta+t');
    await page.getByTestId('cb-input').fill('https://example.com/');
    await page.getByTestId('cb-input').press('Enter');
    await page.waitForTimeout(600);
    const id = (await page.locator('.surface-slot[data-visible]').first().getAttribute('data-testid')).replace('slot-', '');
    await page.evaluate(async ({ id }) => {
      const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /\/store\.ts(\?|$)/.test(n));
      const store = await import(url);
      store.setUi((u) => ({ loadError: { ...u.loadError, [id]: { code: -202, desc: 'ERR_CERT_AUTHORITY_INVALID', url: 'https://example.com/' } } }));
    }, { id });
    await page.waitForTimeout(600);
    await settle(page);
    await page.screenshot({ path: `${OUT}/small-error-dark.png` });
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
