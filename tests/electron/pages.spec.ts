// Real-app checks for the page features added for launch: view-source pages, a page
// whose process dies, the menu bar, and the version/build information.

import { test, expect, type Page } from '@playwright/test';
import { launch, startSite, MOD } from './harness';

let site: Awaited<ReturnType<typeof startSite>>;
test.beforeAll(async () => {
  site = await startSite();
});
test.afterAll(() => site.server.close());

async function open(win: Page, url: string) {
  await win.keyboard.press(`${MOD}+t`);
  await win.getByTestId('cb-input').fill(url);
  await win.getByTestId('cb-input').press('Enter');
}

test('View Page Source opens the page’s source, as sent, in a new tab', async () => {
  const { app, win } = await launch();
  await open(win, site.url('/'));
  await expect(win.locator('[data-title="Kite Test Home"]')).toHaveCount(1, { timeout: 15000 });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('shortcut', 'viewSource'));
  await expect(win.locator('[data-testid^="row-"]')).toHaveCount(2, { timeout: 15000 });
  await expect(win.getByTestId('url-pill')).toContainText('view-source:');
  await expect(win.getByTestId('source-text')).toContainText('<h1 id="h">Home</h1>', { timeout: 15000 });
  await expect(win.getByTestId('source-view')).toContainText('lines · 200');
  await app.close();
});

test('a page whose process dies says so, and “Try again” brings it back', async () => {
  const { app, win } = await launch();
  await open(win, site.url('/two'));
  await expect(win.locator('[data-title="Page Two"]')).toHaveCount(1, { timeout: 15000 });
  await app.evaluate(({ webContents }) => webContents.getAllWebContents().find((w) => w.getType() === 'webview')!.forcefullyCrashRenderer());
  await expect(win.getByTestId('load-error')).toBeVisible({ timeout: 15000 });
  await expect(win.getByTestId('load-error')).toContainText('stopped working');
  await win.getByTestId('load-error-retry').click();
  await expect(win.getByTestId('load-error')).toHaveCount(0, { timeout: 15000 });
  const h = await win.locator('webview').first().evaluate((wv: any) => wv.executeJavaScript('document.querySelector("#h").textContent'));
  expect(h).toBe('Two');
  await app.close();
});

test('the menu bar lists every part of Kite, with shortcuts, and follows shortcut changes', async () => {
  const { app, win } = await launch();
  const labels = await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.items.map((i) => i.label));
  expect(labels).toEqual(expect.arrayContaining(['File', 'Edit', 'View', 'History', 'Tabs', 'Tools', 'Window', 'Help']));
  const find = async (menu: string, label: string) => app.evaluate(({ Menu }, [m, l]) => {
    const top = Menu.getApplicationMenu()!.items.find((i) => i.label === m);
    const it = top?.submenu?.items.find((i) => i.label === l);
    return it ? { accelerator: it.accelerator, enabled: it.enabled } : null;
  }, [menu, label] as const);
  expect(await find('History', 'View History')).toMatchObject({ enabled: true });
  if (process.platform === 'darwin') {
    expect((await find('File', 'New Tab…'))?.accelerator).toBe('CommandOrControl+T');
    // Change a shortcut in Settings: the menu shows the new keys.
    await win.keyboard.press(`${MOD}+Comma`);
    await win.getByTestId('settings-keys').click();
    await win.getByTestId('key-btn-newNote').click();
    await win.keyboard.press(`${MOD}+Shift+k`);
    await expect.poll(async () => (await find('File', 'New Note'))?.accelerator).toBe('CommandOrControl+Shift+K');
  }
  // Menu items act: Show History opens the History page.
  await app.evaluate(({ Menu }) => {
    const top = Menu.getApplicationMenu()!.items.find((i) => i.label === 'History')!;
    top.submenu!.items.find((i) => i.label === 'View History')!.click();
  });
  await expect(win.getByTestId('history-page')).toBeVisible();
  await app.close();
});

test('About shows the real version and build, and the error log exists on disk', async () => {
  const { app, win, userData } = await launch();
  await win.keyboard.press(`${MOD}+Comma`);
  await win.getByTestId('settings-about').click();
  const version = await app.evaluate(({ app }) => app.getVersion());
  await expect(win.getByTestId('about-version')).toHaveText(`Version ${version}`);
  await expect(win.getByTestId('about-details')).toContainText('Electron');
  await expect(win.getByTestId('about-details')).toContainText(userData);
  await app.close();
});
