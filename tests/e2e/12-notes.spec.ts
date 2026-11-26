import { test, expect, openApp, newTab, todayRows, pinnedRows, savedState, MOD } from './fixtures';

test.describe('notes', () => {
  test('⌘⇧O creates a note in the sidebar; title and body are saved', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+Shift+o`);
    await expect(page.getByTestId('note-title')).toBeFocused();
    await expect(todayRows(page).first()).toHaveAttribute('data-kind', 'note');
    await page.getByTestId('note-title').fill('Trip plan');
    await page.getByTestId('note-title').press('Enter');
    await page.keyboard.type('Pack the kite and snacks');
    await expect(todayRows(page).first()).toHaveAttribute('data-title', 'Trip plan');
    await expect(page.getByTestId('note-words')).toHaveText('5 words');
    const s = await savedState(page);
    const note = Object.values(s.items).find((x: any) => x.kind === 'note') as any;
    expect(note.title).toBe('Trip plan');
    expect(note.html).toContain('Pack the kite and snacks');
  });

  test('formatting: toolbar buttons and Markdown shortcuts', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+Shift+o`);
    await page.getByTestId('note-body').click();
    await page.keyboard.type('# Big idea');
    await page.keyboard.press('Enter');
    await page.getByTestId('tool-bold').click();
    await page.keyboard.type('strong words');
    await page.getByTestId('tool-bold').click();
    await page.keyboard.press('Enter');
    await page.keyboard.type('[] buy string');
    await expect(page.getByTestId('note-body').locator('h1')).toHaveText('Big idea');
    await expect(page.getByTestId('note-body').locator('strong')).toHaveText('strong words');
    await expect(page.getByTestId('note-body').locator('ul[data-type="taskList"] li')).toHaveCount(1);
    await page.getByTestId('note-body').locator('ul[data-type="taskList"] input').check();
    await expect(page.getByTestId('note-body').locator('li[data-checked="true"]')).toHaveCount(1);
  });

  test('a note reads like a page of prose: a measure, a larger body, one quiet row of tools', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+Shift+o`);
    await page.getByTestId('note-body').click();
    await page.keyboard.type('The wind is steady from the west on Saturday, so the long field behind the school is the place to fly the big delta. ');
    await page.keyboard.type('Bring the spare line as well; the small one will not hold above ten knots, and the forecast says twelve by noon.');
    const body = page.getByTestId('note-body');
    await expect(body).toHaveCSS('font-size', '15px');
    await expect(body).toHaveCSS('line-height', '24px');
    // About 68 characters a line: never the full width of the page.
    const chars = await body.locator('p').evaluate((p) => {
      const range = document.createRange();
      range.selectNodeContents(p);
      const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
      return p.textContent!.length / lines;
    });
    expect(chars).toBeGreaterThan(50);
    expect(chars).toBeLessThan(80);
    const tools = page.locator('.note-toolbar button');
    expect(await tools.count()).toBeGreaterThan(12);
    for (const b of await tools.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()))) expect([b.width, b.height]).toEqual([24, 24]);
    // A tool that is on says so to assistive tech too.
    await page.getByTestId('tool-bold').click();
    await expect(page.getByTestId('tool-bold')).toHaveAttribute('aria-pressed', 'true');
    // The tools also work from the keyboard.
    await page.getByTestId('tool-italic').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('tool-italic')).toHaveAttribute('aria-pressed', 'true');
  });

  test('add a link with the inline link box', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+Shift+o`);
    await page.getByTestId('note-body').click();
    await page.keyboard.type('docs');
    await page.keyboard.press('Shift+Home');
    await page.getByTestId('tool-link').click();
    await page.getByTestId('note-link-input').fill('kite.example/docs');
    await page.getByTestId('note-link-input').press('Enter');
    await expect(page.getByTestId('note-body').locator('a')).toHaveAttribute('href', 'https://kite.example/docs');
  });

  test('notes keep their content when switching away and back, and after restart', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+Shift+o`);
    await page.getByTestId('note-title').fill('Keep');
    await page.getByTestId('note-body').click();
    await page.keyboard.type('remember this');
    await newTab(page, 'a.com');
    await todayRows(page).nth(1).click();
    await expect(page.getByTestId('note-body')).toContainText('remember this');
    await savedState(page);
    await page.reload();
    await todayRows(page).filter({ has: page.locator('[data-kind]') });
    await page.locator('[data-kind="note"]').click();
    await expect(page.getByTestId('note-body')).toContainText('remember this');
    await expect(page.getByTestId('note-title')).toHaveValue('Keep');
  });

  test('notes can be pinned, closed (Undo) and archived/restored', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+Shift+o`);
    await page.getByTestId('note-title').fill('Pin me');
    await page.getByTestId('note-body').click();
    await page.keyboard.type('body text');
    await page.keyboard.press(`${MOD}+d`);
    await expect(pinnedRows(page)).toHaveCount(1);
    await pinnedRows(page).first().click({ button: 'right' });
    await page.getByTestId('menu-unpin').click();
    await page.keyboard.press(`${MOD}+w`);
    await expect(page.locator('[data-kind="note"]')).toHaveCount(0);
    await page.getByTestId('toast').getByText('Undo').click();
    await expect(page.locator('[data-kind="note"]')).toHaveCount(1);
    await page.getByTestId('btn-clear-today').click();
    await page.keyboard.press(`${MOD}+y`);
    await page.getByTestId('archive-row').getByTestId('archive-restore').click();
    await expect(page.getByTestId('note-body')).toContainText('body text');
  });

  test('export as Markdown', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+Shift+o`);
    await page.getByTestId('note-title').fill('Shopping');
    await page.getByTestId('note-body').click();
    await page.keyboard.type('- milk');
    await page.keyboard.press('Enter');
    await page.keyboard.type('eggs');
    await page.getByTestId('note-export').click();
    const exported = await page.evaluate(() => window.__kiteTest!.exported);
    expect(exported[0].name).toBe('Shopping.md');
    expect(exported[0].text).toBe('# Shopping\n\n- milk\n- eggs\n');
  });

  test('command bar finds notes by title', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press(`${MOD}+Shift+o`);
    await page.getByTestId('note-title').fill('Recipe ideas');
    await newTab(page, 'a.com');
    await page.keyboard.press(`${MOD}+t`);
    await page.getByTestId('cb-input').fill('recipe');
    await expect(page.locator('.cb-row').first()).toContainText('Recipe ideas');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('note-title')).toHaveValue('Recipe ideas');
  });
});
