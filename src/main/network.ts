// Everything Kite does to network requests, for every cookie jar ("session"):
//  - Shields: block ads and trackers (filter lists, see filterLists.ts), remove
//    tracking parameters, apply the lists' page fixes and CSP rules
//  - Tracking protection: referrers, cookie lifetimes, WebRTC
//  - HTTPS-only: open sites over https when possible
//  - Global Privacy Control header
//  - notice videos and sounds a page loads, so they can be offered for download

import { app, net, type Session, type WebContents } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FiltersEngine, Request } from '@ghostery/adblocker';
import { BUILTIN_FILTERS, BUILTIN_PARAMS, capCookie, httpsUpgrade, isAllowedSite, languageCodes, listSources, searchReferrer, shieldsActive, type Shields } from '../shared/shields';
import { mediaKind, nameFromUrl, type MediaItem } from '../shared/downloads';
import type { PageLog, Prefs, ShieldsStatus } from '../shared/ipc';
import { createFilterLists } from './filterLists';

const TYPES: Record<string, string> = {
  mainFrame: 'main_frame', subFrame: 'sub_frame', stylesheet: 'stylesheet', script: 'script', image: 'image', font: 'font', object: 'object',
  xhr: 'xmlhttprequest', ping: 'ping', cspReport: 'csp_report', media: 'media', webSocket: 'websocket',
};
const HOUR = 3_600_000;

export interface NetworkDeps {
  dir: string;
  prefs(): Prefs;
  /** Is this a web page shown in a Kite tab (not Kite's own UI)? */
  isPage(wcId: number): boolean;
  /** Tell the UI how many things were blocked on a page. */
  onCount(wcId: number, count: number): void;
  onStatus(st: ShieldsStatus): void;
  log(msg: string): void;
  workerFile: string;
  /** Tests: fetch lists from a local server. */
  rewriteListUrl?: (url: string, id: string) => string;
}

