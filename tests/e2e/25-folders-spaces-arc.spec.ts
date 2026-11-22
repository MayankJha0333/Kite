// Folders and Spaces the way Arc does them: dropping into folders from anywhere
// they show, folders that open while you hold a tab over them, Spaces that come
// forward the same way, picking several rows, and Arc's folder and Space menus.

import type { Locator, Page } from '@playwright/test';
import { test, expect, openApp, newTab, todayRows, pinnedRows, savedState, settledRows, MOD } from './fixtures';

type Where = 'top' | 'middle' | 'bottom' | 'under-name';

async function point(target: Locator, where: Where = 'middle', dx?: number) {
  await settledRows(target.page()); // rows glide into place after a change; measure them at rest
  const b = (await target.boundingBox())!;
  const x = dx !== undefined ? b.x + dx : b.x + b.width / 2;
  const y = where === 'top' ? b.y + 3 : where === 'bottom' ? b.y + b.height - 3 : where === 'under-name' ? b.y + b.height - 4 : b.y + b.height / 2;
  return { x, y };
}

/** Press on a row, move to a point, optionally hold there, then let go. */
async function drag(page: Page, from: Locator, to: { x: number; y: number }, opts: { holdMs?: number; release?: boolean } = {}) {
  await settledRows(page);
  const a = (await from.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 12, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  if (opts.holdMs) await page.waitForTimeout(opts.holdMs);
  if (opts.release !== false) await page.mouse.up();
}

async function newFolder(page: Page, name: string) {
  await page.keyboard.press(`${MOD}+Alt+f`);
  await page.getByTestId('rename-input').fill(name);
  await page.getByTestId('rename-input').press('Enter');
  return page.locator(`.folder:has(> .folder-row[data-title="${name}"])`);
}

const row = (page: Page, title: string) => page.locator(`[data-dnd-row][data-title="${title}"]`);
const inFolder = (folder: Locator, title: string) => folder.locator(`.folder-children [data-title="${title}"]`);

async function addSpace(page: Page, name: string) {
  await page.getByTestId('btn-new-space').click();
  await page.getByTestId('space-name-input').fill(name);
  await page.getByTestId('space-done').click();
  await expect(page.getByTestId('space-editor')).toHaveCount(0);
}

test.describe('drop into folders like Arc', () => {
  test('an empty folder takes a tab dropped on its "Drop tabs here" line', async ({ page }) => {
    await openApp(page);
    const folder = await newFolder(page, 'Work');
    await newTab(page, 'a.com');
    await drag(page, todayRows(page).first(), await point(folder.locator('.folder-empty')));
    await expect(inFolder(folder, 'a.com')).toHaveCount(1);
    await expect(todayRows(page)).toHaveCount(0);
  });

  test('anywhere on a folder row (not just a thin middle band) drops inside it, and the folder lights up', async ({ page }) => {
    await openApp(page);
    const folder = await newFolder(page, 'Work');
    await folder.locator('.folder-row').click(); // closed
    await newTab(page, 'a.com');
    const b = (await folder.locator('.folder-row').boundingBox())!;
    await drag(page, todayRows(page).first(), { x: b.x + b.width / 2, y: b.y + b.height * 0.3 }, { release: false });
    await expect(folder.locator('.folder-row')).toHaveAttribute('data-drop', 'into');
    await page.mouse.move(b.x + b.width / 2, b.y + b.height * 0.7, { steps: 2 });
    await expect(folder.locator('.folder-row')).toHaveAttribute('data-drop', 'into');
    await page.mouse.up();
    // A closed folder opens to show where the tab went.
    await expect(folder).not.toHaveAttribute('data-collapsed', 'true');
    await expect(inFolder(folder, 'a.com')).toHaveCount(1);
  });

  test('between the tabs inside an open folder drops at that spot in it', async ({ page }) => {
    await openApp(page);
    const folder = await newFolder(page, 'Work');
    for (const u of ['a.com', 'b.com', 'c.com']) await newTab(page, u);
    await drag(page, row(page, 'a.com'), await point(folder.locator('.folder-row')));
    await drag(page, row(page, 'b.com'), await point(row(page, 'a.com'), 'bottom'));
    await drag(page, row(page, 'c.com'), await point(row(page, 'a.com'), 'top'));
    const titles = await folder.locator('.folder-children [data-dnd-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-title')));
    expect(titles).toEqual(['c.com', 'a.com', 'b.com']);
  });

  test('just under an open folder’s name drops at the top of it', async ({ page }) => {
    await openApp(page);
    const folder = await newFolder(page, 'Work');
    for (const u of ['a.com', 'b.com']) await newTab(page, u);
    await drag(page, row(page, 'a.com'), await point(folder.locator('.folder-row')));
    await drag(page, row(page, 'b.com'), await point(folder.locator('.folder-row'), 'under-name'), { release: false });
    await expect(folder.locator('.folder-row')).toHaveAttribute('data-drop', 'into-start');
    await page.mouse.up();
    const titles = await folder.locator('.folder-children [data-dnd-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-title')));
    expect(titles).toEqual(['b.com', 'a.com']);
  });

  test('below a folder’s last tab, pulling left drops after the folder instead of in it', async ({ page }) => {
    await openApp(page);
    const folder = await newFolder(page, 'Work');
    for (const u of ['a.com', 'b.com']) await newTab(page, u);
    await drag(page, row(page, 'a.com'), await point(folder.locator('.folder-row')));
    // Far left, at the bottom edge of the folder's last tab.
    await drag(page, row(page, 'b.com'), await point(row(page, 'a.com'), 'bottom', 4), { release: false });
    await expect(folder.locator('.folder-row')).toHaveAttribute('data-drop', 'after');
    await page.mouse.up();
    await expect(inFolder(folder, 'b.com')).toHaveCount(0);
    expect(await pinnedRows(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-title')))).toEqual(['Work', 'b.com']);
  });

  test('hold a tab over a closed folder and it opens, so you can place it inside', async ({ page }) => {
    await openApp(page);
    const folder = await newFolder(page, 'Work');
    for (const u of ['a.com', 'b.com']) await newTab(page, u);
    await drag(page, row(page, 'a.com'), await point(folder.locator('.folder-row')));
    await folder.locator('.folder-row').click(); // close it
    await expect(folder).toHaveAttribute('data-collapsed', 'true');
    await drag(page, row(page, 'b.com'), await point(folder.locator('.folder-row')), { holdMs: 900, release: false });
    await expect(folder).not.toHaveAttribute('data-collapsed', 'true');
    // Now it's open: put b above a.
    const a = await point(row(page, 'a.com'), 'top');
    await page.mouse.move(a.x, a.y, { steps: 4 });
    await expect(row(page, 'a.com')).toHaveAttribute('data-drop', 'before');
    await page.mouse.up();
    const titles = await folder.locator('.folder-children [data-dnd-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-title')));
    expect(titles).toEqual(['b.com', 'a.com']);
  });

  test('folders nest by dragging one onto another; a folder can’t go into itself or into Today', async ({ page }) => {
    await openApp(page);
    const outer = await newFolder(page, 'Outer');
    const inner = await newFolder(page, 'Inner');
    await newTab(page, 'a.com');
    await drag(page, inner.locator('.folder-row'), await point(outer.locator('.folder-row')));
    await expect(outer.locator('.folder-children .folder-row[data-title="Inner"]')).toHaveCount(1);
    // Outer into Inner (its own child): no drop line, nothing changes.
    await drag(page, outer.locator('> .folder-row'), await point(outer.locator('.folder-row[data-title="Inner"]')), { release: false });
    await expect(page.locator('[data-drop]')).toHaveCount(0);
    await page.mouse.up();
    // A folder over a Today tab: not allowed either.
    await drag(page, outer.locator('> .folder-row'), await point(row(page, 'a.com'), 'top'), { release: false });
    await expect(page.locator('[data-drop]')).toHaveCount(0);
    await page.mouse.up();
    await expect(outer.locator('.folder-children .folder-row[data-title="Inner"]')).toHaveCount(1);
    await expect(todayRows(page)).toHaveCount(1);
  });

  test('a closed folder still shows the open tab inside it, and that tab can be dragged out', async ({ page }) => {
    await openApp(page);
    const folder = await newFolder(page, 'Work');
    for (const u of ['a.com', 'b.com']) await newTab(page, u);
    await drag(page, row(page, 'a.com'), await point(folder.locator('.folder-row')));
    await drag(page, row(page, 'b.com'), await point(folder.locator('.folder-row')));
    await row(page, 'a.com').click();
    await folder.locator('.folder-row').click();
    await expect(folder.locator('.folder-peek [data-dnd-row]')).toHaveCount(1);
    await expect(folder.locator('.folder-peek [data-title="a.com"]')).toHaveAttribute('data-active', 'true');
    await drag(page, folder.locator('.folder-peek [data-title="a.com"]'), await point(page.getByTestId('today-end')));
    await expect(todayRows(page)).toHaveCount(1);
    await expect(folder.locator('.folder-peek')).toHaveCount(0);
  });
});

