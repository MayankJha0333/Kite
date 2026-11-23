import type { Page } from '@playwright/test';
import { test, expect, openApp, newTab, savedState, MOD } from './fixtures';

async function customize(page: Page) {
  await page.getByTestId('home-customize').click();
  await expect(page.getByTestId('context-menu')).toBeVisible();
}

async function addWidget(page: Page, kind: string) {
  await customize(page);
  await page.getByTestId('home-add-widget').hover();
  await page.getByTestId(`home-widget-${kind}`).click();
}

const widgets = (page: Page) => page.locator('[data-testid^="widget-"]:not([data-testid^="widget-menu"]):not([data-testid^="widget-size"])');

test.describe('home page', () => {
  test('sites show their real icon in suggestions and tiles; frequently visited is off until asked for', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'github.com');
    await newTab(page, 'github.com/kite');
    await page.getByTestId('btn-new-tab').click();
    // Off by default: no "Frequently visited" section.
    await expect(page.getByTestId('start-sites')).toHaveCount(0);
    // A typed suggestion shows the icon the site reported, not a letter.
    await page.getByTestId('start-input').fill('git');
    const sug = page.getByTestId('start-suggest').getByRole('option').first();
    await expect(sug.locator('img.site-icon')).toHaveCount(1);
    await expect(sug.locator('.site-icon.letter')).toHaveCount(0);
    await page.getByTestId('start-input').fill('');
    // Turn Frequently visited on: its tile carries the same icon.
    await customize(page);
    await page.getByTestId('home-toggle-frequent').click();
    await expect(page.getByTestId('start-site').first().locator('img.site-icon')).toHaveCount(1);
    expect((await savedState(page)).history.find((h: { url: string }) => h.url.includes('github.com'))?.favicon).toMatch(/^data:image\/svg/);
    // A shortcut typed by hand (never opened): the site is asked for its icon once, and the tile shows it.
    await page.getByTestId('start-add-shortcut').click();
    await page.getByTestId('shortcut-url').fill('stackoverflow.com');
    await page.getByTestId('shortcut-name').fill('SO');
    await page.getByTestId('shortcut-save').click();
    await expect(page.getByTestId('start-favorite').locator('img.site-icon')).toHaveCount(1);
  });

  test('widgets are added from the + button, keep their place, and are saved', async ({ page }) => {
    await openApp(page);
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await addWidget(page, 'clock');
    await expect(widgets(page)).toHaveCount(1);
    await expect(page.getByTestId('wg-clock-time')).toContainText(/\d/);
    await addWidget(page, 'note');
    await expect(widgets(page)).toHaveCount(2);
    const a = (await widgets(page).nth(0).boundingBox())!;
    const b = (await widgets(page).nth(1).boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.width); // side by side, never overlapping
    // Type into the note; it is saved.
    const note = page.locator('textarea[data-testid^="wg-note-"]');
    await note.fill('Buy kite string');
    const s = await savedState(page);
    expect(s.home.widgets).toHaveLength(2);
    expect(s.home.widgets[1].data.text).toBe('Buy kite string');
    // Survives a reload.
    await page.reload();
    await expect(page.locator('textarea[data-testid^="wg-note-"]')).toHaveValue('Buy kite string');
  });

  test('a widget can be dragged to a new place, resized and removed', async ({ page }) => {
    await openApp(page);
    await addWidget(page, 'clock');
    const w = widgets(page).first();
    const before = (await w.boundingBox())!;
    const head = w.locator('.widget-head');
    const h = (await head.boundingBox())!;
    await page.mouse.move(h.x + 40, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + 40 + 160, h.y + h.height / 2 + 120, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await w.boundingBox())!.x).toBeGreaterThan(before.x + 100);
    const s1 = await savedState(page);
    expect(s1.home.widgets[0].x).toBeGreaterThan(0);
    expect(s1.home.widgets[0].y).toBeGreaterThan(0);
    // Resize from its menu.
    await w.locator('[data-testid^="widget-menu-"]').click();
    await page.getByText('Size', { exact: true }).hover();
    await page.getByTestId('widget-size-wide').click();
    await expect.poll(async () => (await w.boundingBox())!.width).toBeGreaterThan(before.width + 100);
    // Remove.
    await w.locator('[data-testid^="widget-menu-"]').click();
    await page.getByTestId('widget-remove').click();
    await expect(widgets(page)).toHaveCount(0);
  });

  test('the weather widget asks for a place, then shows the forecast with switchable units', async ({ page }) => {
    await openApp(page);
    await addWidget(page, 'weather');
    await page.locator('input[data-testid^="wg-weather-place-"]').fill('lisbon');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('wg-weather-placename')).toHaveText('Lisbon');
    await expect(page.getByTestId('wg-weather-temp')).toHaveText('12°');
    await page.getByTestId('wg-weather-temp').click();
    await expect(page.getByTestId('wg-weather-temp')).toHaveText('54°');
    await expect(page.locator('.wg-weather-day')).toHaveCount(4);
  });

  test('to-do, calendar and timer widgets work', async ({ page }) => {
    await openApp(page);
    await addWidget(page, 'todo');
    await page.locator('input[data-testid^="wg-todo-input-"]').fill('Fly the kite');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('wg-todo-item')).toHaveCount(1);
    await page.getByRole('checkbox', { name: 'Mark done' }).click();
    await expect(page.getByTestId('wg-todo-item').first()).toHaveAttribute('data-done', 'true');
    await addWidget(page, 'calendar');
    await expect(page.locator('.wg-cal-day[data-today]')).toHaveCount(1);
    await addWidget(page, 'timer');
    await expect(page.getByTestId('wg-timer')).toContainText('25:00');
    await page.getByTestId('wg-timer-start').click();
    await expect(page.getByTestId('wg-timer')).toHaveAttribute('data-running', 'true');
  });

  test('shortcuts can be added, edited and removed from the page; the search engine switches in place', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('start-add-shortcut').click();
    await page.getByTestId('shortcut-url').fill('example.com');
    await page.getByTestId('shortcut-name').fill('Example');
    await page.getByTestId('shortcut-save').click();
    await expect(page.getByTestId('start-favorite')).toHaveCount(1);
    await expect(page.getByTestId('start-favorite')).toContainText('Example');
    await expect(page.locator('[data-testid^="fav-"]')).toHaveCount(1); // and in the sidebar's Favorites
    await page.getByTestId('start-favorite').click({ button: 'right' });
    await page.getByTestId('shortcut-edit').click();
    await page.getByTestId('shortcut-name').fill('Ex');
    await page.getByTestId('shortcut-save').click();
    await expect(page.getByTestId('start-favorite')).toContainText('Ex');
    await page.getByTestId('start-favorite').click({ button: 'right' });
    await page.getByTestId('shortcut-remove').click();
    await expect(page.getByTestId('start-favorite')).toHaveCount(0);
    // Engine chip.
    await expect(page.getByTestId('home-engine')).toContainText('Google');
    await page.getByTestId('home-engine').click();
    await page.getByTestId('home-engine-Kagi').click();
    await expect(page.getByTestId('home-engine')).toContainText('Kagi');
    await page.getByTestId('start-input').fill('kites');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('url-pill')).toContainText('kagi.com');
  });

  test('a picture from the + menu becomes the Space theme: home page, window frame and new tabs all show it', async ({ page }) => {
    await openApp(page);
    await customize(page);
    await page.getByTestId('home-background').hover();
    await page.getByTestId('home-bg-aurora').click();
    await expect(page.getByTestId('empty-state')).toHaveAttribute('data-backdrop', 'aurora');
    await expect(page.getByTestId('empty-state')).toHaveAttribute('data-tone', 'dark');
    await expect(page.getByTestId('start-bg')).toHaveCSS('background-image', /aurora.*\.jpg/);
    await expect(page.getByTestId('app')).toHaveAttribute('data-backdrop', 'aurora');
    await expect(page.getByTestId('app')).toHaveAttribute('data-theme', 'dark');
    const s = await savedState(page);
    expect(s.spaces[0].theme).toMatchObject({ backdrop: 'aurora', mode: 'dark', colors: ['#1b3646', '#3cf2b4'] });
    await addWidget(page, 'clock');
    await newTab(page, 'a.com');
    await page.getByTestId('btn-new-tab').click();
    await expect(page.getByTestId('start-page')).toHaveAttribute('data-backdrop', 'aurora');
    await expect(widgets(page)).toHaveCount(1);
    await customize(page);
    await page.getByTestId('home-toggle-frequent').click();
    expect((await savedState(page)).home.showFrequent).toBe(true);
    // Back to plain colours.
    await customize(page);
    await page.getByTestId('home-background').hover();
    await page.getByTestId('home-bg-none').click();
    await expect(page.getByTestId('start-page')).not.toHaveAttribute('data-backdrop', /.+/);
    await expect(page.getByTestId('app')).not.toHaveAttribute('data-backdrop', /.+/);
    await page.keyboard.press(`${MOD}+Comma`); // no crash with Settings over it
    await expect(page.getByTestId('settings')).toBeVisible();
  });

  test('the theme editor lists the pictures; picking a colour goes back to plain colours', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('space-menu').click();
    await page.getByTestId('menu-edit-space').click();
    // Colours, Gradient, Upload, and the 11 built-in pictures.
    await expect(page.locator('[data-testid^="backdrop-"][data-tone]')).toHaveCount(11);
    for (const id of ['backdrop-none', 'backdrop-gradient', 'backdrop-upload']) await expect(page.getByTestId(id)).toBeVisible();
    await page.getByTestId('backdrop-dunes').click();
    await expect(page.getByTestId('backdrop-dunes')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('app')).toHaveAttribute('data-backdrop', 'dunes');
    await expect(page.getByTestId('app')).toHaveAttribute('data-theme', 'light');
    await page.getByTestId('swatch-muted-9').click();
    await expect(page.getByTestId('backdrop-none')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('app')).not.toHaveAttribute('data-backdrop', /.+/);
    expect((await savedState(page)).spaces[0].theme.backdrop).toBeUndefined();
  });

});
