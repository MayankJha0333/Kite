// Kite's Electron main process: windows, saving, and keeping web pages in check.

import {
  app,
  BrowserWindow,
  clipboard,
  ClipboardItem,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeTheme,
  net,
  session,
  shell,
  webContents as allWebContents,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type WebContents,
  nativeImage,
} from 'electron';
import { appendFileSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { iconFromHtml } from '@shared/siteIcon';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Storage } from './storage';
import { findAction, toAccelerator } from '../shared/shortcuts';
import type { OpenRequest } from '../shared/ipc';
import { findPipWindow, ignoreMouseOnPipWindow, inspectPipWindow, keepPipWindowIgnoringMouse, roundPipWindowIfSafe, floatPipWindowsSoon, frameStep, installVideoPanelHooks, setPipWindowFrame } from './macWindows';
import { createPipFrame } from './pipFrame';
import { PIP_FRAME_ACTIONS, RESIZE_EDGES, type PipFrameAction, type ResizeEdge } from '../shared/pipFrame';
import { isPipMediaCommand, isThumb, MEDIA_STATE_SCRIPT, pipMediaScript, PIP_REENTER_SCRIPT, PIP_THUMB_SCRIPT, PIP_TO_MINI_SCRIPT, PIP_UNMUTE_VIDEO_SCRIPT } from '../shared/pip';
import { createNetwork } from './network';
import { createDownloads } from './downloads';
import { createExtensions } from './extensions';
import { createPermissions } from './permissions';
import { checkForUpdate } from './updates';
import { isUpdateUrl } from '../shared/updates';
import { DEFAULT_PARTITION, isKitePartition, partitionForSpace } from '../shared/profiles';
import { defaultShields, sanitizeShields, siteKey } from '../shared/shields';
import type { AppInfo, ClearWhat, Prefs, Result } from '../shared/ipc';
import { DEFAULT_SHORTCUTS } from '../shared/defaults';
import { MEDIA_PLAYING_SCRIPT, MEDIA_TRACKER_SCRIPT, PIP_CLOSE_SCRIPT, PIP_ENTER_SCRIPT, PIP_EXIT_SCRIPT, pipPopped } from '../shared/pip';

const isMac = process.platform === 'darwin';
const devUrl = process.env.KITE_DEV_URL;
const userDataOverride = process.env.KITE_USER_DATA;
if (userDataOverride) app.setPath('userData', userDataOverride);
// Pages see a plain Chrome user agent. The default one names Kite and Electron, and sites that
// refuse embedded browsers (sign-in pages most of all) turn it away on those words alone.
app.userAgentFallback = app.userAgentFallback.replace(/\s(?:Kite|kite-browser|Electron)\/\S+/g, '');
// Tests save downloads into a throwaway folder instead of your real Downloads.
if (process.env.KITE_TEST && process.env.KITE_DOWNLOADS) app.setPath('downloads', process.env.KITE_DOWNLOADS);

const PARTITION = DEFAULT_PARTITION;
/** Tests can run in the background: windows appear without taking focus from what you're doing. */
const quiet = !!process.env.KITE_TEST && !!process.env.KITE_TEST_QUIET;
const present = (win: BrowserWindow) => (quiet ? win.showInactive() : win.show());
const isWebUrl = (u: string) => /^https?:\/\//i.test(u);

let storage: Storage;
let mainWindow: BrowserWindow | null = null;
const littleWindows = new Set<BrowserWindow>();
/** webContents id of a web page → the tab it belongs to + the window hosting it. */
const pages = new Map<number, { tabId: string; host: WebContents }>();
let shortcuts: Record<string, string> = {};
let littleHotkey = '';
const pendingExternal: string[] = [];

function rendererUrl(query = ''): string {
  // Tests start on new profiles all the time; they get the first run only when they ask for it.
  if (process.env.KITE_TEST) query += `${query ? '&' : '?'}firstrun=${process.env.KITE_FIRST_RUN ? 1 : 0}`;
  if (devUrl) return `${devUrl}${query}`;
  return `file://${join(__dirname, '../renderer/index.html')}${query}`;
}

// ---- Cookie jars, Shields, downloads, extensions, permissions --------------------

let prefs: Prefs = { shields: defaultShields(), httpsOnly: true, sendGpc: true, askWhereToSave: false, downloadConnections: 8 };
function readPrefs(raw: unknown): Prefs {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const bool = (k: keyof Prefs, d: boolean) => (typeof o[k] === 'boolean' ? (o[k] as boolean) : d);
  const conns = Number(o.downloadConnections);
  return { shields: sanitizeShields(o.shields), httpsOnly: bool('httpsOnly', true), sendGpc: bool('sendGpc', true), askWhereToSave: bool('askWhereToSave', false), downloadConnections: Number.isInteger(conns) ? Math.max(1, Math.min(16, conns)) : 8 };
}

/** Every web page Kite shows (webviews and the popups they open), by webContents id. */
const webPages = new Set<number>();
/** Kite's cookie jars that are in use: partition name → session. */
const jars = new Map<string, Electron.Session>();
const toMain = (channel: string, payload: unknown) => {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isLoading()) mainWindow.webContents.send(channel, payload);
};
let network: ReturnType<typeof createNetwork>;
let downloads: ReturnType<typeof createDownloads>;
let extensions: ReturnType<typeof createExtensions>;
let permissions: ReturnType<typeof createPermissions>;

function setupFeatures() {
  const dir = app.getPath('userData');
  network = createNetwork({
    dir: join(dir, 'shields'),
    prefs: () => prefs,
    isPage: (id) => webPages.has(id),
    onCount: (wcId, count) => {
      const p = pages.get(wcId);
      if (p && !p.host.isDestroyed()) p.host.send('shields-count', { tabId: p.tabId, count });
    },
    onStatus: (st) => toMain('shields-status', st),
    log: debugLog,
    workerFile: join(__dirname, 'shieldsWorker.cjs'),
    // Tests serve the filter lists from a local site, so nothing touches the internet.
    rewriteListUrl: process.env.KITE_TEST && process.env.KITE_TEST_FILTERS ? (_url, id) => `${process.env.KITE_TEST_FILTERS}/${id}.txt` : undefined,
  });
  downloads = createDownloads({
    dir,
    ask: () => prefs.askWhereToSave,
    connections: () => prefs.downloadConnections,
    session: (partition) => ensureJar(partition),
    window: () => BrowserWindow.getFocusedWindow() ?? mainWindow,
    onChange: (list) => toMain('downloads-state', list),
    onDone: (entry) => toMain('download-done', entry),
    onDownloadOnlyPage: (wc) => {
      // A page that turned into a download never finished loading, so it isn't registered yet: its window finds the tab by page id.
      const host = pages.get(wc.id)?.host ?? wc.hostWebContents;
      if (host && !host.isDestroyed()) host.send('download-only-page', wc.id);
    },
    log: debugLog,
  });
  extensions = createExtensions({
    dir,
    sessions: () => [...jars.values()],
    defaultSession: () => ensureJar(PARTITION),
    quiet: () => quiet,
    openUrl: (url) => {
      const win = ensureMainWindow();
      sendOpen(win.webContents, { url, disposition: 'new-tab', sourceTabId: null });
      present(win);
    },
    onChange: (list) => toMain('extensions-state', list),
    log: debugLog,
  });
  permissions = createPermissions({
    dir,
    windowFor: (wc) => BrowserWindow.fromWebContents(pages.get(wc.id)?.host ?? wc) ?? mainWindow ?? undefined,
    onChange: (list) => toMain('permissions-state', list),
  });
}

/** Get a cookie jar ready the first time it is used: blocking, downloads, permissions, extensions. */
function ensureJar(partition: string): Electron.Session {
  let ses = jars.get(partition);
  if (ses) return ses;
  ses = session.fromPartition(partition);
  jars.set(partition, ses);
  network.attach(ses);
  // Shields' page fixes, in every frame at document start (see pagePreload.ts).
  ses.registerPreloadScript({ type: 'frame', id: 'kite-shields', filePath: join(__dirname, 'pagePreload.cjs') });
  downloads.attach(ses, partition);
  permissions.attach(ses);
  void extensions.attach(ses);
  return ses;
}
const partitionOf = (ses: Electron.Session) => [...jars].find(([, s]) => s === ses)?.[0] ?? PARTITION;

/** Erase the data of isolated Spaces that no longer exist (runs at startup, before any page loads). */
function removeOrphanJars(state: unknown) {
  try {
    const spaces = ((state as { spaces?: { id: string; isolated?: boolean }[] })?.spaces ?? []).filter((s) => s && typeof s.id === 'string');
    const used = new Set(spaces.map((s) => partitionForSpace(s).replace(/^persist:/, '').toLowerCase()));
    const dir = join(app.getPath('userData'), 'Partitions');
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      if (!/^kite-space-/i.test(name) || used.has(name.toLowerCase())) continue;
      rmSync(join(dir, name), { recursive: true, force: true });
      debugLog(`profiles: erased data of removed Space jar ${name}`);
    }
  } catch (err) {
    debugLog(`profiles: cleanup failed: ${(err as Error).message}`);
  }
}

