import type { Page } from '@playwright/test';
import { test, expect, openApp, newTab, todayRows, savedState, MOD, settledRows } from './fixtures';

async function splitWith(page: Page, url: string) {
  await page.keyboard.press(`${MOD}+Shift+Equal`);
  await expect(page.locator('.cb-badge')).toHaveText('Split View');
  await page.getByTestId('cb-input').fill(url);
  await page.getByTestId('cb-input').press('Enter');
}

/** A pane's actions come out of the grip at its top edge while the pointer is on it. */
async function paneAction(page: Page, action: 'swap' | 'flip' | 'separate' | 'close', i: number) {
  await page.getByTestId(`pane-handle-${i}`).hover();
  await page.getByTestId(`pane-${action}-${i}`).click();
}

/** Drag a sidebar row to a point on the page card (x, y from 0 to 1 across it), holding it there. */
async function dragOverPage(page: Page, row: number, x: number, y: number) {
  await settledRows(page); // rows glide into place after a new tab (flip.ts); measure them at rest
  const src = (await todayRows(page).nth(row).boundingBox())!;
  const card = (await page.getByTestId('page-card').boundingBox())!;
  await page.mouse.move(src.x + 40, src.y + src.height / 2);
  await page.mouse.down();
  await page.mouse.move(card.x + card.width * x, card.y + card.height * y, { steps: 10 });
  return card;
}

