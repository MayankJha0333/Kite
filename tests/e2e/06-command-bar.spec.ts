import type { Page } from '@playwright/test';
import { test, expect, openApp, newTab, todayRows, activeRowTitle, MOD } from './fixtures';

/** Contrast of an element's text against what is painted behind it: its own fills, on top of `surface`. */
async function contrastOn(page: Page, selector: string, surface: string) {
  return page.evaluate(
    ([sel, base]) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      const layers: string[] = [];
      for (let el: Element | null = document.querySelector(sel); el; el = el.parentElement) {
        layers.unshift(getComputedStyle(el).backgroundColor);
        if (el.matches(base)) break;
      }
      const paint = (colors: string[]) => {
        ctx.clearRect(0, 0, 1, 1);
        for (const c of colors) {
          ctx.fillStyle = c;
          ctx.fillRect(0, 0, 1, 1);
        }
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      const lum = (rgb: number[]) => {
        const [r, g, b] = rgb.map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const back = lum(paint(layers));
      const text = lum(paint([...layers, getComputedStyle(document.querySelector(sel)!).color]));
      return (Math.max(back, text) + 0.05) / (Math.min(back, text) + 0.05);
    },
    [selector, surface] as const,
  );
}

test.describe('command bar', () => {
  test('empty: shows the other recent tabs and four starter actions; Esc and clicking outside close it', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    await page.keyboard.press(`${MOD}+t`);
    // The tab you are on (b.com) is not offered: Enter on it would do nothing.
    const tabs = page.locator('.cb-row[data-kind="tab"]');
    await expect(tabs).toHaveCount(1);
    await expect(tabs.first()).toContainText('a.com');
    await expect(page.getByTestId('cb-results')).not.toContainText('b.com');
    await expect(page.locator('.cb-row[data-kind="action"]')).toHaveText([/New Space/, /Add Split View/, /Settings/, /Customize Kite/]);
    await expect(page.locator('.cb-label')).toHaveText(['Recent tabs', 'Actions']);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-bar')).toHaveCount(0);
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('command-bar').click({ position: { x: 10, y: 10 } });
    await expect(page.getByTestId('command-bar')).toHaveCount(0);
  });

  test('typing a site name finds the open tab and switches to it instead of opening a duplicate', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'github.com');
    await newTab(page, 'b.com');
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('git');
    const first = page.locator('.cb-row').first();
    await expect(first).toHaveAttribute('data-kind', 'tab');
    // Only the selected row says what Enter does.
    await expect(first).toContainText('Switch to tab');
    expect(await page.getByText('Switch to tab').count()).toBe(1);
    await expect(first.locator('mark').first()).toHaveText('git');
    await page.keyboard.press('Enter');
    await expect(todayRows(page)).toHaveCount(2);
    expect(await activeRowTitle(page)).toBe('github.com');
  });

  test('arrow keys pick a result; the search result searches', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'github.com');
    await newTab(page, 'b.com');
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('git');
    await page.keyboard.press('ArrowDown');
    const search = page.locator('.cb-row[data-on]');
    await expect(search).toHaveAttribute('data-kind', 'search');
    await expect(search).toHaveText('Search Google for “git”');
    await page.keyboard.press('Enter');
    await expect(todayRows(page)).toHaveCount(3);
    await expect(page.getByTestId('url-pill')).toContainText('google.com');
  });

  test('the arrows wrap around, and the selection is a neutral tint with readable text, not the accent', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'github.com');
    await newTab(page, 'b.com');
    await page.keyboard.press(`${MOD}+t`);
    const rows = page.locator('.cb-row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(2);
    await page.keyboard.press('ArrowUp');
    await expect(rows.nth(count - 1)).toHaveAttribute('data-on', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(rows.first()).toHaveAttribute('data-on', 'true');
    const look = await rows.first().evaluate((row) => {
      const app = document.querySelector('.app')!;
      const probe = (value: string, prop = 'color') => {
        const el = document.createElement('i');
        el.style.setProperty(prop, value);
        app.appendChild(el);
        const out = getComputedStyle(el).getPropertyValue(prop);
        el.remove();
        return out;
      };
      return { fill: getComputedStyle(row).backgroundColor, selected: probe('var(--fill-selected)', 'background-color'), accent: probe('var(--accent)') };
    });
    expect(look.fill).toBe(look.selected);
    expect(look.fill).not.toBe(look.accent);
    // Tertiary text (the address) on the selected row still reads: at least 4.5:1.
    expect(await contrastOn(page, '.cb-row[data-on] .cb-row-sub', '.cb')).toBeGreaterThanOrEqual(4.5);
    expect(await contrastOn(page, '.cb-row[data-on] .cb-row-title', '.cb')).toBeGreaterThanOrEqual(7);
  });

  test('Tab completes the selected row into the box; Esc first takes back what was typed, then closes', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'github.com/kite/kite');
    await newTab(page, 'b.com');
    await page.keyboard.press(`${MOD}+t`);
    const input = page.getByTestId('cb-input');
    await input.fill('git');
    await page.keyboard.press('Tab');
    await expect(input).toHaveValue('github.com/kite/kite');
    await expect(input).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(input).toHaveValue('');
    await expect(page.getByTestId('command-bar')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-bar')).toHaveCount(0);
    // ⌘L shows the address you did not type: Esc closes at once.
    await page.keyboard.press(`${MOD}+l`);
    await expect(input).toHaveValue('https://b.com');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-bar')).toHaveCount(0);
  });

  test('keys pressed while an input method is composing are left to it', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+t`);
    const input = page.getByTestId('cb-input');
    await input.fill('にほん');
    for (const key of ['Enter', 'Escape', 'ArrowDown']) await input.evaluate((el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, isComposing: true, bubbles: true, cancelable: true })), key);
    await expect(page.getByTestId('command-bar')).toBeVisible();
    await expect(input).toHaveValue('にほん');
    await expect(page.locator('.cb-row').first()).toHaveAttribute('data-on', 'true');
    await expect(todayRows(page)).toHaveCount(0);
  });

  test('the selection stays on the same result when the list changes under it', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'alpha.example');
    await newTab(page, 'beta.example');
    await newTab(page, 'gamma.example');
    await page.keyboard.press(`${MOD}+t`);
    await page.keyboard.press('ArrowDown');
    const picked = page.locator('.cb-row[data-on]');
    await expect(picked).toContainText('alpha.example');
    // A page opens a link in a background tab while the bar is open: a new row arrives above.
    await page.evaluate(() => (window as any).__kiteTest.openRequest({ url: 'https://delta.example/', disposition: 'background-tab', sourceTabId: null }));
    await expect(page.locator('.cb-row[data-kind="tab"]')).toHaveCount(3);
    await expect(picked).toHaveCount(1);
    await expect(picked).toContainText('alpha.example');
  });

  test('opens over a sheet, and makes nothing until a result is picked', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('history');
    await page.keyboard.press('Enter');
    await expect(page.locator('.sheet')).toBeVisible();
    await page.keyboard.press(`${MOD}+t`);
    const onTop = await page.getByTestId('cb-input').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el;
    });
    expect(onTop).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-bar')).toHaveCount(0);
    // Opening and closing the bar created no tab.
    await expect(todayRows(page)).toHaveCount(1);
  });

  test('nothing else matches: one row, ready to search', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('zzqxv');
    await expect(page.locator('.cb-row')).toHaveCount(1);
    await expect(page.locator('.cb-row')).toHaveText('Search Google for “zzqxv”');
    await expect(page.locator('.cb-row')).toHaveAttribute('data-on', 'true');
  });

  test('Check for Updates says what it found, and offers the download when there is one', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('check for updates');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('toast').filter({ hasText: 'Kite is up to date.' })).toBeVisible();
    await page.evaluate(() => ((window as any).__kiteTest.update = { version: '9.9.9', pageUrl: 'https://example.com/release', downloadUrl: 'https://example.com/Kite.dmg' }));
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('check for updates');
    await page.keyboard.press('Enter');
    const found = page.getByTestId('toast').filter({ hasText: 'Kite 9.9.9 is available.' });
    await found.getByRole('button', { name: 'Download' }).click();
    expect(await page.evaluate(() => (window as any).__kiteTest.calls)).toContain('openUpdate:https://example.com/Kite.dmg');
  });

  test('a URL offers Open first', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('kite.dev/docs');
    await expect(page.locator('.cb-row').first()).toHaveAttribute('data-kind', 'open');
    await expect(page.locator('.cb-row').first()).toContainText('Open kite.dev/docs');
  });

  test('runs actions by name (New Space)', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('new space');
    await expect(page.locator('.cb-row[data-kind="action"]').first()).toContainText('New Space');
    await page.locator('.cb-row[data-kind="action"]').first().click();
    await expect(page.getByTestId('space-editor')).toBeVisible();
  });

  test('switches Spaces by name', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('btn-new-space').click();
    await page.getByTestId('space-name-input').fill('Research');
    await page.getByTestId('space-done').click();
    await page.keyboard.press('Control+1');
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('resea');
    await page.locator('.cb-row[data-kind="space"]').click();
    await expect(page.getByTestId('space-name')).toHaveText('Research');
  });

  test('finds pages from history', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'docs.example.com');
    await page.keyboard.press(`${MOD}+w`);
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('docs.exa');
    await expect(page.locator('.cb-row[data-kind="history"]')).toHaveCount(1);
  });

  test('⌘L shows the URL without suggestions until you type; ⌘Enter opens a new tab instead', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await page.keyboard.press(`${MOD}+l`);
    await expect(page.locator('.cb-row')).toHaveCount(0);
    await page.getByTestId('cb-input').fill('b.com');
    await page.keyboard.press(`${MOD}+Enter`);
    await expect(todayRows(page)).toHaveCount(2);
  });

  test('toggle light/dark from the command bar', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('toggle light');
    await page.keyboard.press('Enter');
    const first = await page.getByTestId('app').getAttribute('data-theme');
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('toggle light');
    await page.keyboard.press('Enter');
    expect(await page.getByTestId('app').getAttribute('data-theme')).not.toBe(first);
  });
});
