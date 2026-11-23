import { chromium } from '@playwright/test';
const [out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:5174/?platform=darwin&chrome=electron');
await page.waitForSelector('[data-testid=sidebar]');
const shot = async (n) => { await page.waitForTimeout(500); await page.screenshot({ path: `${out}/${n}.png` }); };
async function tab(u) { await page.keyboard.press('Meta+t'); await page.fill('[data-testid=cb-input]', u); await page.press('[data-testid=cb-input]', 'Enter'); await page.waitForTimeout(100); }
for (const u of ['github.com', 'news.ycombinator.com', 'en.wikipedia.org/wiki/Kite', 'figma.com', 'youtube.com', 'notion.so', 'reddit.com', 'claude.ai']) await tab(u);
// favorite three of them
for (let i = 0; i < 3; i++) { await page.locator('[data-testid=today-list] [data-testid^=row-]').nth(i).click({ button: 'right' }); await page.getByTestId('menu-favorite').click(); }
await page.click('[data-testid=btn-new-tab]');
await shot('40-home-default');
const add = async (k) => { await page.getByTestId('home-customize').click(); await page.getByTestId('home-add-widget').hover(); await page.getByTestId(`home-widget-${k}`).click(); };
await add('clock'); await add('weather'); await page.locator('input[data-testid^="wg-weather-place-"]').fill('Lisbon'); await page.keyboard.press('Enter');
await add('todo'); await page.locator('input[data-testid^="wg-todo-input-"]').fill('Fly the kite'); await page.keyboard.press('Enter'); await page.locator('input[data-testid^="wg-todo-input-"]').fill('Read Arc research'); await page.keyboard.press('Enter');
await add('calendar'); await add('note'); await page.locator('textarea[data-testid^="wg-note-"]').fill('Launch checklist:\n- sign the build\n- write release notes'); await add('timer');
await page.getByTestId('start-input').focus();
await shot('41-home-widgets');
await page.getByTestId('home-customize').click(); await shot('42-home-menu'); await page.getByTestId('home-background').hover(); await page.getByTestId('home-bg-aurora').click();
await shot('43-home-aurora');
await page.getByTestId('home-customize').click(); await page.getByTestId('home-background').hover(); await page.getByTestId('home-bg-dawn').click(); await shot('44-home-dawn');
await page.getByTestId('home-customize').click(); await page.getByTestId('home-background').hover(); await page.getByTestId('home-bg-ocean').click(); await shot('45-home-ocean');
await browser.close();
