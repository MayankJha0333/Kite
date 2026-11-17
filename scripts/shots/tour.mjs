// Screenshot tour of Kite's web test mode. Usage: node shots.mjs <outdir> [light|dark]
import { chromium } from '@playwright/test';
const [out, theme = 'light'] = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, colorScheme: theme });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.goto('http://localhost:5174/?platform=darwin&chrome=electron');
await page.waitForSelector('[data-testid=sidebar]');
const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: `${out}/${name}.png` }); };
async function tab(u) { await page.keyboard.press('Meta+t'); await page.fill('[data-testid=cb-input]', u); await page.press('[data-testid=cb-input]', 'Enter'); await page.waitForTimeout(150); }
await shot('01-empty');
for (const u of ['github.com/torvalds/linux', 'news.ycombinator.com', 'en.wikipedia.org/wiki/Kite', 'figma.com', 'youtube.com/watch?v=abc']) await tab(u);
await shot('02-tabs');
// pin one, favorite one
await page.click('[data-testid^=row-]:nth-of-type(2)', { button: 'right' }); await shot('03-context-menu'); await page.keyboard.press('Escape');
await page.keyboard.press('Meta+d'); await page.waitForTimeout(200);
await page.keyboard.press('Meta+t'); await page.fill('[data-testid=cb-input]', 'fav'); await shot('04-command-bar'); await page.keyboard.press('Escape');
await page.keyboard.press('Meta+t'); await page.fill('[data-testid=cb-input]', ''); await shot('04b-command-bar-empty'); await page.keyboard.press('Escape');
await page.keyboard.press('Meta+Shift+o'); await shot('05-note'); 
await page.click('[data-testid=btn-new-tab]'); await shot('06-new-tab-page');
await page.click('[data-testid=btn-archive]'); await shot('07-archive'); await page.keyboard.press('Escape');
await page.click('[data-testid=btn-settings]'); await shot('08-settings-appearance');
for (const s of ['spaces','layout','motion','tabs','links','adblock','privacy','extensions','keys','data','about']) { await page.click(`[data-testid=settings-${s}]`); await shot(`09-settings-${s}`); }
await page.keyboard.press('Escape');
await page.click('[data-testid=space-header]'); await shot('10-space-menu'); await page.keyboard.press('Escape');
await page.click('[data-testid=btn-new-space]'); await shot('11-space-editor'); await page.keyboard.press('Escape');
await page.evaluate(() => window.__kiteTest.shortcut('downloadsPanel')); await shot('12-downloads'); await page.keyboard.press('Escape');
await page.evaluate(() => window.__kiteTest.shortcut('extensionsPanel')); await shot('13-extensions'); await page.keyboard.press('Escape');
await page.evaluate(() => window.__kiteTest.shortcut('boostsPanel')); await shot('14-boosts'); await page.keyboard.press('Escape');
await page.evaluate(() => window.__kiteTest.shortcut('routingPanel')); await shot('15-routing'); await page.keyboard.press('Escape');
await page.evaluate(() => window.__kiteTest.shortcut('importArc')); await shot('16-import'); await page.keyboard.press('Escape');
await page.click('[data-testid=row-]', { force: true }).catch(()=>{});
await page.click('[data-testid=url-pill]').catch(()=>{}); await shot('17-edit-url'); await page.keyboard.press('Escape');
await page.click('[data-testid=url-security]').catch(()=>{}); await shot('18-site-info'); await page.keyboard.press('Escape');
await page.keyboard.press('Meta+f'); await shot('19-find'); await page.keyboard.press('Escape');
await page.keyboard.press('Meta+s'); await shot('20-sidebar-hidden'); await page.keyboard.press('Meta+s');
await page.setViewportSize({ width: 820, height: 600 }); await shot('21-small-window');
await page.setViewportSize({ width: 1280, height: 800 });
await page.evaluate(() => window.__kiteTest.shortcut('newSplit')); await page.fill('[data-testid=cb-input]', 'example.com'); await page.press('[data-testid=cb-input]', 'Enter'); await shot('22-split');
console.log(JSON.stringify(errors, null, 1));
await browser.close();
