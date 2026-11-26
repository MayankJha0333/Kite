import { test, expect, openApp, newTab, todayRows, activeRowTitle, savedState, settledRows, visibleFrame, MOD } from './fixtures';

test.describe('sidebar tabs', () => {
  test('starts empty, opens a tab from the command bar', async ({ page }) => {
    await openApp(page);
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await newTab(page, 'example.com');
    await expect(todayRows(page)).toHaveCount(1);
    await expect(page.getByTestId('url-pill')).toContainText('example.com');
    await expect(page.getByTestId('empty-state')).toHaveCount(0);
    await expect(visibleFrame(page).locator('#title')).toHaveText('example.com');
  });

  test('typing words searches with the chosen engine', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'paper kites');
    await expect(page.getByTestId('url-pill')).toContainText('google.com');
    await expect(todayRows(page).first()).toHaveAttribute('data-title', 'paper kites - Search');
  });

  test('new tabs go on top and become active; clicking switches pages', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    await expect(todayRows(page).nth(0)).toHaveAttribute('data-title', 'b.com');
    await expect(todayRows(page).nth(1)).toHaveAttribute('data-title', 'a.com');
    expect(await activeRowTitle(page)).toBe('b.com');
    await todayRows(page).nth(1).click();
    expect(await activeRowTitle(page)).toBe('a.com');
    await expect(visibleFrame(page).locator('#title')).toHaveText('a.com');
    // Both pages stay alive (only one is visible)
    await expect(page.locator('.surface-slot')).toHaveCount(2);
    await expect(page.locator('.surface-slot[data-visible]')).toHaveCount(1);
  });

  test('close button removes the tab and Undo brings it back', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    const row = todayRows(page).first();
    await row.hover();
    await row.locator('[data-testid^="close-"]').click();
    await expect(todayRows(page)).toHaveCount(1);
    expect(await activeRowTitle(page)).toBe('a.com');
    await page.getByTestId('toast').getByText('Undo').click();
    await expect(todayRows(page)).toHaveCount(2);
    expect(await activeRowTitle(page)).toBe('b.com');
  });

  test('⌘W closes, ⌘⇧T reopens', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    await page.keyboard.press(`${MOD}+w`);
    await expect(todayRows(page)).toHaveCount(1);
    await page.keyboard.press(`${MOD}+Shift+t`);
    await expect(todayRows(page)).toHaveCount(2);
    expect(await activeRowTitle(page)).toBe('b.com');
  });

  test('shortcuts work while focus is inside a page', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await visibleFrame(page).locator('#lede').click();
    await page.keyboard.press(`${MOD}+t`);
    await expect(page.getByTestId('command-bar')).toBeVisible();
  });

  test('middle-click closes a tab', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    await todayRows(page).nth(1).click({ button: 'middle' });
    await expect(todayRows(page)).toHaveCount(1);
  });

  test('rename by double-click: Enter saves, Escape cancels, empty restores page title', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    const row = todayRows(page).first();
    await row.dblclick();
    await page.getByTestId('rename-input').fill('My tab');
    await page.getByTestId('rename-input').press('Enter');
    await expect(row).toHaveAttribute('data-title', 'My tab');
    await row.dblclick();
    await page.getByTestId('rename-input').fill('Nope');
    await page.getByTestId('rename-input').press('Escape');
    await expect(row).toHaveAttribute('data-title', 'My tab');
    await row.dblclick();
    await page.getByTestId('rename-input').fill('');
    await page.getByTestId('rename-input').press('Enter');
    await expect(row).toHaveAttribute('data-title', 'a.com');
  });

  test('right-click menu duplicates a tab', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await todayRows(page).first().click({ button: 'right' });
    await page.getByTestId('menu-more').click();
    await page.getByTestId('menu-duplicate').click();
    await expect(todayRows(page)).toHaveCount(2);
  });

  test('links inside a page navigate the tab; back and forward work', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await expect(page.getByTestId('btn-back')).toBeDisabled();
    await visibleFrame(page).locator('#same').click();
    await expect(todayRows(page).first()).toHaveAttribute('data-title', 'a.com/page-2');
    await expect(page.getByTestId('url-pill')).toContainText('a.com/page-2');
    await expect(page.getByTestId('btn-back')).toBeEnabled();
    await page.getByTestId('btn-back').click();
    await expect(page.getByTestId('url-pill')).toHaveText('a.com');
    await expect(page.getByTestId('btn-forward')).toBeEnabled();
    await page.getByTestId('btn-forward').click();
    await expect(page.getByTestId('url-pill')).toContainText('page-2');
  });

  test('target=_blank links open a new tab', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await visibleFrame(page).locator('#blank').click();
    await expect(todayRows(page)).toHaveCount(2);
    expect(await activeRowTitle(page)).toBe('newtab.test');
  });

  test('⌘L edits the current tab instead of opening a new one', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await page.keyboard.press(`${MOD}+l`);
    await expect(page.getByTestId('cb-input')).toHaveValue('https://a.com');
    await page.getByTestId('cb-input').fill('b.com');
    await page.getByTestId('cb-input').press('Enter');
    await expect(todayRows(page)).toHaveCount(1);
    await expect(todayRows(page).first()).toHaveAttribute('data-title', 'b.com');
  });

  test('ctrl+tab cycles, ⌘1 jumps to the first item', async ({ page }) => {
    await openApp(page);
    for (const u of ['a.com', 'b.com', 'c.com']) await newTab(page, u);
    await page.keyboard.press('Control+Tab');
    expect(await activeRowTitle(page)).toBe('b.com');
    await page.keyboard.press(`${MOD}+9`);
    expect(await activeRowTitle(page)).toBe('a.com');
    await page.keyboard.press(`${MOD}+1`);
    expect(await activeRowTitle(page)).toBe('c.com');
  });

  test('tabs, titles and selection survive a restart', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    await todayRows(page).nth(1).click();
    const saved = await savedState(page);
    expect(Object.keys(saved.items)).toHaveLength(2);
    await page.reload();
    await expect(todayRows(page)).toHaveCount(2);
    expect(await activeRowTitle(page)).toBe('a.com');
    await expect(visibleFrame(page).locator('#title')).toHaveText('a.com');
  });

  test('sidebar hides with ⌘S and slides out from the edge', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+s`);
    await expect(page.getByTestId('app')).toHaveAttribute('data-collapsed', 'true');
    await page.mouse.move(3, 400);
    await expect(page.getByTestId('app')).toHaveAttribute('data-sidebar-peek', 'true');
    await page.mouse.move(800, 400);
    await expect(page.getByTestId('app')).not.toHaveAttribute('data-sidebar-peek', 'true');
    await page.keyboard.press(`${MOD}+s`);
    await expect(page.getByTestId('app')).not.toHaveAttribute('data-collapsed', 'true');
  });

  test('drag the sidebar edge to resize; double-click resets', async ({ page }) => {
    await openApp(page);
    const handle = page.getByTestId('sidebar-resizer');
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + 4, box.y + 300);
    await page.mouse.down();
    await page.mouse.move(box.x + 84, box.y + 300, { steps: 5 });
    await page.mouse.up();
    const w = await page.getByTestId('sidebar').evaluate((el) => el.getBoundingClientRect().width);
    expect(w).toBeGreaterThan(330);
    await handle.dblclick();
    const w2 = await page.getByTestId('sidebar').evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.round(w2)).toBe(264);
  });

  test('find bar opens with ⌘F and closes with Escape', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await page.keyboard.press(`${MOD}+f`);
    await expect(page.getByTestId('find-bar')).toBeVisible();
    await page.getByTestId('find-input').fill('banner');
    await expect(visibleFrame(page).locator('body')).toHaveAttribute('data-find', 'banner');
    await page.getByTestId('find-input').press('Escape');
    await expect(page.getByTestId('find-bar')).toHaveCount(0);
  });
});

test.describe('rows: one anatomy, honest states', () => {
  const css = (page: import('@playwright/test').Page, sel: string, prop: string) => page.locator(sel).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

  test('a row is as tall as the density says, regular weight; the selected one is medium', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    const rowH = (await page.getByTestId('app').evaluate((el) => getComputedStyle(el).getPropertyValue('--row-h'))).trim();
    const rows = await todayRows(page).evaluateAll((els) => els.map((el) => ({ h: `${el.getBoundingClientRect().height}px`, w: getComputedStyle(el).fontWeight, active: el.hasAttribute('data-active') })));
    expect(rows.map((r) => r.h)).toEqual([rowH, rowH]);
    expect(rows.find((r) => r.active)!.w).toBe('500');
    expect(rows.find((r) => !r.active)!.w).toBe('400');
    // The "New Tab" row is a row like the others.
    expect(`${(await page.getByTestId('btn-new-tab').boundingBox())!.height}px`).toBe(rowH);
  });

  test('pressing a row does not shrink it, and hover and selection do not animate', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    const row = todayRows(page).nth(1);
    await settledRows(page); // the rows glide after a new tab; press one at rest
    const before = (await row.boundingBox())!;
    await page.mouse.move(before.x + 60, before.y + before.height / 2);
    await page.mouse.down();
    expect(await row.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
    expect(await row.evaluate((el) => el.getAnimations().length)).toBe(0);
    expect((await row.boundingBox())!.width).toBe(before.width);
    await page.mouse.up();
    await expect(row).toHaveAttribute('data-active', 'true');
    expect(await row.evaluate((el) => el.getAnimations().length)).toBe(0);
  });

  test('Close appears on hover without moving or re-cutting the title', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a-very-long-address-that-will-not-fit-in-the-sidebar-at-all.example.com/with/a/long/path');
    await newTab(page, 'b.com');
    const row = todayRows(page).nth(1);
    const title = row.locator('.row-title');
    await settledRows(page);
    const before = (await title.boundingBox())!;
    await expect(row.locator('.row-close')).toBeHidden();
    await row.hover();
    await expect(row.locator('.row-close')).toBeVisible();
    expect(await title.boundingBox()).toEqual(before);
    // The title is cut with an ellipsis, never wrapped.
    expect(await title.evaluate((el) => [getComputedStyle(el).textOverflow, getComputedStyle(el).whiteSpace])).toEqual(['ellipsis', 'nowrap']);
    const btn = (await row.locator('.row-close').boundingBox())!;
    expect(Math.min(btn.width, btn.height)).toBeGreaterThanOrEqual(24);
  });

  test('a sleeping tab looks like any other tab', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    await savedState(page);
    await page.reload(); // a.com has not been opened since the restart: it is asleep
    const asleep = page.locator('.row[data-asleep]');
    await expect(asleep).toHaveCount(1);
    expect(await asleep.locator('.site-icon').evaluate((el) => [getComputedStyle(el).opacity, getComputedStyle(el).filter])).toEqual(['1', 'none']);
    const ink = await css(page, '.row[data-active] .row-title', 'color');
    expect(await asleep.locator('.row-title').evaluate((el) => getComputedStyle(el).color)).toBe(ink);
    await expect(asleep).toHaveAttribute('title', /Asleep/);
  });

  test('an icon too dark for a dark sidebar sits on a plate; it is left alone in the light', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'dark-mark.example');
    await newTab(page, 'b.com');
    const s = await savedState(page);
    const id = s.spaces[0].today[1];
    s.items[id].favicon = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#24292f"/></svg>')}`;
    for (const sp of s.spaces) sp.theme.mode = 'dark';
    await page.evaluate((st) => localStorage.setItem('kite-state', JSON.stringify(st)), s);
    await page.reload();
    const icon = page.locator(`[data-testid="row-${id}"] img.site-icon`);
    await expect(icon).toHaveAttribute('data-tone', 'dark');
    expect(await icon.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    // The icon is never recolored.
    expect(await icon.evaluate((el) => getComputedStyle(el).filter)).toBe('none');
    // The other tab's colorful icon needs no plate.
    await expect(page.locator('.row[data-active] img.site-icon')).not.toHaveAttribute('data-tone', /./);
    // In a light window the same dark icon shows by itself.
    await page.getByTestId('space-menu').click();
    await page.getByTestId('menu-edit-space').click();
    await page.getByTestId('space-mode-light').click();
    await expect(page.getByTestId('app')).toHaveAttribute('data-theme', 'light');
    expect(await icon.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  });

  test('a loading tab shows its spinner where the icon will be', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('slow.example');
    await page.getByTestId('cb-input').press('Enter');
    const row = todayRows(page).first();
    // While it loads: a spinner first in the row and no icon; then the icon, in the same place.
    const first = await row.evaluate((el) => (el.firstElementChild as HTMLElement).className);
    expect(first === 'row-spinner' || first.includes('site-icon')).toBe(true);
    await expect(row.locator('.site-icon')).toBeVisible();
    await expect(row.locator('.row-spinner')).toHaveCount(0);
  });
});

