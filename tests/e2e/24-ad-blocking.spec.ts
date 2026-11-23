import type { Page } from '@playwright/test';
import { test, expect, openApp, newTab, savedState, MOD } from './fixtures';

const hooks = <T>(page: Page, fn: string) => page.evaluate((f) => new Function('t', `return ${f}`)((window as any).__kiteTest), fn) as Promise<T>;
const shields = async (page: Page) => (await hooks<{ shields: Record<string, any> }>(page, 't.prefs')).shields;
const SHOTS = process.env.ADBLOCK_SHOTS;

async function openAdblock(page: Page) {
  await page.keyboard.press(`${MOD}+Comma`);
  await page.getByTestId('settings-privacy').click();
  await expect(page.getByTestId('adblock-page')).toBeVisible();
}

test.describe('Settings → Ad blocking', () => {
  test('on out of the box with recommended lists, statistics, and a link from Privacy & Security', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+Comma`);
    await page.getByTestId('settings-privacy').click();
    await expect(page.getByTestId('privacy-open-adblock')).toContainText('On');
    await page.getByTestId('privacy-open-adblock').click();
    await expect(page.getByTestId('adblock-page')).toBeVisible();
    await expect(page.getByTestId('shields-enabled')).toHaveAttribute('aria-checked', 'true');
    for (const id of ['adguard-base', 'ubo', 'easyprivacy']) await expect(page.getByTestId(`shields-list-${id}`)).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('shields-list-easylist')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('shields-total')).toContainText('1,234');
    await page.getByTestId('shields-clear-stats').click();
    expect(await hooks<string[]>(page, 't.calls')).toContain('clearShieldsStats');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/1-ad-blocking-general.png` });
  });

  test('filter groups open and close; search finds lists; language lists are marked', async ({ page }) => {
    await openApp(page);
    await openAdblock(page);
    await expect(page.getByTestId('shields-list-adguard-popups')).toHaveCount(0);
    await page.getByTestId('shields-group-annoyances').locator('.adb-group-head').click();
    await page.getByTestId('shields-list-adguard-popups').click();
    await expect.poll(async () => (await shields(page)).lists).toContain('adguard-popups');
    await page.getByTestId('shields-list-search').fill('german');
    await expect(page.locator('.adb-list')).toHaveCount(1);
    await page.getByTestId('shields-list-search').fill('');
    await page.getByTestId('shields-group-annoyances').locator('.adb-group-head').scrollIntoViewIfNeeded();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/2-ad-blocking-filters.png` });
  });

  test('your lists: add by address (checked), turn off, remove', async ({ page }) => {
    await openApp(page);
    await openAdblock(page);
    await page.getByTestId('shields-custom-url').fill('not a url');
    await page.getByTestId('shields-custom-add').click();
    await expect(page.getByTestId('toast').last()).toContainText('https://');
    await page.getByTestId('shields-custom-url').fill('https://lists.example.org/my-list.txt');
    await page.getByTestId('shields-custom-name').fill('My list');
    await page.getByTestId('shields-custom-add').click();
    await expect(page.getByTestId('shields-custom-row')).toHaveCount(1);
    await expect.poll(async () => (await shields(page)).custom).toEqual([expect.objectContaining({ url: 'https://lists.example.org/my-list.txt', name: 'My list', on: true })]);
    await page.getByTestId('shields-custom-url').fill('https://lists.example.org/my-list.txt');
    await page.getByTestId('shields-custom-add').click();
    await expect(page.getByTestId('toast').last()).toContainText('already');
    await page.getByTestId('shields-custom-row').getByRole('switch').click();
    await expect.poll(async () => (await shields(page)).custom[0].on).toBe(false);
    await page.getByLabel('Remove My list').click();
    await expect(page.getByTestId('shields-custom-row')).toHaveCount(0);
  });

  test('your rules: saved on Save (not per keystroke), counted, survive a reload', async ({ page }) => {
    await openApp(page);
    await openAdblock(page);
    const box = page.getByTestId('shields-user-rules');
    await box.fill('||ads.example.com^\nexample.com##.promo\n! a note');
    await expect(page.getByTestId('shields-user-count')).toContainText('Not saved');
    expect((await shields(page)).userRules).toBe('');
    await page.getByTestId('shields-user-save').click();
    await expect(page.getByTestId('shields-user-count')).toContainText('2 rules');
    await expect.poll(async () => (await shields(page)).userRules).toContain('||ads.example.com^');
    if (SHOTS) {
      await box.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/3-ad-blocking-rules.png` });
    }
    await page.reload();
    await openAdblock(page);
    await expect(page.getByTestId('shields-user-rules')).toHaveValue(/example\.com##\.promo/);
  });

  test('allowlist can be inverted: then blocking happens only on listed sites', async ({ page }) => {
    await openApp(page);
    await openAdblock(page);
    await page.getByTestId('shields-allow-input').fill('trusted.com');
    await page.getByTestId('shields-allow-add').click();
    await page.getByTestId('shields-invert').click();
    await expect(page.getByTestId('shields-invert-note')).toBeVisible();
    await expect(page.getByTestId('shields-allow-list')).toContainText('No sites yet');
    await page.getByTestId('shields-allow-input').fill('https://www.news.com/a');
    await page.getByTestId('shields-allow-add').click();
    await expect.poll(async () => await shields(page)).toMatchObject({ invert: true, only: ['news.com'], allow: ['trusted.com'] });
    if (SHOTS) {
      await page.getByTestId('shields-invert').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/4-ad-blocking-allowlist.png` });
    }
  });

  test('tracking protection choices are kept', async ({ page }) => {
    await openApp(page);
    await openAdblock(page);
    await page.getByTestId('shields-hide-referrer').click();
    await page.getByTestId('shields-webrtc').click();
    await page.getByTestId('shields-cookie-life-2880').click();
    await page.getByTestId('shields-update-6').click();
    await expect.poll(async () => await shields(page)).toMatchObject({ hideReferrer: true, blockWebRTC: true, cookieMinutes: 2880, updateHours: 6, stripParams: true });
    expect((await savedState(page)).settings.shields.cookieMinutes).toBe(2880);
    if (SHOTS) {
      await page.getByTestId('shields-strip').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/5-ad-blocking-tracking.png` });
    }
  });

  test('the site popover lists what was blocked and links here', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'news.example.com');
    await page.getByTestId('url-security').click();
    await page.getByTestId('site-info-log-toggle').click();
    await expect(page.getByTestId('site-info-log')).toContainText('stats.doubleclick.net');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/6-site-popover-log.png` });
    await page.getByTestId('site-info-adblock').click();
    await expect(page.getByTestId('adblock-page')).toBeVisible();
  });
});
