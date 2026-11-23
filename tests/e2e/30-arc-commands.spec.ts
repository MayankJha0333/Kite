// Sidebar and page commands Arc has that Kite gained for launch: a collapsible Pinned
// section, resetting every pinned tab of a Space, clearing a site's cookies or the cache
// and refreshing, and capturing the page. Also the two fixes behind them: a plain click on
// the Space name opens nothing, and closing a pinned tab inside a closed folder moves on
// to a neighbour instead of an empty window.

import type { Page } from '@playwright/test';
import { test, expect, openApp, newTab, pinnedRows, savedState, visibleFrame, MOD } from './fixtures';

const calls = (page: Page) => page.evaluate(() => [...((window as any).__kiteTest.calls as string[])]);

async function pinFirstToday(page: Page) {
  await page.locator('[data-testid=today-list] [data-testid^=row-]').first().click({ button: 'right' });
  await page.getByTestId('menu-pin').click();
}

async function runAction(page: Page, title: string) {
  await page.keyboard.press(`${MOD}+t`);
  await page.getByTestId('cb-input').fill(title);
  await page.getByTestId('cb-result-action').first().click();
}

test.describe('Arc sidebar commands', () => {
  test('Collapse Pinned Section hides the pinned tabs but keeps the open one in view; Expand brings them back', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    await newTab(page, 'c.com');
    await pinFirstToday(page);
    await pinFirstToday(page);
    await expect(pinnedRows(page)).toHaveCount(2);
    await pinnedRows(page).first().click();
    await page.getByTestId('space-menu').click();
    await page.getByTestId('menu-pinned-toggle').click();
    // Only the tab you are on stays visible, and the divider says how many are folded away.
    await expect(page.getByTestId('pinned-list')).toHaveAttribute('data-collapsed', 'true');
    await expect(page.getByTestId('pinned-peek').locator('[data-testid^=row-]')).toHaveCount(1);
    await expect(page.getByTestId('pinned-toggle')).toContainText('2 pinned');
    expect((await savedState(page)).spaces[0].pinnedCollapsed).toBe(true);
    // Opening a Today tab leaves nothing pinned in view; the toggle expands it again.
    await page.locator('[data-testid=today-list] [data-testid^=row-]').first().click();
    await expect(page.getByTestId('pinned-peek')).toHaveCount(0);
    await page.getByTestId('pinned-toggle').click();
    await expect(pinnedRows(page)).toHaveCount(2);
    expect((await savedState(page)).spaces[0].pinnedCollapsed).toBeUndefined();
  });

  test('Reset All Tabs in This Space sends every wandered pinned tab back to its pinned page', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    await pinFirstToday(page);
    await pinFirstToday(page);
    for (let i = 0; i < 2; i++) {
      await pinnedRows(page).nth(i).click();
      await visibleFrame(page).locator('a').first().click();
      await expect(page.getByTestId('url-pill')).toContainText('page-2');
    }
    await page.getByTestId('space-menu').click();
    await page.getByTestId('menu-reset-space').click();
    await expect(page.getByTestId('toast')).toContainText('2 tabs back on their pinned page');
    const s = await savedState(page);
    for (const id of s.spaces[0].pinned) expect(s.items[id].url).toBe(s.items[id].homeUrl);
    await expect(page.getByTestId('url-pill')).not.toContainText('page-2');
  });

  test('closing a pinned tab inside a closed folder moves to a neighbour, not an empty window', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    await pinFirstToday(page);
    await pinFirstToday(page);
    await page.getByTestId('space-menu').click();
    await page.getByTestId('menu-new-folder').click();
    await page.keyboard.press('Enter');
    const fid = (await page.locator('.folder').first().getAttribute('data-testid'))!.replace('folder-', '');
    for (let i = 0; i < 2; i++) {
      await page.locator('[data-testid=pinned-list] > [data-testid^=row-tab]').first().click({ button: 'right' });
      await page.getByText('Move to Folder').hover();
      await page.getByTestId(`menu-folder-${fid}`).click();
    }
    await page.locator(`[data-testid=folder-children-${fid}] [data-testid^=row-]`).first().click();
    await page.locator(`[data-testid=row-${fid}]`).click(); // close the folder; the open tab peeks under it
    await expect(page.getByTestId(`folder-peek-${fid}`)).toBeVisible();
    await page.locator(`[data-testid=folder-peek-${fid}] [data-testid^=close-]`).click();
    await expect(page.locator('.row[data-active]')).toHaveCount(1);
    await expect(page.getByTestId('empty-state')).toHaveCount(0);
  });
});

test.describe('Arc page commands', () => {
  test('Clear Cookies and Refresh / Clear Cache and Refresh act on the site you are on', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'https://shop.example.com/cart');
    await runAction(page, 'Clear Cookies and Refresh');
    await expect(page.getByTestId('toast').filter({ hasText: 'Cookies and site data for shop.example.com cleared' })).toBeVisible();
    await runAction(page, 'Clear Cache and Refresh');
    await expect(page.getByTestId('toast').filter({ hasText: 'Cache cleared' })).toBeVisible();
    const c = await calls(page);
    expect(c).toContain('clear:shop.example.com:cookies+storage');
    expect(c).toContain('clear:shop.example.com:cache');
  });

  test('Capture and Capture Full Page save a picture and offer to show it; nothing to capture on the home page', async ({ page }) => {
    await openApp(page);
    await runAction(page, 'Capture Full Page');
    await expect(page.getByTestId('toast').filter({ hasText: 'Open a website first' })).toBeVisible();
    await newTab(page, 'a.com');
    await page.keyboard.press(`${MOD}+Shift+2`);
    const captured = page.getByTestId('toast').filter({ hasText: 'Captured · copied, saved to Downloads' });
    await expect(captured).toBeVisible();
    await captured.getByText('Show').click();
    await page.keyboard.press(`${MOD}+Shift+1`);
    await expect(page.getByTestId('toast').filter({ hasText: 'Full page captured' })).toBeVisible();
    const c = await calls(page);
    expect(c.filter((x) => x === 'capture')).toHaveLength(1);
    expect(c.filter((x) => x === 'captureFull')).toHaveLength(1);
    expect(c.some((x) => x.startsWith('reveal:/tmp/Capture'))).toBe(true);
  });
});