test.describe('Spaces while dragging', () => {
  test('hold a tab over another Space and the sidebar switches to it; drop it where you like there', async ({ page }) => {
    await openApp(page);
    await addSpace(page, 'Work');
    await newTab(page, 'w.com');
    await page.locator('[data-testid^="space-"][data-name="Home"]').click();
    await newTab(page, 'h.com');
    await drag(page, row(page, 'h.com'), await point(page.locator('[data-testid^="space-"][data-name="Work"]')), { holdMs: 900, release: false });
    await expect(page.getByTestId('space-name')).toHaveText('Work');
    const w = await point(row(page, 'w.com'), 'bottom');
    await page.mouse.move(w.x, w.y, { steps: 4 });
    await page.mouse.up();
    expect(await todayRows(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-title')))).toEqual(['w.com', 'h.com']);
  });

  test('drag a Space’s icon sideways to reorder Spaces', async ({ page }) => {
    await openApp(page);
    await addSpace(page, 'Work');
    await addSpace(page, 'Play');
    const names = () => page.locator('[data-space-dot]').evaluateAll((els) => els.map((e) => e.getAttribute('data-name')));
    expect(await names()).toEqual(['Home', 'Work', 'Play']);
    const play = (await page.locator('[data-space-dot][data-name="Play"]').boundingBox())!;
    const home = (await page.locator('[data-space-dot][data-name="Home"]').boundingBox())!;
    await page.mouse.move(play.x + play.width / 2, play.y + play.height / 2);
    await page.mouse.down();
    await page.mouse.move(home.x + 2, home.y + home.height / 2, { steps: 10 });
    await page.mouse.up();
    expect(await names()).toEqual(['Play', 'Home', 'Work']);
    expect((await savedState(page)).spaces.map((s: { name: string }) => s.name)).toEqual(['Play', 'Home', 'Work']);
    // The drag didn't count as a click on it.
    await expect(page.getByTestId('space-name')).toHaveText('Play'); // it was already the open Space
  });
});

test.describe('picking several rows', () => {
  test('⌘-click picks rows, they drag into a folder together, and Esc lets go', async ({ page }) => {
    await openApp(page);
    const folder = await newFolder(page, 'Work');
    for (const u of ['a.com', 'b.com', 'c.com']) await newTab(page, u);
    await row(page, 'a.com').click({ modifiers: ['Meta'] });
    // The open tab (c) counts as picked too, as in Arc.
    await expect(page.locator('.row[data-picked]')).toHaveCount(2);
    await drag(page, row(page, 'a.com'), await point(folder.locator('.folder-row')), { release: false });
    await expect(page.getByTestId('drag-ghost')).toHaveAttribute('data-count', '2');
    await page.mouse.up();
    const titles = await folder.locator('.folder-children [data-dnd-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-title')));
    expect(titles).toEqual(['c.com', 'a.com']);
    await expect(todayRows(page)).toHaveCount(1);
    await expect(page.locator('.row[data-picked]')).toHaveCount(0);

    await row(page, 'b.com').click({ modifiers: ['Meta'] });
    await expect(page.locator('.row[data-picked]')).not.toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('.row[data-picked]')).toHaveCount(0);
  });

  test('⇧-click picks a range; its menu makes a folder with them', async ({ page }) => {
    await openApp(page);
    for (const u of ['a.com', 'b.com', 'c.com', 'd.com']) await newTab(page, u);
    // Today, newest first: d c b a. d is open.
    await row(page, 'b.com').click({ modifiers: ['Shift'] });
    await expect(page.locator('.row[data-picked]')).toHaveCount(3);
    await row(page, 'c.com').click({ button: 'right' });
    await page.getByTestId('menu-sel-folder').click();
    await page.getByTestId('rename-input').fill('Picked');
    await page.getByTestId('rename-input').press('Enter');
    const folder = page.locator('.folder:has(> .folder-row[data-title="Picked"])');
    const titles = await folder.locator('.folder-children [data-dnd-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-title')));
    expect(titles).toEqual(['d.com', 'c.com', 'b.com']);
    expect(await todayRows(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-title')))).toEqual(['a.com']);
  });

  test('a plain click goes back to one row', async ({ page }) => {
    await openApp(page);
    for (const u of ['a.com', 'b.com']) await newTab(page, u);
    await row(page, 'a.com').click({ modifiers: ['Meta'] });
    await expect(page.locator('.row[data-picked]')).toHaveCount(2);
    await row(page, 'a.com').click();
    await expect(page.locator('.row[data-picked]')).toHaveCount(0);
    await expect(page.locator('.row[data-active]')).toHaveAttribute('data-title', 'a.com');
  });
});