async function clearData(what: ClearWhat, site?: string) {
  const host = site ? siteKey(site) : '';
  if (site && !host) return;
  for (const ses of jars.values()) {
    if (!host) {
      const storages = [...(what.cookies ? ['cookies' as const] : []), ...(what.storage ? (['localstorage', 'indexdb', 'serviceworkers', 'cachestorage', 'filesystem', 'shadercache'] as const) : [])];
      if (storages.length) await ses.clearStorageData({ storages: [...storages] });
      if (what.cache) await ses.clearCache();
      continue;
    }
    if (what.cookies) {
      for (const c of await ses.cookies.get({})) {
        const d = (c.domain ?? '').replace(/^\./, '');
        if (d !== host && !d.endsWith(`.${host}`) && !host.endsWith(`.${d}`)) continue;
        await ses.cookies.remove(`http${c.secure ? 's' : ''}://${d}${c.path ?? '/'}`, c.name).catch(() => undefined);
      }
    }
    if (what.storage) for (const origin of [`https://${host}`, `https://www.${host}`, `http://${host}`]) await ses.clearStorageData({ origin, storages: ['localstorage', 'indexdb', 'serviceworkers', 'cachestorage', 'filesystem'] }).catch(() => undefined);
    if (what.cache) await ses.clearCache();
  }
}

/** Only Kite's own UI may use Kite's private messages — never a web page. */
function fromKite(e: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const url = e.senderFrame?.url ?? '';
  if (devUrl) return url.startsWith(devUrl);
  return url.startsWith(`file://${join(__dirname, '../renderer/index.html')}`);
}

function baseWebPreferences(): Electron.WebPreferences {
  return {
    preload: join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webviewTag: true,
    spellcheck: true,
  };
}

/** Kite's own windows must never be navigated away from Kite (e.g. by dropping a link on them). */
function lockKiteWindow(win: BrowserWindow) {
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 720,
    minHeight: 480,
    title: 'Kite',
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#141c22' : '#e9f0ee',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    autoHideMenuBar: !isMac,
    webPreferences: baseWebPreferences(),
  });
  lockKiteWindow(win);
  win.once('ready-to-show', () => present(win));
  win.loadURL(rendererUrl());
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  win.webContents.on('did-finish-load', () => {
    while (pendingExternal.length) win.webContents.send('external-url', pendingExternal.shift());
  });
  // Kite's own UI process died (it should never, but a page can't take it down either way):
  // reload it. Everything is saved to disk, so nothing is lost. Twice in a minute means
  // something is really wrong; say so instead of looping.
  let uiCrashes: number[] = [];
  win.webContents.on('render-process-gone', (_e, details) => {
    errorLog(`UI process gone: ${details.reason} (exit ${details.exitCode})`);
    if (details.reason === 'clean-exit' || win.isDestroyed()) return;
    const now = Date.now();
    uiCrashes = uiCrashes.filter((t) => now - t < 60_000);
    uiCrashes.push(now);
    if (uiCrashes.length > 2) {
      dialog.showMessageBox(win, { type: 'error', message: 'Kite keeps crashing', detail: `The window stopped working several times in a row (${details.reason}). Your tabs are saved. Please restart Kite; if it continues, send kite-errors.log from Kite’s data folder (Settings → About).`, buttons: ['Quit'] }).then(() => app.quit());
      return;
    }
    win.webContents.reload();
  });
  win.webContents.on('unresponsive', () => errorLog('UI unresponsive'));
  win.webContents.on('responsive', () => debugLog('UI responsive again'));
  // Switching to another app pops the playing video out (see autoPipOnLeave).
  // On macOS the app-level "resign active" event is used instead: it fires
  // first, before macOS marks Kite's covered window as hidden.
  win.on('blur', () => {
    if (!isMac) void autoPipOnLeave('window blur');
  });
  win.on('focus', () => void autoPipReturn('window focus'));
  // The UI lays itself out differently in full screen (no window buttons to make room for).
  const tellState = () => !win.isDestroyed() && win.webContents.send('window-state', { fullscreen: win.isFullScreen() });
  win.on('enter-full-screen', tellState);
  win.on('leave-full-screen', tellState);
  win.webContents.on('did-finish-load', tellState);
  return win;
}

function isKiteWindow(w: BrowserWindow) {
  return w === mainWindow || littleWindows.has(w);
}

// ---- Picture-in-picture -------------------------------------------------------

/**
 * Problems worth keeping: crashes and unexpected errors go to kite-errors.log in Kite's
 * data folder, in every build, so a bug report can include them (Settings → About).
 */
function errorLog(msg: string) {
  try {
    appendFileSync(join(app.getPath('userData'), 'kite-errors.log'), `${new Date().toISOString()} ${msg}\n`);
  } catch {
    /* nowhere to write */
  }
  debugLog(`error: ${msg}`);
}

/** When running from source, every pop-out attempt is written to kite-debug.log. */
function debugLog(msg: string) {
  if (app.isPackaged && !process.env.KITE_DEBUG_LOG) return;
  try {
    appendFileSync(process.env.KITE_DEBUG_LOG || join(app.getAppPath(), 'kite-debug.log'), `${new Date().toISOString()} ${msg}\n`);
  } catch {
    /* read-only location */
  }
}

/** Kite's controls over the floating video, and its mini player (design D) — macOS. */
const pipFrame = createPipFrame({
  log: (m) => debugLog(m),
  url: () => rendererUrl('?mode=pip'),
  webPreferences: () => ({ ...baseWebPreferences(), webviewTag: false }),
  media: async () => {
    const pip = currentPip;
    if (!pip) return null;
    const wc = allWebContents.fromId(pip.wcId);
    if (!wc || wc.isDestroyed()) return null;
    const m = (await runInPipPage(MEDIA_STATE_SCRIPT, false)) as { t: number; d: number; paused: boolean; muted?: boolean; pip: boolean } | null;
    if (!m) return null;
    let host = '';
    try {
      host = new URL(wc.getURL()).hostname.replace(/^www\./, '');
    } catch {
      /* not a web page */
    }
    return { ...m, muted: wc.isAudioMuted() || !!m.muted, title: wc.getTitle(), host };
  },
  thumb: async () => {
    const t = await runInPipPage(PIP_THUMB_SCRIPT, false);
    return isThumb(t) ? t : null;
  },
  native: {
    find: () => findPipWindow(debugLog),
    setFrame: (addr, f, animate) => setPipWindowFrame(debugLog, addr, f, animate),
    step: (name, fn, fallback) => frameStep(debugLog, name, fn, fallback),
    ignoreMouse: (addr) => ignoreMouseOnPipWindow(debugLog, addr),
    keepIgnoringMouse: (addr) => keepPipWindowIgnoringMouse(debugLog, addr),
    round: (addr, r) => roundPipWindowIfSafe(debugLog, addr, r),
  },
});
/** The page whose video is floating right now (however it got there). */
let currentPip: { wcId: number; tabId: string; host: WebContents } | null = null;

/** The floating video's speaker button: mute or unmute its tab, and tell the main window (its sidebar shows it). */
async function toggleFloatingMute() {
  const pip = currentPip;
  const wc = pip ? allWebContents.fromId(pip.wcId) : undefined;
  if (!pip || !wc || wc.isDestroyed()) return;
  const m = (await runInPipPage(MEDIA_STATE_SCRIPT, false)) as { muted?: boolean } | null;
  const mute = !(wc.isAudioMuted() || !!m?.muted);
  wc.setAudioMuted(mute);
  if (!mute) await runInPipPage(PIP_UNMUTE_VIDEO_SCRIPT, true);
  if (!pip.host.isDestroyed()) pip.host.send('tab-muted', { tabId: pip.tabId, muted: mute });
}

/** Tab ids the main window wants popped out on an app switch, best first. */
let pipTargets: string[] = [];
let pipTargetsHost: WebContents | null = null;
/** The page whose video we popped out because you left Kite. */
let pipLeft: { wcId: number; tabId: string; host: WebContents } | null = null;

function pageForTab(tabId: string, host: WebContents) {
  let found: number | null = null;
  for (const [wcId, p] of pages) {
    if (p.tabId !== tabId || p.host !== host) continue;
    const wc = allWebContents.fromId(wcId);
    if (!wc || wc.isDestroyed()) pages.delete(wcId); // page was replaced
    else found = wcId;
  }
  return found;
}

/** Try to pop out a video in a page and each frame inside it. Returns a status for the log. */
async function enterPip(wcId: number): Promise<string> {
  const wc = allWebContents.fromId(wcId);
  if (!wc || wc.isDestroyed()) return 'no page';
  const statuses: string[] = [];
  for (const frame of wc.mainFrame.framesInSubtree) {
    try {
      // `true` = run as if you clicked: browsers only allow pop-out after a user action.
      const st = await frame.executeJavaScript(PIP_ENTER_SCRIPT, true);
      if (pipPopped(st)) {
        const page = pages.get(wcId);
        if (page) currentPip = { wcId, tabId: page.tabId, host: page.host };
        if (isMac) {
          // Keep the video on top of every app and desktop, even full-screen ones,
          // and put Kite's frame (border + buttons) around it.
          floatPipWindowsSoon(debugLog, 'popped out');
          pipFrame.showSoon();
        }
        return String(st);
      }
      statuses.push(String(st));
    } catch (err) {
      statuses.push(`frame error ${(err as Error).message}`);
    }
  }
  return statuses.join(' | ') || 'no frames';
}