test.describe('New Tab is one thing', () => {
  test('the New Tab row opens an empty tab without adding a second "New Tab" row', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await page.getByTestId('btn-new-tab').click();
    await expect(page.getByTestId('start-page')).toBeVisible();
    await expect(page.getByTestId('start-input')).toBeFocused();
    // The row you clicked is the tab you are on; Today still lists only real pages.
    await expect(page.getByTestId('btn-new-tab')).toHaveAttribute('data-active', 'true');
    await expect(todayRows(page)).toHaveCount(1);
    await expect(page.getByTestId('sidebar').getByText('New Tab', { exact: true })).toHaveCount(1);
    await expect(page.locator('.row[data-active]')).toHaveCount(1);
    // ⌘T over it: still one "New Tab".
    await page.keyboard.press(`${MOD}+t`);
    await expect(page.getByTestId('command-bar')).toBeVisible();
    await expect(page.getByTestId('sidebar').getByText('New Tab', { exact: true })).toHaveCount(1);
    await page.keyboard.press('Escape');
  });

  test('going elsewhere and back reuses the same empty tab; a page loaded in it becomes a row', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await page.getByTestId('btn-new-tab').click();
    await todayRows(page).first().click();
    await expect(page.getByTestId('btn-new-tab')).not.toHaveAttribute('data-active', 'true');
    await expect(todayRows(page)).toHaveCount(1);
    await page.getByTestId('btn-new-tab').click();
    await expect(page.getByTestId('start-input')).toBeFocused();
    await expect(page.getByTestId('btn-new-tab')).toHaveAttribute('data-active', 'true');
    const s = await savedState(page);
    expect(Object.values(s.items).filter((it: any) => it.url === 'kite://newtab')).toHaveLength(1);
    await page.getByTestId('start-input').fill('b.com');
    await page.getByTestId('start-input').press('Enter');
    await expect(todayRows(page)).toHaveCount(2);
    await expect(page.getByTestId('btn-new-tab')).not.toHaveAttribute('data-active', 'true');
    expect(await activeRowTitle(page)).toBe('b.com');
  });
});

