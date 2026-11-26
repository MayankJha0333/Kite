import { test, expect, openApp, newTab, todayRows, savedState, MOD } from './fixtures';

const asleep = (page: import('@playwright/test').Page) => todayRows(page).and(page.locator('[data-asleep]'));

test.describe('memory: sleeping tabs', () => {
  test('only the most recent tabs stay awake; the rest sleep and wake when opened', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+Comma`);
    await page.getByTestId('settings-general').click();
    await page.getByTestId('set-awake').fill('3');
    await expect.poll(async () => (await savedState(page)).settings.awakeTabs).toBe(3);
    await page.keyboard.press('Escape');
    for (const site of ['a.com', 'b.com', 'c.com', 'd.com', 'e.com']) await newTab(page, site);
    await expect(todayRows(page)).toHaveCount(5);
    await expect(asleep(page)).toHaveCount(2);
    // Pages of sleeping tabs are really gone.
    await expect(page.locator('.surface-slot')).toHaveCount(3);
    // Opening a sleeping tab wakes it.
    const sleeper = asleep(page).first();
    const id = (await sleeper.getAttribute('data-testid'))!;
    await sleeper.click();
    await expect(page.getByTestId(id)).not.toHaveAttribute('data-asleep', 'true');
    await expect(page.locator('.surface-slot')).toHaveCount(3);
  });

  test('put one tab to sleep from its menu, or all the others at once', async ({ page }) => {
    await openApp(page);
    for (const site of ['a.com', 'b.com', 'c.com']) await newTab(page, site);
    await expect(asleep(page)).toHaveCount(0);
    const other = todayRows(page).and(page.locator(':not([data-active])')).first();
    await other.click({ button: 'right' });
    await page.getByTestId('menu-more').click();
    await page.getByTestId('menu-sleep').click();
    await expect(asleep(page)).toHaveCount(1);
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('Put Other Tabs to Sleep');
    await page.getByTestId('cb-input').press('Enter');
    await expect(asleep(page)).toHaveCount(2);
    await expect(page.locator('.row[data-active]')).not.toHaveAttribute('data-asleep', 'true');
  });
});

test.describe('small wins', () => {
  test('copy a tab as a Markdown link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openApp(page);
    await newTab(page, 'example.com');
    await page.locator('.row[data-active]').click({ button: 'right' });
    await page.getByTestId('menu-more').click();
    await page.getByTestId('menu-copy-md').click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/^\[.+\]\(https:\/\/example\.com\/?\)$/);
  });

  test('mute all and unmute all are in the command bar', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('mute all');
    await expect(page.getByTestId('command-bar')).toContainText('Mute All Tabs');
    await page.getByTestId('cb-input').press('Enter');
    await expect(page.getByText('All tabs muted')).toBeVisible();
  });
});

/** Change the app's passing state (what is loading, what failed) the way a page's events would. Works against the dev server, which serves the app's own modules. */
async function setUi(page: import('@playwright/test').Page, patch: Record<string, Record<string, unknown>>) {
  await page.evaluate(async (patch) => {
    const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /\/store\.ts(\?|$)/.test(n))!;
    const store = await import(/* @vite-ignore */ url);
    store.setUi((u: Record<string, Record<string, unknown>>) => Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, { ...u[k], ...v }])));
  }, patch);
}
const shownId = async (page: import('@playwright/test').Page) => (await page.locator('.surface-slot[data-visible]').first().getAttribute('data-testid'))!.replace('slot-', '');

test.describe('the string: a page in flight', () => {
  test('runs along the top of the page while it loads, finishes when it has, and never shows for an instant load', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'slow.example.com');
    const id = await shownId(page);
    const thread = page.getByTestId('page-thread');
    await expect(thread).toHaveCount(0); // the simulated page loaded at once: nothing flashed
    await setUi(page, { loading: { [id]: true } });
    await expect(thread.locator('.thread[data-busy]')).toHaveCount(1);
    const card = (await page.getByTestId('page-card').boundingBox())!;
    const box = (await thread.boundingBox())!;
    expect([box.x, box.y, box.width, box.height]).toEqual([card.x, card.y, card.width, 2]);
    // The running length is the accent, the one color that means "in flight".
    const [line, accent] = await thread.locator('.thread').evaluate((el) => {
      const probe = document.createElement('i');
      probe.style.color = 'var(--accent)';
      el.append(probe);
      const out = [getComputedStyle(el, '::after').backgroundColor, getComputedStyle(probe).color];
      probe.remove();
      return out;
    });
    expect(line).toBe(accent);
    await setUi(page, { loading: { [id]: false } });
    await expect(thread).toHaveAttribute('data-done', 'true');
    await expect(thread).toHaveCount(0); // it pulled taut, let go, and left nothing behind

    // A load that is over within a blink shows no string at all.
    await setUi(page, { loading: { [id]: true } });
    await page.waitForTimeout(60);
    await setUi(page, { loading: { [id]: false } });
    await page.waitForTimeout(250);
    await expect(thread).toHaveCount(0);
  });

  test('is never left behind: a failed load ends it, and a tab in the background shows none', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'first.example.com');
    const first = await shownId(page);
    await setUi(page, { loading: { [first]: true } });
    await expect(page.getByTestId('page-thread')).toHaveCount(1);
    await setUi(page, { loading: { [first]: false }, loadError: { [first]: { code: -105, desc: 'ERR_NAME_NOT_RESOLVED', url: 'https://first.example.com/' } } });
    await expect(page.getByTestId('load-error')).toBeVisible();
    await expect(page.getByTestId('page-thread')).toHaveCount(0);
    // Still loading when you go to another tab: the other tab's page has no string on it.
    await setUi(page, { loading: { [first]: true } });
    await expect(page.getByTestId('page-thread')).toHaveCount(1);
    await newTab(page, 'second.example.com');
    await expect(page.getByTestId('page-thread')).toHaveCount(0);
  });

  test('each pane of a Split View has its own; Reduce Motion stills it', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'left.example.com');
    await page.keyboard.press(`${MOD}+Shift+Equal`);
    await page.getByTestId('cb-input').fill('right.example.com');
    await page.getByTestId('cb-input').press('Enter');
    await expect(page.locator('.surface-slot[data-visible]')).toHaveCount(2);
    const ids = await page.locator('.surface-slot[data-visible]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('slot-', '')));
    await setUi(page, { loading: { [ids[0]]: true } });
    await expect(page.getByTestId(`slot-${ids[0]}`).getByTestId('page-thread')).toHaveCount(1);
    await expect(page.getByTestId(`slot-${ids[1]}`).getByTestId('page-thread')).toHaveCount(0);
    const pane = (await page.getByTestId(`slot-${ids[0]}`).boundingBox())!;
    expect((await page.getByTestId('page-thread').boundingBox())!.width).toBe(pane.width);
    // Reduce Motion: a still line, not a running one.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const run = await page.getByTestId('page-thread').locator('.thread').evaluate((el) => getComputedStyle(el, '::after').animationName);
    expect(run).toBe('none');
  });
});

test.describe('a page that did not load', () => {
  const fail = async (page: import('@playwright/test').Page, code: number, desc: string, url = 'https://example.com/some/page') => {
    await setUi(page, { loadError: { [await shownId(page)]: { code, desc, url } } });
    return page.getByTestId('load-error');
  };

  test('names the problem and the site, gives the way out, and keeps the code small', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'https://example.com/some/page');
    let err = await fail(page, -105, 'ERR_NAME_NOT_RESOLVED');
    await expect(err.locator('h2')).toHaveText('Can’t find example.com');
    await expect(err.locator('.load-error-code')).toHaveText('ERR_NAME_NOT_RESOLVED · -105');
    await expect(err.getByTestId('load-error-search')).toHaveText('Search for example.com');
    await expect(err.getByTestId('load-error-retry')).toHaveText('Try again');
    for (const [code, desc, title] of [
      [-106, 'ERR_INTERNET_DISCONNECTED', 'You’re offline'],
      [-118, 'ERR_CONNECTION_TIMED_OUT', 'example.com took too long to answer'],
      [-102, 'ERR_CONNECTION_REFUSED', 'Can’t reach example.com'],
      [-20, 'ERR_BLOCKED_BY_CLIENT', 'Shields blocked example.com'],
      [-1000, 'crashed', 'This page stopped working'],
    ] as const) {
      err = await fail(page, code, desc);
      await expect(err.locator('h2')).toHaveText(title);
      // One action, or two where a second one helps (HTTPS-only is on: a site that didn't answer may only speak http).
      await expect(err.getByRole('button')).toHaveCount(code === -106 || code === -1000 ? 1 : 2);
    }
    await expect(err.getByTestId('load-error-retry')).toHaveText('Reload page');
    // One layout for all of them: on the contour field, with the sentence at the title size.
    await expect(err.locator('.contour-field')).toHaveCount(1);
    await expect(err.locator('h2')).toHaveCSS('font-size', '20px');
    await expect(err.locator('h2')).toHaveCSS('font-weight', '600');
  });

  test('a bad certificate offers no way around it; HTTPS-only offers the plain page, said plainly', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'https://example.com/');
    let err = await fail(page, -202, 'ERR_CERT_AUTHORITY_INVALID');
    await expect(err.locator('h2')).toHaveText('The connection to example.com isn’t private');
    await expect(err).toContainText('no way to skip this check');
    // With nowhere to go back to, closing the tab is the way out; trying again stays, second.
    await expect(err.getByRole('button')).toHaveText(['Close tab', 'Try again']);
    await expect(err.getByTestId('load-error-close')).toHaveClass(/primary/);
    await expect(err.getByTestId('load-error-http')).toHaveCount(0);
    // HTTPS-only (on by default) asked for https and the site has none: the plain page is offered, with the warning.
    err = await fail(page, -107, 'ERR_SSL_PROTOCOL_ERROR');
    await expect(err.locator('h2')).toHaveText('example.com has no secure connection');
    await expect(err).toContainText('don’t type passwords or card numbers there');
    await expect(err.getByTestId('load-error-http')).toHaveText('Open without encryption');
    await expect(err.getByRole('button').last()).toHaveText('Try again'); // the primary action stays last
  });
});

test.describe('the page card', () => {
  const settings = async (page: import('@playwright/test').Page, patch: Record<string, unknown>) => {
    await savedState(page);
    await page.evaluate((patch) => {
      const raw = JSON.parse(localStorage.getItem('kite-state')!);
      Object.assign(raw.settings, patch);
      localStorage.setItem('kite-state', JSON.stringify(raw));
    }, patch);
    await page.reload();
    await expect(page.getByTestId('sidebar')).toBeVisible();
  };

  test('is a lifted sheet with the chosen corners; with no margin it is the window, flat and square', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    const card = page.getByTestId('page-card');
    await expect(card).toHaveCSS('border-radius', '12px');
    expect(await card.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');
    await expect(card).toHaveCSS('border-top-width', '0px'); // the elevation carries the edge; no border under it
    await settings(page, { gap: 14, radius: 20 });
    await expect(card).toHaveCSS('border-radius', '20px');
    const box = (await card.boundingBox())!;
    expect([box.y, 800 - box.y - box.height, 1280 - box.x - box.width]).toEqual([14, 14, 14]);
    await settings(page, { gap: 0, radius: 20 });
    await expect(card).toHaveCSS('border-radius', '0px');
    await expect(card).toHaveCSS('box-shadow', 'none');
  });

  test('the find bar stands clear of a panel docked in its corner', async ({ page }) => {
    await openApp(page);
    await newTab(page, 'a.com');
    await page.keyboard.press(`${MOD}+f`);
    const card = (await page.getByTestId('page-card').boundingBox())!;
    const at = async () => (await page.getByTestId('find-bar').boundingBox())!;
    expect(Math.round(card.x + card.width - (await at()).x - (await at()).width)).toBe(8);
    await page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /\/store\.ts(\?|$)/.test(n))!;
      (await import(/* @vite-ignore */ url)).setUi({ panel: 'downloads' });
    });
    await expect(page.locator('.sheet-scrim[data-dock]')).toHaveCount(1);
    const dock = (await page.locator('.sheet-scrim[data-dock] .sheet').boundingBox())!;
    const bar = await at();
    expect(Math.round(bar.x - card.x)).toBe(8);
    expect(bar.x + bar.width).toBeLessThan(dock.x);
  });
});
