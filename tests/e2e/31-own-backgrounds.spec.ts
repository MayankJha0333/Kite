// Your own gradient and your own picture as a Space's background, on top of the plain
// Calm Air default Kite starts with.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect, openApp, savedState } from './fixtures';

const cssVar = (page: import('@playwright/test').Page, name: string) => page.getByTestId('app').evaluate((el, n) => getComputedStyle(el).getPropertyValue(n).trim(), name);

async function openThemeEditor(page: import('@playwright/test').Page) {
  await page.getByTestId('space-menu').click();
  await page.getByTestId('menu-edit-space').click();
  await expect(page.getByTestId('theme-controls')).toBeVisible();
}

test.describe('own backgrounds', () => {
  test('Kite starts on plain colours (Calm Air, following the system\'s light or dark); a gradient preset can be picked, and its colours, count and angle changed and saved', async ({ page }) => {
    await openApp(page);
    // One flat tint for the window frame: sea-glass by day, night chart after dark.
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.getByTestId('app')).toHaveAttribute('data-theme', 'dark');
    expect(await cssVar(page, '--backdrop')).toBe('#141c22');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.getByTestId('app')).toHaveAttribute('data-theme', 'light');
    expect(await cssVar(page, '--backdrop')).toBe('#e9f0ee');
    expect(await cssVar(page, '--accent')).toBe('#c2187a');
    await expect(page.getByTestId('empty-state')).not.toHaveAttribute('data-backdrop', 'gradient');
    await openThemeEditor(page);
    await expect(page.getByTestId('backdrop-none')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('backdrop-gradient').click(); // "Gradient…" opens the ready-made gradients and the editor
    await page.getByTestId('preset-tide').click();
    await expect(page.getByTestId('empty-state')).toHaveAttribute('data-backdrop', 'gradient');
    await expect(page.getByTestId('backdrop-gradient')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('gradient-editor')).toBeVisible();
    await page.getByTestId('grad-color-0').fill('#ff3366');
    await page.getByTestId('grad-add').click();
    await expect(page.locator('[data-testid^="grad-color-"]')).toHaveCount(4);
    await expect(page.getByTestId('grad-add')).toHaveCount(0); // four at most
    await page.getByTestId('grad-color-1').hover();
    await page.getByTestId('grad-remove-1').click();
    await expect(page.locator('[data-testid^="grad-color-"]')).toHaveCount(3);
    await page.getByTestId('grad-angle').fill('90');
    expect(await cssVar(page, '--backdrop')).toMatch(/^linear-gradient\(90deg/);
    const s = await savedState(page);
    expect(s.spaces[0].theme.gradient).toMatchObject({ angle: 90 });
    expect(s.spaces[0].theme.gradient.colors[0]).toBe('#ff3366');
    expect(s.spaces[0].theme.colors[0]).toBe('#ff3366');
    // A plain colour turns the gradient off.
    await page.getByTestId('swatch-muted-9').click();
    await expect(page.getByTestId('gradient-editor')).toHaveCount(0);
    expect((await savedState(page)).spaces[0].theme.gradient).toBeUndefined();
  });

  test('upload a picture: it paints the window and the home page, brings its own colours and tone, and stays after a reload', async ({ page }) => {
    await openApp(page);
    await openThemeEditor(page);
    const file = readFileSync(resolve(process.cwd(), 'src/renderer/assets/backgrounds/dawn.jpg'));
    await page.getByTestId('backdrop-picture').click(); // "Picture…" opens Kite's pictures and the slot for your own
    await page.getByTestId('backdrop-upload-input').setInputFiles({ name: 'my-dawn.jpg', mimeType: 'image/jpeg', buffer: file });
    await expect(page.getByTestId('backdrop-photo')).toHaveAttribute('aria-checked', 'true');
    // The first level shows what the Space has: Picture is the chosen background.
    await expect(page.getByTestId('backdrop-picture')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('app')).toHaveAttribute('data-backdrop', 'photo');
    await expect(page.getByTestId('app')).toHaveAttribute('data-theme', 'light'); // a light picture
    const s = await savedState(page);
    expect(s.spaces[0].theme.photo).toMatchObject({ id: expect.stringMatching(/^img-/), tone: 'light' });
    expect(s.spaces[0].theme.gradient).toBeUndefined();
    await page.getByTestId('space-done').click();
    await expect(page.getByTestId('empty-state')).toHaveAttribute('data-backdrop', 'photo');
    await expect(page.getByTestId('start-bg')).toHaveCSS('background-image', /^url\("blob:/);
    await page.reload();
    await expect(page.getByTestId('empty-state')).toHaveAttribute('data-backdrop', 'photo');
    await expect(page.getByTestId('app')).toHaveAttribute('data-backdrop', 'photo');
  });

  test('a file that is not a picture is refused with a message', async ({ page }) => {
    await openApp(page);
    await openThemeEditor(page);
    await page.getByTestId('backdrop-picture').click();
    await page.getByTestId('backdrop-upload-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(page.getByTestId('toast').filter({ hasText: 'That file isn’t a picture.' })).toBeVisible();
    expect((await savedState(page))?.spaces[0].theme.photo).toBeUndefined();
  });
});
