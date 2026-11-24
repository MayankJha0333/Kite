// Downloads: files, images (optionally converted) and videos (direct files and
// unprotected HLS streams), with progress, pause/resume, cancel and a saved list.

import { app, BrowserWindow, dialog, nativeImage, shell, type DownloadItem, type Session, type WebContents } from 'electron';
import { createDecipheriv } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  extForMime, extOf, hlsIv, isDangerousFile, isMasterPlaylist, kindForName, nameFromUrl, parseMasterPlaylist, parseMediaPlaylist, safeFileName, uniqueName, withExt,
  type DownloadEntry, type HlsVariant, type ImageFormat,
} from '../shared/downloads';
import { hostOf } from '../shared/url';
import { ACCELERATE_MIN, sanitizeParts } from '../shared/segments';
import { probeRanges, startJob, type Job } from './segmented';

const KEEP = 200;
const MAX_IMAGE = 150 * 1024 * 1024;
const MAX_SEGMENTS = 20_000;

export interface DownloadDeps {
  dir: string;
  ask(): boolean;
  /** Connections per download (1 = leave it to Chromium's single connection). */
  connections(): number;
  /** A Space's cookie jar by partition (to resume or retry with the right cookies). */
  session(partition: string): Session;
  window(): BrowserWindow | null;
  onChange(list: DownloadEntry[]): void;
  onDone(entry: DownloadEntry): void;
  /** A tab whose only "page" was this download (an address typed or opened in a new tab): it can close. */
  onDownloadOnlyPage?(wc: WebContents): void;
  log(msg: string): void;
}

interface Wanted {
  saveAs?: boolean;
  name?: string;
}

