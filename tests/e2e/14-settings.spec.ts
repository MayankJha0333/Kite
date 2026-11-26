import type { Page } from '@playwright/test';
import { test, expect, openApp, newTab, todayRows, savedState, settled, MOD, settingsTab } from './fixtures';

async function openSettings(page: Page, section?: string) {
  await page.keyboard.press(`${MOD}+Comma`);
  await expect(page.getByTestId('settings')).toBeVisible();
  if (section) await page.getByTestId(`settings-${settingsTab(section)}`).click();
}

const cssVar = (page: Page, name: string) => page.getByTestId('app').evaluate((el, n) => getComputedStyle(el).getPropertyValue(n).trim(), name);

test.describe('settings: appearance', () => {
  test('sidebar can move to the right', async ({ page }) => {
    await openApp(page);
    await openSettings(page, 'layout');
    await page.getByTestId('set-side-right').click();
    await expect(page.getByTestId('app')).toHaveAttribute('data-side', 'right');
    const sb = (await page.getByTestId('sidebar').boundingBox())!;
    expect(sb.x).toBeGreaterThan(800);
  });

  test('spacing, text size, corners, page margin and sidebar width all apply', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await openSettings(page, 'layout');
    await page.getByTestId('set-density-compact').click();
    await expect(page.getByTestId('app')).toHaveAttribute('data-density', 'compact');
    expect(await cssVar(page, '--row-h')).toBe('28px');
    // Named steps, not raw numbers: Large text, Round corners, an Edge to edge page.
    await page.getByTestId('set-scale-large').click();
    expect(await cssVar(page, '--scale')).toBe('1.1');
    await page.getByTestId('set-corners-round').click();
    await expect(page.getByTestId('page-card')).toHaveCSS('border-radius', '20px');
    await page.getByTestId('set-margin-edge').click();
    expect(await cssVar(page, '--gap')).toBe('0px');
    // The exact sidebar width is behind "More layout options".
    await expect(page.getByTestId('set-width')).toBeHidden();
    await page.getByTestId('layout-more').click();
    await page.getByTestId('set-width').fill('360');
    await expect.poll(() => page.getByTestId('sidebar').evaluate((el) => Math.round(el.getBoundingClientRect().width))).toBe(360);
    const s = await savedState(page);
    expect(s.settings).toMatchObject({ density: 'compact', fontScale: 1.1, radius: 20, gap: 0, sidebarWidth: 360 });
  });

  test('hide the address bar; reduce motion; favorites per row', async ({ page }) => {
    await openApp(page);
    await openSettings(page, 'layout');
    await page.getByTestId('layout-more').click();
    await page.getByTestId('set-urlbar').click();
    await expect(page.getByTestId('url-pill')).toHaveCount(0);
    await page.getByTestId('set-favcols').fill('6');
    await page.getByTestId('settings-general').click();
    await page.getByTestId('set-motion').click();
    await expect(page.getByTestId('app')).toHaveAttribute('data-motion', 'reduced');
    expect((await savedState(page)).settings.favoritesColumns).toBe(6);
  });

  test('reset layout puts the sidebar, spacing and text size back', async ({ page }) => {
    await openApp(page);
    await openSettings(page, 'layout');
    await page.getByTestId('set-side-right').click();
    await page.getByTestId('set-scale-larger').click();
    expect(await cssVar(page, '--scale')).toBe('1.2');
    await expect(page.getByTestId('app')).toHaveAttribute('data-side', 'right');
    await page.getByTestId('set-reset-appearance').click();
    await expect(page.getByTestId('app')).toHaveAttribute('data-side', 'left');
    expect(await cssVar(page, '--scale')).toBe('1');
  });

  test('Settings opens on General; Appearance holds this Space\'s look and the layout for every Space, with the extras closed', async ({ page }) => {
    await openApp(page);
    await openSettings(page);
    const tabs = page.locator('.settings-tab');
    await expect(tabs).toHaveText(['General', 'Appearance', 'Privacy', 'Shortcuts', 'Advanced']);
    await expect(page.getByTestId('settings-general')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('settings-default-browser')).toBeVisible();
    await page.getByTestId('settings-appearance').click();
    await expect(page.getByTestId('settings-scope-spaces')).toHaveText('This Space');
    await expect(page.getByTestId('settings-scope-layout')).toHaveText('All Spaces');
    await expect(page.getByTestId('theme-controls')).toBeVisible();
    // One row of colors: Calm Air's own (chosen on a new Kite), then nine hues.
    await expect(page.getByTestId('preset-quiet')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[data-testid^="swatch-"]')).toHaveCount(9);
    // Every swatch has a name of its own, and the chosen one is marked for the eye and for screen readers.
    await expect(page.getByTestId('swatch-muted-9')).toHaveAttribute('aria-label', 'Navy (muted)');
    await page.getByTestId('swatch-muted-9').click();
    expect(await cssVar(page, '--tint-1')).toBe('#2d4468');
    await expect(page.getByTestId('swatch-muted-9')).toHaveAttribute('aria-checked', 'true');
    // Mode, the color row, three backgrounds and the layout are on the page; everything else opens in place.
    for (const id of ['space-mode-system', 'backdrop-none', 'backdrop-picture', 'backdrop-gradient', 'set-side-left', 'set-density-comfortable', 'set-corners-soft', 'set-margin-float', 'set-scale-regular', 'set-reset-appearance']) await expect(page.getByTestId(id)).toBeVisible();
    await expect(page.getByTestId('theme-backdrops').getByRole('radio')).toHaveCount(3);
    for (const id of ['space-hue', 'swatch-pastel-1', 'backdrop-dunes', 'backdrop-upload', 'preset-tide', 'gradient-own']) await expect(page.getByTestId(id)).toHaveCount(0);
    await expect(page.getByTestId('pattern-dots')).toBeHidden();
    // "Custom…": the other 18 swatches, the hue strip, both colors, Intensity and Grain.
    await page.getByTestId('theme-custom-toggle').click();
    await expect(page.locator('[data-testid^="swatch-"]')).toHaveCount(27);
    for (const id of ['space-hue', 'space-vivid', 'space-intensity', 'space-grain', 'color-a', 'color-b']) await expect(page.getByTestId(id)).toBeVisible();
    // "Picture…": Kite's 11 pictures and the slot for your own. Picking one shows it, by name, on the first level.
    await page.getByTestId('backdrop-picture').click();
    await expect(page.locator('[data-testid^="backdrop-"][data-tone]')).toHaveCount(11);
    await expect(page.getByTestId('backdrop-upload')).toBeVisible();
    await page.getByTestId('backdrop-dunes').click();
    await expect(page.getByTestId('backdrop-picture')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('backdrop-picture')).toHaveAttribute('aria-label', 'Picture: Dunes');
    // "Gradient…": the six ready-made gradients and one of your own, with its editor.
    await page.getByTestId('backdrop-gradient').click();
    await expect(page.getByTestId('backdrop-dunes')).toHaveCount(0); // one thing open at a time
    await expect(page.getByTestId('theme-gradients').getByRole('radio')).toHaveCount(7);
    await page.getByTestId('preset-tide').click();
    await expect(page.getByTestId('backdrop-gradient')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('gradient-editor')).toBeVisible();
    // Calm Air again: the plain shell, and nothing is left chosen under Picture or Gradient.
    await page.getByTestId('preset-quiet').click();
    await expect(page.getByTestId('backdrop-none')).toHaveAttribute('aria-checked', 'true');
    expect(await cssVar(page, '--tint-2')).toBe('#c2187a');
    expect(await cssVar(page, '--pattern')).toBe('none');
    // "Patterns".
    await page.getByTestId('theme-more').click();
    await expect(page.getByTestId('pattern-dots')).toBeVisible();
  });

  test('one screen: Appearance shows mode, color, background and every layout choice without scrolling', async ({ page }) => {
    await openApp(page); // 1280×800, smaller than the window Kite opens with
    await openSettings(page, 'layout');
    const main = (await page.locator('.settings-main').boundingBox())!;
    for (const id of ['space-mode-system', 'swatch-muted-9', 'backdrop-gradient', 'set-side-left', 'set-scale-regular', 'set-reset-appearance', 'layout-more']) {
      const b = (await page.getByTestId(id).boundingBox())!;
      expect(b.y + b.height, id).toBeLessThanOrEqual(main.y + main.height);
    }
  });

});

