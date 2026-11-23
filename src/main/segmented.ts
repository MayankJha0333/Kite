// Accelerated downloads: one file over several connections at once (see shared/segments.ts).
//
// Each connection asks for its own byte range with the Space's own cookies (the page's
// session), and writes at its offset in a temporary file next to the final one. When a
// connection finishes, it takes over half of the largest range left. Dropped connections
// retry with a growing pause. Pausing keeps the ranges; resuming (even after Kite restarts)
// carries on where each range stopped, and starts over cleanly if the file on the server
// changed in the meantime (checked with its ETag or Last-Modified date).

import type { Session } from 'electron';
import { open, rename, unlink, type FileHandle } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { MIN_PART, isComplete, parseContentRange, partLeft, planParts, rangeHeader, receivedOf, smoothSpeed, splitLargest, type Part } from '../shared/segments';

export interface RangeSupport {
  total: number;
  /** ETag (strong) or Last-Modified, to tell if the file changed between sessions. */
  validator: string | null;
  /** The address the bytes actually come from, after redirects. */
  url: string;
}

const PROBE_MS = 8000;

/** Does the server hand out byte ranges for this file? Asks for its first byte only. */
export async function probeRanges(ses: Session, url: string, referrer: string): Promise<RangeSupport | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PROBE_MS);
  try {
    const res = await ses.fetch(url, { headers: { Range: 'bytes=0-0', ...(referrer ? { Referer: referrer } : {}) }, signal: ac.signal, redirect: 'follow', bypassCustomProtocolHandlers: true } as RequestInit);
    void res.body?.cancel().catch(() => undefined);
    if (res.status !== 206) return null;
    const range = parseContentRange(res.headers.get('content-range'));
    if (!range || range.start !== 0 || !range.total) return null;
    const etag = res.headers.get('etag');
    const validator = etag && !etag.startsWith('W/') ? etag : res.headers.get('last-modified');
    return { total: range.total, validator, url: res.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface JobState {
  parts: Part[];
  received: number;
  speed: number;
}

export interface Job {
  /** Resolves when the download ends: completed, paused (ranges kept), cancelled, or failed. */
  done: Promise<{ state: 'completed' | 'paused' | 'cancelled' | 'failed'; error?: string; restart?: boolean }>;
  pause(): void;
  cancel(): void;
}

export interface JobOptions {
  ses: Session;
  url: string;
  referrer: string;
  total: number;
  validator: string | null;
  /** Where the bytes go while downloading, then renamed to `path`. */
  tmp: string;
  path: string;
  connections: number;
  /** Ranges to continue from (resume), or none to start fresh. */
  parts?: Part[];
  onProgress(s: JobState): void;
}

const RETRIES = 6;
const TICK_MS = 500;

/** Start (or continue) an accelerated download. */
export function startJob(o: JobOptions): Job {
  const ac = new AbortController();
  let stopReason: 'pause' | 'cancel' | null = null;
  const parts: Part[] = o.parts?.length ? o.parts.map((p) => ({ ...p })) : planParts(o.total, o.connections);
  let speed = 0;
  let windowBytes = 0;
  let lastTick = Date.now();
  let fatal: { error: string; restart?: boolean } | null = null;

  const done = (async () => {
    let fh: FileHandle | null = null;
    const tick = setInterval(() => {
      const now = Date.now();
      speed = smoothSpeed(speed, windowBytes, now - lastTick);
      windowBytes = 0;
      lastTick = now;
      o.onProgress({ parts, received: receivedOf(parts), speed });
    }, TICK_MS);
    try {
      const fresh = !o.parts?.length || !existsSync(o.tmp);
      if (fresh) parts.splice(0, parts.length, ...planParts(o.total, o.connections));
      fh = await open(o.tmp, fresh ? 'w+' : 'r+');
      if (fresh) await fh.truncate(o.total);
      const file = fh;

      /** One connection: fetch what's left of `p`, write it in place, then look for more work. */
      const worker = async (first: Part) => {
        let p: Part | null = first;
        while (p && !ac.signal.aborted && !fatal) {
          await fetchPart(file, p);
          p = partLeft(p) === 0 ? nextPart() : p;
        }
      };
      const nextPart = (): Part | null => {
        const open = parts.find((x) => partLeft(x) > 0 && !busy.has(x));
        if (open) return claim(open);
        const back = splitLargest(parts.filter((x) => busy.has(x)), MIN_PART);
        if (!back) return null;
        parts.push(back);
        parts.sort((a, b) => a.start - b.start);
        return claim(back);
      };
      const busy = new Set<Part>();
      const claim = (p: Part) => (busy.add(p), p);

      const fetchPart = async (file: FileHandle, p: Part) => {
        for (let attempt = 0; attempt <= RETRIES && partLeft(p) > 0 && !ac.signal.aborted && !fatal; attempt++) {
          if (attempt) await wait(Math.min(8000, 500 * 2 ** (attempt - 1)), ac.signal);
          try {
            const res = await o.ses.fetch(o.url, {
              headers: { Range: rangeHeader(p), ...(o.referrer ? { Referer: o.referrer } : {}), ...(o.validator ? { 'If-Range': o.validator } : {}) },
              signal: ac.signal,
              redirect: 'follow',
              bypassCustomProtocolHandlers: true,
            } as RequestInit);
            if (res.status === 200) {
              // The server ignored the range: the file changed, or it stopped taking ranges.
              void res.body?.cancel().catch(() => undefined);
              fatal = { error: 'The file changed on the server', restart: true };
              return;
            }
            if (res.status !== 206 || !res.body) throw new Error(`The server answered ${res.status}`);
            const range = parseContentRange(res.headers.get('content-range'));
            if (!range || range.start !== p.start + p.done) throw new Error('The server sent the wrong part');
            const reader = res.body.getReader();
            try {
              while (partLeft(p) > 0) {
                const { value, done: end } = await reader.read();
                if (end) break;
                // Another connection may have taken this range's tail: write only what is still ours.
                const n = Math.min(value.byteLength, partLeft(p));
                if (n <= 0) break;
                await file.write(value, 0, n, p.start + p.done);
                p.done += n;
                windowBytes += n;
              }
            } finally {
              void reader.cancel().catch(() => undefined);
            }
            if (partLeft(p) === 0) return;
          } catch (err) {
            if (ac.signal.aborted) return;
            if (attempt === RETRIES) fatal = { error: (err as Error).message || 'The connection was lost' };
          }
        }
        // Out of attempts with bytes still missing (the server kept closing early): stop, keep the ranges for a retry.
        if (partLeft(p) > 0 && !ac.signal.aborted && !fatal) fatal = { error: 'The connection kept dropping' };
      };

      const starters = parts.filter((p) => partLeft(p) > 0).slice(0, o.connections).map(claim);
      // More connections than ranges (a resumed download): split to fill them.
      while (starters.length < o.connections) {
        const back = splitLargest(parts, MIN_PART);
        if (!back) break;
        parts.push(back);
        parts.sort((a, b) => a.start - b.start);
        starters.push(claim(back));
      }
      await Promise.all(starters.map((p) => worker(p)));
      await file.close();
      fh = null;

      if (stopReason === 'cancel') {
        await unlink(o.tmp).catch(() => undefined);
        return { state: 'cancelled' as const };
      }
      if (stopReason === 'pause') return { state: 'paused' as const };
      // Set from inside the connections (TypeScript can't see that), hence the cast.
      const failure = fatal as { error: string; restart?: boolean } | null;
      if (failure) {
        if (failure.restart) await unlink(o.tmp).catch(() => undefined);
        return { state: 'failed' as const, error: failure.error, restart: failure.restart };
      }
      if (!isComplete(parts)) return { state: 'failed' as const, error: 'The download stopped early' };
      await rename(o.tmp, o.path);
      return { state: 'completed' as const };
    } catch (err) {
      await fh?.close().catch(() => undefined);
      if (stopReason === 'cancel') {
        await unlink(o.tmp).catch(() => undefined);
        return { state: 'cancelled' as const };
      }
      return { state: stopReason === 'pause' ? ('paused' as const) : ('failed' as const), error: (err as Error).message };
    } finally {
      clearInterval(tick);
      o.onProgress({ parts, received: receivedOf(parts), speed: 0 });
    }
  })();

  return {
    done,
    pause() {
      stopReason ??= 'pause';
      ac.abort();
    },
    cancel() {
      stopReason = 'cancel';
      ac.abort();
    },
  };
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true });
  });
}