async function exitPip(wcId: number) {
  if (currentPip?.wcId === wcId) {
    currentPip = null;
    pipFrame.hide('video returned');
  }
  const wc = allWebContents.fromId(wcId);
  if (!wc || wc.isDestroyed()) return;
  for (const frame of wc.mainFrame.framesInSubtree) {
    try {
      await frame.executeJavaScript(PIP_EXIT_SCRIPT, true);
    } catch {
      /* frame went away */
    }
  }
}

/** You switched to another app: pop the visible playing video out right away. */
let leaving = false;
async function autoPipOnLeave(why: string) {
  const host = pipTargetsHost;
  if (!host || host.isDestroyed() || !pipTargets.length || pipLeft || leaving) {
    debugLog(`leave (${why}): nothing to do [targets=${pipTargets.length}, already=${!!pipLeft || leaving}]`);
    return;
  }
  leaving = true;
  try {
    await leaveNow(host, why);
  } finally {
    leaving = false;
  }
}

async function leaveNow(host: WebContents, why: string) {
  const t0 = Date.now();
  for (const tabId of pipTargets) {
    const wcId = pageForTab(tabId, host);
    if (wcId === null) continue;
    const status = await enterPip(wcId);
    debugLog(`leave (${why}): tab ${tabId} → ${status} (${Date.now() - t0}ms)`);
    if (pipPopped(status)) {
      // Switched to a little window or a Kite dialog after all? Then it wasn't an app switch.
      const f = BrowserWindow.getFocusedWindow();
      if (!isMac && f && isKiteWindow(f) && f !== mainWindow) {
        await exitPip(wcId);
        debugLog('leave: focus went to another Kite window, video returned');
        return;
      }
      pipLeft = { wcId, tabId, host };
      if (!host.isDestroyed()) host.send('pip-state', { tabId, popped: true });
      return;
    }
  }
}

/** Kite's main window is in front again: put the video back in its page. */
async function autoPipReturn(why: string) {
  const left = pipLeft;
  if (!left) return;
  pipLeft = null;
  await exitPip(left.wcId);
  debugLog(`return (${why}): tab ${left.tabId}`);
  if (!left.host.isDestroyed()) left.host.send('pip-state', { tabId: left.tabId, popped: false });
}

/** Run a script in each frame of the floating video's page; the first frame that has the video answers. */
async function runInPipPage(script: string, userGesture: boolean): Promise<unknown> {
  const pip = currentPip;
  const wc = pip ? allWebContents.fromId(pip.wcId) : null;
  if (!wc || wc.isDestroyed()) return null;
  for (const frame of wc.mainFrame.framesInSubtree) {
    try {
      const r = await frame.executeJavaScript(script, userGesture);
      if (r !== null && r !== false && r !== undefined && r !== 'none') return r;
    } catch {
      /* frame went away */
    }
  }
  return null;
}

/** Back to tab / Minimize / Show video / Close on the floating video and mini player. */
async function pipFrameAction(action: PipFrameAction) {
  testHooks?.frameActions.push(action);
  debugLog(`frame: ${action}`);
  const pip = currentPip;
  if (action === 'back') {
    const win = ensureMainWindow();
    win.show();
    win.focus();
    if (isMac) app.focus({ steal: true });
    if (pip && !pip.host.isDestroyed()) pip.host.send('focus-tab', pip.tabId);
    return;
  }
  if (action === 'minimize') {
    // The video leaves its floating window but keeps playing in its tab; the controls become the mini player.
    await runInPipPage(PIP_TO_MINI_SCRIPT, true);
    pipFrame.toMini();
    return;
  }
  if (action === 'show') {
    const st = await runInPipPage(PIP_REENTER_SCRIPT, true);
    debugLog(`frame: show video → ${String(st)}`);
    if (isMac) pipFrame.showSoon();
    return;
  }
  // close: the video goes back into its tab, paused
  pipFrame.hide('closed');
  if (!pip) return;
  await runInPipPage(PIP_CLOSE_SCRIPT, true);
  currentPip = null;
  if (pipLeft?.wcId === pip.wcId) pipLeft = null;
  if (!pip.host.isDestroyed()) pip.host.send('pip-state', { tabId: pip.tabId, popped: false });
}

/** Tests only: reach the frame window without a real floating video. */
const testHooks = process.env.KITE_TEST
  ? {
      frameActions: [] as string[],
      windowButtons: [] as { visible: boolean; x: number; y: number }[],
      pipFrame,
      /** macOS: the real floating video window, as macOS sees it. */
      inspectPip: () => inspectPipWindow(debugLog),
      /** Which tab's video is floating (or in the mini player). */
      currentPip: () => (currentPip ? { tabId: currentPip.tabId } : null),
      isMac,
      network: () => network,
      downloads: () => downloads,
      extensions: () => extensions,
      permissions: () => permissions,
      jars: () => [...jars.keys()],
    }
  : null;
if (testHooks) (globalThis as Record<string, unknown>).__kiteTest = testHooks;

// A page could try to open endless windows; allow a few per few seconds.
let littleTimes: number[] = [];
function createLittleWindow(url: string): BrowserWindow | null {
  const now = Date.now();
  littleTimes = littleTimes.filter((t) => now - t < 5000);
  if (littleTimes.length >= 4) return null;
  littleTimes.push(now);
  if (url !== 'kite://new' && !isWebUrl(url)) return null;
  const win = new BrowserWindow({
    width: 560,
    height: 700,
    minWidth: 360,
    minHeight: 320,
    title: 'Kite',
    show: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 12, y: 13 },
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#141c22' : '#e9f0ee',
    webPreferences: baseWebPreferences(),
  });
  lockKiteWindow(win);
  littleWindows.add(win);
  win.once('ready-to-show', () => present(win));
  win.loadURL(rendererUrl(`?mode=little&url=${encodeURIComponent(url)}`));
  win.on('closed', () => littleWindows.delete(win));
  return win;
}

function ensureMainWindow(): BrowserWindow {
  if (!mainWindow || mainWindow.isDestroyed()) mainWindow = createMainWindow();
  return mainWindow;
}

/** Deliver a message to the main window, waiting for it to load if needed. */
function sendToMain(channel: string, payload: unknown) {
  const win = ensureMainWindow();
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', () => win.webContents.send(channel, payload));
  else win.webContents.send(channel, payload);
}

function sendOpen(host: WebContents, req: OpenRequest) {
  // Pages may only ask Kite to open web links (never file:, data:, kite: …).
  if (!isWebUrl(req.url) || host.isDestroyed()) return;
  host.send('open-request', req);
}

/** "Save Page As…": a complete web page (HTML plus the files it needs) where you choose. */
async function savePage(wc: WebContents): Promise<string | null> {
  if (wc.isDestroyed()) return 'That page is gone.';
  const url = wc.getURL();
  if (!isWebUrl(url)) return 'Only web pages can be saved.';
  const win = BrowserWindow.fromWebContents(pages.get(wc.id)?.host ?? wc) ?? mainWindow ?? undefined;
  const title = (wc.getTitle() || basename(new URL(url).pathname) || 'page').replace(/[/\\:*?"<>|]+/g, '-').trim().slice(0, 120) || 'page';
  const opts = { defaultPath: join(app.getPath('downloads'), `${title}.html`), filters: [{ name: 'Web page, complete', extensions: ['html'] }] };
  const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
  if (res.canceled || !res.filePath) return null;
  try {
    await wc.savePage(res.filePath, 'HTMLComplete');
    return null;
  } catch (err) {
    errorLog(`save page failed: ${(err as Error).message}`);
    return `Couldn’t save the page: ${(err as Error).message}`;
  }
}

/** Put text on the clipboard. The write is asynchronous, so a failure is logged rather than left unhandled. */
function copyText(text: string) {
  void clipboard.writeText(text).catch((err) => errorLog(`copy failed: ${(err as Error).message}`));
}

/** Files Capture wrote this session: the only ones the renderer may ask to reveal. */
const captures = new Set<string>();

/**
 * Arc's Capture: a PNG of what you see, or of the whole page (taken through the page's
 * debugger so nothing has to scroll), saved to Downloads and put on the clipboard.
 */
async function capturePage(wc: WebContents, full: boolean): Promise<{ value: { path: string } } | { error: string }> {
  if (wc.isDestroyed()) return { error: 'That page is gone.' };
  if (!isWebUrl(wc.getURL())) return { error: 'Only web pages can be captured.' };
  let img: Electron.NativeImage;
  try {
    if (!full) img = await wc.capturePage();
    else {
      const dbg = wc.debugger;
      const attached = !dbg.isAttached();
      if (attached) dbg.attach('1.3');
      try {
        const m = (await dbg.sendCommand('Page.getLayoutMetrics')) as { cssContentSize?: { width: number; height: number }; contentSize?: { width: number; height: number } };
        const size = m.cssContentSize ?? m.contentSize ?? { width: 1280, height: 800 };
        // Very long pages are cut at 16k pixels: more than that and the PNG is unwieldy anyway.
        const clip = { x: 0, y: 0, width: Math.max(1, Math.ceil(size.width)), height: Math.max(1, Math.min(16384, Math.ceil(size.height))), scale: 1 };
        const r = (await dbg.sendCommand('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip })) as { data: string };
        img = nativeImage.createFromBuffer(Buffer.from(r.data, 'base64'));
      } finally {
        if (attached) {
          try {
            dbg.detach();
          } catch {
            /* already gone */
          }
        }
      }
    }
  } catch (err) {
    errorLog(`capture failed: ${(err as Error).message}`);
    return { error: `Couldn’t capture the page: ${(err as Error).message}` };
  }
  if (img.isEmpty()) return { error: 'Nothing to capture yet. Let the page finish loading.' };
  const title = (wc.getTitle() || 'page').replace(/[/\\:*?"<>|]+/g, '-').trim().slice(0, 80) || 'page';
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} at ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
  let path = join(app.getPath('downloads'), `Capture ${title} ${stamp}.png`);
  for (let n = 2; existsSync(path); n++) path = join(app.getPath('downloads'), `Capture ${title} ${stamp} (${n}).png`);
  const png = img.toPNG();
  try {
    writeFileSync(path, png);
  } catch (err) {
    return { error: `Couldn’t save the capture: ${(err as Error).message}` };
  }
  // The picture is saved by now, so a clipboard that refuses it doesn’t make the capture fail.
  try {
    await clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }) })]);
  } catch (err) {
    errorLog(`capture: couldn’t copy the picture: ${(err as Error).message}`);
  }
  captures.add(path);
  return { value: { path } };
}

