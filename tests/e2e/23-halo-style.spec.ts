import type { Page } from '@playwright/test';
import { test, expect, openApp, newTab, savedState, MOD } from './fixtures';

const app = (page: Page) => page.getByTestId('app');
const cssVar = (page: Page, name: string) => app(page).evaluate((el, n) => getComputedStyle(el).getPropertyValue(n).trim(), name);
const SHOTS = process.env.HALO_SHOTS;

test.describe('Halo style (measured from Arc)', () => {
  test('the Halo theme applies white-pill tabs, the grey scale, system type and spring motion', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    await page.keyboard.press(`${MOD}+Comma`);
    await page.getByTestId('look-theme-halo-indigo').click();
    await page.getByTestId('look-apply').click();
    await expect(app(page)).toHaveAttribute('data-style', 'halo');
    await expect.poll(async () => (await savedState(page)).settings).toMatchObject({ font: 'system', radius: 10, look: { style: 'halo' } });
    expect(await cssVar(page, '--gray-12')).toBe('#171717');
    expect(await cssVar(page, '--press-ease')).toMatch(/^linear\(0,/);
    expect(await cssVar(page, '--ease')).toMatch(/^linear\(0,/);
    // While a page loads, Halo shows the glow ring and hides the bar.
    await expect(page.locator('.load-bar')).toBeHidden();
    await expect(page.locator('.load-glow')).toHaveCount(1);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/halo-settings.png` });
    await page.keyboard.press('Escape');
    await page.keyboard.press(`${MOD}+Comma`);
    await page.keyboard.press('Escape');
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/halo-light.png` });
      await page.keyboard.press(`${MOD}+t`);
      await page.keyboard.type('b');
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/halo-commandbar.png` });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOTS}/halo-tabs.png` });
      await page.keyboard.press(`${MOD}+Comma`);
      await page.getByTestId('settings-spaces').click();
      await page.getByTestId('look-mode-dark').click();
      await page.getByTestId('look-apply').click();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOTS}/halo-dark.png` });
    }
  });

  test('the colour wheel paints the Space from one hue', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+Comma`);
    await page.getByTestId('settings-spaces').click();
    await page.getByTestId('bg-wheel-hue').fill('120');
    await page.getByTestId('bg-wheel-harmony-opposite').click();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/halo-wheel.png` });
    await page.getByTestId('look-apply').click();
    await expect.poll(async () => (await savedState(page)).spaces[0].theme.colors[1]).toMatch(/^#/);
    const [a, b] = (await savedState(page)).spaces[0].theme.colors as [string, string];
    // First colour: light green. Second: the opposite hue (magenta).
    const g = (hex: string) => parseInt(hex.slice(3, 5), 16);
    expect(g(a)).toBeGreaterThan(parseInt(a.slice(1, 3), 16));
    expect(g(b)).toBeLessThan(parseInt(b.slice(1, 3), 16));
  });

  test('Springy motion feel works with any style', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+Comma`);
    await page.getByTestId('settings-motion').click();
    await page.getByTestId('set-feel-spring').click();
    await expect.poll(async () => (await savedState(page)).settings.motionFeel).toBe('spring');
    expect(await cssVar(page, '--ease')).toMatch(/^linear\(0,/);
    expect(await cssVar(page, '--press-ease')).toMatch(/^linear\(0,/);
  });
});
