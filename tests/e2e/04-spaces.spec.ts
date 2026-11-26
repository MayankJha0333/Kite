import type { Page } from '@playwright/test';
import { test, expect, openApp, newTab, todayRows, pinnedRows, activeRowTitle, savedState, visibleFrame, MOD } from './fixtures';

async function addSpace(page: Page, name: string, swatch?: string) {
  await page.getByTestId('btn-new-space').click();
  await expect(page.getByTestId('space-editor')).toBeVisible();
  await page.getByTestId('space-name-input').fill(name);
  // The first row of colors is always there; the others are behind "Custom…".
  if (swatch && !swatch.startsWith('muted-')) await page.getByTestId('theme-custom-toggle').click();
  if (swatch) await page.getByTestId(`swatch-${swatch}`).click();
  await page.getByTestId('space-done').click();
  await expect(page.getByTestId('space-editor')).toHaveCount(0);
}

function spaceBtn(page: Page, name: string) {
  return page.locator(`[data-testid^="space-"][data-name="${name}"]`);
}

test.describe('spaces', () => {
  test('create a Space, name it, and switch between Spaces', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'home.com');
    await addSpace(page, 'Work', 'pastel-7');
    await expect(page.getByTestId('space-name')).toHaveText('Work');
    await expect(todayRows(page)).toHaveCount(0);
    await newTab(page, 'work.com');
    await spaceBtn(page, 'Home').click();
    await expect(page.getByTestId('space-name')).toHaveText('Home');
    expect(await activeRowTitle(page)).toBe('home.com');
    await expect(visibleFrame(page).locator('#title')).toHaveText('home.com');
    await spaceBtn(page, 'Work').click();
    expect(await activeRowTitle(page)).toBe('work.com');
  });

  test('a plain click on the Space name opens nothing; its menu comes from the … button, right-click or Enter; double-click renames', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('space-name').click();
    await expect(page.getByTestId('context-menu')).toHaveCount(0);
    await page.getByTestId('space-menu').click();
    const menu = page.getByTestId('menu-edit-space');
    await expect(menu).toBeVisible();
    const header = (await page.getByTestId('space-header').boundingBox())!;
    const item = (await menu.boundingBox())!;
    expect(item.y).toBeGreaterThan(header.y + header.height - 1);
    await menu.click();
    await expect(page.getByTestId('space-editor')).toBeVisible();
    await page.getByTestId('space-done').click();
    await expect(page.getByTestId('space-editor')).toHaveCount(0);

    // Arc renames a Space right in its header.
    await page.getByTestId('space-name').dblclick();
    await expect(page.getByTestId('menu-edit-space')).toHaveCount(0);
    await expect(page.getByTestId('space-rename-input')).toBeFocused();
    await page.getByTestId('space-rename-input').fill('Personal');
    await page.getByTestId('space-rename-input').press('Enter');
    await expect(page.getByTestId('space-name')).toHaveText('Personal');
    // Esc puts the old name back.
    await page.getByTestId('space-name').dblclick();
    await page.getByTestId('space-rename-input').fill('Nope');
    await page.getByTestId('space-rename-input').press('Escape');
    await expect(page.getByTestId('space-name')).toHaveText('Personal');

    await page.getByTestId('space-header').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('menu-edit-space')).toBeVisible();
  });

  test('each Space has its own colors on the window', async ({ page }) => {
    await openApp(page);
    const before = await page.getByTestId('app').evaluate((el) => getComputedStyle(el).getPropertyValue('--tint-1'));
    await addSpace(page, 'Ocean', 'muted-9');
    const after = await page.getByTestId('app').evaluate((el) => getComputedStyle(el).getPropertyValue('--tint-1'));
    expect(after.trim()).toBe('#2d4468');
    expect(after).not.toBe(before);
  });

  test('custom colors, appearance and strength apply live', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('space-menu').click();
    await page.getByTestId('menu-edit-space').click();
    await page.getByTestId('theme-custom-toggle').click();
    await page.getByTestId('color-a').fill('#123456');
    await expect(page.getByTestId('app')).toHaveCSS('--tint-1', '#123456');
    await page.getByTestId('space-mode-dark').click();
    await expect(page.getByTestId('app')).toHaveAttribute('data-theme', 'dark');
    await page.getByTestId('space-mode-light').click();
    await expect(page.getByTestId('app')).toHaveAttribute('data-theme', 'light');
    // Grain is off on the default (Quiet) look: one click turns it on, another turns it off.
    await page.getByTestId('space-grain').click();
    await expect(page.getByTestId('app')).toHaveCSS('--grain-opacity', '.16');
    await page.getByTestId('space-grain').click();
    await expect(page.getByTestId('app')).toHaveCSS('--grain-opacity', '0');
    await page.getByTestId('space-intensity').fill('0');
    const s = await savedState(page);
    expect(s.spaces[0].theme).toMatchObject({ colors: ['#123456', expect.any(String)], mode: 'light', grain: false, intensity: 0 });
  });

  test('icon from the picker or typed', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('space-menu').click();
    await page.getByTestId('menu-edit-space').click();
    await page.locator('.emoji', { hasText: '🚀' }).click();
    await expect(page.locator('.space-header .space-icon')).toHaveText('🚀');
    await page.getByTestId('space-icon-input').fill('Z');
    await expect(page.locator('.space-header .space-icon')).toHaveText('Z');
  });

  test('⌃1/⌃2 and ⌘⌥→/← switch Spaces', async ({ page }) => {
    await openApp(page);
    await addSpace(page, 'Two');
    await addSpace(page, 'Three');
    await page.keyboard.press('Control+1');
    await expect(page.getByTestId('space-name')).toHaveText('Home');
    await page.keyboard.press('Control+2');
    await expect(page.getByTestId('space-name')).toHaveText('Two');
    await page.keyboard.press(`${MOD}+Alt+ArrowRight`);
    await expect(page.getByTestId('space-name')).toHaveText('Three');
    await page.keyboard.press(`${MOD}+Alt+ArrowRight`);
    await expect(page.getByTestId('space-name')).toHaveText('Home');
    await page.keyboard.press(`${MOD}+Alt+ArrowLeft`);
    await expect(page.getByTestId('space-name')).toHaveText('Three');
  });

  test('two-finger swipe on the sidebar switches Spaces', async ({ page }) => {
    await openApp(page);
    await addSpace(page, 'Two');
    await page.getByTestId('sb-scroll').hover();
    await page.mouse.wheel(140, 0);
    await expect(page.getByTestId('space-name')).toHaveText('Home');
    await page.waitForTimeout(500);
    await page.mouse.wheel(-140, 0);
    await expect(page.getByTestId('space-name')).toHaveText('Two');
  });

  test('drag a tab onto another Space moves it there', async ({ page }) => {
    await openApp(page);
    await addSpace(page, 'Work');
    await spaceBtn(page, 'Home').click();
    await newTab(page, 'move-me.com');
    const row = todayRows(page).first();
    const a = (await row.boundingBox())!;
    const b = (await spaceBtn(page, 'Work').boundingBox())!;
    await page.mouse.move(a.x + 40, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(todayRows(page)).toHaveCount(0);
    await spaceBtn(page, 'Work').click();
    await expect(todayRows(page)).toHaveCount(1);
  });

  test('pinned tabs stay with their own Space', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await page.keyboard.press(`${MOD}+d`);
    await addSpace(page, 'Two');
    await expect(pinnedRows(page)).toHaveCount(0);
    await spaceBtn(page, 'Home').click();
    await expect(pinnedRows(page)).toHaveCount(1);
  });

  test('delete a Space (its tabs go to the Archive) and undo', async ({ page }) => {
    await openApp(page);
    await addSpace(page, 'Temp');
    await newTab(page, 'temp.com');
    await spaceBtn(page, 'Temp').click({ button: 'right' });
    await page.getByTestId('menu-delete-space').click();
    await expect(spaceBtn(page, 'Temp')).toHaveCount(0);
    await expect(page.getByTestId('space-name')).toHaveText('Home');
    let s = await savedState(page);
    expect(s.archive[0].url).toBe('https://temp.com');
    await page.getByTestId('toast').getByText('Undo').click();
    await expect(spaceBtn(page, 'Temp')).toHaveCount(1);
    s = await savedState(page);
    expect(s.spaces).toHaveLength(2);
  });

  test('the only Space cannot be deleted', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('space-menu').click();
    await expect(page.getByTestId('menu-delete-space')).toBeDisabled();
  });

  test('reorder Spaces from the menu', async ({ page }) => {
    await openApp(page);
    await addSpace(page, 'Two');
    await spaceBtn(page, 'Two').click({ button: 'right' });
    await page.getByTestId('menu-more').click();
    await page.getByTestId('menu-space-left').click();
    const names = await page.locator('[data-testid="space-bar"] [role="tab"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-name')));
    expect(names).toEqual(['Two', 'Home']);
  });

  test('Spaces survive restart, including which one was open', async ({ page }) => {
    await openApp(page);
    await addSpace(page, 'Work', 'muted-7');
    await savedState(page);
    await page.reload();
    await expect(page.getByTestId('space-name')).toHaveText('Work');
    await expect(page.locator('[data-testid="space-bar"] [role="tab"]')).toHaveCount(2);
  });
});