test.describe('the sidebar teaches itself', () => {
  test('empty Pinned and Today each say one thing, and stop for good once used', async ({ page }) => {
    await openApp(page);
    await expect(page.getByTestId('hint-pinned')).toHaveText('Drag a tab here to pin it');
    await expect(page.getByTestId('hint-today')).toHaveText('New tabs appear here and tidy themselves after 12 hours');
    await newTab(page, 'a.com');
    await expect(page.getByTestId('hint-today')).toHaveCount(0);
    await expect(page.getByTestId('hint-pinned')).toBeVisible();
    await page.keyboard.press(`${MOD}+d`); // pin it
    await expect(page.getByTestId('hint-pinned')).toHaveCount(0);
    await page.keyboard.press(`${MOD}+d`); // unpin it
    await page.keyboard.press(`${MOD}+w`);
    await expect(todayRows(page)).toHaveCount(0);
    // Both areas are empty again, and neither hint comes back: not now, not after a restart.
    await expect(page.getByTestId('hint-pinned')).toHaveCount(0);
    await expect(page.getByTestId('hint-today')).toHaveCount(0);
    await savedState(page);
    await page.reload();
    await expect(page.getByTestId('sidebar')).toBeVisible();
    await expect(page.getByTestId('hint-pinned')).toHaveCount(0);
    await expect(page.getByTestId('hint-today')).toHaveCount(0);
  });

  test('the Today hint names the real tidy-up time', async ({ page }) => {
    await openApp(page);
    // Make Kite save once without opening a tab: nudge the sidebar's width.
    const edge = (await page.getByTestId('sidebar-resizer').boundingBox())!;
    await page.mouse.move(edge.x + 4, edge.y + 300);
    await page.mouse.down();
    await page.mouse.move(edge.x + 24, edge.y + 300, { steps: 3 });
    await page.mouse.up();
    const s = await savedState(page);
    s.settings.archiveAfterMs = 24 * 3_600_000;
    await page.evaluate((st) => localStorage.setItem('kite-state', JSON.stringify(st)), s);
    await page.reload();
    await expect(page.getByTestId('hint-today')).toHaveText('New tabs appear here and tidy themselves after 24 hours');
  });
});