test.describe('folder and Space menus like Arc', () => {
  test('the folder’s “…” button opens its menu: duplicate, copy links, open/close', async ({ page }) => {
    await openApp(page);
    const folder = await newFolder(page, 'Work');
    await newTab(page, 'a.com');
    await drag(page, row(page, 'a.com'), await point(folder.locator('.folder-row')));
    await folder.locator('.folder-row').hover();
    await folder.locator('.folder-more').click();
    await expect(page.getByTestId('menu-duplicate-folder')).toBeVisible();
    await page.getByTestId('menu-copy-links').click();
    await expect(page.getByText('Copied 1 link')).toBeVisible();
    await folder.locator('.folder-row').click({ button: 'right' });
    await page.getByTestId('menu-duplicate-folder').click();
    const copy = page.locator('.folder:has(> .folder-row[data-title="Work copy"])');
    await expect(copy).toHaveCount(1);
    await expect(inFolder(copy, 'a.com')).toHaveCount(1);
    // The copy has its own tabs.
    const s = await savedState(page);
    const ids = Object.values(s.items as Record<string, { kind: string; title: string; children?: string[] }>).filter((x) => x.kind === 'folder').map((f) => f.children![0]);
    expect(new Set(ids).size).toBe(2);
  });

  test('“Turn into Space” makes a Space from a folder; “Turn into Folder” puts a Space back as a folder', async ({ page }) => {
    await openApp(page);
    const folder = await newFolder(page, 'Research');
    for (const u of ['a.com', 'b.com']) await newTab(page, u);
    await drag(page, row(page, 'a.com'), await point(folder.locator('.folder-row')));
    await folder.locator('.folder-row').click({ button: 'right' });
    await page.getByTestId('menu-folder-to-space').click();
    await expect(page.getByTestId('space-name')).toHaveText('Research');
    expect(await pinnedRows(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-title')))).toEqual(['a.com']);
    await expect(page.locator('[data-space-dot]')).toHaveCount(2);

    // And back: the Space becomes a folder in Home.
    await page.getByTestId('space-menu').click();
    await page.getByTestId('menu-space-to-folder').click();
    await page.locator('[data-testid^="menu-space-to-folder-"]').click();
    await expect(page.locator('[data-space-dot]')).toHaveCount(1);
    await expect(page.getByTestId('space-name')).toHaveText('Home');
    const back = page.locator('.folder:has(> .folder-row[data-title="Research"])');
    await expect(inFolder(back, 'a.com')).toHaveCount(1);
    // Undo brings the Space back.
    await page.getByRole('button', { name: 'Undo' }).last().click();
    await expect(page.locator('[data-space-dot]')).toHaveCount(2);
  });

  test('“Move to Space” sends a folder (with its tabs) to another Space’s Pinned', async ({ page }) => {
    await openApp(page);
    await addSpace(page, 'Work');
    await page.locator('[data-testid^="space-"][data-name="Home"]').click();
    const folder = await newFolder(page, 'Docs');
    await newTab(page, 'a.com');
    await drag(page, row(page, 'a.com'), await point(folder.locator('.folder-row')));
    await folder.locator('.folder-row').click({ button: 'right' });
    await page.getByTestId('menu-move-space').click();
    await page.locator('[data-testid^="menu-to-space-"]:not([data-testid$="-pinned"]):not([data-testid$="-today"])').first().click();
    await page.locator('[data-testid$="-pinned"]').click();
    await expect(page.locator('.folder-row[data-title="Docs"]')).toHaveCount(0);
    await page.locator('[data-testid^="space-"][data-name="Work"]').click();
    await expect(inFolder(page.locator('.folder:has(> .folder-row[data-title="Docs"])'), 'a.com')).toHaveCount(1);
  });

  test('“Rename Space” edits the name in the header', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('space-name').click();
    await page.getByTestId('menu-rename-space').click();
    await expect(page.getByTestId('space-rename-input')).toBeFocused();
    await page.getByTestId('space-rename-input').fill('Life');
    await page.getByTestId('space-rename-input').press('Enter');
    await expect(page.getByTestId('space-name')).toHaveText('Life');
    expect((await savedState(page)).spaces[0].name).toBe('Life');
  });
});
