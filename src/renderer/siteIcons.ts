// Icons for sites no page has reported yet (a shortcut typed by hand, a search engine, a
// site from an import). One lookup per site, a few at a time; the answer is stamped on the
// state so every place that shows the site picks it up, and a miss is not asked again.

import { rememberSiteIcon } from '@shared/ops';
import { hostOf } from '@shared/url';
import { bridge } from './platform';
import { useKite } from './store';

const asked = new Set<string>();
const queue: string[] = [];
let running = 0;
const AT_ONCE = 4;

export function lookupSiteIcon(url: string): void {
  const host = hostOf(url);
  if (!host || asked.has(host) || !/^https?:/i.test(url)) return;
  asked.add(host);
  queue.push(url);
  pump();
}

function pump() {
  while (running < AT_ONCE && queue.length) {
    const url = queue.shift()!;
    running++;
    bridge
      .siteIcon(url)
      .then((icon) => {
        if (icon) useKite.getState().act((d) => rememberSiteIcon(d, url, icon));
      })
      .catch(() => {})
      .finally(() => {
        running--;
        pump();
      });
  }
}

/** For tests: forget what was asked, so a fresh page asks again. */
export function resetSiteIconLookups(): void {
  asked.clear();
  queue.length = 0;
}

// ---- tone -------------------------------------------------------------------
// Some icons are drawn for a white page (GitHub's mark is near-black on nothing) and
// vanish on a dark sidebar; a few are white and vanish on a light one. An icon is measured
// once: when almost none of what it draws would show on a dark shell it is 'dark', when
// almost none would show on a light one it is 'light', and SiteIcon sits those on a small
// plate. The icon itself is never recolored.
//
// Measuring reads the icon's pixels, which the browser allows only for icons it may share
// (inline ones, and ones their site serves to anyone). The rest stay unmeasured and are
// drawn as they are.

export type IconTone = 'dark' | 'light' | null;

const tones = new Map<string, IconTone>();
const measuring = new Map<string, Set<() => void>>();

/** What is known about this icon: its tone, null for "fine as it is", undefined for "not measured yet". */
export function iconTone(src: string): IconTone | undefined {
  return tones.get(src);
}

/** Share of an icon's drawn pixels that must be visible on a shell for it to need no plate. */
const VISIBLE_SHARE = 0.1;

/** Exported for tests: the tone of an icon from its RGBA pixels. */
export function toneOfPixels(data: Uint8ClampedArray | number[]): IconTone {
  let drawn = 0;
  let showsOnDark = 0;
  let showsOnLight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    if (a < 0.15) continue;
    const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    drawn += a;
    if (lum > 0.35) showsOnDark += a;
    if (lum < 0.72) showsOnLight += a;
  }
  if (drawn < 4) return null; // next to nothing drawn: a plate would not help
  if (showsOnDark / drawn < VISIBLE_SHARE) return 'dark';
  if (showsOnLight / drawn < VISIBLE_SHARE) return 'light';
  return null;
}

/** Measure an icon once; `done` is called when its tone is known. Returns a way to stop waiting. */
export function measureIconTone(src: string, done: () => void): () => void {
  let waiters = measuring.get(src);
  if (!waiters) {
    waiters = new Set();
    measuring.set(src, waiters);
    const finish = (tone: IconTone) => {
      tones.set(src, tone);
      measuring.get(src)?.forEach((fn) => fn());
      measuring.delete(src);
    };
    // Read the pixels directly when the site shares them; otherwise ask the main process for
    // a small copy it fetched itself (most sites' own icons), and read that.
    const read = (url: string, fallback: (() => void) | null) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = c.height = 16;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          if (!ctx) return finish(null);
          ctx.drawImage(img, 0, 0, 16, 16);
          finish(toneOfPixels(ctx.getImageData(0, 0, 16, 16).data));
        } catch {
          if (fallback) fallback();
          else finish(null);
        }
      };
      img.onerror = () => (fallback ? fallback() : finish(null));
      img.src = url;
    };
    const viaMain = /^https?:/i.test(src)
      ? () =>
          void bridge
            .iconPixels(src)
            .then((copy) => (copy ? read(copy, null) : finish(null)))
            .catch(() => finish(null))
      : null;
    read(src, viaMain);
  }
  waiters.add(done);
  return () => void measuring.get(src)?.delete(done);
}
