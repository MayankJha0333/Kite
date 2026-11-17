// Real-app drag and drop for folders and Spaces (the web tests cover the details;
// this checks the same moves work with the real window, pages and pointer).

import { test, expect, type Page } from '@playwright/test';
import { launch, startSite, MOD } from './harness';

async function open(win: Page, url: string) {
  await win.keyboard.press(`${MOD}+t`);
  await win.keyboard.type(url);
  await win.keyboard.press('Enter');
  await expect(win.getByTestId('command-bar')).toHaveCount(0);
}

async function drag(win: Page, from: string, to: { x: number; y: number }, holdMs = 0) {
  const a = (await win.locator(from).first().boundingBox())!;
  await win.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await win.mouse.down();
  await win.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 10, { steps: 3 });
  await win.mouse.move(to.x, to.y, { steps: 10 });
  if (holdMs) await win.waitForTimeout(holdMs);
  await win.mouse.up();
}

async function mid(win: Page, sel: string) {
  const b = (await win.locator(sel).first().boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test('real app: tabs drop into folders, closed folders open on hover, picked tabs move together', async () => {
  const site = await startSite();
  const { app, win } = await launch();
  try {
    for (const p of ['/', '/two', '/article']) {
      await open(win, site.url(p));
      await win.waitForTimeout(300);
    }
    await win.keyboard.press(`${MOD}+Alt+f`);
    await win.getByTestId('rename-input').fill('Work');
    await win.getByTestId('rename-input').press('Enter');
    const children = win.locator('.folder-children:not(.folder-peek) [data-dnd-row]');
    const today = '[data-testid=today-list] [data-dnd-row]';

    // 1. Onto the empty folder's "Drop tabs here".
    await drag(win, today, await mid(win, '.folder-empty'));
    await expect(children).toHaveCount(1);

    // 2. Onto a closed folder, held: it opens.
    await win.locator('.folder-row').click();
    await expect(win.locator('.folder')).toHaveAttribute('data-collapsed', 'true');
    await drag(win, today, await mid(win, '.folder-row'), 900);
    await expect(win.locator('.folder')).not.toHaveAttribute('data-collapsed', 'true');
    await expect(children).toHaveCount(2);

    // 3. ⌘-click two rows and drag both out to Today.
    await children.nth(0).click();
    await children.nth(1).click({ modifiers: ['Meta'] });
    await expect(win.locator('.row[data-picked]')).toHaveCount(2);
    await drag(win, '.folder-children .row[data-picked]', await mid(win, '[data-testid=today-end]'));
    await expect(children).toHaveCount(0);
    await expect(win.locator(today)).toHaveCount(3);
  } finally {
    await app.close();
    site.server.close();
  }
});