test.describe('Space header and switcher: look', () => {
  test('the Space name is a quiet label over its list, not a row', async ({ page }) => {
    await openApp(page);
    const name = page.getByTestId('space-name');
    const label = await name.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { weight: cs.fontWeight, transform: cs.textTransform, size: parseFloat(cs.fontSize) };
    });
    expect(label).toEqual({ weight: '600', transform: 'none', size: 11 });
    // "Today" is the same kind of label.
    const today = page.getByTestId('sidebar').getByText('Today', { exact: true });
    expect(await today.evaluate((el) => [getComputedStyle(el).fontWeight, parseFloat(getComputedStyle(el).fontSize)])).toEqual(['600', 11]);
    expect(await today.evaluate((el) => getComputedStyle(el).color)).toBe(await name.evaluate((el) => getComputedStyle(el).color));
  });

  test('the Pinned fold lives in the Space header: hidden until pointed at, always shown when folded', async ({ page }) => {
    await openApp(page);
    await expect(page.getByTestId('pinned-toggle')).toHaveCount(0); // nothing pinned, nothing to fold
    await newTab(page, 'a.com');
    await page.keyboard.press(`${MOD}+d`);
    const toggle = page.getByTestId('pinned-toggle');
    await expect(toggle).toHaveCSS('opacity', '0');
    await page.getByTestId('space-header').hover();
    await expect(toggle).toHaveCSS('opacity', '1');
    await toggle.click();
    await expect(page.getByTestId('pinned-list')).toHaveAttribute('data-collapsed', 'true');
    await page.mouse.move(600, 400);
    await expect(toggle).toHaveCSS('opacity', '1');
    await expect(toggle).toContainText('1 pinned');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('the Space menu is short: one way into the editor, housekeeping under More', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('space-menu').click();
    const top = await page.getByTestId('context-menu').first().locator('[data-testid^="menu-"]').evaluateAll((els) => els.map((e) => e.textContent?.trim()));
    expect(top).toEqual(['Rename Space', 'Edit Space…', 'New Folder', 'Collapse Pinned Section', 'More', 'Delete Space…']);
    await page.getByTestId('menu-more').click();
    for (const id of ['menu-collapse-all', 'menu-expand-all', 'menu-reset-space', 'menu-space-left', 'menu-space-right', 'menu-space-to-folder']) await expect(page.getByTestId(id)).toBeVisible();
    // With only one Space there is nowhere to turn it into a folder.
    await expect(page.getByTestId('menu-space-to-folder')).toBeDisabled();
    await page.keyboard.press('Escape');
  });

  test('every Space in the switcher is at full strength; the current one is marked; the keyboard ring is not clipped', async ({ page }) => {
    await openApp(page);
    await addSpace(page, 'Work');
    const home = spaceBtn(page, 'Home');
    const work = spaceBtn(page, 'Work');
    for (const dot of [home, work]) expect(await dot.evaluate((el) => [getComputedStyle(el).opacity, getComputedStyle(el).filter])).toEqual(['1', 'none']);
    await expect(work).toHaveAttribute('aria-selected', 'true');
    expect(await work.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(await home.evaluate((el) => getComputedStyle(el).backgroundColor));
    // A real outline, drawn inside the button, so the scrolling bar cannot cut it off.
    await home.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(home).toBeFocused();
    expect(await home.evaluate((el) => [getComputedStyle(el).outlineStyle, getComputedStyle(el).outlineOffset])).toEqual(['solid', '-2px']);
  });
});
