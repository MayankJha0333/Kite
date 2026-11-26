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
    await expect(page.getByTestId('history-count')).toHaveText('1 page matches');
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

  test('opens at once in the page’s corner, keeps the last search selected, and says “No matches” in the text only', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'https://words.com');
    await page.keyboard.press(`${MOD}+f`);
    const bar = page.getByTestId('find-bar');
    // Opened from the keyboard: it is simply there.
    expect(await bar.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
    const card = (await page.getByTestId('page-card').boundingBox())!;
    const box = (await bar.boundingBox())!;
    expect(Math.round(card.x + card.width - box.x - box.width)).toBe(8);
    expect(Math.round(box.y - card.y)).toBe(8); // under the string, never over it
    await page.getByTestId('find-input').fill('zzzqqq');
    await expect(page.getByTestId('find-count')).toHaveText('No matches');
    // The count turns red; the field does not.
    const [count, field, danger] = await bar.evaluate((el) => {
      const probe = document.createElement('i');
      probe.style.color = 'var(--danger)';
      el.append(probe);
      const out = [getComputedStyle(el.querySelector('.find-count')!).color, getComputedStyle(el.querySelector('input')!).color, getComputedStyle(probe).color];
      probe.remove();
      return out;
    });
    expect(count).toBe(danger);
    expect(field).not.toBe(danger);
    await page.getByTestId('find-input').fill('link');
    await page.keyboard.press('Escape');
    await page.keyboard.press(`${MOD}+f`);
    await expect(page.getByTestId('find-input')).toHaveValue('link');
    await expect(page.getByTestId('find-count')).toHaveText(/1 of \d+/);
    expect(await page.getByTestId('find-input').evaluate((el: HTMLInputElement) => el.selectionEnd! - el.selectionStart!)).toBe(4);
    for (const name of ['Previous match', 'Next match', 'Close find']) {
      const b = (await bar.getByRole('button', { name }).boundingBox())!;
      expect([b.width, b.height]).toEqual([24, 24]);
    }
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

  test('the site popover has the zoom control too, and hangs under the address field', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'https://zoom.com');
    await page.getByTestId('url-security').click();
    const info = page.getByTestId('site-info');
    await expect(page.getByTestId('site-info-zoom')).toHaveText('100%');
    await info.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByTestId('site-info-zoom')).toHaveText('120%');
    await expect(page.getByTestId('url-zoom')).toHaveText('120%');
    await info.getByRole('button', { name: 'Zoom out' }).click();
    await info.getByRole('button', { name: 'Zoom out' }).click();
    await expect(page.getByTestId('site-info-zoom')).toHaveText('83%');
    await page.getByTestId('site-info-zoom').click();
    await expect(page.getByTestId('url-zoom')).toHaveCount(0);
    const field = (await page.getByTestId('url-pill').boundingBox())!;
    const box = (await info.boundingBox())!;
    expect(Math.round(box.y - field.y - field.height)).toBe(6);
    expect(Math.round(box.x)).toBe(Math.round(field.x));
    expect(Math.round(box.width)).toBe(320);
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