/** What a frame needs at document start: CSS to hide things, scripts that fix the page. */
export interface FrameFixes {
  css: string;
  scripts: string[];
  /** Keep watching the page for new elements to hide. */
  watch: boolean;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

export function createNetwork(deps: NetworkDeps) {
  mkdirSync(deps.dir, { recursive: true });
  const lists = createFilterLists({ dir: deps.dir, fetch: (u) => net.fetch(u, { cache: 'no-store' }), workerFile: deps.workerFile, log: deps.log, rewriteUrl: deps.rewriteListUrl });

  let engine = FiltersEngine.parse(BUILTIN_FILTERS, { loadCSPFilters: true });
  let params = FiltersEngine.parse(BUILTIN_PARAMS, { enableOptimizations: false, loadCosmeticFilters: false });
  let loadedKey = '';
  let status: ShieldsStatus = { source: 'builtin', updatedAt: 0, updating: false };
  const languages = languageCodes(safe(() => app.getPreferredSystemLanguages(), [] as string[]).concat(safe(() => app.getLocale(), 'en')));

  // ---- Statistics (kept across restarts) ----
  const statsFile = join(deps.dir, 'stats.json');
  let blocked = safe(() => JSON.parse(readFileSync(statsFile, 'utf8')) as { total: number; since: number }, { total: 0, since: Date.now() });
  let statsTimer: ReturnType<typeof setTimeout> | null = null;
  const saveStats = () => {
    if (statsTimer) return;
    statsTimer = setTimeout(() => {
      statsTimer = null;
      safe(() => writeFileSync(statsFile, JSON.stringify(blocked)), undefined);
      setStatus({});
    }, 4000);
  };

  /** Pages you chose to open over http although HTTPS-only is on (until Kite quits). */
  const allowHttp = new Set<string>();
  const topUrl = new Map<number, string>();
  const counts = new Map<number, number>();
  const logs = new Map<number, Map<string, number>>();
  const media = new Map<number, Map<string, MediaItem>>();
  const notify = new Map<number, ReturnType<typeof setTimeout>>();

  function setStatus(p: Partial<ShieldsStatus>) {
    status = { ...status, ...p, blocked, languages };
    deps.onStatus(status);
  }

  // ---- Keeping the lists and the engine current ----
  let syncing: Promise<void> | null = null;
  let again = false;

  /** Download what's due, then build (or load) the engine for the current choices. */
  async function sync(force = false): Promise<void> {
    if (syncing) {
      again = true;
      return syncing;
    }
    syncing = (async () => {
      do {
        again = false;
        const sh = deps.prefs().shields;
        if (!sh.enabled) break;
        const sources = listSources(sh, languages);
        const userRules = sh.userRulesOn ? sh.userRules : '';
        const maxAge = sh.updateHours > 0 ? sh.updateHours * HOUR : Infinity;
        // A saved engine for exactly these lists starts blocking at once, before any download.
        if (!loadedKey) use(lists.loadSaved(lists.keyFor(sources, userRules)), sources);
        setStatus({ updating: true, error: undefined });
        await lists.ensure(sources, maxAge, force);
        force = false;
        const key = lists.keyFor(sources, userRules);
        const failed = sources.filter((s) => !lists.has(s));
        setStatus({ updating: false, error: failed.length ? `Couldn’t download ${failed.map((s) => s.name).join(', ')}. ${status.source === 'full' ? 'The other lists are in use.' : 'Using the list built into Kite for now.'}` : undefined });
        if (key === loadedKey) {
          setStatus({ lists: lists.status(sources, lastCounts) });
          continue;
        }
        const saved = lists.loadSaved(key);
        if (saved) {
          use(saved, sources);
          continue;
        }
        setStatus({ building: true });
        try {
          use(await lists.build(sources, userRules), sources);
        } catch (err) {
          deps.log(`shields: build failed: ${(err as Error).message}`);
          setStatus({ error: 'Couldn’t prepare the filter lists. Using the list built into Kite.' });
        } finally {
          setStatus({ building: false });
        }
      } while (again);
    })().finally(() => {
      syncing = null;
    });
    return syncing;
  }

  let lastCounts: Record<string, number> = {};
  function use(built: ReturnType<typeof lists.loadSaved>, sources: ReturnType<typeof listSources>) {
    if (!built) return;
    try {
      engine = FiltersEngine.deserialize(built.engine);
      params = FiltersEngine.deserialize(built.params);
    } catch (err) {
      deps.log(`shields: saved engine unreadable: ${(err as Error).message}`);
      return;
    }
    loadedKey = built.key;
    lastCounts = built.counts;
    const updated = Math.max(0, ...sources.map((s) => lists.status([s], {})[s.id].updatedAt));
    setStatus({
      source: built.full ? 'full' : 'builtin',
      updatedAt: updated,
      lists: lists.status(sources, built.counts),
      rules: Object.values(built.counts).reduce((a, b) => a + b, 0) + built.userCount,
      userRules: { count: built.userCount, invalid: built.invalid },
      scriptlets: built.scriptlets,
    });
    applyWebRTC();
  }

  // Lists are checked every hour; each is downloaded again when older than you chose.
  const timer = setInterval(() => void sync(), HOUR);
  timer.unref?.();

  function prefsChanged() {
    applyWebRTC();
    void sync();
  }

  // ---- Per page ----
  function bump(wcId: number, url: string) {
    const n = (counts.get(wcId) ?? 0) + 1;
    counts.set(wcId, n);
    let log = logs.get(wcId);
    if (!log) logs.set(wcId, (log = new Map()));
    const h = hostOf(url);
    if (h && (log.size < 200 || log.has(h))) log.set(h, (log.get(h) ?? 0) + 1);
    blocked = { ...blocked, total: blocked.total + 1 };
    saveStats();
    if (notify.has(wcId)) return;
    notify.set(
      wcId,
      setTimeout(() => {
        notify.delete(wcId);
        deps.onCount(wcId, counts.get(wcId) ?? 0);
      }, 300),
    );
  }

  const active = (url: string) => shieldsActive(deps.prefs().shields, url);
  const request = (url: string, sourceUrl: string, type: string) => Request.fromRawDetails({ url, sourceUrl, type: type as never });

  /** The address without its tracking parameters, or null. */
  function stripped(url: string, sourceUrl: string, type: string): string | null {
    if (!deps.prefs().shields.stripParams || !url.includes('?')) return null;
    try {
      const next = params.match(request(url, sourceUrl, type)).rewrite?.url;
      return next && next !== url ? next : null;
    } catch {
      return null;
    }
  }

  function attach(ses: Session) {
    ses.webRequest.onBeforeRequest((details, cb) => {
      const { url, resourceType, webContentsId: wcId } = details;
      if (!/^(https?|wss?):/i.test(url)) return cb({});
      const prefs = deps.prefs();
      if (resourceType === 'mainFrame') {
        const up = httpsUpgrade(url, prefs.httpsOnly, allowHttp);
        const target = up ?? url;
        const clean = wcId !== undefined && deps.isPage(wcId) && active(target) ? stripped(target, target, 'main_frame') : null;
        if (wcId !== undefined) {
          topUrl.set(wcId, clean ?? target);
          counts.set(wcId, 0);
          logs.delete(wcId);
          media.delete(wcId);
          deps.onCount(wcId, 0);
        }
        const next = clean ?? up;
        return cb(next ? { redirectURL: next } : {});
      }
      // Only pages in tabs are filtered: never Kite's own UI, extensions' own pages or background workers.
      if (wcId === undefined || !deps.isPage(wcId)) return cb({});
      const top = topUrl.get(wcId) ?? details.webContents?.getURL() ?? '';
      if (!active(top)) return cb({});
      const type = TYPES[resourceType] ?? 'other';
      try {
        const { match, redirect } = engine.match(request(url, top || details.referrer, type));
        if (redirect?.dataUrl) {
          bump(wcId, url);
          return cb({ redirectURL: redirect.dataUrl });
        }
        if (match) {
          bump(wcId, url);
          return cb({ cancel: true });
        }
        if (resourceType === 'subFrame') {
          const clean = stripped(url, top, 'sub_frame');
          if (clean) return cb({ redirectURL: clean });
        }
      } catch (err) {
        deps.log(`shields: match failed: ${(err as Error).message}`);
      }
      cb({});
    });

    ses.webRequest.onBeforeSendHeaders((details, cb) => {
      if (!/^https?:/i.test(details.url)) return cb({});
      const prefs = deps.prefs();
      const sh = prefs.shields;
      const headers = { ...details.requestHeaders };
      let changed = false;
      if (prefs.sendGpc) {
        headers['Sec-GPC'] = '1';
        headers.DNT = '1';
        changed = true;
      }
      const wcId = details.webContentsId;
      const refKey = Object.keys(headers).find((k) => k.toLowerCase() === 'referer');
      if (refKey && sh.enabled && wcId !== undefined && deps.isPage(wcId) && active(topUrl.get(wcId) ?? headers[refKey])) {
        const ref = headers[refKey];
        const third = request(details.url, ref, 'other').isThirdParty;
        if (third && sh.hideReferrer) {
          // Third parties learn only their own address, as AdGuard does.
          headers[refKey] = `${new URL(details.url).origin}/`;
          changed = true;
        } else if (third && sh.hideSearchQueries) {
          const s = searchReferrer(ref);
          if (s) {
            headers[refKey] = s;
            changed = true;
          }
        }
      }
      cb(changed ? { requestHeaders: headers } : {});
    });

    ses.webRequest.onHeadersReceived((details, cb) => {
      const wcId = details.webContentsId;
      const sh = deps.prefs().shields;
      if (wcId === undefined || !deps.isPage(wcId) || !sh.enabled || !/^https?:/i.test(details.url)) return cb({});
      const isDoc = details.resourceType === 'mainFrame' || details.resourceType === 'subFrame';
      const top = details.resourceType === 'mainFrame' ? details.url : (topUrl.get(wcId) ?? '');
      if (!active(top)) return cb({});
      let headers = details.responseHeaders;
      let changed = false;
      // The lists' $csp rules (e.g. stop a site's pop-under scripts).
      if (isDoc) {
        try {
          const csp = engine.getCSPDirectives(request(details.url, top, isDoc && details.resourceType === 'mainFrame' ? 'main_frame' : 'sub_frame'));
          if (csp) {
            headers = { ...headers, 'Content-Security-Policy': [...(headers?.['Content-Security-Policy'] ?? headers?.['content-security-policy'] ?? []), csp] };
            changed = true;
          }
        } catch {
          // no CSP for this one
        }
      }
      // Third-party cookies get a short life.
      if (sh.cookieMinutes > 0 && headers && top && request(details.url, top, 'other').isThirdParty) {
        for (const k of Object.keys(headers)) {
          if (k.toLowerCase() !== 'set-cookie') continue;
          headers = { ...headers, [k]: headers[k].map((c) => capCookie(c, sh.cookieMinutes * 60)) };
          changed = true;
        }
      }
      cb(changed ? { responseHeaders: headers } : {});
    });

    // Notice media as it loads (observing only — responses are never changed).
    ses.webRequest.onResponseStarted((details) => {
      const wcId = details.webContentsId;
      if (wcId === undefined || !deps.isPage(wcId) || details.statusCode >= 400) return;
      const h = details.responseHeaders ?? {};
      const header = (n: string) => Object.entries(h).find(([k]) => k.toLowerCase() === n)?.[1]?.[0] ?? '';
      const mime = header('content-type');
      const kind = mediaKind(mime, details.url);
      if (!kind || !/^https?:/i.test(details.url)) return;
      const size = Number(/\/(\d+)$/.exec(header('content-range'))?.[1] ?? header('content-length')) || 0;
      // Tiny clips are sound effects and UI noises, not what anyone wants to save.
      if (kind !== 'stream' && size > 0 && size < 150_000) return;
      let m = media.get(wcId);
      if (!m) media.set(wcId, (m = new Map()));
      if (m.size >= 40 && !m.has(details.url)) return;
      m.set(details.url, { url: details.url, kind, mime: mime.split(';')[0].trim(), size, label: nameFromUrl(details.url, kind) });
    });
  }

  // ---- Page fixes (asked for by each frame at document start; see pagePreload.ts) ----

  /** CSS and scripts for a frame that is starting, or null when nothing applies. */
  function frameFixes(wcId: number, frameUrl: string): FrameFixes | null {
    const sh: Shields = deps.prefs().shields;
    if (!sh.enabled || !sh.cosmetic || !deps.isPage(wcId) || !/^https?:/i.test(frameUrl)) return null;
    const top = topUrl.get(wcId) ?? frameUrl;
    if (!active(top) || !active(frameUrl)) return null;
    try {
      const r = request(frameUrl, top, 'main_frame');
      // A whole-page exception ($document / $elemhide) turns page fixes off here.
      const { styles, scripts } = engine.getCosmeticsFilters({ url: frameUrl, hostname: r.hostname, domain: r.domain || '', getBaseRules: true, getInjectionRules: true, getExtendedRules: false, getRulesFromHostname: true, getRulesFromDOM: false });
      return { css: styles, scripts, watch: true };
    } catch (err) {
      deps.log(`shields: page fixes failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** CSS for elements a page has added (generic rules matched by class and id). */
  function domFixes(wcId: number, frameUrl: string, classes: string[], ids: string[], hrefs: string[]): string {
    const sh = deps.prefs().shields;
    if (!sh.enabled || !sh.cosmetic || !deps.isPage(wcId) || !/^https?:/i.test(frameUrl) || !active(topUrl.get(wcId) ?? frameUrl)) return '';
    try {
      const r = request(frameUrl, frameUrl, 'main_frame');
      return engine.getCosmeticsFilters({ url: frameUrl, hostname: r.hostname, domain: r.domain || '', classes: classes.slice(0, 5000), ids: ids.slice(0, 3000), hrefs: hrefs.slice(0, 2000), getBaseRules: false, getInjectionRules: false, getExtendedRules: false, getRulesFromHostname: false, getRulesFromDOM: true }).styles;
    } catch {
      return '';
    }
  }

  // ---- WebRTC ----
  const rtcPages = new Set<WebContents>();
  function applyWebRTC() {
    const block = deps.prefs().shields.enabled && deps.prefs().shields.blockWebRTC;
    for (const wc of rtcPages) {
      if (wc.isDestroyed()) {
        rtcPages.delete(wc);
        continue;
      }
      wc.setWebRTCIPHandlingPolicy(block ? 'disable_non_proxied_udp' : 'default');
    }
  }
  function watchPage(wc: WebContents) {
    rtcPages.add(wc);
    applyWebRTC();
    wc.once('destroyed', () => rtcPages.delete(wc));
  }

  function forget(wcId: number) {
    topUrl.delete(wcId);
    counts.delete(wcId);
    logs.delete(wcId);
    media.delete(wcId);
    const t = notify.get(wcId);
    if (t) clearTimeout(t);
    notify.delete(wcId);
  }

  function pageLog(wcId: number): PageLog {
    const hosts = [...(logs.get(wcId) ?? new Map<string, number>())].map(([host, count]) => ({ host, count })).sort((a, b) => b.count - a.count || a.host.localeCompare(b.host));
    return { total: counts.get(wcId) ?? 0, hosts: hosts.slice(0, 50) };
  }

  function clearStats() {
    blocked = { total: 0, since: Date.now() };
    safe(() => writeFileSync(statsFile, JSON.stringify(blocked)), undefined);
    setStatus({});
  }

  setStatus({});

  return {
    attach,
    frameFixes,
    domFixes,
    watchPage,
    forget,
    prefsChanged,
    refresh: () => sync(true),
    status: () => status,
    count: (wcId: number) => counts.get(wcId) ?? 0,
    pageLog,
    clearStats,
    media: (wcId: number) => [...(media.get(wcId)?.values() ?? [])],
    allowHttp: (host: string) => void allowHttp.add(host.toLowerCase()),
    isAllowed: (url: string) => isAllowedSite(deps.prefs().shields, url),
    /** The address without its tracking parameters (unchanged when there are none). */
    cleanUrl: (url: string) => stripped(url, url, 'main_frame') ?? url,
    /** Tests: wait until the lists and engine are current. */
    settled: () => sync(),
  };
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export type Network = ReturnType<typeof createNetwork>;
