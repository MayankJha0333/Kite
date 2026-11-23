import type { Page } from '@playwright/test';
import { test, expect, openApp, newTab } from './fixtures';

// Kite's floating video controls (laid out like Arc's) — in their own see-through window.
const state = (page: Page, s: Partial<{ mode: 'full' | 'mini'; t: number; d: number; paused: boolean; muted: boolean; title: string; host: string; thumb: string; rounded: boolean }>) =>
  page.evaluate((v) => window.__kiteTest!.pipFrameState({ mode: 'full', t: 252, d: 660, paused: false, title: 'A video', host: 'youtube.com', ...v }), s);
const hooks = (page: Page) => page.evaluate(() => ({ actions: window.__kiteTest!.pipFrameActions, media: window.__kiteTest!.pipFrameMedia, drags: window.__kiteTest!.pipFrameDrags }));

test.describe('floating video controls (Arc layout)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 470, height: 260 }); // the size of a floating video
    await page.goto('/?platform=darwin&mode=pip');
    await expect(page.getByTestId('pip-frame')).toBeAttached();
    await state(page, {});
  });

  test('controls appear when you move the mouse over the video, and fade away', async ({ page }) => {
    const close = page.locator('.pipd-corner'); // the buttons' group fades as one
    await expect(page.getByTestId('pip-frame')).not.toHaveAttribute('data-shown', /.*/, { timeout: 5000 });
    await expect(close).toHaveCSS('opacity', '0');
    await page.mouse.move(200, 120);
    await page.mouse.move(210, 125);
    await expect(page.getByTestId('pip-frame')).toHaveAttribute('data-shown');
    await expect(close).toHaveCSS('opacity', '1');
    for (const id of ['pip-frame-minimize', 'pip-frame-back', 'pip-play', 'pip-back10', 'pip-fwd10', 'pip-seek']) await expect(page.getByTestId(id)).toBeVisible();
    await expect(page.getByTestId('pip-frame')).not.toHaveAttribute('data-shown', /.*/, { timeout: 5000 });
  });

  test('stay visible while the video is paused', async ({ page }) => {
    await state(page, { paused: true });
    await expect(page.getByTestId('pip-frame')).toHaveAttribute('data-shown');
    await expect(page.getByTestId('pip-play')).toHaveAttribute('aria-label', 'Play');
  });

  test('Close and Minimize sit top-left as round buttons; Back to Tab top-right', async ({ page }) => {
    await page.mouse.move(100, 100);
    const close = (await page.getByTestId('pip-frame-close').boundingBox())!;
    const min = (await page.getByTestId('pip-frame-minimize').boundingBox())!;
    const back = (await page.getByTestId('pip-frame-back').boundingBox())!;
    expect(close.x).toBeLessThan(20);
    expect(close.y).toBeLessThan(20);
    expect(min.x).toBeGreaterThan(close.x);
    expect(Math.round(close.width)).toBe(24);
    expect(Math.round(close.height)).toBe(24);
    expect(back.x + back.width).toBeGreaterThan(440);
    expect(Math.abs(back.y - close.y)).toBeLessThan(2); // one top bar
    await expect(page.getByTestId('pip-frame-back')).toHaveText('Back to Tab');
    // Arc's dark chip with a light hairline, not a white button.
    await expect(page.getByTestId('pip-frame-close')).toHaveCSS('background-color', 'rgba(33, 33, 35, 0.8)');
  });

  test('play/pause, 10-second skips, and the buttons', async ({ page }) => {
    await page.mouse.move(100, 100);
    await page.getByTestId('pip-play').click();
    await expect(page.getByTestId('pip-play')).toHaveAttribute('aria-label', 'Play');
    await page.getByTestId('pip-back10').click();
    await expect(page.getByTestId('pip-time')).toHaveText('4:02');
    await page.getByTestId('pip-fwd10').click();
    await page.getByTestId('pip-frame-back').click();
    await page.getByTestId('pip-frame-minimize').click();
    await page.getByTestId('pip-frame-close').click();
    const h = await hooks(page);
    expect(h.media).toEqual([{ cmd: 'toggle' }, { cmd: 'skip', by: -10 }, { cmd: 'skip', by: 10 }]);
    expect(h.actions).toEqual(['back', 'minimize', 'close']);
  });

  test('drag the slider back to an earlier moment', async ({ page }) => {
    await page.mouse.move(100, 100);
    const seek = page.getByTestId('pip-seek');
    await expect(seek).toHaveAttribute('max', '660');
    await expect(seek).toHaveValue('252');
    const box = (await seek.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 6 });
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    const seeks = (await hooks(page)).media.filter((m: any) => m.cmd === 'seek') as { t: number }[];
    expect(seeks.length).toBeGreaterThan(0);
    const final = seeks.at(-1)!.t;
    expect(final).toBeGreaterThan(30);
    expect(final).toBeLessThan(110); // about a tenth of the way in
    await expect(page.getByTestId('pip-time')).toHaveText(new RegExp(`^${Math.floor(final / 60)}:`));
  });

  test('the speaker button mutes and unmutes the video’s tab', async ({ page }) => {
    await page.mouse.move(100, 100);
    const mute = page.getByTestId('pip-mute');
    await expect(mute).toHaveAttribute('aria-label', 'Mute');
    await mute.click();
    await expect(mute).toHaveAttribute('aria-label', 'Unmute');
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
    expect((await hooks(page)).media).toEqual([{ cmd: 'mute' }]);
    // The real state wins when it arrives.
    await state(page, { muted: false });
    await expect(mute).toHaveAttribute('aria-label', 'Mute');
  });

  test('while you drag the slider, the time you would land on rides above the knob', async ({ page }) => {
    await page.mouse.move(100, 100);
    await expect(page.getByTestId('pip-scrub-label')).toHaveCount(0);
    const box = (await page.getByTestId('pip-seek').boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2, { steps: 5 });
    const label = page.getByTestId('pip-scrub-label');
    await expect(label).toBeVisible();
    await expect(label).toHaveText(/^\d+:\d\d$/);
    const l = (await label.boundingBox())!;
    expect(l.y + l.height).toBeLessThanOrEqual(box.y + 1); // above the slider
    expect(Math.abs(l.x + l.width / 2 - (box.x + box.width * 0.25))).toBeLessThan(24); // over the knob
    await page.mouse.up();
    await expect(label).toHaveCount(0);
  });

  test('skip arrows turn when pressed', async ({ page }) => {
    await page.mouse.move(100, 100);
    await page.getByTestId('pip-fwd10').click();
    await expect(page.locator('[data-testid="pip-fwd10"] .pipd-skip-arrow')).toHaveAttribute('data-spin', 'fwd');
    await page.getByTestId('pip-back10').click();
    await expect(page.locator('[data-testid="pip-back10"] .pipd-skip-arrow')).toHaveAttribute('data-spin', 'back');
  });

  test('a small video keeps just the essentials', async ({ page }) => {
    await page.setViewportSize({ width: 300, height: 170 });
    await page.mouse.move(100, 80);
    await expect(page.getByTestId('pip-frame')).toHaveAttribute('data-size', 'compact');
    await expect(page.getByTestId('pip-back10')).toBeHidden();
    await expect(page.getByTestId('pip-fwd10')).toBeHidden();
    for (const id of ['pip-play', 'pip-seek', 'pip-mute', 'pip-frame-back', 'pip-frame-close']) await expect(page.getByTestId(id)).toBeVisible();
    const back = (await page.getByTestId('pip-frame-back').boundingBox())!;
    expect(Math.round(back.width)).toBe(24); // just the arrow
    await expect(page.getByTestId('pip-frame-back')).toHaveAccessibleName('Back to Tab');
    // Nothing overlaps: top bar, play and the bottom bar each keep their own space.
    const play = (await page.getByTestId('pip-play').boundingBox())!;
    const bar = (await page.locator('.pipd-bottom').boundingBox())!;
    expect(back.y + back.height).toBeLessThan(play.y);
    expect(play.y + play.height).toBeLessThan(bar.y);
    await page.setViewportSize({ width: 470, height: 260 });
    await expect(page.getByTestId('pip-frame')).toHaveAttribute('data-size', 'regular');
  });

  test('a live stream has no slider or skips, just "Live"', async ({ page }) => {
    await state(page, { d: 0 });
    await page.mouse.move(100, 100);
    await expect(page.getByTestId('pip-seek')).toHaveCount(0);
    await expect(page.getByTestId('pip-back10')).toHaveCount(0);
    await expect(page.getByText('Live')).toBeVisible();
  });

  test('dragging the video (not a button) moves the floating window', async ({ page }) => {
    await page.mouse.move(230, 200);
    await page.mouse.down();
    await page.mouse.move(260, 210);
    await page.mouse.up();
    await page.mouse.move(20, 15);
    await page.getByTestId('pip-frame-close').click();
    expect((await hooks(page)).drags).toEqual(['start', 'end']); // the button click didn't start a drag
  });

  test('mini player: title, site and time; play/pause, Show video, Close and its own slider', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 90 });
    await state(page, { mode: 'mini', title: 'Lo-fi beats to study to' });
    await expect(page.getByTestId('pip-frame')).toHaveAttribute('data-mode', 'mini');
    await expect(page.getByText('Lo-fi beats to study to')).toBeVisible();
    await expect(page.getByText('· youtube.com')).toBeVisible();
    await expect(page.getByTestId('pip-time')).toHaveText('4:12');
    await page.getByTestId('pip-play').click();
    await page.getByTestId('pip-frame-show').click();
    await page.getByTestId('pip-frame-close').click();
    await page.getByTestId('pip-seek').fill('30');
    const h = await hooks(page);
    expect(h.actions).toEqual(['show', 'close']);
    expect(h.media).toContainEqual({ cmd: 'toggle' });
    expect(h.media).toContainEqual({ cmd: 'seek', t: 30 });
  });

  test('drag an edge or corner to resize the video', async ({ page }) => {
    const box = (await page.getByTestId('pip-edge-se').boundingBox())!;
    await page.mouse.move(box.x + 4, box.y + 4);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + 30);
    await page.mouse.up();
    const e = (await page.getByTestId('pip-edge-e').boundingBox())!;
    await page.mouse.move(e.x + 2, e.y + 20);
    await page.mouse.down();
    await page.mouse.up();
    expect((await hooks(page)).drags).toEqual(['start:se', 'end', 'start:e', 'end']);
  });

  test('mini player shows a snapshot of the video when there is one', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 90 });
    await state(page, { mode: 'mini' });
    await expect(page.locator('.pipm-thumb img')).toHaveCount(0);
    const thumb = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=';
    await state(page, { mode: 'mini', thumb });
    await expect(page.locator('.pipm-thumb img')).toHaveAttribute('src', thumb);
  });

  test('the time and slider sit in a small rounded bar', async ({ page }) => {
    await page.mouse.move(100, 100);
    await expect(page.locator('.pipd-shade')).toHaveCount(0);
    await expect(page.locator('.pipd-bottom')).toHaveCSS('border-radius', '10px');
    await expect(page.locator('.pipd-bottom')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });

  test('no shade on hover, rounded or not — just the controls', async ({ page }) => {
    await state(page, { rounded: true });
    await page.mouse.move(100, 100);
    await expect(page.getByTestId('pip-frame')).toHaveAttribute('data-shown');
    await expect(page.locator('.pipd-shade')).toHaveCount(0);
    await expect(page.locator('.pipd-bottom')).toHaveCSS('border-radius', '10px');
  });

  test('a thin dark edge always follows the video’s outline (hides macOS’s light rim at the corners)', async ({ page }) => {
    await expect(page.locator('.pipd-ring')).toHaveCSS('border-radius', '0px');
    await expect(page.locator('.pipd-ring')).toHaveCSS('opacity', '1'); // even with the controls hidden
    await state(page, { rounded: true });
    await expect(page.locator('.pipd-ring')).toHaveCSS('border-radius', '10px');
    await expect(page.locator('.pipd-ring')).toHaveCSS('box-shadow', /inset/);
  });

  test('the page is see-through', async ({ page }) => {
    for (const sel of ['html', 'body', '#root']) await expect(page.locator(sel)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });
});

test('“Back to tab” shows that tab in the main window', async ({ page }) => {
  await openApp(page);
  await newTab(page, 'video.example');
  const row = page.locator('[data-title="video.example"]');
  await expect(row).toHaveCount(1);
  const id = (await row.getAttribute('data-testid'))!.replace('row-', '');
  await newTab(page, 'other.example');
  await expect(row).not.toHaveAttribute('data-active');
  await page.evaluate((tabId) => window.__kiteTest!.focusTab(tabId), id);
  await expect(row).toHaveAttribute('data-active');
});
