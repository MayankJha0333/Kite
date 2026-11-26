import { test, expect, openApp, newTab, todayRows, MOD } from './fixtures';

test.describe('little window', () => {
  test('⌘⌥N and ⌥⌘-click ask for a little window', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await page.keyboard.press(`${MOD}+Alt+n`);
    await page.frameLocator('.surface-slot[data-visible] iframe').locator('#external').click({ modifiers: ['Alt', 'Meta'] });
    const opened = await page.evaluate(() => window.__kiteTest!.littleOpened);
    expect(opened).toEqual(['kite://new', 'https://elsewhere.test/article']);
    await expect(todayRows(page)).toHaveCount(1); // the page itself didn't navigate
    await expect(page.getByTestId('url-pill')).toHaveText('a.com');
  });

  test('a blank little window starts with a search box', async ({ page }) => {
    await page.goto('/?platform=darwin&mode=little');
    await expect(page.getByTestId('little-input')).toBeFocused();
    await page.getByTestId('little-input').fill('quick.example');
    await page.getByTestId('little-input').press('Enter');
    await expect(page.getByTestId('little-url')).toContainText('quick.example');
    await expect(page.frameLocator('iframe').locator('#title')).toHaveText('quick.example');
  });

  test('shows the page and moves it to the main window (any Space)', async ({ page }) => {
    await page.goto('/?platform=darwin&mode=little&url=' + encodeURIComponent('https://read.example/story'));
    await expect(page.getByTestId('little-url')).toContainText('read.example/story');
    await page.getByTestId('little-open-main').click();
    let moved = await page.evaluate(() => window.__kiteTest!.littleMoved);
    expect(moved).toEqual([{ url: 'https://read.example/story', spaceId: null }]);
    await page.getByTestId('little-open-menu').click();
    await page.locator('[data-testid^="little-space-"]').first().click();
    moved = await page.evaluate(() => window.__kiteTest!.littleMoved);
    expect(moved[1].spaceId).not.toBeNull();
  });

  test('its bar says what the page is, offers Open in Kite, and keeps the rest in a menu', async ({ page }) => {
    await page.goto('/?platform=darwin&mode=little&url=' + encodeURIComponent('https://read.example/story'));
    const little = page.getByTestId('little');
    await expect(little).toHaveAttribute('data-mac', 'true');
    // The site in full ink, the rest of the address quieter.
    const [site, rest] = await page.getByTestId('little-url').evaluate((el) => [getComputedStyle(el.querySelector('b')!).color, getComputedStyle(el).color]);
    expect(site).not.toBe(rest);
    await expect(page.getByTestId('little-url').locator('b')).toHaveText('read.example');
    await expect(page.getByTestId('little-open-main')).toHaveText('Open in Kite');
    // The window is drawn from the same tokens as the main one.
    expect(await little.evaluate((el) => getComputedStyle(el).getPropertyValue('--thread-w').trim())).toBe('2px');
    await page.getByTestId('little-open-menu').click();
    await expect(page.getByRole('menuitem')).toHaveText([/^Open in .+/, 'Reload', 'Copy link', /^Close window/]);
    await page.keyboard.press('Escape'); // Esc backs out of the menu first
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(little).toBeVisible();
  });

  test('with nothing open it says what it is for, in its own empty state', async ({ page }) => {
    await page.goto('/?platform=darwin&mode=little');
    await expect(page.locator('.little-empty')).toContainText('A quick look-up');
    await expect(page.locator('.little-empty .contour-field')).toHaveCount(1);
    await expect(page.locator('.empty')).toHaveCount(0); // the shared empty state is a different thing
  });

  test('links inside the little window navigate it; click the address to edit', async ({ page }) => {
    await page.goto('/?platform=darwin&mode=little&url=' + encodeURIComponent('https://read.example/'));
    await page.frameLocator('iframe').locator('#same').click();
    await expect(page.getByTestId('little-url')).toContainText('read.example/page-2');
    await page.getByTestId('little-url').click();
    await page.getByTestId('little-input').fill('other.example');
    await page.getByTestId('little-input').press('Enter');
    await expect(page.getByTestId('little-url')).toContainText('other.example');
  });

  test('the main window opens a page handed over from a little window', async ({ page }) => {
    await openApp(page);
    // Simulate the hand-over event the main process delivers after "Open in Kite".
    await page.evaluate(() => window.__kiteTest!.handOver('https://handed.example/', null));
    await expect(todayRows(page)).toHaveCount(1);
    await expect(page.getByTestId('url-pill')).toHaveText('handed.example');
  });

  test('a little window that archived itself shows up in the Archive', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => window.__kiteTest!.littleArchived('https://brief.example/', 'Brief look'));
    await page.keyboard.press(`${MOD}+y`);
    await expect(page.getByTestId('archive-row')).toHaveAttribute('data-title', 'Brief look');
  });
});