/** Links to other apps (mailto:, zoommtg: …): safe ones open, anything else asks first. */
const SAFE_SCHEMES = /^(mailto|tel|sms|facetime|facetime-audio|webcal|maps|zoommtg|zoomus|msteams|slack|spotify|tg|whatsapp):/i;
async function openOutside(url: string, from: WebContents) {
  if (SAFE_SCHEMES.test(url)) return void shell.openExternal(url).catch(() => undefined);
  const scheme = url.split(':')[0];
  const win = BrowserWindow.fromWebContents(from) ?? mainWindow ?? undefined;
  const opts = {
    type: 'question' as const,
    buttons: ['Cancel', 'Open'],
    defaultId: 0,
    cancelId: 0,
    message: `Open “${scheme}:” link in another app?`,
    detail: `A page wants to open:\n${url.slice(0, 300)}\n\nOnly continue if you trust it.`,
  };
  const res = win ? await dialog.showMessageBox(win, opts) : await dialog.showMessageBox(opts);
  if (res.response === 1) shell.openExternal(url).catch(() => undefined);
}

let popupTimes: number[] = [];

/** Rules shared by web pages and the popups they open. */
function guardNavigation(contents: WebContents) {
  contents.on('will-navigate', (e, url) => {
    if (/^(https?|about|blob):/i.test(url)) return;
    if (/^file:/i.test(url) && /^file:/i.test(contents.getURL())) return; // a local file linking to another
    e.preventDefault();
    if (!/^(file|data|javascript|kite|chrome|devtools):/i.test(url)) void openOutside(url, contents);
  });
}

/** Lock down every web page shown inside a <webview>. */
function hardenWebview(contents: WebContents) {
  guardNavigation(contents);
  contents.setWindowOpenHandler((details) => {
    const page = pages.get(contents.id);
    const host = page?.host ?? mainWindow?.webContents;
    if (!isWebUrl(details.url) && details.url !== 'about:blank') return { action: 'deny' };
    // Real popups (sign-in windows etc.) need to stay popups — a few at a time.
    if (details.disposition === 'new-window' && details.features) {
      const now = Date.now();
      popupTimes = popupTimes.filter((t) => now - t < 5000);
      if (popupTimes.length >= 3) return { action: 'deny' };
      popupTimes.push(now);
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { width: 520, height: 680, autoHideMenuBar: true, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, partition: partitionOf(contents.session) } },
      };
    }
    if (host) {
      const disposition = details.disposition === 'background-tab' ? 'background-tab' : 'new-tab';
      sendOpen(host, { url: details.url, disposition, sourceTabId: page?.tabId ?? null });
    }
    return { action: 'deny' };
  });
  // Popups get the same rules, and can't open more popups themselves.
  contents.on('did-create-window', (popup) => {
    guardNavigation(popup.webContents);
    webPages.add(popup.webContents.id);
    const popupId = popup.webContents.id;
    network.watchPage(popup.webContents);
    popup.webContents.once('destroyed', () => {
      webPages.delete(popupId);
      network.forget(popupId);
    });
    popup.webContents.setWindowOpenHandler((d) => {
      const host = pages.get(contents.id)?.host ?? mainWindow?.webContents;
      if (host) sendOpen(host, { url: d.url, disposition: 'new-tab', sourceTabId: null });
      return { action: 'deny' };
    });
  });

  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const page = pages.get(contents.id);
    if (input.key === 'Escape' && page?.tabId.startsWith('peek:') && !input.meta && !input.control && !input.alt) {
      event.preventDefault();
      page.host.send('shortcut', 'closePeek');
      return;
    }
    if (!input.meta && !input.control && !input.alt) return;
    const action = findAction(
      { key: input.key, code: input.code, metaKey: input.meta, ctrlKey: input.control, altKey: input.alt, shiftKey: input.shift },
      shortcuts,
      isMac,
    );
    const host = pages.get(contents.id)?.host;
    if (action && host && !host.isDestroyed()) {
      // Let pages keep their own copy/paste/find etc. — only forward Kite actions.
      if (action === 'findInPage') return;
      event.preventDefault();
      host.send('shortcut', action);
    }
  });

  contents.on('context-menu', (_e, params) => {
    const page = pages.get(contents.id);
    const host = page?.host;
    if (!host) return;
    const items: Electron.MenuItemConstructorOptions[] = [];
    if (params.linkURL && isWebUrl(params.linkURL)) {
      const url = params.linkURL;
      items.push(
        { label: 'Open Link in New Tab', click: () => sendOpen(host, { url, disposition: 'new-tab', sourceTabId: page.tabId }) },
        { label: 'Open Link in Background', click: () => sendOpen(host, { url, disposition: 'background-tab', sourceTabId: page.tabId }) },
        { label: 'Open Link in Peek', click: () => sendOpen(host, { url, disposition: 'peek', sourceTabId: page.tabId }) },
        { label: 'Open Link in Split View', click: () => host.send('open-split', { url, sourceTabId: page.tabId }) },
        { label: 'Open Link in Little Window', click: () => createLittleWindow(url) },
        { type: 'separator' },
        { label: 'Copy Link', click: () => copyText(url) },
        { label: 'Download Linked File', click: () => downloads.downloadUrl(contents, url) },
        { type: 'separator' },
      );
    }
    if (params.selectionText) items.push({ role: 'copy' });
    if (params.isEditable) items.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' });
    if (params.mediaType === 'image' && isWebUrl(params.srcURL)) {
      items.push({ label: 'Open Image in New Tab', click: () => sendOpen(host, { url: params.srcURL, disposition: 'new-tab', sourceTabId: page.tabId }) });
      items.push({ label: 'Copy Image', click: () => contents.copyImageAt(params.x, params.y) });
      items.push({ label: 'Copy Image Address', click: () => copyText(params.srcURL) });
      items.push({ label: 'Save Image', click: () => void downloads.saveImage(contents, params.srcURL, 'original') });
      items.push({
        label: 'Save Image As',
        submenu: [
          { label: 'Original Format…', click: () => void downloads.saveImage(contents, params.srcURL, 'original', true) },
          { label: 'PNG…', click: () => void downloads.saveImage(contents, params.srcURL, 'png', true) },
          { label: 'JPEG…', click: () => void downloads.saveImage(contents, params.srcURL, 'jpeg', true) },
        ],
      });
    }
    if ((params.mediaType === 'video' || params.mediaType === 'audio') && isWebUrl(params.srcURL)) {
      const what = params.mediaType === 'video' ? 'Video' : 'Audio';
      items.push({ label: `Save ${what}`, click: () => downloads.downloadUrl(contents, params.srcURL) });
      items.push({ label: `Save ${what} As…`, click: () => downloads.downloadUrl(contents, params.srcURL, { saveAs: true }) });
      items.push({ label: `Copy ${what} Address`, click: () => copyText(params.srcURL) });
    } else if (params.mediaType === 'video' || params.mediaType === 'audio') {
      // Streamed video (no plain file address): the Downloads panel lists what can be saved.
      items.push({ label: 'Find Downloadable Video…', click: () => host.send('shortcut', 'downloadsPanel') });
    }
    if (items.length && items[items.length - 1].type !== 'separator') items.push({ type: 'separator' });
    items.push(
      { label: 'Back', enabled: contents.navigationHistory.canGoBack(), click: () => contents.navigationHistory.goBack() },
      { label: 'Forward', enabled: contents.navigationHistory.canGoForward(), click: () => contents.navigationHistory.goForward() },
      { label: 'Reload', click: () => contents.reload() },
      { type: 'separator' },
      { label: 'Boost This Site…', click: () => host.send('shortcut', 'boostEditor') },
      { label: 'Save Page As…', click: () => void savePage(contents) },
      { label: 'Print…', click: () => contents.print() },
      { type: 'separator' },
      { label: 'View Page Source', enabled: isWebUrl(contents.getURL()), click: () => host.send('shortcut', 'viewSource') },
      { label: 'Inspect Element', click: () => contents.inspectElement(params.x, params.y) },
    );
    Menu.buildFromTemplate(items).popup();
  });
}

