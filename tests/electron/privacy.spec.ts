// Brave-style protections in the real app, against a local server that plays two sites
// (127.0.0.1 and localhost are different sites to the browser). Nothing touches the internet.

import { test, expect, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { launch, MOD } from './harness';

let server: Server;
let port = 0;
let lastEchoCookie: string | undefined;
const a = (p = '/') => `http://127.0.0.1:${port}${p}`;
const b = (p = '/') => `http://localhost:${port}${p}`;

const FINGERPRINT_PAGE = `<title>FP</title><canvas id="c" width="220" height="40"></canvas><script>
  const c = document.getElementById('c'); const x = c.getContext('2d');
  x.fillStyle = '#f60'; x.fillRect(10, 5, 100, 20); x.fillStyle = '#069'; x.font = '16px Arial'; x.fillText('Kite fingerprint 😃', 4, 28);
  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
  window.fp = { one: hash(c.toDataURL()), two: hash(c.toDataURL()), cores: navigator.hardwareConcurrency, native: HTMLCanvasElement.prototype.toDataURL.toString() };
</script>`;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    if (u.pathname === '/set') {
      res.writeHead(200, { 'Set-Cookie': 'tp=1; SameSite=None; Secure; Path=/', 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
      return res.end('set');
    }
    if (u.pathname === '/echo') {
      lastEchoCookie = req.headers.cookie;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<title>Echo</title>echo');
    }
    if (u.pathname === '/embed') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(`<title>Embed</title><iframe id="f" src="${b('/set')}"></iframe><script>document.getElementById('f').onload = () => { const g = document.createElement('iframe'); g.src = '${b('/echo')}'; g.onload = () => { document.title = 'Embed done'; }; document.body.appendChild(g); };</script>`);
    }
    if (u.pathname === '/fp') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(FINGERPRINT_PAGE);
    }
    if (u.pathname === '/landed') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<title>Landed</title>landed');
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  port = (server.address() as { port: number }).port;
});
test.afterAll(() => server.close());

async function open(win: Page, address: string) {
  await win.keyboard.press(`${MOD}+t`);
  await win.getByTestId('cb-input').fill(address);
  await win.getByTestId('cb-input').press('Enter');
}
const inPage = <T,>(win: Page, js: string) =>
  win.evaluate((code) => {
    const wv = [...document.querySelectorAll('webview')].find((w) => (w as HTMLElement).dataset.visible === 'true') as unknown as { executeJavaScript(c: string): Promise<unknown> };
    return wv.executeJavaScript(code);
  }, js) as Promise<T>;
const row = (win: Page, title: string) => win.locator(`[data-testid^="row-"][data-title="${title}"]`);

async function toggle(win: Page, testId: string) {
  await win.keyboard.press(`${MOD}+Comma`);
  await win.getByTestId('settings-privacy').click();
  await win.getByTestId(testId).click();
  await win.keyboard.press('Escape');
}

test('cross-site cookies are neither set nor sent; with the switch off, they are', async () => {
  const { app, win } = await launch(undefined, [], { KITE_TEST_QUIET: '1' });
  lastEchoCookie = 'unset';
  await open(win, a('/embed'));
  await expect(row(win, 'Embed done')).toHaveCount(1, { timeout: 15000 });
  expect(lastEchoCookie).toBeUndefined();

  await toggle(win, 'shields-cross-site-cookies');
  lastEchoCookie = 'unset';
  await open(win, a('/embed'));
  await expect(row(win, 'Embed done')).toHaveCount(2, { timeout: 15000 });
  await expect.poll(() => lastEchoCookie).toBe('tp=1');
  await app.close();
});

test('fingerprinting protection: the same answer twice on a site, a different one on another site; off, both match', async () => {
  const { app, win } = await launch(undefined, [], { KITE_TEST_QUIET: '1' });
  type Fp = { one: number; two: number; cores: number; native: string };
  await open(win, a('/fp'));
  await expect(row(win, 'FP')).toHaveCount(1, { timeout: 15000 });
  const onA = await inPage<Fp>(win, 'window.fp');
  await open(win, b('/fp'));
  await expect(row(win, 'FP')).toHaveCount(2, { timeout: 15000 });
  const onB = await inPage<Fp>(win, 'window.fp');
  expect(onA.one).toBe(onA.two);
  expect(onB.one).toBe(onB.two);
  expect(onA.one).not.toBe(onB.one);
  expect(onA.native).toContain('[native code]');
  for (const fp of [onA, onB]) expect(fp.cores).toBeGreaterThanOrEqual(2), expect(fp.cores).toBeLessThanOrEqual(8);

  await toggle(win, 'shields-fingerprinting');
  await open(win, a('/fp'));
  await expect(row(win, 'FP')).toHaveCount(3, { timeout: 15000 });
  const offA = await inPage<Fp>(win, 'window.fp');
  await open(win, b('/fp'));
  await expect(row(win, 'FP')).toHaveCount(4, { timeout: 15000 });
  const offB = await inPage<Fp>(win, 'window.fp');
  expect(offA.one).toBe(offB.one);
  await app.close();
});

test('a tracking redirect link goes straight to its destination', async () => {
  const { app, win } = await launch(undefined, [], { KITE_TEST_QUIET: '1' });
  await open(win, `https://www.google.com/url?q=${encodeURIComponent(a('/landed'))}&sa=D`);
  await expect(row(win, 'Landed')).toHaveCount(1, { timeout: 15000 });
  await expect(win.getByTestId('url-pill')).toContainText('127.0.0.1');
  await app.close();
});