test.describe('settings: tabs, search, keyboard, data', () => {
  test('search engine: pick one or use your own', async ({ page }) => {
    await openApp(page);
    await openSettings(page, 'links');
    await page.getByTestId('set-engine').selectOption({ label: 'Kagi' });
    await page.keyboard.press('Escape');
    await newTab(page, 'paper planes');
    await expect(page.getByTestId('url-pill')).toContainText('kagi.com');
    await openSettings(page, 'links');
    // The box for your own engine appears only after picking "Custom…".
    await expect(page.getByTestId('set-engine-custom')).toHaveCount(0);
    await page.getByTestId('set-engine').selectOption({ label: 'Custom…' });
    await page.getByTestId('set-engine-custom').fill('https://search.example/find?words=%s');
    await page.getByTestId('set-engine-custom').press('Enter');
    await page.keyboard.press('Escape');
    await newTab(page, 'kites');
    await expect(page.getByTestId('url-pill')).toContainText('search.example/find?words=kites');
  });

  test('global auto-archive time; the Archive page link opens this section', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+y`);
    await page.getByTestId('archive-settings').click();
    await expect(page.getByTestId('set-archive')).toBeVisible();
    await page.getByTestId('set-archive').selectOption({ label: 'Never' });
    expect((await savedState(page)).settings.archiveAfterMs).toBeNull();
  });

  test('record a new shortcut and use it; conflicts are explained', async ({ page }) => {
    await openApp(page);
    await openSettings(page, 'keys');
    await expect(page.getByTestId('key-btn-newNote')).toHaveText('Record');
    await page.getByTestId('key-btn-newNote').click();
    await expect(page.getByTestId('key-btn-newNote')).toHaveText('Press keys…');
    await expect(page.getByTestId('key-btn-newNote')).toHaveAttribute('data-recording', 'true');
    await page.keyboard.press(`${MOD}+Shift+k`);
    await expect(page.getByTestId('key-btn-newNote')).toHaveText('Record');
    // The shortcut is shown as key caps, one per key.
    await expect(page.getByTestId('key-caps-newNote')).toHaveText('⇧⌘K');
    await expect(page.getByTestId('key-caps-newNote').locator('.kbd')).toHaveText(['⇧', '⌘', 'K']);
    await page.keyboard.press('Escape');
    await page.keyboard.press(`${MOD}+Shift+k`);
    await expect(todayRows(page).first()).toHaveAttribute('data-kind', 'note');
    // taking another action's keys
    await openSettings(page, 'keys');
    await page.getByTestId('key-btn-newFolder').click();
    await page.keyboard.press(`${MOD}+Shift+k`);
    await expect(page.getByTestId('key-warn')).toContainText('New note');
    await expect(page.getByTestId('key-caps-newNote')).toHaveText('None');
    await page.getByTestId('keys-reset-all').click();
    await expect(page.getByTestId('key-caps-newNote')).toHaveText('⇧⌘O');
    await expect(page.getByTestId('key-warn')).toHaveCount(0);
  });

  test('Esc while recording cancels without closing Settings; ⌫ removes a shortcut', async ({ page }) => {
    await openApp(page);
    await openSettings(page, 'keys');
    await page.getByTestId('key-btn-reload').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('settings')).toBeVisible();
    await expect(page.getByTestId('key-caps-reload')).toHaveText('⌘R');
    // A shortcut that is still the default has nothing to reset.
    await expect(page.getByTestId('key-reset-reload')).toHaveCount(0);
    await page.getByTestId('key-btn-reload').click();
    await page.keyboard.press('Backspace');
    await expect(page.getByTestId('key-caps-reload')).toHaveText('None');
    await page.getByTestId('key-reset-reload').click();
    await expect(page.getByTestId('key-caps-reload')).toHaveText('⌘R');
  });

  test('shortcuts can be searched by action or by key; nothing found says so', async ({ page }) => {
    await openApp(page);
    await openSettings(page, 'keys');
    const rows = page.getByTestId('keys-list').locator('.key-row');
    await page.getByTestId('keys-search').fill('zoom');
    await expect(rows).toHaveCount(3);
    await page.getByTestId('keys-search').fill('⌘R');
    await expect(rows.first()).toContainText('Reload page');
    await page.getByTestId('keys-search').fill('no such thing');
    await expect(page.getByTestId('keys-nomatch')).toBeVisible();
    // Esc empties the field first; Settings stays open.
    await page.getByTestId('keys-search').press('Escape');
    await expect(page.getByTestId('keys-search')).toHaveValue('');
    await expect(page.getByTestId('key-btn-reload')).toBeVisible();
  });

  test('back up and restore', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'keep.com');
    await openSettings(page, 'data');
    await page.getByTestId('backup-export').click();
    const backup = await page.evaluate(() => window.__kiteTest!.exported[0]);
    expect(backup.name).toMatch(/^kite-backup-\d{4}-\d{2}-\d{2}\.json$/);
    await page.getByTestId('reset-all').click();
    await page.getByTestId('reset-all-confirm').click();
    await expect(todayRows(page)).toHaveCount(0);
    await openSettings(page, 'data');
    await page.getByTestId('backup-import').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(backup.text) });
    await expect(page.getByTestId('backup-confirm')).toContainText('1 Space, 1 tab, 0 notes and 0 Boosts');
    await page.getByTestId('backup-restore-confirm').click();
    await page.keyboard.press('Escape');
    await expect(todayRows(page)).toHaveCount(1);
    await expect(todayRows(page).first()).toHaveAttribute('data-title', 'keep.com');
  });

  test('a wrong backup file is refused with a message', async ({ page }) => {
    await openApp(page);
    await openSettings(page, 'data');
    await page.getByTestId('backup-import').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from('{"x":1}') });
    await expect(page.getByTestId('backup-error')).toContainText('isn’t a Kite backup');
  });

  test('clear history', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await openSettings(page, 'privacy');
    await page.getByTestId('set-clear-history').click();
    expect((await savedState(page)).history).toEqual([]);
  });

  test('General opens Link routing; Advanced opens Boosts', async ({ page }) => {
    await openApp(page);
    await openSettings(page, 'links');
    await page.getByTestId('settings-open-routing').click();
    await expect(page.getByTestId('routing-panel')).toBeVisible();
    await openSettings(page, 'extensions');
    await page.getByTestId('settings-open-boosts').click();
    await expect(page.getByTestId('boosts-list')).toBeVisible();
  });
});

test.describe('settings layout and search', () => {
  test('search narrows the sections, jumps to the match, and Esc clears it before closing', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+Comma`);
    const tabs = page.locator('.settings-tab');
    await expect(tabs).toHaveCount(5);
    await page.getByTestId('settings-search').fill('cookie');
    // Cookie notices live in Shields, clearing cookies under your data: both in the Privacy tab.
    await expect(tabs).toHaveCount(1);
    await expect(page.getByTestId('settings-privacy')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-section]')).toHaveCount(2);
    await expect(page.locator('[data-hit]')).toContainText('Hide cookie notices');
    // A match behind a disclosure opens it and comes into view.
    await page.getByTestId('settings-search').fill('webrtc');
    await expect(page.locator('[data-hit]')).toContainText('WebRTC');
    await expect(page.getByTestId('shields-webrtc')).toBeInViewport();
    await page.getByTestId('settings-search').fill('nothing like this');
    await expect(page.getByTestId('settings-nomatch')).toBeVisible();
    await page.getByTestId('settings-search').press('Escape');
    await expect(page.getByTestId('settings-search')).toHaveValue('');
    await expect(tabs).toHaveCount(5);
    await expect(page.getByTestId('settings')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('settings')).toHaveCount(0);
  });

  test('a tab keeps one size: switching tabs does not resize the window', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+Comma`);
    await settled(page, 'settings');
    const a = (await page.getByTestId('settings').boundingBox())!;
    await page.getByTestId('settings-advanced').click();
    await settled(page, 'settings');
    const b = (await page.getByTestId('settings').boundingBox())!;
    expect([b.width, b.height]).toEqual([a.width, a.height]);
  });
});

test.describe('settings: where a tab opens', () => {
  const scrollTop = (page: Page) => page.locator('.settings-main').evaluate((el) => el.scrollTop);

  test('a tab opens at its top; a link that names a section scrolls to it; a tab is remembered while Settings stays open', async ({ page }) => {
    await openApp(page);
    await openSettings(page);
    // Privacy used to open thousands of pixels down, at its second section.
    await page.getByTestId('settings-privacy').click();
    expect(await scrollTop(page)).toBe(0);
    await expect(page.getByTestId('shields-enabled')).toBeInViewport();
    // Coming back to a tab finds it where it was left.
    await page.getByTestId('set-https').scrollIntoViewIfNeeded();
    const left = await scrollTop(page);
    expect(left).toBeGreaterThan(200);
    await page.getByTestId('settings-advanced').click();
    expect(await scrollTop(page)).toBe(0);
    await page.getByTestId('settings-privacy').click();
    await expect(page.getByTestId('set-https')).toBeInViewport();
    expect(await scrollTop(page)).toBeGreaterThanOrEqual(left);
    await page.keyboard.press('Escape');
    // The Archive's "Change" link names the Tabs section of General: it is scrolled into view.
    await page.keyboard.press(`${MOD}+y`);
    await page.getByTestId('archive-settings').click();
    await expect(page.getByTestId('settings-general')).toHaveAttribute('aria-selected', 'true');
    expect(await scrollTop(page)).toBeGreaterThan(0);
    await expect(page.getByTestId('set-archive')).toBeInViewport();
  });

  test('the column does not step sideways between a short tab and a long one', async ({ page }) => {
    await openApp(page);
    await openSettings(page);
    const x = async () => (await page.locator('.settings-page-title').boundingBox())!.x;
    const general = await x();
    await page.getByTestId('settings-shortcuts').click();
    expect(await x()).toBe(general);
    await page.getByTestId('settings-search').fill('about');
    await expect(page.getByTestId('settings-advanced')).toHaveAttribute('aria-selected', 'true');
    expect(await x()).toBe(general); // one short section, nothing to scroll
  });

  test('the tabs work from the keyboard: arrows move along them, and nothing animates in', async ({ page }) => {
    await openApp(page);
    await openSettings(page);
    await page.getByTestId('settings-general').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('settings-appearance')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('settings-appearance')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('settings-advanced')).toHaveAttribute('aria-selected', 'true');
    // A tab change swaps the content: no entrance on the new tab's groups.
    expect(await page.locator('.settings-body').evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  });

  test('a narrow window keeps the tab labels and the search field', async ({ page }) => {
    await page.setViewportSize({ width: 760, height: 600 });
    await openApp(page);
    await openSettings(page);
    await expect(page.locator('.settings-tab-label')).toHaveText(['General', 'Appearance', 'Privacy', 'Shortcuts', 'Advanced']);
    for (const id of ['general', 'appearance', 'privacy', 'shortcuts', 'advanced']) await expect(page.getByTestId(`settings-${id}`).locator('.settings-tab-label')).toBeVisible();
    const field = (await page.locator('.settings-search').boundingBox())!;
    expect(field.width).toBeGreaterThanOrEqual(100);
    await page.getByTestId('settings-search').fill('volume');
    await expect(page.locator('[data-hit]')).toContainText('Volume');
  });
});

test.describe('settings: updates', () => {
  test('checking is on by default and can be switched off; "Check now" says what it found and offers the download', async ({ page }) => {
    await openApp(page);
    await openSettings(page);
    const group = page.locator('[data-section="updates"]');
    await expect(group).toContainText('Asks github.com once a day whether a newer Kite exists. Nothing about you or your browsing is sent.');
    await expect(group).toContainText(/Kite \d+\.\d+\.\d+/);
    await expect(page.getByTestId('set-updates')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('set-updates').click();
    expect((await savedState(page)).settings.checkForUpdates).toBe(false);
    // Nothing newer: it says so, and there is nothing to download.
    await page.getByTestId('update-check').click();
    await expect(page.getByTestId('update-status')).toHaveText('Kite is up to date.');
    await expect(page.getByTestId('update-download')).toHaveCount(0);
    // A newer Kite exists: the version is named and Download opens its page.
    await page.evaluate(() => { window.__kiteTest!.update = { version: '9.9.9', pageUrl: 'https://github.com/x/y/releases/latest' }; });
    await page.getByTestId('update-check').click();
    await expect(page.getByTestId('update-status')).toHaveText('Kite 9.9.9 is available.');
    await page.getByTestId('update-download').click();
    expect(await page.evaluate(() => window.__kiteTest!.calls)).toContain('openUpdate:https://github.com/x/y/releases/latest');
  });
});

test.describe('settings: privacy', () => {
  test('"Hide cookie notices" is a switch of its own near the top, and is the same thing as the Cookie notices list', async ({ page }) => {
    await openApp(page);
    await openSettings(page, 'adblock');
    const lists = async () => (await page.evaluate(() => (window.__kiteTest as unknown as { prefs: { shields: { lists: string[] } } }).prefs)).shields.lists;
    // On from the start: a cookie banner on every news site is the first thing a new user meets.
    await expect(page.getByTestId('shields-cookie-notices')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('shields-cookie-notices')).toBeInViewport();
    await expect.poll(lists).toContain('adguard-cookies');
    await page.getByTestId('shields-cookie-notices').click();
    await expect.poll(lists).not.toContain('adguard-cookies');
    // The list itself, in its group, shows the same choice.
    await page.getByTestId('shields-group-annoyances').locator('.adb-group-head').click();
    await expect(page.getByTestId('shields-list-adguard-cookies')).toHaveAttribute('aria-checked', 'false');
    await page.getByTestId('shields-list-adguard-cookies').click();
    await expect(page.getByTestId('shields-cookie-notices')).toHaveAttribute('aria-checked', 'true');
    await expect.poll(lists).toContain('adguard-cookies');
  });

  test('the rarer choices wait behind "Advanced"; filter groups show how many lists are on', async ({ page }) => {
    await openApp(page);
    await openSettings(page, 'adblock');
    for (const id of ['shields-enabled', 'shields-fingerprinting', 'shields-cross-site-cookies', 'shields-debounce', 'shields-strip']) await expect(page.getByTestId(id)).toBeVisible();
    await expect(page.getByTestId('shields-user-rules')).toBeHidden();
    await expect(page.getByTestId('shields-group-ads')).toContainText(/\d of \d on/);
    await page.getByTestId('shields-advanced').click();
    for (const id of ['shields-webrtc', 'shields-update-6', 'shields-custom-url', 'shields-user-rules']) await expect(page.getByTestId(id)).toBeVisible();
  });
});

test.describe('Customize', () => {
  test('the quick panel changes the look and layout live, leaves the window usable, and Reset goes back to Calm Air', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openApp(page);
    await newTab(page, 'a.com');
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('Customize Kite');
    await page.getByTestId('cb-input').press('Enter');
    const panel = page.getByTestId('customize');
    await expect(panel).toBeVisible();
    // The short editor: one row of colors and three backgrounds, no "Custom…".
    await expect(panel.locator('[data-testid^="swatch-"]')).toHaveCount(9);
    await expect(panel.getByTestId('theme-custom-toggle')).toHaveCount(0);
    await panel.getByTestId('swatch-muted-9').click();
    expect(await cssVar(page, '--tint-1')).toBe('#2d4468');
    await panel.getByTestId('backdrop-gradient').click();
    await panel.getByTestId('preset-ember').click();
    expect(await cssVar(page, '--tint-2')).toBe('#ffb38a');
    await page.getByTestId('cz-mode-light').click();
    await expect(page.getByTestId('app')).toHaveAttribute('data-theme', 'light');
    await page.getByTestId('cz-side-right').click();
    await expect(page.getByTestId('app')).toHaveAttribute('data-side', 'right');
    await page.getByTestId('cz-corners-round').click();
    expect(await cssVar(page, '--radius')).toBe('20px');
    await page.getByTestId('cz-margin-edge').click();
    expect(await cssVar(page, '--gap')).toBe('0px');
    await page.getByTestId('cz-density-compact').click();
    await expect(page.getByTestId('app')).toHaveAttribute('data-density', 'compact');
    // Nothing is dimmed: the sidebar behind it still takes clicks, and the panel stays.
    await page.locator('.row[data-active]').click();
    await expect(panel).toBeVisible();
    await page.getByTestId('customize-reset').click();
    await expect(page.getByTestId('app')).toHaveAttribute('data-side', 'left');
    expect(await cssVar(page, '--radius')).toBe('12px');
    expect(await cssVar(page, '--tint-2')).toBe('#c2187a');
    expect((await savedState(page)).spaces[0].theme.mode).toBe('system');
    await page.getByTestId('customize-all').click();
    await expect(page.getByTestId('settings-appearance')).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('sidebar: no empty placeholders', () => {
  test('with no Favorites or pinned tabs, nothing empty sits between the address bar and the tabs', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    const pill = (await page.getByTestId('url-pill').boundingBox())!;
    const header = (await page.getByTestId('space-header').boundingBox())!;
    expect(header.y - (pill.y + pill.height)).toBeLessThanOrEqual(16);
    await expect(page.getByText('Drop here to add to Favorites')).toBeHidden();
    await expect(page.getByText('Drop here to pin')).toBeHidden();
  });
});

test.describe('settings is a page, not a dialog', () => {
  test('it fills the page area, the sidebar stays usable, and picking a tab goes back to it', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await newTab(page, 'b.com');
    await page.keyboard.press(`${MOD}+Comma`);
    await settled(page, 'settings');
    const card = (await page.getByTestId('page-card').boundingBox())!;
    const settings = (await page.getByTestId('settings').boundingBox())!;
    expect([settings.x, settings.y, settings.width, settings.height]).toEqual([card.x, card.y, card.width, card.height]);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // The tab you were on: clicking it leaves Settings.
    await todayRows(page).first().click();
    await expect(page.getByTestId('settings')).toHaveCount(0);
    // Another tab works too, and so does a new one.
    await page.keyboard.press(`${MOD}+Comma`);
    await todayRows(page).nth(1).click();
    await expect(page.getByTestId('settings')).toHaveCount(0);
    await page.keyboard.press(`${MOD}+Comma`);
    await newTab(page, 'c.com');
    await expect(page.getByTestId('settings')).toHaveCount(0);
  });
});

test.describe('design review fixes', () => {
  test('an empty window has one place to search; the sidebar address bar comes back with a tab', async ({ page }) => {
    await openApp(page);
    await expect(page.getByTestId('start-input')).toHaveAttribute('placeholder', 'Search or enter address');
    await expect(page.getByTestId('url-pill')).toHaveCount(0);
    await newTab(page, 'a.com');
    await expect(page.getByTestId('url-pill')).toHaveText('a.com');
  });

  test('the Settings button stays lit while Settings is open', async ({ page }) => {
    await openApp(page);
    const bg = () => page.getByTestId('btn-settings').evaluate((el) => getComputedStyle(el).backgroundColor);
    const before = await bg();
    await page.keyboard.press(`${MOD}+Comma`);
    await expect.poll(bg).not.toBe(before);
  });

  test('tab close buttons are at least 24px (WCAG 2.2 target size)', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    const b = (await page.locator('.row[data-active] .row-btn').first().boundingBox())!;
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(24);
  });
});