export function createDownloads(deps: DownloadDeps) {
  const file = join(deps.dir, 'downloads.json');
  let list: DownloadEntry[] = [];
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as DownloadEntry[];
    // Accelerated downloads carry on after a restart (their ranges and part file are kept); others can't.
    if (Array.isArray(raw))
      list = raw
        .filter((d) => d && typeof d.id === 'string')
        .map((d) => {
          if (d.state !== 'progressing' && d.state !== 'paused') return d;
          const parts = d.accelerated && d.tmp && existsSync(d.tmp) ? sanitizeParts(d.parts, d.total) : undefined;
          return parts ? { ...d, parts, state: 'paused' as const, speed: 0, resumable: true } : { ...d, state: 'failed' as const, error: 'Kite quit before it finished', speed: 0 };
        });
  } catch {
    /* no list yet */
  }
  const items = new Map<string, DownloadItem>();
  const jobs = new Map<string, Job>();
  const aborts = new Map<string, AbortController>();
  /** Options for downloads Kite itself started, by URL. */
  const wanted = new Map<string, Wanted>();
  let seq = 0;
  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const newId = () => `dl-${Date.now().toString(36)}-${++seq}`;
  const folder = () => app.getPath('downloads');

  function changed(now = false) {
    if (!saveTimer)
      saveTimer = setTimeout(() => {
        saveTimer = null;
        try {
          writeFileSync(file, JSON.stringify(list.slice(0, KEEP)));
        } catch (err) {
          deps.log(`downloads: couldn't save list: ${(err as Error).message}`);
        }
      }, 800);
    if (now) {
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = null;
      return deps.onChange(list);
    }
    if (!pushTimer)
      pushTimer = setTimeout(() => {
        pushTimer = null;
        deps.onChange(list);
      }, 250);
  }

  function add(e: Omit<DownloadEntry, 'id' | 'startedAt' | 'received' | 'speed' | 'state'> & Partial<DownloadEntry>): DownloadEntry {
    const entry: DownloadEntry = { id: newId(), startedAt: Date.now(), received: 0, speed: 0, state: 'progressing', ...e };
    list = [entry, ...list].slice(0, KEEP);
    changed(true);
    return entry;
  }

  function finish(entry: DownloadEntry, state: DownloadEntry['state'], error?: string) {
    Object.assign(entry, { state, error, speed: 0, endedAt: Date.now() });
    if (state === 'completed' && entry.total < entry.received) entry.total = entry.received;
    changed(true);
    if (state === 'completed' || state === 'failed') deps.onDone(entry);
  }

  /** A free file name in the Downloads folder. */
  function freePath(name: string): string {
    const dir = folder();
    mkdirSync(dir, { recursive: true });
    const taken = new Set(list.filter((d) => d.state === 'progressing' || d.state === 'paused').map((d) => d.path));
    return join(dir, uniqueName(safeFileName(name), (n) => existsSync(join(dir, n)) || taken.has(join(dir, n))));
  }

  /** Where to save: asks when "ask where to save" is on (or `saveAs`), else the Downloads folder. Null = cancelled. */
  async function choosePath(name: string, saveAs: boolean): Promise<string | null> {
    const path = freePath(name);
    if (!saveAs && !deps.ask()) return path;
    const win = deps.window();
    const res = win ? await dialog.showSaveDialog(win, { defaultPath: path }) : await dialog.showSaveDialog({ defaultPath: path });
    return res.canceled || !res.filePath ? null : res.filePath;
  }

  /** Run (or continue) an accelerated download. */
  function runJob(entry: DownloadEntry, ses: Session, resume: boolean, restarted = false) {
    if (!entry.tmp || !entry.total) return;
    const job = startJob({
      ses,
      url: entry.url,
      referrer: entry.referrer ?? '',
      total: entry.total,
      validator: entry.validator ?? null,
      tmp: entry.tmp,
      path: entry.path,
      connections: entry.connections ?? deps.connections(),
      parts: resume ? entry.parts : undefined,
      onProgress: (st) => {
        entry.parts = st.parts.map((x) => ({ ...x }));
        entry.received = st.received;
        entry.speed = st.speed;
        changed();
      },
    });
    jobs.set(entry.id, job);
    Object.assign(entry, { state: 'progressing', error: undefined, resumable: true });
    changed(true);
    void job.done.then((r) => {
      jobs.delete(entry.id);
      if (r.state === 'completed') return finish(entry, 'completed');
      if (r.state === 'paused') return void (Object.assign(entry, { state: 'paused', speed: 0 }), changed(true));
      if (r.state === 'cancelled') return finish(entry, 'cancelled');
      // The file changed on the server: start it over once, cleanly.
      if (r.restart && !restarted) return runJob(Object.assign(entry, { parts: undefined, received: 0 }), ses, false, true);
      finish(entry, 'failed', r.error);
    });
  }

  /**
   * IDM's trick for downloads Chromium started: if the server hands out byte ranges for the
   * very same file, take it over and fetch it over several connections. Anything else
   * (form posts, servers without ranges, small files) carries on as it was.
   */
  async function maybeAccelerate(entry: DownloadEntry, item: DownloadItem, ses: Session, partition: string, referrer: string) {
    const connections = deps.connections();
    const total = item.getTotalBytes();
    if (connections < 2 || total < ACCELERATE_MIN) return;
    const url = item.getURLChain().at(-1) ?? item.getURL();
    if (!/^https?:\/\//i.test(url)) return;
    const support = await probeRanges(ses, url, referrer);
    if (!support || support.total !== total) return;
    const take = () => {
      const path = item.getSavePath();
      if (!path || item.getState() !== 'progressing' || entry.accelerated) return false;
      Object.assign(entry, { accelerated: true, url: support.url, path, name: path.split(/[\\/]/).pop() || entry.name, tmp: `${path}.kitepart`, connections, validator: support.validator, partition, referrer: /^https?:/i.test(referrer) ? referrer : undefined });
      items.delete(entry.id);
      item.cancel(); // its 'done' is ignored for accelerated entries
      runJob(entry, ses, false);
      return true;
    };
    // With "ask where to save", wait for the chosen path.
    if (!take()) item.on('updated', () => void take());
  }

  function attach(ses: Session, partition = '') {
    ses.on('will-download', (_e, item, wc) => {
      const url = item.getURL();
      const opts = wanted.get(url) ?? {};
      wanted.delete(url);
      const name = safeFileName(opts.name || item.getFilename());
      const site = hostOf(wc?.getURL() ?? '') || hostOf(url);
      // Files that can run code: say so before anything is kept.
      if (isDangerousFile(name)) {
        const win = deps.window();
        const o = {
          type: 'warning' as const,
          buttons: ['Don’t Download', 'Download Anyway'],
          defaultId: 0,
          cancelId: 0,
          message: `“${name}” can run programs on your computer.`,
          detail: `It comes from ${site || 'an unknown site'}. Only download it if you trust where it comes from.`,
        };
        const choice = win ? dialog.showMessageBoxSync(win, o) : dialog.showMessageBoxSync(o);
        if (choice !== 1) return item.cancel();
      }
      const path = freePath(name);
      if (opts.saveAs || deps.ask()) item.setSaveDialogOptions({ defaultPath: path });
      else item.setSavePath(path);
      const entry = add({ url, name, path: opts.saveAs || deps.ask() ? '' : path, kind: kindForName(name, item.getMimeType()), total: item.getTotalBytes(), resumable: true, site });
      items.set(entry.id, item);
      void maybeAccelerate(entry, item, ses, partition, wc?.getURL() ?? '');
      // A tab that never showed a page before this download is left empty: browsers close it, and so does Kite.
      if (wc && !wc.isDestroyed()) {
        const shown = wc.getURL();
        if (!/^https?:/i.test(shown) || shown === url || item.getURLChain().includes(shown)) deps.onDownloadOnlyPage?.(wc);
      }
      item.on('updated', (_ev, state) => {
        if (entry.accelerated) return;
        entry.received = item.getReceivedBytes();
        entry.total = item.getTotalBytes();
        entry.path = item.getSavePath() || entry.path;
        if (entry.path) entry.name = entry.path.split(/[\\/]/).pop() || entry.name;
        entry.speed = item.isPaused() ? 0 : item.getCurrentBytesPerSecond();
        entry.state = state === 'interrupted' ? 'paused' : item.isPaused() ? 'paused' : 'progressing';
        entry.resumable = item.canResume() || state !== 'interrupted';
        changed();
      });
      item.once('done', (_ev, state) => {
        if (entry.accelerated) return; // taken over by the accelerated download
        items.delete(entry.id);
        entry.received = item.getReceivedBytes();
        entry.path = item.getSavePath() || entry.path;
        if (entry.path) entry.name = entry.path.split(/[\\/]/).pop() || entry.name;
        // Cancelling the Save dialog isn't a download worth listing.
        if (state === 'cancelled' && !entry.path) {
          list = list.filter((d) => d !== entry);
          return changed(true);
        }
        finish(entry, state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'failed', state === 'interrupted' ? 'The connection was lost' : undefined);
      });
    });
  }

  /** Start a normal download of a URL, in the page's own session (so its cookies apply). */
  function downloadUrl(wc: WebContents, url: string, opts: Wanted = {}) {
    if (!/^https?:\/\//i.test(url) || wc.isDestroyed()) return;
    wanted.set(url, opts);
    setTimeout(() => wanted.delete(url), 60_000);
    wc.downloadURL(url);
  }

  async function fetchBytes(ses: Session, url: string, referrer: string, signal: AbortSignal, max = MAX_IMAGE): Promise<{ data: Buffer; mime: string }> {
    const res = await ses.fetch(url, { signal, headers: referrer ? { Referer: referrer } : undefined });
    if (!res.ok) throw new Error(`The site answered ${res.status}`);
    const len = Number(res.headers.get('content-length')) || 0;
    if (len > max) throw new Error('That file is too large');
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length > max) throw new Error('That file is too large');
    return { data, mime: res.headers.get('content-type') ?? '' };
  }

  /** Convert image bytes with the browser engine's decoder, in a world the page's scripts can't see. */
  async function convertInPage(wc: WebContents, data: Buffer, format: 'png' | 'jpeg'): Promise<Buffer> {
    if (data.length > 40 * 1024 * 1024) throw new Error('This image is too large to convert. Save it in its original format instead.');
    const type = format === 'png' ? 'image/png' : 'image/jpeg';
    const code = `(async () => {
      const bytes = Uint8Array.from(atob(${JSON.stringify(data.toString('base64'))}), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes]));
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const x = c.getContext('2d');
      if (${JSON.stringify(type)} === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
      x.drawImage(bmp, 0, 0);
      const out = new Uint8Array(await (await c.convertToBlob({ type: ${JSON.stringify(type)}, quality: 0.92 })).arrayBuffer());
      let s = '';
      for (let i = 0; i < out.length; i += 32768) s += String.fromCharCode.apply(null, out.subarray(i, i + 32768));
      return btoa(s);
    })()`;
    try {
      const b64 = (await wc.executeJavaScriptInIsolatedWorld(1997, [{ code }])) as string;
      const out = Buffer.from(b64, 'base64');
      if (!out.length) throw new Error('empty');
      return out;
    } catch {
      throw new Error('This image type can’t be converted. Save it in its original format instead.');
    }
  }

  /** Save an image, optionally converted to PNG or JPEG. */
  async function saveImage(wc: WebContents, url: string, format: ImageFormat, saveAs = false): Promise<void> {
    if (format === 'original') return downloadUrl(wc, url, { saveAs });
    const ext = format === 'png' ? 'png' : 'jpg';
    const path = await choosePath(withExt(nameFromUrl(url, 'image'), ext), saveAs);
    if (!path) return;
    const entry = add({ url, name: path.split(/[\\/]/).pop()!, path, kind: 'image', total: 0, resumable: false, site: hostOf(wc.getURL()) || hostOf(url) });
    const ac = new AbortController();
    aborts.set(entry.id, ac);
    try {
      const { data } = await fetchBytes(wc.session, url, wc.getURL(), ac.signal);
      const img = nativeImage.createFromBuffer(data);
      // PNG and JPEG are read directly; everything else (WebP, AVIF, GIF…) is decoded by the browser engine.
      const out = !img.isEmpty() ? (format === 'png' ? img.toPNG() : img.toJPEG(92)) : await convertInPage(wc, data, format);
      writeFileSync(path, out);
      entry.received = entry.total = out.length;
      finish(entry, 'completed');
    } catch (err) {
      finish(entry, ac.signal.aborted ? 'cancelled' : 'failed', (err as Error).message);
    } finally {
      aborts.delete(entry.id);
    }
  }

  /** The quality levels of a stream. An empty list means it has only one. */
  async function hlsVariants(ses: Session, url: string, referrer: string): Promise<HlsVariant[]> {
    const { data } = await fetchBytes(ses, url, referrer, AbortSignal.timeout(20_000), 5 * 1024 * 1024);
    const text = data.toString('utf8');
    if (!text.trimStart().startsWith('#EXTM3U')) throw new Error('That isn’t a stream Kite can read.');
    return isMasterPlaylist(text) ? parseMasterPlaylist(text, url) : [];
  }

  /** Download an HLS stream by fetching its pieces in order and joining them. */
  async function downloadHls(wc: WebContents, url: string, title: string): Promise<void> {
    const ses = wc.session;
    const referrer = wc.getURL();
    const entry = add({ url, name: safeFileName(`${title || 'video'}.mp4`), path: '', kind: 'video', total: 0, resumable: false, site: hostOf(referrer) || hostOf(url) });
    const ac = new AbortController();
    aborts.set(entry.id, ac);
    let out: ReturnType<typeof createWriteStream> | null = null;
    try {
      let playlistUrl = url;
      let text = (await fetchBytes(ses, playlistUrl, referrer, ac.signal, 5 * 1024 * 1024)).data.toString('utf8');
      if (isMasterPlaylist(text)) {
        const best = parseMasterPlaylist(text, playlistUrl)[0];
        if (!best) throw new Error('This stream has no video Kite can read.');
        playlistUrl = best.url;
        text = (await fetchBytes(ses, playlistUrl, referrer, ac.signal, 5 * 1024 * 1024)).data.toString('utf8');
      }
      const pl = parseMediaPlaylist(text, playlistUrl);
      if (pl.protected) throw new Error('This video is copy-protected (DRM), so it can’t be downloaded.');
      if (pl.live) throw new Error('This is a live broadcast. It can be downloaded once it has ended.');
      if (!pl.segments.length || pl.segments.length > MAX_SEGMENTS) throw new Error('This stream can’t be downloaded.');
      // Fragmented-MP4 streams join into .mp4; classic ones into an MPEG transport stream (.ts), which every player opens.
      const path = await choosePath(withExt(safeFileName(title || nameFromUrl(url, 'video')), pl.init ? 'mp4' : 'ts'), false);
      if (!path) {
        list = list.filter((d) => d !== entry);
        return changed(true);
      }
      entry.path = path;
      entry.name = path.split(/[\\/]/).pop()!;
      mkdirSync(dirname(path), { recursive: true });
      out = createWriteStream(path);
      const write = (b: Buffer) => new Promise<void>((res, rej) => out!.write(b, (e) => (e ? rej(e) : res())));
      const key = pl.key ? (await fetchBytes(ses, pl.key.url, referrer, ac.signal, 1024)).data : null;
      if (key && key.length !== 16) throw new Error('This stream’s encryption isn’t supported.');
      if (pl.init) await write((await fetchBytes(ses, pl.init, referrer, ac.signal)).data);
      const started = Date.now();
      const BATCH = 6;
      for (let i = 0; i < pl.segments.length; i += BATCH) {
        const part = await Promise.all(
          pl.segments.slice(i, i + BATCH).map(async (u, j) => {
            let lastErr: unknown;
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                const { data } = await fetchBytes(ses, u, referrer, ac.signal);
                if (!key) return data;
                const d = createDecipheriv('aes-128-cbc', key, hlsIv(pl.key!.iv, i + j));
                return Buffer.concat([d.update(data), d.final()]);
              } catch (err) {
                lastErr = err;
                if (ac.signal.aborted) break;
              }
            }
            throw lastErr;
          }),
        );
        for (const b of part) {
          await write(b);
          entry.received += b.length;
        }
        const done = Math.min(pl.segments.length, i + BATCH);
        entry.total = Math.round((entry.received / done) * pl.segments.length); // an estimate until the end
        entry.speed = Math.round(entry.received / Math.max(1, (Date.now() - started) / 1000));
        changed();
      }
      await new Promise<void>((res) => out!.end(res));
      entry.total = entry.received;
      finish(entry, 'completed');
    } catch (err) {
      out?.destroy();
      if (entry.path && existsSync(entry.path)) {
        try {
          unlinkSync(entry.path); // never leave half a video behind
        } catch {
          /* still open elsewhere */
        }
      }
      finish(entry, ac.signal.aborted ? 'cancelled' : 'failed', ac.signal.aborted ? undefined : (err as Error).message || 'The download failed');
    } finally {
      aborts.delete(entry.id);
    }
  }

  type Action = 'pause' | 'resume' | 'cancel' | 'open' | 'reveal' | 'remove' | 'clear' | 'retry' | 'trash';
  async function act(action: Action, id?: string): Promise<string | null> {
    if (action === 'clear') {
      list = list.filter((d) => d.state === 'progressing' || d.state === 'paused');
      changed(true);
      return null;
    }
    const entry = list.find((d) => d.id === id);
    if (!entry) return null;
    const item = items.get(entry.id);
    const job = jobs.get(entry.id);
    if (action === 'pause') {
      item?.pause();
      job?.pause();
    } else if (action === 'resume') {
      if (item?.canResume()) item.resume();
      else if (entry.accelerated && !job && entry.state === 'paused') runJob(entry, deps.session(entry.partition ?? ''), true);
    } else if (action === 'retry') {
      if (entry.state !== 'failed' && entry.state !== 'cancelled') return null;
      // An accelerated download picks up where its connections stopped; anything else starts again.
      if (entry.accelerated && entry.tmp && existsSync(entry.tmp) && entry.parts) runJob(entry, deps.session(entry.partition ?? ''), true);
      else {
        list = list.filter((d) => d !== entry);
        changed(true);
        deps.session(entry.partition ?? '').downloadURL(entry.url);
      }
    } else if (action === 'cancel') {
      item?.cancel();
      job?.cancel();
      aborts.get(entry.id)?.abort();
    } else if (action === 'trash') {
      // Only a finished file goes to the Trash (where it can be put back); it also leaves the list.
      if (entry.state !== 'completed' || !entry.path) return 'Only finished downloads can be moved to the Trash.';
      if (existsSync(entry.path)) {
        try {
          await shell.trashItem(entry.path);
        } catch {
          return 'Kite couldn’t move that file to the Trash.';
        }
      }
      list = list.filter((d) => d !== entry);
      changed(true);
    } else if (action === 'remove') {
      item?.cancel();
      job?.cancel();
      aborts.get(entry.id)?.abort();
      list = list.filter((d) => d !== entry);
      changed(true);
    } else if (entry.state === 'completed' && entry.path) {
      if (!existsSync(entry.path)) return 'That file was moved or deleted.';
      if (action === 'reveal') shell.showItemInFolder(entry.path);
      else if (isDangerousFile(entry.name)) shell.showItemInFolder(entry.path); // never run a program from a click in Kite
      else return (await shell.openPath(entry.path)) || null;
    }
    return null;
  }

  /** IDM's "Add URL": download a pasted link with a Space's cookies. */
  function downloadLink(ses: Session, url: string) {
    if (/^https?:\/\//i.test(url)) ses.downloadURL(url);
  }

  return {
    attach,
    downloadLink,
    list: () => list,
    act,
    downloadUrl,
    saveImage,
    hlsVariants,
    downloadHls,
    extFor: (mime: string, url: string) => extForMime(mime) || extOf(nameFromUrl(url)),
    activeCount: () => list.filter((d) => d.state === 'progressing').length,
  };
}

export type Downloads = ReturnType<typeof createDownloads>;