function registerGlobalHotkey() {
  globalShortcut.unregisterAll();
  const acc = littleHotkey ? toAccelerator(littleHotkey) : null;
  if (!acc) return;
  try {
    globalShortcut.register(acc, () => createLittleWindow('kite://new'));
  } catch {
    /* hotkey taken by another app */
  }
}

function handleExternalUrl(url: string) {
  if (!isWebUrl(url)) return;
  const win = mainWindow;
  if (win && !win.isDestroyed() && !win.webContents.isLoading()) win.webContents.send('external-url', url);
  else {
    pendingExternal.push(url);
    ensureMainWindow();
  }
}

function arcDefaultPath(): string {
  return join(homedir(), 'Library', 'Application Support', 'Arc', 'StorableSidebar.json');
}

function setupIpc() {
  // Every handler checks the sender is Kite's own UI.
  const on = (ch: string, fn: (e: IpcMainEvent, ...a: never[]) => void) => ipcMain.on(ch, (e, ...a) => fromKite(e) && fn(e, ...(a as never[])));
  const handle = (ch: string, fn: (e: IpcMainInvokeEvent, ...a: never[]) => unknown) =>
    ipcMain.handle(ch, (e, ...a) => {
      if (!fromKite(e)) throw new Error('Not allowed');
      return fn(e, ...(a as never[]));
    });

  handle('state:load', () => storage.load());
  handle('state:save', (_e, json: string) => storage.saveAsync(json));
  // Used on quit, when there's no time to wait for an async reply.
  ipcMain.on('state:save-sync', (e, json: string) => {
    if (!fromKite(e)) return void (e.returnValue = false);
    try {
      storage.save(json);
      e.returnValue = true;
    } catch {
      e.returnValue = false;
    }
  });
  on('page:register', (e, id: number, tabId: string) => {
    pages.set(id, { tabId, host: e.sender });
    e.sender.send('shields-count', { tabId, count: network.count(id) });
  });
  on('page:unregister', (_e, id: number) => pages.delete(id));
  // Run Kite's helper scripts in a separate "world" the page itself can't see or tamper with.
  handle('page:exec-isolated', async (e, id: number, code: string) => {
    const page = pages.get(id);
    if (!page || page.host !== e.sender) throw new Error('Unknown page');
    const wc = allWebContents.fromId(id);
    return wc ? wc.executeJavaScriptInIsolatedWorld(1999, [{ code }]) : null;
  });
  // Picture-in-picture by hand (⌘⇧P) and on tab switches.
  handle('pip:enter', async (e, id: number) => {
    const page = pages.get(id);
    if (!page || page.host !== e.sender) return false;
    const status = await enterPip(id);
    debugLog(`enter (switch or ⌘⇧P): tab ${page.tabId} → ${status}`);
    return pipPopped(status);
  });
  handle('pip:exit', async (e, id: number) => {
    const page = pages.get(id);
    if (!page || page.host !== e.sender) return;
    if (pipLeft?.wcId === id) pipLeft = null;
    await exitPip(id);
  });
  // A page said "media paused" — but one paused video (a preview, an ad) doesn't mean
  // nothing plays any more. Check every frame.
  handle('page:media-playing', async (e, id: number) => {
    const page = pages.get(id);
    const wc = allWebContents.fromId(id);
    if (!page || page.host !== e.sender || !wc || wc.isDestroyed()) return false;
    for (const frame of wc.mainFrame.framesInSubtree) {
      try {
        if ((await frame.executeJavaScript(MEDIA_PLAYING_SCRIPT)) === true) return true;
      } catch {
        /* frame went away */
      }
    }
    return false;
  });
  // macOS: the window buttons follow the sidebar (and hide with it) instead of needing an empty band above the page.
  on('window:buttons', (e, v: { visible?: unknown; x?: unknown; y?: unknown }) => {
    if (!isMac || !mainWindow || e.sender !== mainWindow.webContents || !v) return;
    const num = (n: unknown, max: number) => Math.round(Math.max(0, Math.min(max, Number(n) || 0)));
    testHooks?.windowButtons.push({ visible: !!v.visible, x: num(v.x, 10000), y: num(v.y, 200) });
    mainWindow.setWindowButtonVisibility(!!v.visible);
    if (v.visible) mainWindow.setWindowButtonPosition({ x: num(v.x, 10000), y: num(v.y, 200) });
  });

  // ---- Shields, privacy and security ----
  // These two come from Shields' page preload inside web pages (never from Kite's UI).
  // Pages can't reach them: the preload runs in an isolated world and exposes nothing.
  const frameUrlOf = (e: IpcMainEvent | IpcMainInvokeEvent, claimed: unknown) => {
    const actual = e.senderFrame?.url ?? '';
    const url = /^https?:/i.test(actual) ? actual : typeof claimed === 'string' ? claimed : '';
    return /^https?:/i.test(url) && url.length < 8192 ? url : '';
  };
  ipcMain.on('shields:frame', (e, claimed: unknown) => {
    const url = frameUrlOf(e, claimed);
    e.returnValue = webPages.has(e.sender.id) && url ? network.frameFixes(e.sender.id, url) : null;
  });
  // A link in a page is about to be followed: warm its site's connection (see pagePreload.ts).
  ipcMain.on('page:warm', (e, url: unknown) => {
    if (!webPages.has(e.sender.id) || typeof url !== 'string' || url.length > 2048 || !/^https?:\/\//i.test(url)) return;
    network.warmLink(e.sender.id, e.sender.session, url);
  });
  ipcMain.handle('shields:dom', (e, claimed: unknown, classes: unknown, ids: unknown, hrefs: unknown) => {
    const url = frameUrlOf(e, claimed);
    const strs = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length < 512).slice(0, max) : []);
    if (!webPages.has(e.sender.id) || !url) return '';
    return network.domFixes(e.sender.id, url, strs(classes, 5000), strs(ids, 3000), strs(hrefs, 2000));
  });
  on('prefs:set', (e, p: unknown) => {
    if (!mainWindow || e.sender !== mainWindow.webContents) return;
    prefs = readPrefs(p);
    network.prefsChanged();
  });
  handle('shields:status', () => network.status());
  handle('shields:page', (e, id: number) => (pageOf(e, id) ? network.pageLog(id) : { total: 0, hosts: [] }));
  on('shields:clear-stats', () => network.clearStats());
  handle('shields:refresh', async () => {
    await network.refresh();
    return network.status();
  });
  // Home page weather widget: Open-Meteo (no key, no account). Only the place name leaves the computer.
  const weatherCache = new Map<string, { at: number; value: unknown }>();
  handle('home:weather', async (_e, place: string): Promise<Result<unknown>> => {
    const q = String(place ?? '').trim().slice(0, 80);
    if (!q) return { error: 'Type a place.' };
    const key = q.toLowerCase();
    const hit = weatherCache.get(key);
    if (hit && Date.now() - hit.at < 30 * 60_000) return { value: hit.value };
    try {
      const geo = (await (await net.fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`)).json()) as { results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[] };
      const g = geo.results?.[0];
      if (!g) return { error: `Couldn’t find “${q}”.` };
      const f = (await (
        await net.fetch(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=5&timezone=auto`)
      ).json()) as { current: { temperature_2m: number; weather_code: number; wind_speed_10m: number }; daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; weather_code: number[] } };
      const value = {
        place: [g.name, g.admin1 && g.admin1 !== g.name ? g.admin1 : '', g.country].filter(Boolean).join(', '),
        current: { temp: Math.round(f.current.temperature_2m), code: f.current.weather_code, wind: Math.round(f.current.wind_speed_10m) },
        daily: f.daily.time.map((date, i) => ({ date, max: Math.round(f.daily.temperature_2m_max[i]), min: Math.round(f.daily.temperature_2m_min[i]), code: f.daily.weather_code[i] })),
        fetchedAt: Date.now(),
      };
      weatherCache.set(key, { at: Date.now(), value });
      if (weatherCache.size > 50) weatherCache.delete(weatherCache.keys().next().value!);
      return { value };
    } catch (err) {
      return { error: `Couldn’t reach the weather service: ${(err as Error).message}` };
    }
  });
  // An icon's pixels, so the sidebar can tell whether it would vanish on the shell (a black
  // mark on a dark sidebar) and give it a plate. The page's own icon usually can't be read
  // from the UI (sites don't share it), so it is fetched here, small and bounded, through the
  // app's own session (no site cookies), and handed back as a 16px PNG.
  const iconPixelCache = new Map<string, Promise<string | null>>();
  handle('icon:pixels', (_e, url: string): Promise<string | null> => {
    if (typeof url !== 'string' || !isWebUrl(url) || url.length > 2048) return Promise.resolve(null);
    let p = iconPixelCache.get(url);
    if (!p) {
      p = (async () => {
        const stop = new AbortController();
        const timer = setTimeout(() => stop.abort(), 5000);
        try {
          const res = await net.fetch(url, { headers: browserHeaders('image'), signal: stop.signal, redirect: 'follow' });
          const type = res.headers.get('content-type') ?? '';
          if (!res.ok || !/^image\//i.test(type)) return null;
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length === 0 || buf.length > 512 * 1024) return null;
          // SVG: the UI draws it itself (it holds no scripts when used as an image).
          if (/svg/i.test(type)) return `data:image/svg+xml;base64,${buf.toString('base64')}`;
          const img = nativeImage.createFromBuffer(buf);
          return img.isEmpty() ? null : img.resize({ width: 16, height: 16, quality: 'good' }).toDataURL();
        } catch {
          return null;
        } finally {
          clearTimeout(timer);
        }
      })();
      iconPixelCache.set(url, p);
      if (iconPixelCache.size > 500) iconPixelCache.delete(iconPixelCache.keys().next().value as string);
    }
    return p;
  });
  // A site's icon when no page has reported one (a shortcut typed by hand, a search engine):
  // read the <link rel="icon"> from its home page, else its /favicon.ico if that is an image.
  // Only the site itself is contacted, through the app's own session (no site cookies there).
  const siteIconCache = new Map<string, Promise<string | null>>();
  handle('site:icon', (_e, url: string): Promise<string | null> => {
    if (typeof url !== 'string' || !isWebUrl(url) || url.length > 2048) return Promise.resolve(null);
    let origin: string;
    try {
      origin = new URL(url).origin;
    } catch {
      return Promise.resolve(null);
    }
    let p = siteIconCache.get(origin);
    if (!p) {
      p = findSiteIcon(origin);
      siteIconCache.set(origin, p);
      if (siteIconCache.size > 500) siteIconCache.delete(siteIconCache.keys().next().value!);
    }
    return p;
  });
  on('net:allow-http', (_e, host: string) => typeof host === 'string' && /^[a-z0-9.-]{1,253}$/i.test(host) && network.allowHttp(host));
  // While you type an address, its connection opens, so Enter has less to wait for.
  const preconnected = new Map<string, number>();
  on('net:preconnect', (_e, url: string, partition: string) => {
    if (typeof url !== 'string' || !isWebUrl(url) || url.length > 2048) return;
    const ses = ensureJar(isKitePartition(partition) ? partition : PARTITION);
    let origin = '';
    try {
      origin = new URL(url).origin;
    } catch {
      return;
    }
    // Once per origin per few seconds: typing letter by letter must not open a socket each keystroke.
    const now = Date.now();
    if ((preconnected.get(origin) ?? 0) > now - 10_000) return;
    preconnected.set(origin, now);
    if (preconnected.size > 200) preconnected.delete(preconnected.keys().next().value!);
    network.preconnect(ses, origin);
  });
  handle('permissions:list', () => permissions.list());
  on('permissions:forget', (_e, site?: string, permission?: string) => permissions.forget(typeof site === 'string' ? site : undefined, typeof permission === 'string' ? permission : undefined));
  handle('privacy:clear', (_e, what: ClearWhat, site?: string) => clearData({ cookies: !!what?.cookies, cache: !!what?.cache, storage: !!what?.storage }, typeof site === 'string' ? site : undefined));

  // ---- Downloads ----
  /** The page behind a webContents id, if it belongs to the window that asks. */
  const pageOf = (e: IpcMainEvent | IpcMainInvokeEvent, id: number) => {
    const page = pages.get(id);
    const wc = allWebContents.fromId(id);
    return page && page.host === e.sender && wc && !wc.isDestroyed() ? wc : null;
  };
  handle('downloads:list', () => downloads.list());
  handle('downloads:link', (_e, url: string, partition: string) => {
    if (typeof url !== 'string' || !isWebUrl(url) || url.length > 4096) return 'That isn’t a web address.';
    downloads.downloadLink(ensureJar(typeof partition === 'string' && jars.has(partition) ? partition : PARTITION), url);
    return null;
  });
  handle('downloads:act', (_e, action: string, id?: string) =>
    ['pause', 'resume', 'cancel', 'open', 'reveal', 'remove', 'clear', 'retry'].includes(action) ? downloads.act(action as 'pause', typeof id === 'string' ? id : undefined) : null,
  );
  handle('media:list', async (e, id: number) => {
    const wc = pageOf(e, id);
    if (!wc) return [];
    const found = new Map(network.media(id).map((m) => [m.url, m]));
    // Plain video/audio files on the page that haven't started loading yet.
    for (const frame of wc.mainFrame.framesInSubtree) {
      try {
        const list = (await frame.executeJavaScript(
          `[...document.querySelectorAll('video,audio')].flatMap((m) => [m.currentSrc, ...[...m.querySelectorAll('source')].map((s) => s.src)].filter((u) => /^https?:/.test(u || '')).map((u) => ({ url: u, audio: m.tagName === 'AUDIO' }))).slice(0, 20)`,
        )) as { url: string; audio: boolean }[];
        for (const m of list) {
          if (found.has(m.url)) continue;
          const stream = /\.m3u8(\?|$)/i.test(m.url);
          found.set(m.url, { url: m.url, kind: stream ? 'stream' : m.audio ? 'audio' : 'video', mime: '', size: 0, label: m.url.split('/').pop()?.split('?')[0] || 'media' });
        }
      } catch {
        /* frame went away */
      }
    }
    return [...found.values()];
  });
  on('media:download', (e, id: number, url: string) => {
    const wc = pageOf(e, id);
    if (wc && isWebUrl(url)) downloads.downloadUrl(wc, url);
  });
  handle('media:hls-variants', async (e, id: number, url: string): Promise<Result<unknown>> => {
    const wc = pageOf(e, id);
    if (!wc || !isWebUrl(url)) return { error: 'That page is gone.' };
    try {
      return { value: await downloads.hlsVariants(wc.session, url, wc.getURL()) };
    } catch (err) {
      return { error: (err as Error).message };
    }
  });
  on('media:hls-download', (e, id: number, url: string, title: string) => {
    const wc = pageOf(e, id);
    if (wc && isWebUrl(url)) void downloads.downloadHls(wc, url, String(title ?? '').slice(0, 120));
  });

  // ---- Chrome extensions ----
  const attempt = async <T,>(fn: () => T | Promise<T>): Promise<Result<T>> => {
    try {
      return { value: await fn() };
    } catch (err) {
      return { error: (err as Error).message || 'Something went wrong.' };
    }
  };
  handle('ext:list', () => extensions.list());
  handle('ext:pick', async (e, kind: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)!;
    const res = await dialog.showOpenDialog(
      win,
      kind === 'folder'
        ? { title: 'Choose an unpacked extension folder', properties: ['openDirectory'] }
        : { title: 'Choose an extension file', properties: ['openFile'], filters: [{ name: 'Chrome extension', extensions: ['crx', 'zip'] }] },
    );
    if (res.canceled || !res.filePaths[0]) return { value: null };
    return attempt(() => (kind === 'folder' ? extensions.previewFolder(res.filePaths[0]) : extensions.previewFile(res.filePaths[0])));
  });
  handle('ext:store', (_e, input: string) => attempt(() => extensions.previewStore(String(input ?? ''))));
  handle('ext:confirm', (_e, token: string) => attempt(async () => (await extensions.confirm(String(token)), true as const)));
  on('ext:cancel', (_e, token: string) => extensions.cancel(String(token)));
  handle('ext:enable', (_e, id: string, enabled: boolean) => extensions.setEnabled(String(id), !!enabled));
  handle('ext:remove', (_e, id: string) => extensions.remove(String(id)));
  handle('ext:open', (_e, id: string, which: string) => extensions.openPage(String(id), which === 'options' ? 'options' : 'popup'));
  on('debug:log', (_e, msg: string) => typeof msg === 'string' && debugLog(msg.slice(0, 500)));
  // Buttons on Kite's frame around the floating video.
  // Play/pause, seek (drag the slider), skip 10 seconds.
  on('pip-frame:media', (e, cmd: unknown) => {
    if (!pipFrame.isFrameWindow(BrowserWindow.fromWebContents(e.sender)) || !isPipMediaCommand(cmd)) return;
    if (cmd.cmd === 'mute') return void toggleFloatingMute().then(() => pipFrame.refresh());
    void runInPipPage(pipMediaScript(cmd), true).then(() => pipFrame.refresh());
  });
  // Drag on the video: move the floating window; drag an edge or corner: resize it.
  on('pip-frame:drag', (e, phase: unknown, edge: unknown) => {
    if (!pipFrame.isFrameWindow(BrowserWindow.fromWebContents(e.sender))) return;
    if (phase === 'start') pipFrame.startDrag(RESIZE_EDGES.includes(edge as ResizeEdge) ? (edge as ResizeEdge) : 'move');
    else pipFrame.endDrag();
  });
  on('pip-frame:action', (e, action: PipFrameAction) => {
    if (!pipFrame.isFrameWindow(BrowserWindow.fromWebContents(e.sender)) || !PIP_FRAME_ACTIONS.includes(action)) return;
    void pipFrameAction(action);
  });
  // Which tabs to pop out if you switch apps — kept up to date by the main window.
  on('pip:targets', (e, tabIds: string[]) => {
    if (!mainWindow || e.sender !== mainWindow.webContents || !Array.isArray(tabIds)) return;
    pipTargets = tabIds.filter((t) => typeof t === 'string').slice(0, 4);
    pipTargetsHost = e.sender;
  });
  on('shortcuts:set', (_e, map: Record<string, string>, hotkey: string) => {
    const changed = JSON.stringify(map) !== JSON.stringify(shortcuts);
    shortcuts = map;
    if (changed) buildAppMenu();
    if (hotkey !== littleHotkey) {
      littleHotkey = hotkey;
      registerGlobalHotkey();
    }
  });
  on('little:open', (_e, url: string) => void createLittleWindow(url));
  on('little:to-main', (e, url: string, spaceId: string | null) => {
    if (!isWebUrl(url)) return;
    sendToMain('little-to-main', { url, spaceId });
    const win = ensureMainWindow();
    win.show();
    win.focus();
    BrowserWindow.fromWebContents(e.sender)?.close();
  });
  on('little:archive', (_e, url: string, title: string) => {
    if (isWebUrl(url)) sendToMain('little-archived', { url, title: String(title).slice(0, 300) });
  });
  handle('arc:pick', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
    const res = await dialog.showOpenDialog(win!, {
      title: 'Choose StorableSidebar.json',
      defaultPath: existsSync(arcDefaultPath()) ? arcDefaultPath() : homedir(),
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    return { path: res.filePaths[0], text: readFileSync(res.filePaths[0], 'utf8') };
  });
  handle('arc:read-default', () => {
    const p = arcDefaultPath();
    if (!existsSync(p)) return null;
    return { path: p, text: readFileSync(p, 'utf8') };
  });
  handle('browser:set-default', () => app.setAsDefaultProtocolClient('http') && app.setAsDefaultProtocolClient('https'));
  handle('browser:is-default', () => app.isDefaultProtocolClient('https'));
  handle('app:info', (): AppInfo => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    dataDir: app.getPath('userData'),
    packaged: app.isPackaged,
  }));
  on('app:reveal-data', () => shell.showItemInFolder(storage.file));
  // Updates: the UI asks (once a day when the setting is on, or from "Check now") and opens
  // the installer's page; only links to a GitHub release are ever opened.
  // Test runs never call out to GitHub.
  handle('update:check', () => (process.env.KITE_TEST ? { value: null } : checkForUpdate()));
  on('update:open', (_e, url: string) => {
    if (typeof url === 'string' && isUpdateUrl(url)) void shell.openExternal(url).catch(() => undefined);
  });
  on('page:print', (e, id: number) => pageOf(e, id)?.print());
  // "View Page Source": the HTML as the server sent it (not the live DOM), through the Space's cookie jar.
  handle('page:source', async (_e, url: string, partition: string): Promise<Result<{ text: string; status: number; contentType: string; truncated: boolean }>> => {
    if (typeof url !== 'string' || !isWebUrl(url) || url.length > 8192) return { error: 'Only web pages have source to show.' };
    const ses = ensureJar(isKitePartition(partition) ? partition : PARTITION);
    const MAX = 4 * 1024 * 1024;
    try {
      const res = await ses.fetch(url, { headers: { Accept: 'text/html,*/*;q=0.8' }, redirect: 'follow' });
      const buf = Buffer.from(await res.arrayBuffer());
      const truncated = buf.length > MAX;
      return { value: { text: buf.subarray(0, MAX).toString('utf8'), status: res.status, contentType: res.headers.get('content-type') ?? '', truncated } };
    } catch (err) {
      return { error: `Couldn’t fetch the page: ${(err as Error).message}` };
    }
  });
  handle('page:save', (e, id: number) => {
    const wc = pageOf(e, id);
    return wc ? savePage(wc) : 'That page is gone.';
  });
  handle('page:capture', (e, id: number, full: boolean) => {
    const wc = pageOf(e, id);
    return wc ? capturePage(wc, !!full) : { error: 'That page is gone.' };
  });
  on('capture:reveal', (_e, path: string) => {
    if (typeof path === 'string' && captures.has(path)) shell.showItemInFolder(path);
  });
  // The user picks where the file goes in a Save dialog; the name is only a suggestion.
  handle('file:export', async (e, name: string, text: string) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
    const safeName = String(name).replace(/[/\\:*?"<>|]+/g, '-').slice(0, 120) || 'kite-export.txt';
    const res = await dialog.showSaveDialog(win!, { defaultPath: join(app.getPath('downloads'), safeName) });
    if (res.canceled || !res.filePath) return false;
    writeFileSync(res.filePath, String(text), 'utf8');
    return true;
  });
}

