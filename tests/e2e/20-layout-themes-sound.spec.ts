import type { Page } from '@playwright/test';
import { test, expect, newTab, savedState, MOD } from './fixtures';

const hooks = <T>(page: Page, fn: string, arg?: unknown) => page.evaluate(([f, a]) => new Function('t', 'arg', `return ${f}`)((window as any).__kiteTest, a), [fn, arg] as const) as Promise<T>;
const sounds = (page: Page) => page.evaluate(() => [...((window as any).__kiteSounds as string[])]);
const cssVar = (page: Page, name: string) => page.getByTestId('app').evaluate((el, n) => getComputedStyle(el).getPropertyValue(n).trim(), name);

/** The desktop app's layout (macOS window buttons and all), in a plain browser. */
async function openDesktop(page: Page) {
  await page.goto('/?platform=darwin&chrome=electron');
  await expect(page.getByTestId('sidebar')).toBeVisible();
}
const lastButtons = (page: Page) => hooks<{ visible: boolean; x: number; y: number }>(page, 't.windowButtons[t.windowButtons.length - 1]');

test.describe('layout: no wasted space around the page', () => {
  test('hiding the sidebar gives the page the whole window, with the same margin on every side', async ({ page }) => {
    await openDesktop(page);
    await newTab(page, 'https://youtube.com');
    await page.keyboard.press(`${MOD}+s`);
    await expect(page.getByTestId('app')).toHaveAttribute('data-collapsed', 'true');
    await expect.poll(async () => (await page.getByTestId('page-card').boundingBox())!.x).toBe(8);
    const card = (await page.getByTestId('page-card').boundingBox())!;
    const vp = page.viewportSize()!;
    // 8px all round: there used to be a 36px empty band on top.
    expect([card.x, card.y, vp.width - card.x - card.width, vp.height - card.y - card.height]).toEqual([8, 8, 8, 8]);
    // The window buttons hide with the sidebar instead of needing that band…
    expect(await lastButtons(page)).toMatchObject({ visible: false });
    // …and come back, inside the sidebar, when it slides out (move to the edge like a hand would:
    // the sidebar then covers the edge strip, so a plain hover check would see it "intercepting").
    await page.mouse.move(600, 300);
    await page.mouse.move(4, 300, { steps: 2 });
    await expect(page.getByTestId('app')).toHaveAttribute('data-sidebar-peek', 'true');
    expect(await lastButtons(page)).toEqual({ visible: true, x: 22, y: 22 });
    await page.keyboard.press(`${MOD}+s`);
    expect(await lastButtons(page)).toEqual({ visible: true, x: 16, y: 16 });
  });

  test('a quick flick to the window edge brings the hidden sidebar back', async ({ page }) => {
    await openDesktop(page);
    await newTab(page, 'https://a.com');
    await page.mouse.move(600, 300);
    await page.keyboard.press(`${MOD}+s`);
    await expect(page.getByTestId('app')).not.toHaveAttribute('data-sidebar-peek', 'true');
    await page.mouse.move(0, 300, { steps: 2 });
    await expect(page.getByTestId('app')).toHaveAttribute('data-sidebar-peek', 'true');
    expect(await lastButtons(page)).toMatchObject({ visible: true });
  });

  test('moving out of the window through its side also brings the sidebar (window not at the screen edge)', async ({ page }) => {
    await openDesktop(page);
    await newTab(page, 'https://a.com');
    await page.mouse.move(600, 300);
    await page.keyboard.press(`${MOD}+s`);
    await page.mouse.move(40, 300);
    await page.mouse.move(-40, 300);
    await expect(page.getByTestId('app')).toHaveAttribute('data-sidebar-peek', 'true');
    // Back on the page, it tucks away again.
    await page.mouse.move(700, 300);
    await expect(page.getByTestId('app')).not.toHaveAttribute('data-sidebar-peek', 'true');
    // Heading for the menu bar (out through the top-left corner) does not open it.
    await page.mouse.move(30, 4);
    await page.mouse.move(-20, -30);
    await page.waitForTimeout(150);
    await expect(page.getByTestId('app')).not.toHaveAttribute('data-sidebar-peek', 'true');
  });

  test('with no margin chosen, the page touches every edge', async ({ page }) => {
    await openDesktop(page);
    await newTab(page, 'https://a.com');
    await page.keyboard.press(`${MOD}+Comma`);
    await page.getByTestId('settings-appearance').click();
    await page.getByTestId('set-gap').fill('0');
    await page.getByTestId('sheet-close').click();
    await page.keyboard.press(`${MOD}+s`);
    await expect.poll(async () => (await page.getByTestId('page-card').boundingBox())!.x).toBe(0);
    const card = (await page.getByTestId('page-card').boundingBox())!;
    expect([card.y, card.width, card.height]).toEqual([0, page.viewportSize()!.width, page.viewportSize()!.height]);
  });

  test('sidebar on the right: the window buttons move into it and follow the window and sidebar size', async ({ page }) => {
    await openDesktop(page);
    await newTab(page, 'https://a.com');
    await page.keyboard.press(`${MOD}+Comma`);
    await page.getByTestId('settings-appearance').click();
    await page.getByTestId('set-side-right').click();
    await page.getByTestId('sheet-close').click();
    const card = (await page.getByTestId('page-card').boundingBox())!;
    expect([card.x, card.y]).toEqual([8, 8]); // no band on top here either
    expect(await lastButtons(page)).toEqual({ visible: true, x: 1280 - 264 + 14, y: 16 });
    // The sidebar keeps room for them.
    await expect(page.locator('.sb-top')).toHaveAttribute('data-lights', 'true');
    await page.setViewportSize({ width: 1000, height: 700 });
    await expect.poll(() => lastButtons(page)).toEqual({ visible: true, x: 1000 - 264 + 14, y: 16 });
  });

  test('full screen: no window buttons, so nothing is reserved for them anywhere', async ({ page }) => {
    await openDesktop(page);
    await expect(page.locator('.sb-top')).toHaveAttribute('data-lights', 'true');
    const before = (await page.getByTestId('btn-toggle-sidebar').boundingBox())!.x;
    await hooks(page, 't.windowState({ fullscreen: true })');
    await expect(page.getByTestId('app')).toHaveAttribute('data-fullscreen', 'true');
    await expect(page.locator('.sb-top')).not.toHaveAttribute('data-lights', 'true');
    expect((await page.getByTestId('btn-toggle-sidebar').boundingBox())!.x).toBeLessThan(before - 60);
    // macOS shows them itself at the top edge in full screen, as in every other app.
    expect(await lastButtons(page)).toMatchObject({ visible: true });
    // …even with the sidebar hidden.
    await page.keyboard.press(`${MOD}+s`);
    expect(await lastButtons(page)).toMatchObject({ visible: true });
    await page.keyboard.press(`${MOD}+s`);
    await hooks(page, 't.windowState({ fullscreen: false })');
    await expect(page.locator('.sb-top')).toHaveAttribute('data-lights', 'true');
  });

  test('small windows: the sidebar gives way to the page; keyboard focus is always visible', async ({ page }) => {
    await openDesktop(page);
    await newTab(page, 'https://a.com');
    await page.setViewportSize({ width: 720, height: 480 });
    await expect.poll(async () => (await page.getByTestId('sidebar').boundingBox())!.width).toBeLessThanOrEqual(216);
    expect((await page.getByTestId('page-card').boundingBox())!.width).toBeGreaterThan(490);
    await page.getByTestId('btn-settings').focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    expect(await page.getByTestId('btn-settings').evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
  });
});

test.describe('themes', () => {
  test('a new Kite starts on the dark default gradient, and the editor has only the Arc controls', async ({ page }) => {
    await openDesktop(page);
    expect(await cssVar(page, '--tint-2')).toBe('#8f8cff');
    await expect(page.getByTestId('app')).toHaveAttribute('data-theme', 'dark');
    expect(await cssVar(page, '--backdrop')).toMatch(/^linear-gradient\(160deg/);
    await page.getByTestId('space-menu').click();
    await page.getByTestId('menu-edit-space').click();
    await expect(page.getByTestId('theme-controls')).toBeVisible();
    for (const id of ['space-hue', 'space-vivid', 'space-intensity', 'space-grain', 'space-mode-light', 'space-mode-dark', 'space-mode-system', 'color-a', 'color-b']) await expect(page.getByTestId(id)).toBeVisible();
    await expect(page.locator('[data-testid^="swatch-"]')).toHaveCount(27);
  });

  test('every swatch paints the window, in light and dark, and the app stays readable', async ({ page }) => {
    test.slow(); // 27 swatches × light and dark: more than 30s on slow CI runners
    await openDesktop(page);
    await newTab(page, 'https://a.com');
    await page.getByTestId('space-menu').click();
    await page.getByTestId('menu-edit-space').click();
    const contrast = () =>
      page.getByTestId('app').evaluate((el) => {
        const cs = getComputedStyle(el);
        const rgb = (s: string) => {
          const m = s.match(/\d+(\.\d+)?/g)!.map(Number);
          return m.length >= 3 ? m.slice(0, 3) : [0, 0, 0];
        };
        const lum = ([r, g, b]: number[]) => {
          const f = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const sb = getComputedStyle(document.querySelector('[data-testid=sidebar]')!);
        const ink = cs.getPropertyValue('--ink').trim();
        const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
        const a = lum(hex(ink));
        const b = lum(rgb(sb.backgroundColor === 'rgba(0, 0, 0, 0)' ? cs.getPropertyValue('--chrome-mid').trim().startsWith('#') ? `rgb(${hex(cs.getPropertyValue('--chrome-mid').trim()).join(',')})` : sb.backgroundColor : sb.backgroundColor));
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
    for (const row of ['pastel', 'muted', 'grey']) {
      for (let i = 1; i <= 9; i++) {
        await page.getByTestId(`swatch-${row}-${i}`).click();
        await expect(page.getByTestId(`swatch-${row}-${i}`)).toHaveAttribute('aria-checked', 'true');
        for (const mode of ['light', 'dark']) {
          await page.getByTestId(`space-mode-${mode}`).click();
          await expect(page.getByTestId('app')).toHaveAttribute('data-theme', mode);
          expect(await contrast(), `${row} ${i} ${mode}`).toBeGreaterThanOrEqual(4.5);
          await expect(page.locator('.row[data-active]')).toBeVisible();
        }
      }
    }
    // The wheel paints from one hue, and everything is saved on the Space.
    await page.getByTestId('space-hue').fill('120');
    const s = await savedState(page);
    expect(s.spaces[0].theme.colors[1]).toMatch(/^#[0-9a-f]{6}$/);
    expect(s.spaces[0].theme).not.toHaveProperty('gradient');
  });
});

test.describe('interface sounds', () => {
  test('tabs, Spaces, panels and downloads each have a sound', async ({ page }) => {
    await openDesktop(page);
    await newTab(page, 'https://a.com');
    await newTab(page, 'https://b.com');
    expect(await sounds(page)).toEqual(['pop', 'open', 'pop', 'open']);
    await page.keyboard.press(`${MOD}+w`);
    await page.getByTestId('btn-new-space').click();
    await page.getByTestId('space-done').click();
    await page.keyboard.press('Control+1');
    await hooks(page, 't.downloadDone(arg)', { id: 'd', url: 'u', name: 'a.zip', path: '/a.zip', kind: 'file', state: 'completed', received: 1, total: 1, speed: 0, startedAt: 1, resumable: true, site: 'a.com' });
    expect((await sounds(page)).slice(4)).toEqual(['close', 'pop', 'switch', 'done']);
  });

  test('they can be turned off, the volume is saved, and "Play" lets you hear it', async ({ page }) => {
    await openDesktop(page);
    await page.keyboard.press(`${MOD}+Comma`);
    await page.getByTestId('settings-general').click();
    await page.getByTestId('set-volume').fill('0.8');
    await page.getByTestId('set-sounds').click();
    expect((await savedState(page)).settings).toMatchObject({ sounds: false, soundVolume: 0.8 });
    await page.getByTestId('sheet-close').click();
    const before = (await sounds(page)).length;
    await newTab(page, 'https://a.com');
    await page.keyboard.press(`${MOD}+w`);
    expect((await sounds(page)).length).toBe(before); // silence
    await page.keyboard.press(`${MOD}+Comma`);
    await page.getByTestId('settings-general').click();
    // Volume and Play are greyed out while sounds are off.
    await expect(page.locator('.set-row[data-off]').filter({ has: page.getByTestId('set-volume') })).toHaveCount(1);
    await page.getByTestId('set-sounds').click();
    await page.getByTestId('set-sound-test').click();
    expect((await sounds(page)).pop()).toBe('done');
  });
});
