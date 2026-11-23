// Accelerated downloads in the real app: several connections at once for servers that
// hand out byte ranges, the same bytes on disk, pause and resume, and the normal
// single-connection path for servers that don't.

import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, MOD } from './harness';

const SIZE = 6 * 1024 * 1024;
const DATA = Buffer.alloc(SIZE);
for (let i = 0; i < SIZE; i++) DATA[i] = (i * 31 + (i >> 10)) % 251;
const SHA = createHash('sha256').update(DATA).digest('hex');

let server: Server;
let base = '';
let open = 0;
let maxOpen = 0;
let rangeRequests = 0;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/page') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<title>Files</title><a id="get" href="/linked.zip">Get it</a>');
    }
    if (url.pathname.startsWith('/linked') && !req.headers.referer?.endsWith('/page')) {
      res.writeHead(403);
      return res.end('referer missing');
    }
    const slow = url.searchParams.has('slow');
    const ranges = !url.pathname.startsWith('/norange');
    const headers: Record<string, string> = { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${url.pathname.slice(1)}"` };
    let start = 0;
    let end = SIZE - 1;
    const m = ranges ? /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '') : null;
    if (ranges) Object.assign(headers, { 'Accept-Ranges': 'bytes', ETag: '"kite-test-v1"' });
    if (m) {
      start = Number(m[1]);
      end = m[2] ? Math.min(SIZE - 1, Number(m[2])) : SIZE - 1;
      rangeRequests++;
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${SIZE}`, 'Content-Length': String(end - start + 1) });
    } else res.writeHead(200, { ...headers, 'Content-Length': String(SIZE) });
    open++;
    maxOpen = Math.max(maxOpen, open);
    let pos = start;
    const chunk = slow ? 16 * 1024 : 128 * 1024;
    const timer = setInterval(() => {
      if (res.destroyed) return stop();
      const next = Math.min(end + 1, pos + chunk);
      res.write(DATA.subarray(pos, next));
      pos = next;
      if (pos > end) {
        res.end();
        stop();
      }
    }, slow ? 40 : 5);
    const stop = () => {
      clearInterval(timer);
      open = Math.max(0, open - 1);
    };
    res.on('close', stop);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
test.afterAll(() => server.close());

const sha = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex');

async function start(win: import('@playwright/test').Page, url: string) {
  await win.keyboard.press(`${MOD}+t`);
  await win.getByTestId('cb-input').fill(url);
  await win.getByTestId('cb-input').press('Enter');
}
const list = (win: import('@playwright/test').Page) => win.evaluate(() => (window as any).kite.downloads()) as Promise<any[]>;

test('a big file from a server with ranges comes down over several connections, byte for byte', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kite-dl-'));
  maxOpen = 0;
  rangeRequests = 0;
  const { app, win } = await launch(undefined, [], { KITE_DOWNLOADS: dir, KITE_TEST_QUIET: '1' });
  await start(win, `${base}/big.zip`);
  await expect.poll(() => existsSync(join(dir, 'big.zip')) && statSync(join(dir, 'big.zip')).size === SIZE, { timeout: 30000 }).toBe(true);
  // The tab opened just for the download closes, as browsers do.
  await expect(win.locator('[data-testid=today-list] [data-testid^="row-"]')).toHaveCount(0);
  expect(sha(join(dir, 'big.zip'))).toBe(SHA);
  expect(readdirSync(dir).filter((f) => f.endsWith('.kitepart'))).toEqual([]);
  expect(maxOpen).toBeGreaterThanOrEqual(4);
  expect(rangeRequests).toBeGreaterThanOrEqual(8);
  const [entry] = await list(win);
  expect(entry).toMatchObject({ state: 'completed', accelerated: true, connections: 8, received: SIZE, total: SIZE });
  await app.close();
});

test('pause keeps the ranges; resume carries on and the file is still exact', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kite-dl-'));
  const { app, win } = await launch(undefined, [], { KITE_DOWNLOADS: dir, KITE_TEST_QUIET: '1' });
  await start(win, `${base}/slow.zip?slow=1`);
  await expect.poll(async () => (await list(win))[0]?.accelerated && (await list(win))[0]?.received > 512 * 1024, { timeout: 30000 }).toBe(true);
  const id = (await list(win))[0].id;
  await win.evaluate((x) => (window as any).kite.downloadAction('pause', x), id);
  await expect.poll(async () => (await list(win))[0].state, { timeout: 10000 }).toBe('paused');
  const paused = (await list(win))[0];
  expect(paused.parts.length).toBeGreaterThanOrEqual(2);
  expect(paused.received).toBeLessThan(SIZE);
  expect(existsSync(join(dir, 'slow.zip.kitepart'))).toBe(true);
  await win.evaluate((x) => (window as any).kite.downloadAction('resume', x), id);
  await expect.poll(async () => (await list(win))[0].state, { timeout: 60000 }).toBe('completed');
  expect(sha(join(dir, 'slow.zip'))).toBe(SHA);
  await app.close();
});

test('a server without ranges still downloads normally, over one connection', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kite-dl-'));
  rangeRequests = 0;
  const { app, win } = await launch(undefined, [], { KITE_DOWNLOADS: dir, KITE_TEST_QUIET: '1' });
  await start(win, `${base}/norange.zip`);
  await expect.poll(async () => (await list(win))[0]?.state, { timeout: 30000 }).toBe('completed');
  const [entry] = await list(win);
  expect(entry.accelerated).toBeFalsy();
  expect(sha(join(dir, 'norange.zip'))).toBe(SHA);
  await app.close();
});

test('started from a link on a page, the connections send that page as the referrer, like the browser did', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kite-dl-'));
  const { app, win } = await launch(undefined, [], { KITE_DOWNLOADS: dir, KITE_TEST_QUIET: '1' });
  await start(win, `${base}/page`);
  await expect(win.locator('[data-testid^="row-"][data-title="Files"]')).toHaveCount(1, { timeout: 15000 });
  await win.evaluate(() => {
    const wv = [...document.querySelectorAll('webview')].find((w) => (w as HTMLElement).dataset.visible === 'true') as unknown as { executeJavaScript(c: string): Promise<unknown> };
    return wv.executeJavaScript(`document.getElementById('get').click()`);
  });
  await expect.poll(async () => (await list(win))[0]?.state, { timeout: 30000 }).toBe('completed');
  const [entry] = await list(win);
  expect(entry.accelerated).toBe(true);
  expect(sha(join(dir, 'linked.zip'))).toBe(SHA);
  await app.close();
});

test('a paused download carries on after Kite restarts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kite-dl-'));
  const first = await launch(undefined, [], { KITE_DOWNLOADS: dir, KITE_TEST_QUIET: '1' });
  await start(first.win, `${base}/restart.zip?slow=1`);
  await expect.poll(async () => (await list(first.win))[0]?.accelerated && (await list(first.win))[0]?.received > 512 * 1024, { timeout: 30000 }).toBe(true);
  const id = (await list(first.win))[0].id;
  await first.win.evaluate((x) => (window as any).kite.downloadAction('pause', x), id);
  await expect.poll(async () => (await list(first.win))[0].state, { timeout: 10000 }).toBe('paused');
  await first.win.waitForTimeout(1000); // the list is saved shortly after a change
  await first.app.close();

  const again = await launch(first.userData, [], { KITE_DOWNLOADS: dir, KITE_TEST_QUIET: '1' });
  const [kept] = await list(again.win);
  expect(kept).toMatchObject({ id, state: 'paused', accelerated: true, resumable: true });
  expect(kept.received).toBeGreaterThan(0);
  await again.win.evaluate((x) => (window as any).kite.downloadAction('resume', x), id);
  await expect.poll(async () => (await list(again.win))[0].state, { timeout: 60000 }).toBe('completed');
  expect(sha(join(dir, 'restart.zip'))).toBe(SHA);
  await again.app.close();
});