test.describe('address field, toolbar and footer', () => {
  test('the address field keeps one height, with an address or without', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com/some/path');
    const withUrl = (await page.getByTestId('url-pill').boundingBox())!.height;
    expect(withUrl).toBe(32);
    await expect(page.locator('.url-host')).toHaveText('a.com');
    await expect(page.locator('.url-path')).toHaveText('/some/path');
    await page.getByTestId('btn-new-tab').click();
    await expect(page.getByTestId('url-pill')).toHaveText('Search or enter address');
    expect((await page.getByTestId('url-pill').boundingBox())!.height).toBe(withUrl);
  });

  test('every button in the sidebar has a name and a tooltip, and is at least 24px to hit', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await todayRows(page).first().hover();
    const bad = await page.getByTestId('sidebar').evaluate((sb) =>
      [...sb.querySelectorAll<HTMLElement>('button, [role="button"]')]
        .filter((b) => b.getClientRects().length > 0 && !b.closest('.site-info'))
        .filter((b) => {
          const named = (b.getAttribute('aria-label') || b.textContent || '').trim().length > 0;
          const iconOnly = (b.textContent || '').trim().length === 0;
          const r = b.getBoundingClientRect();
          return !named || (iconOnly && !b.title) || (iconOnly && Math.min(r.width, r.height) < 20);
        })
        .map((b) => b.outerHTML.slice(0, 120)),
    );
    expect(bad).toEqual([]);
  });

  test('the sliders button in the footer opens Customize, stays lit while it is open, and closes it again', async ({ page }) => {
    await openApp(page);
    const btn = page.getByTestId('btn-settings');
    await expect(btn).toHaveAttribute('aria-label', 'Customize');
    await btn.click();
    await expect(page.getByTestId('customize')).toBeVisible();
    await expect(btn).toHaveAttribute('data-active', 'true');
    await btn.click();
    await expect(page.getByTestId('customize')).toHaveCount(0);
    await expect(btn).not.toHaveAttribute('data-active', 'true');
  });

  test('with more tabs than fit, the list scrolls inside the sidebar and nothing shifts sideways', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    const s = await savedState(page);
    const first = s.spaces[0].today[0];
    for (let i = 0; i < 45; i++) {
      s.items[`tab_x${i}`] = { ...s.items[first], id: `tab_x${i}`, url: `https://site${i}.example/`, title: `Site ${i}` };
      s.spaces[0].today.push(`tab_x${i}`);
    }
    const narrow = (await todayRows(page).first().boundingBox())!;
    await page.evaluate((st) => localStorage.setItem('kite-state', JSON.stringify(st)), s);
    await page.reload();
    await expect(todayRows(page)).toHaveCount(46);
    const scroll = page.getByTestId('sb-scroll');
    expect(await scroll.evaluate((el) => el.scrollHeight > el.clientHeight && el.clientWidth === (el as HTMLElement).offsetWidth)).toBe(true);
    const wide = (await todayRows(page).first().boundingBox())!;
    expect([wide.x, wide.width]).toEqual([narrow.x, narrow.width]);
    // The footer stays put under the list.
    const footer = (await page.getByTestId('btn-archive').boundingBox())!;
    expect(footer.y + footer.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  });
});
