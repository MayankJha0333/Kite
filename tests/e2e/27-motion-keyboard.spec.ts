import { test, expect, openApp, newTab, todayRows, pinnedRows, MOD } from './fixtures';

/** Rows currently gliding (flip.ts) under the sidebar, by their flip key. */
const gliding = (page: import('@playwright/test').Page) =>
  page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.sb-scroll [data-flip]')].filter((el) => el.getAnimations().some((a) => a.id === 'flip')).map((el) => el.dataset.flip));

test.describe('motion', () => {
  test('pinning a tab glides it into place; the rows it left behind move up', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    await newTab(page, 'c.com');
    await expect(todayRows(page)).toHaveCount(3);
    const cId = await todayRows(page).first().getAttribute('data-flip');
    await page.keyboard.press(`${MOD}+d`); // pin c.com (the active, top row)
    await expect(pinnedRows(page)).toHaveCount(1);
    // The pinned row and the rows that moved up are animating, from their old positions.
    const moving = await gliding(page);
    expect(moving).toContain(cId);
    expect(moving.length).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(400);
    expect(await gliding(page)).toEqual([]);
  });

  test('a row made from the keyboard is simply there; rows closing a gap settle quickly', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('c.com');
    await page.getByTestId('cb-input').press('Enter');
    await expect(todayRows(page)).toHaveCount(3);
    // The new row (first) does not fade or slide in.
    const entering = await todayRows(page).first().evaluate((el) => el.getAnimations().filter((a) => a.id !== 'flip').length);
    expect(entering).toBe(0);
    // Closing it: the rows below move up, and are at rest well inside 300ms.
    await page.keyboard.press(`${MOD}+w`);
    await expect(todayRows(page)).toHaveCount(2);
    await page.waitForTimeout(300);
    expect(await gliding(page)).toEqual([]);
  });

  test('a keyboard-focused row shows a real ring, drawn inside the row', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    await todayRows(page).first().focus();
    await page.keyboard.press('ArrowDown');
    const row = todayRows(page).nth(1);
    await expect(row).toBeFocused();
    expect(await row.evaluate((el) => [getComputedStyle(el).outlineStyle, getComputedStyle(el).outlineOffset])).toEqual(['solid', '-2px']);
  });

  test('switching tabs and opening the command bar are instant', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    await page.keyboard.press(`${MOD}+t`);
    const cbAnims = await page.locator('.cb').evaluate((el) => el.getAnimations().length);
    expect(cbAnims).toBe(0);
    await page.keyboard.press('Escape');
    await todayRows(page).nth(1).click();
    const slotAnims = await page.locator('.surface-slot[data-visible]').first().evaluate((el) => el.getAnimations().length);
    expect(slotAnims).toBe(0);
  });

  test('reduce motion keeps fades and colour feedback but drops movement', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+Comma`);
    await page.getByTestId('settings-general').click();
    await page.getByTestId('set-motion').click();
    await expect(page.getByTestId('app')).toHaveAttribute('data-motion', 'reduced');
    await page.keyboard.press('Escape');
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    await page.keyboard.press(`${MOD}+d`);
    expect(await gliding(page)).toEqual([]); // no glide…
    await page.keyboard.press(`${MOD}+y`);
    // …but a sheet still fades in (a short opacity animation, no transform).
    const anim = await page.locator('.sheet').evaluate((el) => {
      const a = el.getAnimations()[0] as CSSAnimation | undefined;
      return a ? { name: a.animationName, ms: Number((a.effect as KeyframeEffect).getTiming().duration) } : null;
    });
    expect(anim).toEqual({ name: 'fade-in', ms: 140 });
  });
});

test.describe('keyboard', () => {
  test('tabs in the sidebar can be reached and opened from the keyboard', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    await newTab(page, 'c.com');
    // The selected row is the one tab stop; arrows move, Enter opens.
    await todayRows(page).first().focus();
    await expect(todayRows(page).first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(todayRows(page).nth(1)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(todayRows(page).nth(2)).toHaveAttribute('data-active', 'true');
    await expect(page.getByTestId('url-pill')).toHaveText('a.com');
    await page.keyboard.press('ArrowUp');
    await expect(todayRows(page).nth(1)).toBeFocused();
  });
});
