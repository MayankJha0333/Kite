import { test, expect, openApp, newTab, todayRows, visibleFrame, MOD } from './fixtures';

test.describe('history page', () => {
  test('lists visited pages newest first, searches, reopens, forgets and clears', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'https://alpha.com/one');
    await newTab(page, 'https://beta.com');
    await page.keyboard.press(`${MOD}+Shift+h`);
    await expect(page.getByTestId('history-page')).toBeVisible();
    const rows = page.getByTestId('history-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toHaveAttribute('data-url', 'https://beta.com');
    await expect(page.getByTestId('history-group').first().locator('.arch-day')).toHaveText('Today');
    await expect(page.getByTestId('history-count')).toHaveText('2 pages');
    // Search narrows it.
    await page.getByTestId('history-search').fill('alpha');
    await expect(rows).toHaveCount(1);
    await expect(page.getByTestId('history-count')).toHaveText('1 page match');
    // Opening one makes a new tab and closes the page.
    await rows.first().getByTestId('history-open').click();
    await expect(page.getByTestId('history-page')).toHaveCount(0);
    await expect(todayRows(page)).toHaveCount(3);
    // Forget one entry; then clear everything.
    await page.keyboard.press(`${MOD}+Shift+h`);
    await page.getByTestId('history-search').fill('');
    await expect(rows).toHaveCount(2);
    await rows.first().getByTestId('history-delete').click();
    await expect(rows).toHaveCount(1);
    await page.getByTestId('history-clear').click();
    await page.getByTestId('history-clear-all').click();
    await expect(page.getByTestId('history-empty')).toBeVisible();
    // Undo brings it back.
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(rows).toHaveCount(1);
  });

  test('is reachable from the command bar and from Privacy settings', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('history');
    await expect(page.getByTestId('cb-results').locator('[data-kind=action]').first()).toContainText('History');
    await page.getByTestId('cb-input').press('Enter');
    await expect(page.getByTestId('history-page')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press(`${MOD}+Comma`);
    await page.getByTestId('settings-privacy').click();
    await page.getByTestId('set-open-history').click();
    await expect(page.getByTestId('history-page')).toBeVisible();
  });
});

test.describe('find in page', () => {
  test('shows how many matches there are and which one is current', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'https://words.com');
    await expect(visibleFrame(page).locator('h1')).toBeVisible();
    await page.keyboard.press(`${MOD}+f`);
    await expect(page.getByTestId('find-input')).toBeFocused();
    await page.getByTestId('find-input').fill('link');
    await expect(page.getByTestId('find-count')).toHaveText(/1 of \d+/);
    await page.getByTestId('find-input').press('Enter');
    await expect(page.getByTestId('find-count')).toHaveText(/2 of \d+/);
    await page.getByTestId('find-input').fill('zzzqqq');
    await expect(page.getByTestId('find-count')).toHaveText('No matches');
    await expect(page.getByTestId('find-bar')).toHaveAttribute('data-none', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('find-bar')).toHaveCount(0);
  });
});

test.describe('zoom', () => {
  test('the address bar shows the zoom level and a click resets it; ⌘0 resets too', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'https://zoom.com');
    await expect(page.getByTestId('url-zoom')).toHaveCount(0);
    await page.keyboard.press(`${MOD}+=`);
    await expect(page.getByTestId('url-zoom')).toHaveText('120%');
    await page.keyboard.press(`${MOD}+=`);
    await expect(page.getByTestId('url-zoom')).toHaveText('144%');
    await page.getByTestId('url-zoom').click();
    await expect(page.getByTestId('url-zoom')).toHaveCount(0);
    await page.keyboard.press(`${MOD}+-`);
    await expect(page.getByTestId('url-zoom')).toHaveText('83%');
    await page.keyboard.press(`${MOD}+0`);
    await expect(page.getByTestId('url-zoom')).toHaveCount(0);
  });
});

test.describe('about', () => {
  test('shows the version from the build and offers the data folder and shortcuts', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+Comma`);
    await page.getByTestId('settings-advanced').click();
    await expect(page.getByTestId('about-version')).toContainText(/Version \d+\.\d+\.\d+/);
    await expect(page.getByTestId('about-details')).toBeVisible();
    await page.getByTestId('about-shortcuts').click();
    await expect(page.getByTestId('key-btn-commandBar')).toBeVisible();
  });
});

test.describe('view page source', () => {
  test('opens the page’s HTML in a Kite tab, with line numbers, wrap and copy', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'https://source.com/page');
    await page.evaluate(() => (window as any).__kiteTest.shortcut('viewSource'));
    await expect(todayRows(page)).toHaveCount(2);
    await expect(todayRows(page).first()).toContainText('Source of source.com');
    await expect(page.getByTestId('url-pill')).toContainText('view-source:source.com/page');
    await expect(page.getByTestId('source-text')).toContainText('Simulated source of https://source.com/page');
    await expect(page.getByTestId('source-text').locator('tr')).toHaveCount(6);
    await page.getByRole('button', { name: 'Wrap' }).click();
    await expect(page.getByTestId('source-view')).toHaveAttribute('data-wrap', 'true');
    // Typing view-source: in the command bar does the same.
    await newTab(page, 'view-source:https://other.com');
    await expect(page.getByTestId('url-pill')).toContainText('view-source:other.com');
  });
});