/**
 * The menu bar: every Kite action, with its shortcut shown beside it.
 *
 * Keys are handled by Kite's own window (and forwarded from pages), so the menu shows
 * the shortcuts without registering them (macOS); elsewhere the menu bar is hidden
 * and only its items are used. Rebuilt whenever shortcuts change.
 */
function buildAppMenu() {
  const send = (action: string) => () => {
    const w = BrowserWindow.getFocusedWindow() ?? mainWindow;
    w?.webContents.send('shortcut', action);
  };
  const keyOf = (action: string): Partial<Electron.MenuItemConstructorOptions> => {
    const combo = shortcuts[action] ?? DEFAULT_SHORTCUTS[action] ?? '';
    const acc = combo ? toAccelerator(combo) : null;
    // macOS: shown, not registered (the window handles keys). Other systems: no menu accelerators at all.
    return isMac && acc ? { accelerator: acc, registerAccelerator: false } : {};
  };
  const item = (label: string, action: string, extra: Partial<Electron.MenuItemConstructorOptions> = {}): Electron.MenuItemConstructorOptions => ({ label, click: send(action), ...keyOf(action), ...extra });
  const sep = (): Electron.MenuItemConstructorOptions => ({ type: 'separator' });
  const pageDevTools = () => {
    const host = BrowserWindow.getFocusedWindow() ?? mainWindow;
    if (!host) return;
    // The page shown in the focused window: the most recently focused webview it hosts.
    const guest = [...pages].filter(([, p]) => p.host === host.webContents).map(([id]) => allWebContents.fromId(id)).filter((w): w is WebContents => !!w && !w.isDestroyed() && w.isFocused())[0]
      ?? [...pages].filter(([, p]) => p.host === host.webContents).map(([id]) => allWebContents.fromId(id)).filter((w): w is WebContents => !!w && !w.isDestroyed()).pop();
    guest?.toggleDevTools();
  };
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
            sep(),
            item('Settings…', 'settings'),
            sep(),
            { role: 'services' as const },
            sep(),
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            sep(),
            { role: 'quit' as const },
          ],
        }]
      : []),
    {
      label: 'File',
      submenu: [
        item('New Tab…', 'commandBar'),
        item('New Little Window', 'littleWindow', { click: () => void createLittleWindow('kite://new') }),
        item('New Note', 'newNote'),
        item('New Folder', 'newFolder'),
        item('New Space', 'newSpace'),
        sep(),
        item('Open Address…', 'editUrl'),
        item('Reopen Closed Tab', 'reopenClosed'),
        item('Close Tab', 'closeTab'),
        sep(),
        item('Save Page As…', 'savePage'),
        item('Print Page…', 'print'),
        sep(),
        item('Import from Arc…', 'importArc'),
        item('Set as Default Browser', 'setDefaultBrowser'),
        sep(),
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, sep(),
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'pasteAndMatchStyle' }, { role: 'delete' }, { role: 'selectAll' },
        sep(),
        item('Find in Page…', 'findInPage'),
        item('Copy URL', 'copyUrl'),
        item('Copy URL as Markdown', 'copyMarkdown'),
        ...(isMac ? [sep(), { role: 'startSpeaking' as const }, { role: 'stopSpeaking' as const }] : []),
      ],
    },
    {
      label: 'View',
      submenu: [
        item('Reload Page', 'reload'),
        item('Force Refresh the Page', 'hardReload'),
        item('Stop Loading', 'stopLoading'),
        item('Clear Cookies and Refresh', 'clearCookiesRefresh'),
        item('Clear Cache and Refresh', 'clearCacheRefresh'),
        sep(),
        { label: 'Capture', submenu: [item('Capture', 'capture'), item('Capture Full Page', 'captureFull')] },
        sep(),
        item('Zoom In', 'zoomIn'),
        item('Zoom Out', 'zoomOut'),
        item('Zoom to Actual Size', 'zoomReset'),
        sep(),
        item('Toggle Light / Dark Mode', 'toggleTheme'),
        item('Show / Hide Sidebar', 'toggleSidebar'),
        item('Add Split View', 'newSplit'),
        item('Separate Split View', 'unsplit'),
        sep(),
        item('Pop Out Video', 'popOutVideo'),
        item('Mute / Unmute Tab', 'toggleMute'),
        sep(),
        { role: 'togglefullscreen' },
        sep(),
        item('View Source', 'viewSource'),
        { label: 'Developer Tools', accelerator: isMac ? 'Alt+Command+I' : 'Ctrl+Shift+I', click: pageDevTools },
        { label: 'Developer Tools for Kite Itself', accelerator: 'Alt+CommandOrControl+Shift+I', click: () => BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools() },
      ],
    },
    {
      label: 'History',
      submenu: [
        item('Go Back', 'back'),
        item('Go Forward', 'forward'),
        sep(),
        item('View History', 'historyPage'),
        item('View Archive', 'archivePage'),
        item('View Downloads', 'downloadsPanel'),
      ],
    },
    {
      label: 'Tabs',
      submenu: [
        item('Pin / Unpin Tab', 'togglePin'),
        item('Add to Favorites', 'addFavorite'),
        item('Rename Current Item', 'renameCurrent'),
        item('Reset Tab to Original URL', 'resetToHome'),
        item('Reset All Tabs in This Space', 'resetSpaceTabs'),
        item('Clear Unpinned Tabs', 'clearToday'),
        item('Collapse / Expand Pinned Section', 'togglePinnedSection'),
        sep(),
        item('Next Tab', 'nextTab'),
        item('Previous Tab', 'prevTab'),
        sep(),
        item('Next Space', 'nextSpace'),
        item('Previous Space', 'prevSpace'),
        sep(),
        item('Put Other Tabs to Sleep', 'sleepOthers'),
        item('Mute All Tabs', 'muteAll'),
        item('Unmute All Tabs', 'unmuteAll'),
      ],
    },
    {
      label: 'Tools',
      submenu: [
        item('Boost This Site…', 'boostEditor'),
        item('Boosts', 'boostsPanel'),
        item('Extensions', 'extensionsPanel'),
        item('Link Routing', 'routingPanel'),
        sep(),
        item('Turn Shields On / Off', 'toggleShields'),
        item('Privacy & Security', 'privacyPanel'),
        ...(isMac ? [] : [sep(), item('Settings…', 'settings')]),
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        item('Keyboard Shortcuts', 'shortcutsPanel'),
        { label: 'Check for Updates…', click: () => void checkForUpdatesFromMenu() },
        { label: 'Copy Kite Info', click: () => copyText(`Kite ${app.getVersion()} · Electron ${process.versions.electron} · Chromium ${process.versions.chrome} · ${process.platform} ${process.arch}`) },
        { label: 'Reveal Kite Data', click: () => shell.showItemInFolder(storage.file) },
        { label: 'Show Error Log', click: () => { const f = join(app.getPath('userData'), 'kite-errors.log'); if (existsSync(f)) shell.showItemInFolder(f); else void dialog.showMessageBox({ type: 'info', message: 'No errors have been logged.', detail: 'Kite writes crashes and unexpected problems to kite-errors.log in its data folder.' }); } },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/** Help → Check for Updates…: ask now and say what was found, whatever the daily setting is. */
async function checkForUpdatesFromMenu() {
  const found = await checkForUpdate();
  if (found.error) return void dialog.showMessageBox({ type: 'warning', message: 'Couldn’t check for updates', detail: found.error });
  const update = found.value;
  if (!update) return void dialog.showMessageBox({ type: 'info', message: 'Kite is up to date', detail: `You have Kite ${app.getVersion()}, the newest version.` });
  const res = await dialog.showMessageBox({
    type: 'info',
    message: `Kite ${update.version} is available`,
    detail: `You have ${app.getVersion()}.${update.notes ? `\n\n${update.notes}` : ''}`,
    buttons: ['Download', 'Later'],
    defaultId: 0,
    cancelId: 1,
  });
  if (res.response === 0) void shell.openExternal(update.downloadUrl ?? update.pageUrl).catch(() => undefined);
}

// ---- app lifecycle -------------------------------------------------------

const gotLock = process.env.KITE_TEST ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const url = argv.find((a) => isWebUrl(a));
    if (url) handleExternalUrl(url);
    else ensureMainWindow().focus();
  });

  // macOS sends links from other apps here (when Kite is the default browser).
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (app.isReady()) handleExternalUrl(url);
    else if (isWebUrl(url)) pendingExternal.push(url);
  });

  app.on('web-contents-created', (_e, contents) => {
    if (contents.getType() === 'webview') {
      hardenWebview(contents);
      const wcId = contents.id;
      webPages.add(wcId);
      network.watchPage(contents);
      contents.once('destroyed', () => {
        webPages.delete(wcId);
        network.forget(wcId);
      });
      // Remember when videos last played, so a video the system pauses as you
      // switch apps can still pop out (see MEDIA_TRACKER_SCRIPT).
      contents.on('media-started-playing', () => {
        for (const frame of contents.mainFrame.framesInSubtree) frame.executeJavaScript(MEDIA_TRACKER_SCRIPT).catch(() => undefined);
      });
    }
    contents.on('will-attach-webview', (_ev, prefs, params) => {
      // Web pages never get Node or Kite's preload, and always use Kite's own session.
      delete prefs.preload;
      prefs.nodeIntegration = false;
      prefs.contextIsolation = true;
      prefs.sandbox = true;
      prefs.webSecurity = true;
      prefs.allowRunningInsecureContent = false;
      // Pages may only use Kite's own cookie jars: the shared one, or an isolated Space's.
      params.partition = isKitePartition(params.partition) ? params.partition : PARTITION;
      ensureJar(params.partition);
      if (!/^(https?|about|file):/i.test(params.src || 'about:blank')) params.src = 'about:blank';
    });
  });

  app.whenReady().then(() => {
    storage = new Storage(app.getPath('userData'));
    storage.snapshot(); // a dated copy per day, kept for a week
    const savedState = storage.load();
    prefs = readPrefs((savedState as { settings?: unknown } | null)?.settings);
    removeOrphanJars(savedState);
    setupFeatures();
    ensureJar(PARTITION);
    network.prefsChanged();
    setupIpc();
    buildAppMenu();
    // macOS: floating videos become panels, so they show over other apps (even full-screen ones).
    if (isMac) installVideoPanelHooks(debugLog);
    const argUrl = process.argv.find((a) => isWebUrl(a));
    if (argUrl) pendingExternal.push(argUrl);
    mainWindow = createMainWindow();
    app.on('activate', () => ensureMainWindow());
    // macOS only (other systems never send these; tests send them by hand).
    app.on('did-resign-active', () => {
      // A video the site popped out by itself (its own button) gets the same treatment.
      floatPipWindowsSoon(debugLog, 'app inactive');
      if (isMac) pipFrame.showSoon(); // also frames a video the site popped out itself
      void autoPipOnLeave('app inactive');
    });
    app.on('did-become-active', () => debugLog('app active again'));
  });

  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  // A helper process (GPU, network, a page's renderer) died: note it; Chromium restarts most of them.
  app.on('child-process-gone', (_e, d) => errorLog(`${d.type} process gone: ${d.reason}${d.name ? ` (${d.name})` : ''} exit ${d.exitCode}`));
  app.on('render-process-gone', (_e, wc, d) => {
    if (d.reason !== 'clean-exit' && !wc.isDestroyed()) errorLog(`page process gone: ${d.reason} at ${wc.getURL().slice(0, 200)}`);
  });
  process.on('uncaughtException', (err) => errorLog(`uncaught: ${err?.stack ?? err}`));
  process.on('unhandledRejection', (err) => errorLog(`unhandled rejection: ${(err as Error)?.stack ?? String(err)}`));
}

