import type { Page } from '@playwright/test';
import { test, expect, openApp, newTab, savedState, MOD } from './fixtures';

const hooks = <T>(page: Page, fn: string, arg?: unknown) => page.evaluate(([f, a]) => new Function('t', 'arg', `return ${f}`)((window as any).__kiteTest, a), [fn, arg] as const) as Promise<T>;
const cssVar = (page: Page, name: string) => page.getByTestId('app').evaluate((el, n) => getComputedStyle(el).getPropertyValue(n).trim(), name);
const MB = 1024 * 1024;
const entry = (over: Record<string, unknown>) => ({ id: 'dl-1', url: 'https://a.com/f.zip', name: 'f.zip', path: '/tmp/f.zip', kind: 'file', state: 'progressing', received: 5 * MB, total: 20 * MB, speed: MB, startedAt: 1, resumable: true, site: 'a.com', ...over });

async function openThemeEditor(page: Page) {
  await page.getByTestId('space-menu').click();
  await page.getByTestId('menu-edit-space').click();
  await expect(page.getByTestId('theme-controls')).toBeVisible();
}

test.describe('Theme presets and patterns', () => {
  test('a new Kite shows the Glow pattern; presets and patterns change the window and are saved', async ({ page }) => {
    await openApp(page);
    expect(await cssVar(page, '--pattern')).toContain('radial-gradient');
    await openThemeEditor(page);
    await expect(page.locator('[data-testid^="preset-"]')).toHaveCount(6);
    await expect(page.getByTestId('preset-tide')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('pattern-glow')).toHaveAttribute('aria-checked', 'true');

    await page.getByTestId('preset-dawn').click();
    await expect(page.getByTestId('app')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByTestId('preset-dawn')).toHaveAttribute('aria-checked', 'true');
    expect(await cssVar(page, '--pattern')).toContain('40,30,20'); // dark marks on a light theme

    await page.getByTestId('preset-ember').click();
    await expect(page.getByTestId('app')).toHaveAttribute('data-theme', 'dark');
    expect(await cssVar(page, '--tint-2')).toBe('#ffb38a');

    await page.getByTestId('pattern-grid').click();
    expect(await cssVar(page, '--pattern-size')).toBe('28px 28px, 28px 28px');
    await page.getByTestId('pattern-strength').fill('1');
    await page.getByTestId('pattern-none').click();
    expect(await cssVar(page, '--pattern')).toBe('none');
    await expect(page.getByTestId('pattern-strength')).toHaveCount(0);
    await page.getByTestId('pattern-dots').click();

    const saved = await savedState(page);
    expect(saved.spaces[0].theme).toMatchObject({ mode: 'dark', pattern: 'dots', colors: ['#6a2b7a', '#ffb38a'] });
    // Picking a colour by hand leaves the preset but keeps the pattern.
    await page.getByTestId('swatch-muted-3').click();
    await expect(page.locator('[data-testid^="preset-"][aria-checked="true"]')).toHaveCount(0);
    await expect(page.getByTestId('pattern-dots')).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('Downloads: filters, cancel confirmation, file menu', () => {
  test('filters narrow the list; a big download asks before cancelling; the menu acts on a file', async ({ page }) => {
    await openApp(page);
    await hooks(page, 't.setDownloads(arg)', [entry({}), entry({ id: 'dl-2', name: 'photo.png', kind: 'image', state: 'completed', received: 3 * MB, total: 3 * MB }), entry({ id: 'dl-3', name: 'bad.mp4', kind: 'video', state: 'failed', error: 'The connection was lost' })]);
    await page.keyboard.press(`${MOD}+Shift+j`);
    await expect(page.getByTestId('downloads')).toBeVisible();
    const rows = page.locator('.dl-list > .dl-row');
    await expect(rows).toHaveCount(3);
    await expect(page.getByTestId('downloads-filter-all')).toContainText('3');
    await page.getByTestId('downloads-filter-done').click();
    await expect(rows).toHaveCount(1);
    await expect(page.getByTestId('download-dl-2')).toBeVisible();
    await page.getByTestId('downloads-filter-failed').click();
    await expect(page.getByTestId('download-dl-3')).toBeVisible();
    await page.getByTestId('downloads-filter-active').click();
    await expect(rows).toHaveCount(1);

    // 5 MB is already saved, so cancelling asks first.
    const live = page.getByTestId('download-dl-1');
    await live.getByTestId('download-cancel').click();
    await expect(live.getByTestId('download-cancel-ask')).toContainText('5.0 MB already saved');
    await live.getByTestId('download-cancel-keep').click();
    await expect(live).toHaveAttribute('data-state', 'progressing');
    await live.getByTestId('download-cancel').click();
    await live.getByTestId('download-cancel-pause').click();
    await expect(live).toHaveAttribute('data-state', 'paused');
    await live.getByTestId('download-cancel').click();
    await live.getByTestId('download-cancel-yes').click();
    await expect(page.getByTestId('downloads-filter-empty')).toBeVisible(); // nothing in progress any more
    await page.getByTestId('downloads-filter-all').click();
    await expect(page.getByTestId('download-dl-1').getByTestId('download-status')).toHaveText('Cancelled');

    // The file menu.
    await page.getByTestId('download-dl-2').getByTestId('download-more').click();
    await expect(page.getByRole('menuitem', { name: 'Move to Trash' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Show in Folder' }).click();
    await page.getByTestId('download-dl-2').getByTestId('download-more').click();
    await page.getByRole('menuitem', { name: 'Move to Trash' }).click();
    await expect(page.getByTestId('download-dl-2')).toHaveCount(0);
    expect(await hooks<string[]>(page, 't.calls')).toEqual(expect.arrayContaining(['download:pause:dl-1', 'download:cancel:dl-1', 'download:reveal:dl-2', 'download:trash:dl-2']));
  });
});

test.describe('Per-site protections', () => {
  test('the site pop-up lists what is on, and follows the per-site switch', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'https://news.example.com');
    await expect(page.getByTestId('url-security')).toHaveAttribute('data-level', 'secure');
    const id = await page.locator('.row[data-active]').getAttribute('data-testid');
    await hooks(page, 't.shieldsCount(arg, 12)', id!.replace('row-', ''));
    await expect(page.getByTestId('url-blocked')).toHaveText('12');
    await page.getByTestId('url-blocked').click();
    await expect(page.getByTestId('site-info-protections').locator('li')).toHaveCount(6);
    await expect(page.getByTestId('site-prot-ads')).toHaveAttribute('data-on', 'true');
    await expect(page.getByTestId('site-prot-fingerprinting')).toHaveAttribute('data-on', 'true');
    await page.getByTestId('site-info-shields').click(); // off for this site; the pop-up closes
    await expect(page.getByTestId('site-info')).toHaveCount(0);
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('About This Site');
    await page.getByTestId('cb-input').press('Enter');
    await expect(page.getByTestId('site-prot-ads')).not.toHaveAttribute('data-on', 'true');
    await expect(page.getByTestId('site-prot-fingerprinting')).toHaveAttribute('data-on', 'true');
  });
});

test.describe('Welcome tour', () => {
  test('opens from the command bar and walks through its four steps; the theme step changes the window', async ({ page }) => {
    await openApp(page);
    await expect(page.getByTestId('welcome')).toHaveCount(0); // never opens by itself
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('Welcome to Kite');
    await page.getByTestId('cb-input').press('Enter');
    await expect(page.getByTestId('welcome-hello')).toBeVisible();
    await expect(page.getByTestId('welcome-back')).toHaveCount(0);
    await page.getByTestId('welcome-next').click();
    await expect(page.getByTestId('welcome-import-go')).toBeVisible();
    await page.getByTestId('welcome-next').click();
    await page.getByTestId('welcome-theme').getByTestId('preset-forest').click();
    expect(await cssVar(page, '--tint-2')).toBe('#8fe0a8');
    await page.getByTestId('welcome-back').click();
    await expect(page.getByTestId('welcome-import')).toBeVisible();
    await page.getByTestId('welcome-next').click();
    await page.getByTestId('welcome-next').click();
    await expect(page.getByTestId('welcome-finish')).toBeVisible();
    await expect(page.getByTestId('welcome-step')).toHaveAttribute('aria-label', 'Step 4 of 4');
    await page.getByTestId('welcome-done').click();
    await expect(page.getByTestId('welcome')).toHaveCount(0);
    expect((await savedState(page)).spaces[0].theme.pattern).toBe('glow');
  });
});
