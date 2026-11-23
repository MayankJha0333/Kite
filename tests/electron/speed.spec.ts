// Faster link clicks in the real app: resting the pointer on a link to another site opens
// that site's connection before the click (nothing is fetched until you click).

import { test, expect, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { launch, MOD } from './harness';

let pages: Server;
let other: Server;
let pagesPort = 0;
let otherPort = 0;
let connections = 0;
let requests = 0;

test.beforeAll(async () => {
  other = createServer((_req, res) => {
    requests++;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<title>Other</title>other');
  });
  other.on('connection', () => connections++);
  await new Promise<void>((r) => other.listen(0, '127.0.0.1', () => r()));
  otherPort = (other.address() as { port: number }).port;
  pages = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<title>Links</title><a id="go" href="http://localhost:${otherPort}/page" style="display:block;width:300px;height:40px">Other site</a>`);
  });
  await new Promise<void>((r) => pages.listen(0, '127.0.0.1', () => r()));
  pagesPort = (pages.address() as { port: number }).port;
});
test.afterAll(() => {
  pages.close();
  other.close();
});

const inPage = (win: Page, js: string) =>
  win.evaluate((code) => {
    const wv = [...document.querySelectorAll('webview')].find((w) => (w as HTMLElement).dataset.visible === 'true') as unknown as { executeJavaScript(c: string): Promise<unknown> };
    return wv.executeJavaScript(code);
  }, js);

test('hovering a link to another site opens its connection early, without fetching anything', async () => {
  const { app, win } = await launch(undefined, [], { KITE_TEST_QUIET: '1' });
  await win.keyboard.press(`${MOD}+t`);
  await win.getByTestId('cb-input').fill(`http://127.0.0.1:${pagesPort}/`);
  await win.getByTestId('cb-input').press('Enter');
  await expect(win.locator('[data-testid^="row-"][data-title="Links"]')).toHaveCount(1, { timeout: 15000 });
  connections = 0;
  requests = 0;
  await inPage(win, `document.getElementById('go').dispatchEvent(new PointerEvent('pointerover', { bubbles: true }))`);
  await expect.poll(() => connections, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
  expect(requests).toBe(0);
  // Clicking now uses the warm connection.
  await inPage(win, `document.getElementById('go').click()`);
  await expect(win.locator('[data-testid^="row-"][data-title="Other"]')).toHaveCount(1, { timeout: 15000 });
  expect(requests).toBeGreaterThanOrEqual(1);
  await app.close();
});