test.describe('split view', () => {
  test('⌘⇧= opens a page next to the current one', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'left.com');
    await splitWith(page, 'right.com');
    await expect(page.getByTestId('split-chrome')).toBeVisible();
    await expect(page.locator('.surface-slot[data-visible]')).toHaveCount(2);
    await expect(todayRows(page)).toHaveCount(1);
    await expect(todayRows(page).first()).toHaveAttribute('data-kind', 'split');
    await expect(todayRows(page).first()).toHaveAttribute('data-title', 'left.com | right.com');
    await expect(page.getByTestId('pane-1')).toHaveAttribute('data-focused', 'true');
    await expect(page.getByTestId('url-pill')).toHaveText('right.com');
  });

  test('panes sit side by side; flip stacks them', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await splitWith(page, 'b.com');
    const box = async (i: number) => (await page.getByTestId(`pane-${i}`).boundingBox())!;
    expect((await box(1)).x).toBeGreaterThan((await box(0)).x + 100);
    await paneAction(page, 'flip', 0);
    expect((await box(1)).y).toBeGreaterThan((await box(0)).y + 100);
    expect(Math.abs((await box(1)).x - (await box(0)).x)).toBeLessThan(2);
    // pages follow their frames
    const slots = await page.locator('.surface-slot[data-visible]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
    const frame = Math.round((await box(0)).width);
    expect(slots.every((w) => Math.abs(w - frame) < 3)).toBe(true);
  });

  test('clicking a pane focuses it and the URL bar follows', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await splitWith(page, 'b.com');
    await page.getByTestId('pane-handle-0').click();
    await expect(page.getByTestId('pane-0')).toHaveAttribute('data-focused', 'true');
    await expect(page.getByTestId('url-pill')).toHaveText('a.com');
  });

  test('drag the divider to resize; double-click resets', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await splitWith(page, 'b.com');
    const div = (await page.getByTestId('divider-0').boundingBox())!;
    await page.mouse.move(div.x + 5, div.y + 300);
    await page.mouse.down();
    await page.mouse.move(div.x - 200, div.y + 300, { steps: 6 });
    await page.mouse.up();
    let s = await savedState(page);
    const split = Object.values(s.items).find((x: any) => x.kind === 'split') as any;
    expect(split.sizes[0]).toBeLessThan(0.4);
    await page.getByTestId('divider-0').dblclick();
    s = await savedState(page);
    const split2 = Object.values(s.items).find((x: any) => x.kind === 'split') as any;
    expect(split2.sizes).toEqual([0.5, 0.5]);
  });

  test('drag a sidebar tab onto the page to split with it', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'one.com');
    await newTab(page, 'two.com');
    await settledRows(page); // rows glide into place after a new tab (flip.ts); measure them at rest
    const src = (await todayRows(page).nth(1).boundingBox())!;
    const card = (await page.getByTestId('page-card').boundingBox())!;
    await page.mouse.move(src.x + 40, src.y + src.height / 2);
    await page.mouse.down();
    await page.mouse.move(card.x + card.width * 0.7, card.y + card.height / 2, { steps: 10 });
    await expect(page.getByTestId('page-card')).toHaveAttribute('data-over', 'true');
    await page.mouse.up();
    await expect(page.getByTestId('split-chrome')).toBeVisible();
    await expect(todayRows(page)).toHaveCount(1);
  });

  test('the page shows where a dragged tab will land: an edge of the page, or between panes', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'one.com');
    await newTab(page, 'two.com');
    await newTab(page, 'three.com'); // showing: three.com; rows: three, two, one
    // Near the left edge: the left half is offered, and the dropped page becomes the first pane.
    let card = await dragOverPage(page, 1, 0.2, 0.5);
    let hint = (await page.getByTestId('drop-hint').boundingBox())!;
    expect(Math.round(hint.x - card.x)).toBe(0);
    expect(Math.abs(hint.width - card.width / 2)).toBeLessThan(2);
    // Near the top edge: the top half, for a stacked split.
    await page.mouse.move(card.x + card.width * 0.5, card.y + card.height * 0.1, { steps: 4 });
    hint = (await page.getByTestId('drop-hint').boundingBox())!;
    expect(Math.abs(hint.height - card.height / 2)).toBeLessThan(2);
    expect(Math.abs(hint.width - card.width)).toBeLessThan(2);
    await page.mouse.move(card.x + card.width * 0.2, card.y + card.height * 0.5, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByTestId('drop-hint')).toHaveCount(0);
    await expect(todayRows(page).first()).toHaveAttribute('data-title', 'two.com | three.com');
    await expect(page.getByTestId('pane-0')).toHaveAttribute('data-focused', 'true');
    // Onto a split: between the panes nearest the pointer (here, after the last one).
    card = await dragOverPage(page, 1, 0.9, 0.5);
    hint = (await page.getByTestId('drop-hint').boundingBox())!;
    expect(Math.abs(hint.width - card.width / 3)).toBeLessThan(2);
    expect(Math.abs(hint.x + hint.width - (card.x + card.width))).toBeLessThan(2);
    await page.mouse.up();
    await expect(todayRows(page).first()).toHaveAttribute('data-title', 'two.com | three.com | one.com');
    await expect(todayRows(page)).toHaveCount(1); // moved into the split, not copied
  });

  test('pane actions stay out of the page until the pointer is on the grip; dividers are a hairline with room to grab', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await splitWith(page, 'b.com');
    const actions = page.getByTestId('pane-0').locator('.pane-actions');
    await page.mouse.move(600, 500);
    await expect(actions).toHaveCSS('opacity', '0');
    await expect(actions).toHaveCSS('pointer-events', 'none');
    await page.getByTestId('pane-handle-0').hover();
    await expect(actions).toHaveCSS('opacity', '1');
    for (const a of ['swap', 'flip', 'separate', 'close']) {
      const b = (await page.getByTestId(`pane-${a}-0`).boundingBox())!;
      expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(24);
    }
    const divider = page.getByTestId('divider-0');
    expect((await divider.boundingBox())!.width).toBe(8);
    expect(await divider.evaluate((el) => getComputedStyle(el, '::after').width)).toBe('1px');
    await expect(divider).toHaveCSS('cursor', 'col-resize');
    // The two pages meet at that hairline: nothing else stands between them.
    const [left, right] = await page.locator('.surface-slot[data-visible]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).sort((a, b) => a.left - b.left));
    expect(Math.round(right.left - left.right)).toBe(1);
  });

  test('up to 4 panes; a fifth is refused', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'p1.com');
    for (const u of ['p2.com', 'p3.com', 'p4.com']) await splitWith(page, u);
    await expect(page.locator('.pane-frame')).toHaveCount(4);
    await splitWith(page, 'p5.com');
    await expect(page.getByTestId('toast').filter({ hasText: 'up to 4 pages' })).toHaveCount(1);
    await expect(page.locator('.pane-frame')).toHaveCount(4);
  });

  test('close a pane; with one left it becomes a normal tab', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await splitWith(page, 'b.com');
    await splitWith(page, 'c.com');
    await paneAction(page, 'close', 2);
    await expect(page.locator('.pane-frame')).toHaveCount(2);
    await paneAction(page, 'close', 1);
    await expect(page.getByTestId('split-chrome')).toHaveCount(0);
    await expect(todayRows(page).first()).toHaveAttribute('data-kind', 'tab');
  });

  test('separate a pane back into its own tab; swap reorders', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await splitWith(page, 'b.com');
    await splitWith(page, 'c.com');
    await paneAction(page, 'swap', 0);
    await expect(todayRows(page).first()).toHaveAttribute('data-title', 'b.com | a.com | c.com');
    await paneAction(page, 'separate', 2);
    await expect(todayRows(page)).toHaveCount(2);
    await expect(todayRows(page).nth(1)).toHaveAttribute('data-title', 'c.com');
  });

  test('“Separate All Pages” from the sidebar menu, and pages keep loaded (no reload)', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await splitWith(page, 'b.com');
    const frameId = await page.locator('.surface-slot[data-visible] iframe').first().evaluate((f: HTMLIFrameElement) => ((f as any).__mark = Math.random()));
    await todayRows(page).first().click({ button: 'right' });
    await page.getByTestId('menu-unsplit').click();
    await expect(todayRows(page)).toHaveCount(2);
    // The same iframe element survived (page wasn't reloaded)
    const still = await page.locator('iframe').evaluateAll((fs, m) => fs.some((f: any) => f.__mark === m), frameId);
    expect(still).toBe(true);
  });

  test('“Open in Split View” from a tab’s menu', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    await todayRows(page).nth(1).click({ button: 'right' });
    await page.getByTestId('menu-split-with').click();
    await expect(page.locator('.pane-frame')).toHaveCount(2);
  });

  test('split survives restart', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await splitWith(page, 'b.com');
    await savedState(page);
    await page.reload();
    await expect(page.locator('.pane-frame')).toHaveCount(2);
    await expect(page.locator('.surface-slot[data-visible]')).toHaveCount(2);
  });
});
