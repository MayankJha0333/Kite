import { test as base, expect, type Page } from '@playwright/test';

export const MOD = 'Meta'; // tests run the UI as if on macOS (?platform=darwin)

export async function openApp(page: Page, opts: { state?: unknown } = {}) {
  if (opts.state) {
    await page.addInitScript((s) => localStorage.setItem('kite-state', JSON.stringify(s)), opts.state);
  }
  await page.goto('/?platform=darwin');
  await expect(page.getByTestId('sidebar')).toBeVisible();
}

/** Open a new tab through the command bar and wait for it to appear. */
export async function newTab(page: Page, input: string) {
  await page.keyboard.press(`${MOD}+t`);
  await page.getByTestId('cb-input').fill(input);
  await page.getByTestId('cb-input').press('Enter');
  await expect(page.getByTestId('command-bar')).toHaveCount(0);
}

export function todayRows(page: Page) {
  return page.getByTestId('today-list').locator('[data-testid^="row-"]');
}

export function pinnedRows(page: Page) {
  return page.getByTestId('pinned-list').locator(':scope > [data-testid^="row-"], :scope > .folder > [data-testid^="row-"]');
}

export async function activeRowTitle(page: Page) {
  return page.locator('.row[data-active]').getAttribute('data-title');
}

/** Saved state as the app wrote it. */
export async function savedState(page: Page) {
  await page.waitForTimeout(450); // autosave debounce
  return page.evaluate(() => JSON.parse(localStorage.getItem('kite-state') || 'null'));
}

/** The simulated page frame for the visible tab. */
export function visibleFrame(page: Page) {
  return page.frameLocator('.surface-slot[data-visible] iframe').first();
}

/** Wait for sidebar rows to stop gliding (flip.ts) before measuring where they are. */
export async function settledRows(page: Page) {
  await page.evaluate(() => Promise.all([...document.querySelectorAll('.sb-scroll [data-flip]')].flatMap((el) => el.getAnimations().map((a) => a.finished.catch(() => undefined)))));
}

/** Wait for an element's entry/exit animations (and its children's) to finish. */
export async function settled(page: Page, testId: string) {
  await page.getByTestId(testId).evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined))));
}

export const test = base;
export { expect };

/**
 * Layout check for one surface (a menu, a sheet, a page): finds text that collides with
 * other text, text that spills out of its box, and text outside the window. Returns a
 * list of problems in plain words; an empty list means the surface lays out cleanly.
 *
 * Only elements with text of their own are compared (labels, hints, values), and an
 * element is never compared with its own ancestors, so nesting is fine while two
 * labels drawn over one another, or a hint wrapped into the row below, are caught.
 */
export async function layoutProblems(page: Page, scope: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return [`${sel}: not found`];
    const problems: string[] = [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const visible = (el: Element) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const ownText = (el: Element) =>
      [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent?.trim() ?? '')
        .join(' ')
        .trim();
    // The box an element can be scrolled into: the nearest ancestor that scrolls, else the window.
    const scrollBox = (el: Element): { x: boolean; y: boolean } => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p);
        const y = /auto|scroll/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 1;
        const x = /auto|scroll/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1;
        if (x || y) return { x, y };
      }
      return { x: false, y: false };
    };
    // The part of an element that is actually drawn: its box cut by every ancestor that clips.
    const drawn = (el: Element): DOMRect | null => {
      let r = el.getBoundingClientRect();
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.overflow === 'visible' && cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
        const c = p.getBoundingClientRect();
        const left = Math.max(r.left, c.left);
        const top = Math.max(r.top, c.top);
        const right = Math.min(r.right, c.right);
        const bottom = Math.min(r.bottom, c.bottom);
        if (right - left < 3 || bottom - top < 3) return null;
        r = new DOMRect(left, top, right - left, bottom - top);
      }
      return r;
    };
    type Leaf = { el: Element; text: string; r: DOMRect };
    const leaves: Leaf[] = [];
    for (const el of root.querySelectorAll('*')) {
      if (el.closest('.toasts, [aria-hidden="true"]') || !visible(el)) continue;
      const text = ownText(el);
      if (!text) continue;
      const r = drawn(el);
      if (r) leaves.push({ el, text: text.slice(0, 40), r });
    }
    for (const { el, text, r } of leaves) {
      const s = scrollBox(el);
      const offX = !s.x && (r.left < -1 || r.right > vw + 1);
      const offY = !s.y && (r.top < -1 || r.bottom > vh + 1);
      if (offX || offY) problems.push(`"${text}" is outside the window (${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)} in ${vw}×${vh})`);
      const cs = getComputedStyle(el);
      const h = el as HTMLElement;
      if (cs.overflowX === 'visible' && h.scrollWidth > h.clientWidth + 1 && cs.whiteSpace.startsWith('nowrap')) problems.push(`"${text}" spills ${h.scrollWidth - h.clientWidth}px past its box`);
    }
    const area = (a: DOMRect, b: DOMRect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    for (let i = 0; i < leaves.length; i++) {
      for (let j = i + 1; j < leaves.length; j++) {
        const a = leaves[i];
        const b = leaves[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const ov = area(a.r, b.r);
        // More than a sliver (rounded corners and 1px borders touch): real text on text.
        if (ov > 12 && Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > 3 && Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > 3) problems.push(`"${a.text}" overlaps "${b.text}" by ${Math.round(ov)}px²`);
      }
    }
    return problems;
  }, scope);
}

/** Assert that a surface lays out cleanly (see layoutProblems). */
export async function expectTidy(page: Page, scope: string, what = scope) {
  expect(await layoutProblems(page, scope), `layout of ${what}`).toEqual([]);
}
