// The first run: three steps over the page area, once, on a brand-new profile.
// (Every other test also starts on a new profile and meets the plain start page: a browser
// driven by automation only gets the first run when the address asks for it.)

import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, openApp, savedState, todayRows, expectTidy, MOD } from './fixtures';

const ARC = readFileSync(join(process.cwd(), 'tests/fixtures/arc-sidebar.json'), 'utf8');

async function firstLaunch(page: Page) {
  await page.goto('/?platform=darwin&firstrun=1');
  await expect(page.getByTestId('sidebar')).toBeVisible();
  await expect(page.getByTestId('welcome')).toBeVisible();
}

const step = (page: Page) => page.getByTestId('welcome-step');
const favorites = (page: Page) => page.getByTestId('sidebar').locator('[data-testid^="fav-"]');

test.describe('first run', () => {
  test('opens by itself on a new profile, beside the sidebar, and never again', async ({ page }) => {
    await firstLaunch(page);
    await expect(page.getByRole('heading', { name: 'Welcome to Kite' })).toBeVisible();
    await expect(step(page)).toHaveText('1 of 3');
    // It takes the page area and nothing else: the sidebar is still there to look at and use.
    const card = (await page.getByTestId('page-card').boundingBox())!;
    const run = (await page.getByTestId('welcome').boundingBox())!;
    expect([Math.round(run.x), Math.round(run.y), Math.round(run.width), Math.round(run.height)]).toEqual([Math.round(card.x), Math.round(card.y), Math.round(card.width), Math.round(card.height)]);
    const side = (await page.getByTestId('sidebar').boundingBox())!;
    expect(side.x + side.width).toBeLessThanOrEqual(run.x + 1);
    // Seen from the moment it is shown: closing the window halfway still counts.
    expect((await savedState(page)).home.firstRunSeen).toBe(true);
    await page.reload();
    await expect(page.getByTestId('sidebar')).toBeVisible();
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(page.getByTestId('welcome')).toHaveCount(0);
  });

  test('a profile that already exists, and a test’s own new profile, go straight to the start page', async ({ page }) => {
    await openApp(page);
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(page.getByTestId('welcome')).toHaveCount(0);
    // Someone already using Kite (a saved file from before the first run existed) is never shown it, even when asked.
    const old = await savedStateAfterChange(page);
    delete old.home.firstRunSeen;
    await page.evaluate((s) => localStorage.setItem('kite-state', JSON.stringify(s)), old);
    await page.goto('/?platform=darwin&firstrun=1');
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(page.getByTestId('welcome')).toHaveCount(0);
  });

  test('Return goes on, the real command bar finishes the second step, Esc skips', async ({ page }) => {
    await firstLaunch(page);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Your tabs live in the sidebar' })).toBeVisible();
    await expect(step(page)).toHaveText('2 of 3');
    await expect(page.getByTestId('welcome-habit')).toContainText('to open or find anything.');
    // The shortcut it teaches is the real one.
    await page.keyboard.press(`${MOD}+t`);
    await expect(page.getByTestId('cb-input')).toBeFocused();
    await page.getByTestId('cb-input').fill('example.com');
    await page.getByTestId('cb-input').press('Enter');
    // The page opened (it is in Today), and the first run moved on to its last step over it.
    await expect(todayRows(page)).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Make it yours' })).toBeVisible();
    await expect(step(page)).toHaveText('3 of 3');
    await expect(page.getByTestId('welcome-skip')).toHaveCount(0);
    // Back, and Esc in the command bar closes only the bar, then goes on as well.
    await page.getByTestId('welcome-back').click();
    await page.keyboard.press(`${MOD}+t`);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-bar')).toHaveCount(0);
    await expect(step(page)).toHaveText('3 of 3');
    // Esc in the first run itself leaves it.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('welcome')).toHaveCount(0);
    await expect(page.getByTestId('url-pill')).toHaveText('example.com');
  });

  test('the sidebar’s three places point at the real sidebar; ticked sites become real Favorites', async ({ page }) => {
    await firstLaunch(page);
    await page.getByTestId('welcome-next').click();
    const places = page.getByTestId('welcome-sidebar').locator('.first-run-places li');
    await expect(places).toHaveCount(3);
    await expect(places.nth(2)).toContainText('12 hours'); // the tidy-up time from Settings
    // Pointing at a line marks that region of the sidebar, and only while pointing.
    const pointer = page.locator('.first-run-pointer');
    await page.getByRole('heading', { name: 'Your tabs live in the sidebar' }).hover();
    await expect(pointer).toHaveCount(0);
    await page.getByTestId('welcome-place-today').hover();
    const today = (await page.getByTestId('today-list').boundingBox())!;
    const mark = (await pointer.boundingBox())!;
    expect(Math.abs(mark.x - today.x)).toBeLessThan(1);
    expect(Math.abs(mark.y - today.y)).toBeLessThan(1);
    expect(await pointer.evaluate((el) => el.getAnimations().length)).toBe(0); // nothing pulses
    await page.getByTestId('welcome-place-pinned').focus();
    const pinned = (await page.getByTestId('pinned-list').boundingBox())!;
    expect(Math.abs((await pointer.boundingBox())!.y - pinned.y)).toBeLessThan(1);
    await page.getByRole('heading', { name: 'Your tabs live in the sidebar' }).hover();
    await page.getByTestId('welcome-place-pinned').blur();
    await expect(pointer).toHaveCount(0);

    // Nothing is ticked for you.
    await expect(page.getByTestId('welcome-sidebar').getByRole('checkbox')).toHaveCount(6);
    await expect(page.getByTestId('welcome-sidebar').getByRole('checkbox', { checked: true })).toHaveCount(0);
    await expect(favorites(page)).toHaveCount(0);
    await page.getByTestId('welcome-starter-wikipedia').check();
    await page.getByTestId('welcome-starter-youtube').check();
    await expect(favorites(page)).toHaveCount(2);
    await page.getByTestId('welcome-starter-youtube').uncheck();
    await expect(favorites(page)).toHaveCount(1);
    const s = await savedState(page);
    expect(s.favorites).toHaveLength(1);
    expect(Object.values(s.items as Record<string, { url: string }>).map((i) => i.url)).toEqual(['https://www.wikipedia.org/']);
    expect(s.history).toEqual([]); // offering a site is not visiting it
    // Going on and coming back keeps what was chosen.
    await page.getByTestId('welcome-next').click();
    await page.getByTestId('welcome-back').click();
    await expect(page.getByTestId('welcome-starter-wikipedia')).toBeChecked();
  });

  test('the last step changes the real window, offers the default browser, and lands on the start page', async ({ page }) => {
    await firstLaunch(page);
    await page.getByTestId('welcome-next').click();
    await page.getByTestId('welcome-starter-wikipedia').check();
    await page.getByTestId('welcome-next').click();
    await page.getByTestId('welcome-mode-dark').click();
    await expect(page.getByTestId('app')).toHaveAttribute('data-theme', 'dark');
    await page.getByTestId('welcome-mode-light').click();
    await expect(page.getByTestId('app')).toHaveAttribute('data-theme', 'light');
    const before = await page.getByTestId('app').evaluate((el) => getComputedStyle(el).getPropertyValue('--chrome-mid'));
    await page.getByTestId('welcome-theme').getByTestId('backdrop-gradient').click();
    await page.getByTestId('welcome-theme').getByTestId('preset-forest').click();
    await expect.poll(() => page.getByTestId('app').evaluate((el) => getComputedStyle(el).getPropertyValue('--chrome-mid'))).not.toBe(before);
    await page.getByTestId('welcome-default').click();
    await expect(page.getByTestId('welcome-is-default')).toHaveText('Kite is your default browser');
    await page.getByTestId('welcome-done').click();
    await expect(page.getByTestId('welcome')).toHaveCount(0);
    // The start page of a new person: ready to type, their Favorite, and the one habit in a line.
    await expect(page.getByTestId('start-input')).toBeFocused();
    await expect(page.getByTestId('start-favorite')).toHaveCount(1);
    await expect(page.getByTestId('start-favorite')).toContainText('Wikipedia');
    await expect(page.getByTestId('start-hint')).toHaveText('Press ⌘T anywhere to open a page or find a tab.');
  });

  test('the start page stops hinting at the command bar once it has been used a few times', async ({ page }) => {
    await firstLaunch(page);
    await page.getByTestId('welcome-skip').click();
    await expect(page.getByTestId('start-hint')).toBeVisible();
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press(`${MOD}+t`);
      await expect(page.getByTestId('cb-input')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('command-bar')).toHaveCount(0);
    }
    await expect(page.getByTestId('start-hint')).toHaveCount(0);
    expect((await savedState(page)).home.barUses).toBe(3);
  });

  test('people with Arc’s data are offered the way across, and come back to the first run afterwards', async ({ page }) => {
    await firstLaunch(page);
    await expect(page.getByTestId('welcome-import-go')).toHaveCount(0); // nothing to bring: nothing offered
    await page.evaluate((t) => (window.__kiteTest!.arcFileText = t), ARC);
    await page.getByTestId('welcome-next').click();
    await page.getByTestId('welcome-back').click();
    await expect(page.getByTestId('welcome-hello')).toContainText('Coming from Arc?');
    // Changing their mind brings them back where they were.
    await page.getByTestId('welcome-import-go').click();
    await expect(page.getByTestId('import-arc')).toBeVisible();
    await expect(page.getByTestId('welcome')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('import-arc')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Welcome to Kite' })).toBeVisible();
    // Importing brings them to the sidebar step, with their own Spaces beside it.
    await page.getByTestId('welcome-import-go').click();
    await page.getByTestId('import-auto').click();
    await page.getByTestId('import-run').click();
    await expect(page.getByTestId('space-name')).toHaveText('Work');
    await expect(page.getByRole('heading', { name: 'Your tabs live in the sidebar' })).toBeVisible();
  });

  test('the entrance plays once at first launch; opened again from the command bar it is simply there', async ({ page }) => {
    await page.goto('/?platform=darwin&firstrun=1');
    await expect(page.getByTestId('welcome')).toHaveAttribute('data-entrance', 'true');
    // Only opacity and a short rise; the string is drawn by scaling.
    const moving = await page.getByTestId('welcome').evaluate((el) => [...new Set(el.getAnimations({ subtree: true }).map((a) => (a as CSSAnimation).animationName))].sort());
    expect(moving.every((n) => ['first-run-rise', 'first-run-draw'].includes(n))).toBe(true);
    await page.getByTestId('welcome-next').click();
    // Moving between steps starts nothing.
    expect(await page.getByTestId('welcome').evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
    await page.getByTestId('welcome-skip').click();
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('Welcome to Kite');
    await page.getByTestId('cb-input').press('Enter');
    await expect(page.getByRole('heading', { name: 'Welcome to Kite' })).toBeVisible();
    await expect(page.getByTestId('welcome')).not.toHaveAttribute('data-entrance', 'true');
    expect(await page.getByTestId('welcome').evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  });

  test('with Reduce Motion the entrance is a plain fade', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?platform=darwin&firstrun=1');
    const title = page.getByRole('heading', { name: 'Welcome to Kite' });
    await expect(title).toBeVisible();
    expect(await title.evaluate((el) => ({ name: getComputedStyle(el).animationName, ms: parseFloat(getComputedStyle(el).animationDuration) * 1000 }))).toEqual({ name: 'fade-in', ms: 140 });
    expect(await page.locator('.first-run-string').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  });

  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1000, height: 640 },
    { width: 720, height: 640 },
  ]) {
    test(`every step lays out cleanly and fits one screen at ${viewport.width} × ${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await firstLaunch(page);
      for (let i = 0; i < 3; i++) {
        await expectTidy(page, '[data-testid=welcome]', `first run, step ${i + 1}`);
        if (viewport.width >= 1000) {
          // One screen: nothing to scroll to.
          expect(await page.locator('.first-run-scroll').evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
        }
        if (i < 2) await page.getByTestId('welcome-next').click();
      }
    });
  }
});

/** The saved state once the app has had something to save (a new profile is not written until it changes). */
async function savedStateAfterChange(page: Page) {
  await page.keyboard.press(`${MOD}+t`);
  await page.keyboard.press('Escape');
  const s = await savedState(page);
  expect(s).not.toBeNull();
  return s;
}