/** The icon a site declares on its home page, else its /favicon.ico when that is really an image; null when it has neither. */
async function findSiteIcon(origin: string): Promise<string | null> {
  // Some sites answer only a browser-looking request; the apex host sometimes stalls where www answers.
  const u = new URL(origin);
  const alt = new URL(origin);
  alt.hostname = u.hostname.startsWith('www.') ? u.hostname.slice(4) : `www.${u.hostname}`;
  // Both at once: the first that answers wins, so a stalled apex host does not hold things up.
  return new Promise((resolve) => {
    let pending = 2;
    for (const o of [u.origin, alt.origin]) {
      siteIconAt(o)
        .catch(() => null)
        .then((found) => {
          if (found) resolve(found);
          else if (--pending === 0) resolve(null);
        });
    }
  });
}

/** Looks like a page request from this browser, so sites answer the way they do for a tab. */
function browserHeaders(kind: 'page' | 'image'): Record<string, string> {
  return {
    accept: kind === 'page' ? 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' : 'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
    'accept-language': `${app.getLocale() || 'en-US'},en;q=0.8`,
    'user-agent': app.userAgentFallback.replace(/\s(?:Kite|kite-browser|Electron)\/\S+/g, ''),
  };
}

async function siteIconAt(origin: string): Promise<string | null> {
  const withTimeout = (ms: number) => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    return { signal: c.signal, done: () => clearTimeout(t) };
  };
  try {
    const t = withTimeout(6000);
    const res = await net.fetch(origin + '/', { headers: browserHeaders('page'), signal: t.signal, redirect: 'follow' });
    if (res.ok && res.body && /text\/html/i.test(res.headers.get('content-type') ?? '')) {
      // Only the head matters, and the first chunks hold it: read up to 128KB.
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let html = '';
      while (html.length < 131072) {
        const { value, done } = await reader.read();
        if (done) break;
        html += dec.decode(value, { stream: true });
        if (/<\/head>/i.test(html) || /<body[\s>]/i.test(html)) break;
      }
      void reader.cancel().catch(() => {});
      t.done();
      const found = iconFromHtml(html, res.url || origin + '/');
      if (found) return found;
    } else {
      t.done();
      void res.body?.cancel().catch(() => {});
    }
  } catch {
    /* unreachable or odd: try the plain favicon below */
  }
  try {
    const t = withTimeout(5000);
    const res = await net.fetch(origin + '/favicon.ico', { headers: browserHeaders('image'), signal: t.signal, redirect: 'follow' });
    t.done();
    const type = res.headers.get('content-type') ?? '';
    const len = Number(res.headers.get('content-length') ?? '1');
    void res.body?.cancel().catch(() => {});
    if (res.ok && /^image\//i.test(type) && len > 0) return res.url || origin + '/favicon.ico';
  } catch {
    /* no icon */
  }
  return null;
}
