// A sweep over every menu, sheet and page: nothing may overlap, spill or fall outside the
// window. This is the automatic eye for "the hint wrapped into the row below" bugs: a new
// menu item, a longer label, or a smaller window shows up here, not in a screenshot.

import type { Page } from '@playwright/test';
import { test, expect, openApp, newTab, todayRows, expectTidy, MOD } from './fixtures';

const SETTINGS_SECTIONS = ['spaces', 'layout', 'motion', 'tabs', 'links', 'adblock', 'privacy', 'extensions', 'keys', 'data', 'about'];

async function menuOpen(page: Page) {
  await expect(page.getByTestId('context-menu')).toBeVisible();
  await page.waitForTimeout(150); // menu-in animation
}

async function submenu(page: Page, parentTestId: string) {
  await page.getByTestId(parentTestId).hover();
  await expect(page.getByTestId('context-submenu')).toBeVisible();
  await page.waitForTimeout(150);
  await expectTidy(page, '[data-testid=context-submenu]', `${parentTestId} submenu`);
}

function sweep(name: string, viewport: { width: number; height: number }) {
  test.describe(name, () => {
    test.use({ viewport });

    test('home page and its menus', async ({ page }) => {
      await openApp(page);
      await newTab(page, 'github.com');
      await page.getByTestId('btn-new-tab').click();
      await expectTidy(page, '[data-testid=start-page]', 'home page');
      await page.getByTestId('home-customize').click();
      await menuOpen(page);
      await expectTidy(page, '[data-testid=context-menu]', 'home + menu');
      await submenu(page, 'home-add-widget');
      await submenu(page, 'home-background');
      await page.keyboard.press('Escape');
      for (const k of ['clock', 'weather', 'todo', 'calendar', 'note', 'timer']) {
        await page.getByTestId('home-customize').click();
        await page.getByTestId('home-add-widget').hover();
        await page.getByTestId(`home-widget-${k}`).click();
      }
      await page.waitForTimeout(300);
      await expectTidy(page, '[data-testid=home-widgets]', 'widgets');
      await page.locator('[data-testid^="widget-menu-"]').first().click();
      await menuOpen(page);
      await expectTidy(page, '[data-testid=context-menu]', 'widget menu');
      await page.getByText('Size', { exact: true }).hover();
      await expect(page.getByTestId('context-submenu')).toBeVisible();
      await expectTidy(page, '[data-testid=context-submenu]', 'widget size submenu');
      await page.keyboard.press('Escape');
      await page.getByTestId('start-add-shortcut').click();
      await expectTidy(page, '[data-testid=shortcut-editor]', 'shortcut editor');
    });

    test('sidebar menus and the command bar', async ({ page }) => {
      await openApp(page);
      await newTab(page, 'github.com');
      await newTab(page, 'en.wikipedia.org/wiki/Kite');
      await todayRows(page).first().click({ button: 'right' });
      await menuOpen(page);
      await expectTidy(page, '[data-testid=context-menu]', 'tab menu');
      await page.keyboard.press('Escape');
      await page.getByTestId('space-menu').first().click();
      await menuOpen(page);
      await expectTidy(page, '[data-testid=context-menu]', 'Space menu');
      await page.keyboard.press('Escape');
      await page.keyboard.press(`${MOD}+t`);
      await page.getByTestId('cb-input').fill('ki');
      await expect(page.locator('[data-testid^="cb-result-"]').first()).toBeVisible();
      await expectTidy(page, '[data-testid=command-bar]', 'command bar');
    });

    test('settings, history and the archive', async ({ page }) => {
      await openApp(page);
      await newTab(page, 'github.com');
      await page.keyboard.press(`${MOD}+Comma`);
      await expect(page.getByTestId('settings')).toBeVisible();
      await page.waitForTimeout(350);
      for (const id of SETTINGS_SECTIONS) {
        await page.getByTestId(`settings-${id}`).click();
        await page.waitForTimeout(300);
        await expectTidy(page, '[data-testid=settings]', `Settings › ${id}`);
      }
      await page.keyboard.press('Escape');
      await page.keyboard.press(`${MOD}+Shift+h`);
      await expect(page.getByTestId('history-page')).toBeVisible();
      await page.waitForTimeout(300);
      await expectTidy(page, '[data-testid=history-page]', 'History');
      await page.keyboard.press('Escape');
      await page.getByTestId('btn-archive').click();
      await expect(page.getByTestId('archive-page')).toBeVisible();
      await page.waitForTimeout(300);
      await expectTidy(page, '[data-testid=archive-page]', 'Archive');
    });
  });
}

sweep('layout sweep · 1280×800', { width: 1280, height: 800 });
sweep('layout sweep · small window 1000×640', { width: 1000, height: 640 });
