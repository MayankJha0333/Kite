# Kite: Electron 38.8.6 -> 45.x upgrade plan

Written 2026-11-25. Read-only research: nothing in the repo was changed and nothing was installed.

How to read the confidence marks:

- **[verified]** = read in a primary source (Electron's `docs/breaking-changes.md`, the v39-v45 GitHub release notes, `releases.electronjs.org` JSON, the `electron@45.5.0` npm tarball, Electron/Chromium source at the release tags, the castlabs repo and wiki, package tarballs) or checked mechanically against Kite's code.
- **[unverified]** = inferred, or from a secondary source, or needs a real run under Electron 45. Nothing was launched under Electron 45.

One mechanical check carries most of the weight below: the current working tree was type-checked against `electron@45.5.0`'s own `electron.d.ts` (a scratch tsconfig with a `paths` override; baseline against 38.8.6 is clean). Result: **exactly 4 errors**, listed in section 4.

---

## 1. Recommended target

**Electron 45.5.x (pin `~45.5.0`, take the newest 45 patch on the day).**

| Line | Latest | First stable | Stable releases so far | Chromium | Node | EOL | Status |
|---|---|---|---|---|---|---|---|
| 47 | nightly | 2027-03-02 (planned) | - | 164 | 26.13 | 2027-08-17 | nightly |
| 46 | 46.0.0-alpha.13 | 2027-01-05 (planned) | - | 160 | 26.13 | 2027-06-22 | prerelease |
| **45** | **45.5.0** (2026-11-24) | 2026-10-21 | 13 | 156 | 24.22 | 2027-04-27 | **supported (latest)** |
| 44 | 44.11.6 (2026-11-24) | 2026-08-24 | 32 | 152 | 24.22 | 2027-03-02 | supported |
| 43 | 43.8.13 (2026-11-24) | 2026-06-30 | 36 | 150 | 24.22 | 2027-01-05 | supported (security fixes only) |
| 42 and older | - | - | - | - | - | passed | EOL |
| 38 (Kite today) | 38.8.6 (2026-03-10) | 2025-09-02 | 19 | 140 | 22.22 | 2026-03-10 | **EOL for 8 months** |

Source: `releases.electronjs.org/releases.json` and `/schedule.json`; policy "latest three stable majors" from `docs/tutorial/electron-timelines.md`. [verified]

Why 45 and not 44:

- 45 is five weeks old and already on its 13th stable release, so it is past the ".0" stage.
- Every breaking change that actually hits Kite landed in 43 or 44 (see section 3). Stopping at 44 saves no work.
- 45 has the longest remaining support (to 2027-04-27) and, as the newest line, gets every fix from `main`; 44 gets "most", 43 only security fixes.
- 45 carries a batch of `<webview>` fixes Kite benefits from (findInPage hang with iframes, Esc hang in fullscreen webview, "Invalid guestInstanceId" on removal, zoom limits in webviews). [verified, v45.0.0 release notes]

Do not wait for 46: it lands 2027-01-05 with Node 26 and three more behaviour changes (section 9). Plan it as a separate, small follow-up.

If Widevine is wanted, the target becomes castlabs `v45.2.1+wvcus` instead (section 10), which trails upstream patches.

---

## 2. Version matrix, 38 -> 45

| Electron | Chromium (first -> latest) | Node (first -> latest) | V8 | Module ABI | macOS min | Windows | Linux |
|---|---|---|---|---|---|---|---|
| 38 | 140.0.7339.41 -> .249 | 22.18.0 -> 22.22.0 | 14.0 | 139 | 12 | 10+, ia32/x64/arm64 | x64/arm64/armv7l |
| 39 | 142.0.7444.52 -> .265 | 22.20.0 -> 22.22.1 | 14.2 | 140 | 12 | same | same |
| 40 | 144.0.7559.60 -> .236 | 24.11.1 -> 24.15.0 | 14.4 | 143 | 12 | same | same |
| 41 | 146.0.7680.65 -> .216 | 24.14.0 -> 24.18.0 | 14.6 | 145 | 12 | same | same |
| 42 | 148.0.7778.96 -> .280 | 24.15.0 -> 24.19.0 | 14.8 | 146 | 12 | same | same |
| 43 | 150.0.7871.46 -> .250 | 24.17.0 -> 24.22.3 | 15.0 | 148 | 12 | last line with ia32 | last line with armv7l |
| 44 | 152.0.7977.54 -> .169 | 24.18.1 -> 24.22.3 | 15.2 | 149 | **13** | 10+, x64/arm64 only | x64/arm64 only |
| 45 | 156.0.8078.48 -> .109 | 24.22.0 -> 24.22.3 | 15.6 | 150 | **13** | 10+, x64/arm64 | x64/arm64 |

[verified: releases.json, breaking-changes.md, README at v38.8.6 and v45.5.0]

- Linux policy since 44/45: "major distributions in versions still supported by both Chromium and the distro maker"; binaries are built on Ubuntu. Chrome's requirements page currently lists Ubuntu 18.04+, Debian 10+, openSUSE 15.5+, Fedora 39+; Windows on ARM needs Windows 11. [unverified: read through a summarising fetch]
- The `electron` npm package itself now needs host Node >= 22.12.0 and depends on `@types/node ^24.9.0`. [verified, package.json in the tarball]
- Chromium 156 is built with Xcode 26.6 / macOS 26.5 SDK; Chromium 140 used Xcode 16.4 / macOS 15.5 SDK (`build/mac_toolchain.py` at both tags). [verified for Chromium; **unverified** that Electron's own builders use the same SDK]
- This machine runs macOS 27.2.1. Electron 38's last release predates macOS 27.

---

## 3. Every breaking change 39 -> 45, against Kite's code

"Affected" means a change is needed or behaviour visibly changes. Line numbers are for the current working tree.

### 39.0

| Change | Kite affected? | Where | Action |
|---|---|---|---|
| Deprecated `--host-rules` switch | No. Kite appends no command-line switches (no `appendSwitch` anywhere in `src/main`). | - | none |
| `window.open` popups always resizable | Harmless. Sign-in popups become resizable. | `src/main/main.ts:703` | none |
| `NSAudioCaptureUsageDescription` needed for `desktopCapturer` (macOS 14.2+) | No. `desktopCapturer` and `setDisplayMediaRequestHandler` are not used anywhere. | - | add the key to `package.json` `build.mac.extendInfo` only if screen sharing is ever built |
| Shared-texture OSR `paint` shape | No (no offscreen rendering) | - | none |

### 40.0

| Change | Kite affected? | Where | Action |
|---|---|---|---|
| `clipboard` in renderer deprecated (removed in 44) | No. The renderer only uses `navigator.clipboard` (`commands.ts:267,347`, `itemMenus.ts:132`, `Settings.tsx:772`, `SourceView.tsx:48`, `Peek.tsx:74`, `Downloads.tsx:38`); `preload.ts` exposes no clipboard. | - | none |
| macOS dSYM now `tar.xz` | No | - | none |
| Node 22 -> 24 in the main process (stack change, not listed as breaking) | Low. Main, worker and adblocker code are plain JS bundled by esbuild. | `scripts/build-main.mjs:7` | bump esbuild target (section 5) |

### 41.0

| Change | Kite affected? | Where | Action |
|---|---|---|---|
| PDFs no longer get a separate guest WebContents (now an out-of-process iframe in the same WebContents) | **Behaviour change, no compile error.** Kite hardens and tracks pages per `webview`-type WebContents; the PDF viewer used to be its own guest and now lives inside the tab's WebContents. | `src/main/main.ts:1397-1411` (`web-contents-created`, `getType() === 'webview'`), `hardenWebview` `main.ts:689`, context menu `main.ts:752-805` | no code change expected; manually test a PDF in a tab: scroll, find, zoom, print, save, context menu, Esc in Peek, shortcuts while the PDF has focus |
| Cookie `changed` event causes renamed | No (`cookies.on('changed')` is not used; only `cookies.get/remove` at `main.ts:190-193`) | - | none |
| `showHiddenFiles` deprecated on Linux | No | - | none |

### 42.0

| Change | Kite affected? | Where | Action |
|---|---|---|---|
| macOS notifications use `UNNotification`; **unsigned apps cannot show notifications** (they emit `failed`) | **Likely yes for site notifications.** Kite offers the `notifications` permission, and CI builds are unsigned. | `src/main/permissions.ts:15`; `.github/workflows/ci.yml:88`, `build.yml:37` (`CSC_IDENTITY_AUTO_DISCOVERY: 'false'`) | sign release builds with a Developer ID, or accept that web notifications do nothing in unsigned builds. [unverified: whether an ad-hoc signature is enough, and that web `Notification` goes through the same presenter] |
| `electron` no longer downloads its binary in `postinstall`; it downloads on first run. `ELECTRON_SKIP_BINARY_DOWNLOAD` gone. | **Yes, CI and first local run.** After `npm ci` there is no binary; the first `electron .` or Playwright launch downloads ~100 MB inside a test with a 60 s timeout. | `.github/workflows/ci.yml:45`, `scripts/dev.mjs:9-10`, `tests/electron/harness.ts:56` | add `npx install-electron --no` after `npm ci` in the test job (`ci.yml:45`). The two build jobs (`ci.yml:84`, `build.yml:33`) do not need it: electron-builder fetches its own zip. |
| OSR default scale factor 1.0 | No | - | none |
| `quotas` removed from `clearStorageData` | No (only `storages`/`origin` are passed, `main.ts:185,196`) | - | none |
| `hslShift` array form deprecated | No | - | none |

### 43.0

| Change | Kite affected? | Where | Action |
|---|---|---|---|
| Open/save dialogs default to Downloads when no `defaultPath`; the OS no longer remembers the last folder | Minor. One dialog has no `defaultPath`: the extension picker. All others pass one (`main.ts:591,1145,1200`, `downloads.ts:118,204`). | `src/main/main.ts:1081-1086` | optional: remember the last folder and pass it as `defaultPath` |
| Frameless windows rounded on Linux; WCO follows native layout on Linux | No (the frameless video-controls window is macOS-only in practice; no `titleBarOverlay`) | `src/main/pipFrame.ts:68-87` | none |
| `NativeImage.toBitmap()` normalises to sRGB | No (`toBitmap`/`getBitmap` unused; only `createFromBuffer` + `toPNG`) | `main.ts:626,650`, `downloads.ts:296` | none |
| `chrome.scripting` CSS reaches more fallback frames | Extension behaviour only | - | none |
| `showHiddenFiles` removed on Linux | No | - | none |
| **Not in the breaking-changes doc:** `'websql'` removed from `clearStorageData({ storages })` (docs and typings, 43+) | **Yes, compile error.** At runtime unknown names are ignored (checked in `shell/browser/api/electron_api_session.cc` at v45.5.0), so nothing breaks for users. | `src/main/main.ts:184` (array literal; error reported at `185`), `main.ts:196` | delete `'websql'` from both lists |

### 44.0

| Change | Kite affected? | Where | Action |
|---|---|---|---|
| **`clipboard` rearchitected**: `readText/writeText/read/write/has` return Promises; `writeImage`, `readImage`, `readHTML`, `writeHTML`, `readRTF`, `readBuffer`, `availableFormats`, bookmarks, find-text helpers removed; Linux selection moves to `clipboard.selection` | **Yes. The only certain runtime break.** Capture's "put the picture on the clipboard" throws `clipboard.writeImage is not a function`. Because that line sits outside the `try`, `page:capture` rejects after the PNG is already saved. | `src/main/main.ts:653` (removed API); `main.ts:766,776,791,1369` (`writeText` still works, now returns a Promise); `tests/electron/pages.spec.ts:100` (`clipboard.readImage()` removed) | see section 4, changes 1-3 |
| `clipboard` module removed from renderers | No (see 40.0) | - | none |
| macOS 12 dropped; macOS 13+ required | Yes, as a product requirement. No version is hard-coded in the repo or site (grep found none). | `package.json` `build.mac` (no `minimumSystemVersion`) | state "macOS 13 or later" in README/site; optionally set `build.mac.minimumSystemVersion: "13.0"` |
| Windows ia32 and Linux armv7l dropped | No. Targets are win x64/arm64 and linux x64/arm64. | `package.json` `build.win`, `build.linux` | none |
| ANGLE statically linked; `libEGL`/`libGLESv2` no longer shipped | No. electron-builder 25.1.8 does not reference them (grep of `app-builder-lib/out`). | - | none |
| `select-client-certificate` also fires for `net` requests with `webContents === null`; unhandled means the first matching client certificate is used | Edge case. Kite has no handler. `net.fetch` calls (filter lists, weather, favicons, Web Store) would now present a client certificate if the server asks and the keychain has one. | `main.ts:953,957,1505,1530`, `network.ts:65`, `extensions.ts:166` | optional: handle the event and call `callback()` with no argument when `webContents` is null |
| `net.request` rejects `Sec-Fetch-Dest: document/frame/...` without `navigate` mode | No. `browserHeaders()` sets only accept, accept-language, user-agent. | `main.ts:1489-1495` | none |
| Unity support, `app.isUnityRunning()`, pre-macOS-13 login-item fields removed | No (unused) | - | none |

### 45.0

| Change | Kite affected? | Where | Action |
|---|---|---|---|
| Sandboxed preloads lose `require('events'/'timers'/'url')` and the `Buffer`, `setImmediate`, `clearImmediate` globals | **No, checked in the built bundles.** `dist/main/preload.cjs` and `dist/main/pagePreload.cjs` contain only `require("electron")` and `process.platform`. | `src/main/preload.ts:5`, `src/main/pagePreload.ts:11`, `scripts/build-main.mjs:15,19` | none. Guard for the future: anything bundled into a preload that touches `Buffer` now throws. |
| `ipcRenderer`/`process` in sandboxed preloads use a native EventEmitter | No (only `on`, `removeListener`, `send`, `sendSync`, `invoke`) | `preload.ts:8-24`, `pagePreload.ts` | none |
| Screen/window/tab capture reported as `display-capture` instead of `media` | No functional change. A label exists; screen sharing is not implemented at all (no display-media handler). | `src/main/permissions.ts:13,19` | when screen sharing is built, grant both and add a handler |
| `window.open()` child whose sandbox state differs from the opener gets its own process and no opener | No. Pages are sandboxed webviews and popups are forced `sandbox: true`, so the states match and `window.opener` (sign-in flows) keeps working. | `main.ts:703`, `main.ts:1413-1425`, `WebSurface.tsx:195` | none |
| Preloads only run in `chrome-extension://` frames that are top-level or inside DevTools | No. Extension windows have no preload; `pagePreload` exits for non-http(s) URLs. | `extensions.ts:228-236`, `pagePreload.ts:55` | none |
| Workers from subframes need `nodeIntegrationInSubFrames` for Node | No (no Node integration anywhere) | - | none |
| `chromeMediaSource: 'desktop'` rejects WebContents ids | No | - | none |
| ASAR file descriptors only usable through `fs`; write-opens fail with `EACCES` | No. The only `openSync` writes to userData; the Shields worker is loaded by path. | `src/main/storage.ts:75`, `src/main/filterLists.ts:180`, `main.ts:107` | none; covered by `test:packaged` |
| `document.requestStorageAccessFor` disabled (removed in 46) | No. One label becomes dead. | `permissions.ts:25` | optional cleanup |
| `contentTracing` heap profiling / Perfetto format; sync `safeStorage` deprecated | No (unused) | - | none |
| **Not in the breaking-changes doc:** Electron now forwards every Chromium permission type by name (45 docs list about 45, including `local-network`, `loopback-network`, `local-network-access`, `screen-wake-lock`, `sensors`, `persistent-storage`, `local-fonts`, `geolocation-approximate`) | **Behaviour change in web content.** Kite denies anything without a label. Chromium 142+ gates requests from public sites to localhost/LAN behind the Local Network Access permission, so those requests will be silently refused. | `src/main/permissions.ts:11-26` (labels), `:79-93` (request), `:95-99` (check) | add labels for `local-network`, `loopback-network`, `local-network-access`; decide on `screen-wake-lock` and `persistent-storage`. [unverified at runtime] Pre-existing nit: the key `idleDetection` at `:20` never matches Electron's `idle-detection`. |

Areas you asked about that have **no** breaking change between 38 and 45 [verified against the 45.5.0 typings and docs]:

- `<webview>`: the tag's documented methods, events and attributes are identical between 38.8.6 and 45.5.0 (heading-by-heading diff of `docs/api/webview-tag.md`). `canGoBack/goBack/canGoForward/goForward` are deprecated on `WebContents` but **not** on the tag, which is what `WebSurface.tsx:54-68` uses. All 15 events used at `WebSurface.tsx:146-160` still exist.
- `will-attach-webview` (`main.ts:1413`), `session.fromPartition` (`main.ts:150`), `registerPreloadScript` (`main.ts:154`), `webRequest.*` (`network.ts:226,277,319,359`), `setWindowOpenHandler`, `will-download` / `DownloadItem` (`downloads.ts:183-229`; 45 only adds a trailing `frame` argument), `webContents.debugger` (`main.ts:617-634`), `app.userAgentFallback` (`main.ts:49,1493`), `setWindowButtonVisibility/Position` (`main.ts:905-906`), `titleBarStyle: 'hiddenInset'` + `trafficLightPosition` (`main.ts:234-235,552-553`), `type: 'panel'` (`pipFrame.ts:70`).
- Extensions: Kite already uses `ses.extensions.loadExtension/getAllExtensions/getExtension/removeExtension` (`extensions.ts:87,97-98`). The old `ses.loadExtension` family is still only deprecated in 45.
- `protocol.handle` / `registerSchemesAsPrivileged`: Kite registers no custom scheme. `kite://new` is a sentinel string (`main.ts:544,818,1258`), blocked in `will-navigate` (`main.ts:684`).
- `utilityProcess`: unused. The Shields worker uses `node:worker_threads` (`filterLists.ts:180`, `shieldsWorker.ts:10`).

---

## 4. Code changes required (complete list)

Changes 1-4 are the four type errors; they are the whole compile-time delta.

1. **`src/main/main.ts:653`** - replace `clipboard.writeImage(img)`. Add `ClipboardItem` to the `electron` import at `main.ts:3-20`.
   ```ts
   try {
     await clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(img.toPNG())], { type: 'image/png' }) })]);
   } catch (err) {
     errorLog(`capture: clipboard write failed: ${(err as Error).message}`);
   }
   ```
   The saved file should count as success even if the clipboard write fails.
2. **`src/main/main.ts:766, 776, 791, 1369`** - `clipboard.writeText(...)` now returns a Promise. It still works; make the handlers `() => void clipboard.writeText(x).catch(() => undefined)` so a failure is not an unhandled rejection.
3. **`tests/electron/pages.spec.ts:100`** - `clipboard.readImage()` is gone.
   ```ts
   const clip = await app.evaluate(async ({ clipboard, nativeImage }) => {
     for (const item of await clipboard.read()) {
       if (!item.types.includes('image/png')) continue;
       const blob = await item.getType('image/png');
       return nativeImage.createFromBuffer(Buffer.from(await blob.arrayBuffer())).getSize();
     }
     return { width: 0, height: 0 };
   });
   ```
   [unverified that macOS reports the type back as `image/png`; adjust if it comes back under another image type]
4. **`src/main/main.ts:184` and `:196`** - remove `'websql'` from both `storages` lists.
5. **`src/main/permissions.ts:12-26`** - add labels for `local-network`, `loopback-network`, `local-network-access` (recommended, not a compile error).
6. **`.github/workflows/ci.yml:45`** - add a step `npx install-electron --no` after `npm ci` in the `test` job.
7. **`package.json:67`** - `engines.node` `">=20"` -> `">=22.12"`.
8. **`scripts/build-main.mjs:7`** `target: 'node20'` -> `'node24'`; **`:19`** `target: 'chrome130'` -> `'chrome156'`. Not required for correctness (the output already runs), but keeps esbuild from down-levelling.
9. Docs/site: minimum macOS becomes 13.

No change is needed in `preload.ts`, `pagePreload.ts`, `WebSurface.tsx`, `network.ts`, `downloads.ts`, `extensions.ts`, `objcPanel.ts`, `macWindows.ts`, `pipFrame.ts`, `shieldsWorker.ts`, `vite.config.ts`, `tsconfig.json` or the Playwright configs.

---

## 5. Dependencies

| Package | Now | Change | Why |
|---|---|---|---|
| `electron` | ^38.8.6 | `~45.5.0` | section 1 |
| `@types/node` | ^22.10.1 | `^24` | main process is Node 24.22; `electron@45` itself depends on `@types/node ^24.9.0` (otherwise npm nests a second copy). Typecheck passed with 22, so this is tidiness. |
| `electron-builder` | ^25.1.8 | `^26.18.1` | 26.18.1 knows Electron 45: it renames the new `electron_wer.dll` next to the Windows executable (verified in `app-builder-lib@26.18.1/out/electron/ElectronFramework.js`); 25.1.8 does not, so Windows fail-fast crash capture would be inert. Also: `package.json` already uses the 26-style `linux.desktop.entry` shape. Under the installed 25.1.8 `desktop` is spread flat (`LinuxTargetHelper.js:119`), so the `MimeType` entry is not written as intended today; 26 reads `desktop.entry` (`LinuxTargetHelper.js:255`). [verified in both tarballs] dmg/zip for arm64+x64, NSIS, AppImage and deb remain supported targets. [unverified: I could not fetch the 26.0.0 migration notes; re-check that `node_modules/koffi` still lands in `app.asar.unpacked` with both `darwin_arm64` and `darwin_x64` binaries, since 26 changed how node modules are collected] |
| `koffi` | ^2.16.3 | **stay on 2.x** (2.16.4 is fine) | Koffi is Node-API (`"napi": 8` in its package.json). The shipped `koffi.node` imports only `napi_*` (84 symbols) and `uv_*` (7) from the host, nothing from V8 or Node's C++ ABI, and loads under a Node with a different module ABI (tested: system Node 22, ABI 127, versus Electron 38's 139). So no rebuild and no Electron-specific binary is needed for ABI 150. `npmRebuild: false` stays correct. 2.15.2 and 2.15.3 contain callback fixes for Node 24.14+, already included in 2.16.3. [verified] **Do not move to koffi 3 in this change**: pointers become BigInt (breaks the `Number(...)` handling throughout `macWindows.ts`/`objcPanel.ts`), and binaries move to per-platform optional packages (`@koromix/koffi-darwin-arm64` ...), which breaks the `files`/`asarUnpack` globs and the x64 build made on an arm64 runner. |
| `@playwright/test` | ^1.63.0 (lock: 1.63.0) | keep; if bumped use >= 1.64.1 | Playwright documents only a minimum Electron version, no maximum. 1.64.0 had a regression losing a packaged app's first window (#43247, fixed in 1.64.1), which would hit `tests/electron/packaged.spec.ts`. Launch needs the `nodeCliInspect` fuse left on (Kite sets no fuses). [unverified: no run of `_electron.launch` against 45] |
| `@ghostery/adblocker` | ^2.20.3 | none | 2.20.3 is the latest; pure JS, bundled by esbuild into `main.cjs` and `shieldsWorker.cjs`. |
| `esbuild`, `vite`, `typescript` | 0.24 / 5.4 / 5.6 | none | `vite.config.ts` sets no `build.target` and has no Electron-specific settings; Vite's default output runs on Chromium 156. `tsconfig.json` `lib: ES2022, DOM` is fine. |
| CI Node | 22 (`ci.yml:43,82`, `build.yml:31`) | keep, or 24 | satisfies `>= 22.12` |

Electron's dist layout changed 38 -> 45 [verified, zip manifests]: macOS adds `Electron Framework.framework/Helpers/app_shim_loader` and drops `libEGL.dylib`/`libGLESv2.dylib`; Windows adds `electron_wer.dll` and drops `dxil.dll`, `libEGL.dll`, `libGLESv2.dll`; Linux drops `libEGL.so`/`libGLESv2.so`. Kite's `files` globs do not mention any of them.

---

## 6. The koffi / Objective-C layer (most fragile part)

What it relies on, and what was checked:

| Dependency | Where | Status for 45 |
|---|---|---|
| The video window's class matches `/NativeWidgetMacFramelessNSWindow/` (in practice the KVO subclass `NSKVONotifying_NativeWidgetMacFramelessNSWindow`, per `kite-debug.log`) | `src/shared/pipWindow.ts:32,44` | Class still exists with the same name in Chromium 156 (`components/remote_cocoa/app_shim/native_widget_mac_frameless_nswindow.h`). [verified] |
| The video window is created at floating level (3) and joins all Spaces | `pipWindow.ts:16,34,44` | `z_order = kFloatingWindow`, `visible_on_all_workspaces = true`, `remove_standard_frame = true` unchanged in 156 (`video_overlay_window_views.cc`); `video_overlay_window_native_widget_mac.mm` is byte-identical between 140 and 156. [verified] |
| The window is translucent, so corners can be rounded | `macWindows.ts:337-362` | 140 set translucency behind a feature flag; 156 sets it unconditionally. The log shows it is already translucent today, so no change expected. [verified source, unverified runtime] |
| Private AppKit selectors `_isNonactivatingPanel`, `_setPreventsActivation:`; swizzling `setCollectionBehavior:`, `setLevel:`, `styleMask` | `objcPanel.ts:96,112,131-177` | These depend on macOS, not Electron. Electron 45's own `ElectronNSWindow` adds one unrelated swizzle (`NSVisualTabPickerGridView`) and an `accessibilityDocument` override; `ElectronNSPanel` is unchanged. [verified, source diff] |
| `getNativeWindowHandle()` returns an `NSView*` | `macWindows.ts:198` | Still documented as `NSView*` on macOS in 45. [verified] |
| `type: 'panel'` adds the non-activating panel style mask | `pipFrame.ts:70` | Same wording in 45 docs; implemented by the unchanged `ElectronNSPanel`. [verified] |
| `koffi.register` callbacks invoked by AppKit on the main thread | `objcPanel.ts:96,131,147,160` | Node 24.14+ needed koffi >= 2.15.3 for this; Kite has 2.16.3. Running under V8 15.6 is **unverified**. |
| `objc_msgSend_stret` on Intel for `-frame` | `macWindows.ts:137` | ABI rule, unchanged |

The crash guards (`macWindows.ts:55-108`) key on the mtime of `main.cjs`, so the first build on 45 retries every step and disables one only if it crashes. That is the right safety net; `tests/mac/floating-video.mac.spec.ts` is the test that proves it.

One thing likely to look different rather than break: if Electron 45 is linked against the macOS 26 SDK (true for Chromium 156, unverified for Electron's builders), macOS 26/27 gives the main window the current system look (window corner radius, traffic-light size and spacing) instead of the compatibility look 38 gets. Check `trafficLightPosition` at `main.ts:235` (16,16) and `main.ts:553` (12,13), the `window:buttons` positioning at `main.ts:901-907`, and the sidebar's top inset in CSS. [unverified]

---

## 7. Procedure and tests

Suggested order (one branch):

1. `npm i -D electron@~45.5.0 @types/node@^24` then `npx install-electron --no`.
2. Apply section 4 changes 1-4, then `npm run typecheck`. Expect zero errors.
3. Unit and web UI tests (not Electron-dependent, should be unchanged):
   - `npm test`
   - `npm run test:e2e`
4. Real-app tests. In this terminal `ELECTRON_RUN_AS_NODE` is exported and must be unset:
   - `env -u ELECTRON_RUN_AS_NODE npm run test:electron`
   - `env -u ELECTRON_RUN_AS_NODE npx playwright test -c playwright.mac.config.ts` (floating video on the real desktop; hands off mouse and keyboard for about a minute)
   - Known from project notes: the two floating-video "app switch" tests in `tests/electron/app.spec.ts` fail in this harness even on a clean checkout. Compare against a 38 baseline run, not against zero.
5. Packaging, after bumping `electron-builder` to `^26.18.1`:
   - `npm run dist:dir` then `env -u ELECTRON_RUN_AS_NODE npm run test:packaged`
   - `npm run dist` and confirm four artifacts (dmg + zip, arm64 + x64) and that `Kite.app/Contents/Resources/app.asar.unpacked/node_modules/koffi/build/koffi/` holds `darwin_arm64` and `darwin_x64`.
   - `npm run dist:win` / `npm run dist:linux` if those are shipped.
6. Full report: `env -u ELECTRON_RUN_AS_NODE npm run test:report`.
7. Manual pass, things no test covers: a PDF in a tab; a site that asks for notifications (signed vs unsigned build); a public page that calls `localhost` (permission prompt); Capture and paste into another app; pop a video out and switch to a full-screen app; an installed extension (MV2 and MV3); sign-in popup with `window.opener`; main window chrome on macOS 26/27.

---

## 8. Risk ranking

| # | Risk | Likelihood | Impact | Notes |
|---|---|---|---|---|
| 1 | Floating-video panel hack misbehaves or crashes under the new runtime (koffi callbacks, private AppKit selectors, Chromium PiP internals) | low-medium | high (crash) | static evidence is good (section 6); only a real run settles it; crash guards limit the blast radius |
| 2 | Web-content behaviour drift across 16 Chromium milestones: Local Network Access denials, PDF viewer now in-frame, unsigned-build notifications, extension (MV2) behaviour | medium-high | medium | not compile-time visible; needs the manual pass |
| 3 | Clipboard API rewrite | certain | low | 5 call sites + 1 test, fix is mechanical |
| 4 | Packaging and CI: electron-builder 25 -> 26, lazy Electron download, koffi unpacking | medium | medium | caught by `dist` + `test:packaged` |
| 5 | Visual shift of window chrome on macOS 26/27 from the newer SDK | medium | low | cosmetic, tune two coordinates |
| 6 | Playwright `_electron` against Electron 45 | low | medium (blocks tests) | no known issue; stay on 1.63.0 or >= 1.64.1 |

---

## 9. Heads-up: 46 (2027-01-05) and 47

From the same breaking-changes doc ("planned", may change):

- 46: `capturePage()` images carry the page scale factor, so `getSize()` returns DIPs (`main.ts:615`; PNG bytes unchanged; `pages.spec.ts:101` only asserts width > 100). `unload` handlers stop running on http(s) pages by default (affects sites, not Kite's `file://` UI). Sync `safeStorage` removed (unused). `utilityProcess.kill()` no longer force-kills (unused). Node 26.
- 47: `console-message` positional arguments removed on `WebContents` (the `<webview>` event used at `WebSurface.tsx:150,160` is explicitly unchanged). `top-level-storage-access` permission removed (`permissions.ts:25`). `session` `preconnect` **event** deprecated (Kite uses the `ses.preconnect()` method, not the event).

---

## 10. Option: DRM video (Widevine) via castlabs

**What it is.** "Electron for Content Security" (ECS), a fork at `github.com/castlabs/electron-releases`, presented as a drop-in replacement. It adds a `components` API that installs Google's Widevine CDM at runtime through Chromium's Component Updater, and supports Verified Media Path (VMP) on macOS and Windows. Linux has no VMP. [verified, repo README]

**Versions.** Tags follow upstream with a `+wvcus` suffix. Newest today: `v45.2.1+wvcus` (2026-11-05), `v44.10.1+wvcus`, `v43.8.6+wvcus`; `v46.0.0-alpha.7+wvcus` is a prerelease. Since August 2025 castlabs builds about once a month per supported line, so it trails upstream: today 45.2.1 versus 45.5.0. For a browser that is a real security cost. Their notice says updates, including security updates, are best-effort. [verified, tags and wiki]

**Licensing and sign-up.** ECS binaries are pre-signed for development only (works with Widevine's test servers). Production needs a VMP signature from castlabs' **EVS** service: free, sign-up required, no Google/Widevine contract needed. [verified, wiki]

- `python3 -m pip install --upgrade castlabs-evs`
- `python3 -m castlabs_evs.account signup` asks for e-mail, first and last name, organisation, account name, password, then an e-mailed confirmation code. Tokens must be refreshed about monthly (`reauth`), which matters for CI.
- `python3 -m castlabs_evs.vmp sign-pkg <folder containing Kite.app or Kite.exe>`
- macOS: VMP-sign **before** code-signing. Windows: VMP-sign **after** code-signing.
- Notarised macOS builds need the `com.apple.security.cs.disable-library-validation` entitlement so the CDM can load.
- Only a fixed set of Electron fuses is allowed with the free service.
- 2022 history on the wiki: Widevine had EVS suspended for a few days over "possible misuse". Whether a general-purpose browser fits their terms is **unverified**; ask castlabs before building on it.

**What would change in Kite.**

```jsonc
// package.json
"devDependencies": { "electron": "github:castlabs/electron-releases#v45.2.1+wvcus" },
"build": {
  "electronDownload": { "mirror": "https://github.com/castlabs/electron-releases/releases/download/v" },
  "afterPack": "scripts/evs-sign.cjs"   // macOS: runs before signing; use afterSign for Windows
}
```

- `src/main/main.ts:1428`: `await components.whenReady()` before the first window (first launch downloads the CDM from Google, which sits oddly with "offline" and delays first paint).
- `src/main/permissions.ts:11-26`: `mediaKeySystem` has no label today, so DRM requests are refused. It needs a label or a place in `ALWAYS_OK`.
- Tests: Playwright's Electron loader passes `--disable-component-update`, so the CDM will not install under test.
- Kite builds arm64 and x64 separately, so the universal-binary signature conflict in castlabs' FAQ does not apply.

**Limits to expect.** The desktop CDM is software-only, so services cap resolution and some refuse non-Chrome clients outright; which services work, and at what quality, is **unverified**. Linux reports `PLATFORM_UNVERIFIED` and most production services will not play.

---

## 11. Option: more native window chrome

What Electron 45.5.0 offers [verified in `electron.d.ts` and docs]:

| API | Platform | Notes for Kite |
|---|---|---|
| `vibrancy` / `win.setVibrancy(type, { animationDuration })` | macOS | types: `titlebar`, `selection`, `menu`, `popover`, `sidebar`, `header`, `sheet`, `window`, `hud`, `fullscreen-ui`, `tooltip`, `content`, `under-window`, `under-page` (`appearance-based` constructor-only). Unchanged since 38. The natural fit is `vibrancy: 'sidebar'` behind Kite's sidebar. Needs a transparent `backgroundColor` (today `main.ts:233` is opaque) and translucent sidebar CSS; the webviews stay opaque. |
| `visualEffectState` | macOS | `followWindow` (default), `active`, `inactive`. Use `followWindow` so the material dims when Kite is in the background, as native apps do. |
| `roundedCorners` | macOS, Windows 11, Linux (since 43) | frameless windows only; default true. Relevant to `pipFrame.ts`. |
| `titleBarStyle`, `trafficLightPosition`, `setWindowButtonPosition/Visibility` | macOS | already used. Fixes for macOS 26 traffic-light placement and a WindowServer GPU spike landed in 38.2+/39+. |
| `titleBarOverlay` + `setTitleBarOverlay` | macOS, Windows, Linux | exposes `env(titlebar-area-*)` CSS variables; mainly useful to give Windows/Linux a custom title bar with native buttons instead of `titleBarStyle: 'default'` (`main.ts:234`). |
| `backgroundMaterial` / `setBackgroundMaterial` | Windows 11 22H2+ | `auto`, `none`, `mica`, `acrylic`, `tabbed`. `mica` is the Windows counterpart of sidebar vibrancy. `accentColor` also exists (Windows). |
| `View.setBackgroundBlur(radius)`, `View.setBorderRadius(radius)` | all | new since 38; only for `WebContentsView`/`View`, not `<webview>`. |
| `-electron-corner-smoothing` CSS | all | Apple-style continuous corners on elements in Kite's own UI. |
| `nativeImage.createMenuSymbol(name)`, `MenuItem.badge` | macOS (badge 14+) | SF Symbols in native menus; new since 38. |
| `windowStatePersistence` + `name` | all, experimental (44+) | built-in save/restore of window bounds. |

**Liquid Glass specifically:** Electron 45.5.0 has **no** first-party API for it. A search of its docs, typings and macOS window sources finds no `NSGlassEffectView`, "glass", "macOS 26" or "Tahoe". The third-party `electron-liquid-glass` package wraps `NSGlassEffectView` behind a native addon and requires a transparent window with vibrancy off [unverified: found by search, not evaluated]. Kite could also reach it through its existing koffi bridge, but that adds a second fragile native surface. The cheap, supported step is sidebar vibrancy plus `visualEffectState`; with the newer SDK the system-drawn parts (corners, traffic lights) should already follow the current macOS look (section 6, unverified).

---

## 12. What stayed unverified

- Any runtime behaviour under Electron 45: nothing was launched. In particular koffi callbacks under V8 15.6, Playwright `_electron.launch`, the PiP hooks, and the clipboard read-back MIME type.
- Whether Electron's own builders use the macOS 26 SDK (Chromium 156's toolchain does).
- Whether unsigned or ad-hoc-signed builds can show web notifications under `UNNotification`.
- Local Network Access enforcement details inside Electron 45 (the permission names are documented; the denial path was reasoned from Kite's handler).
- Manifest V2 extension behaviour on Chromium 156.
- electron-builder 26 migration notes (26.0.0 release notes could not be fetched); Linux distro minimums (read via a summarising fetch); which streaming services accept castlabs builds; castlabs EVS terms for a general-purpose browser.

## 13. Sources

- Electron breaking changes: https://www.electronjs.org/docs/latest/breaking-changes (raw: `electron/electron` `docs/breaking-changes.md` on `main` and at `v45.5.0`, `v44.11.6`, `v43.8.13`)
- Release notes: https://github.com/electron/electron/releases/tag/v39.0.0 ... `/v45.0.0`; blog posts https://www.electronjs.org/blog/electron-39-0, `-41-0`, `-43-0`, `-44-0`, `-45-0`
- Releases and schedule: https://releases.electronjs.org/releases.json , https://releases.electronjs.org/schedule.json , https://releases.electronjs.org/pr/48376
- Support policy: `docs/tutorial/electron-timelines.md`; platform support: `README.md` at `v38.8.6` and `v45.5.0`
- `electron@45.5.0` npm tarball (`electron.d.ts`, `index.js`, `install.js`, `abi_version`); Electron source tarballs `v38.8.6` and `v45.5.0` (docs, `shell/browser/...`, `script/zip_manifests`)
- Chromium at `140.0.7339.249` and `156.0.8078.109` via chromium.googlesource.com (`video_overlay_window_views.cc`, `video_overlay_window_native_widget_mac.mm`, `native_widget_mac_frameless_nswindow.h`, `build/mac_toolchain.py`, `build/config/mac/mac_sdk.gni`)
- castlabs: https://github.com/castlabs/electron-releases (README, tags, releases) and its wiki pages Home, EVS, VMP, FAQ
- npm registry: `koffi` (2.16.3 installed, 3.3.8 tarball and changelog), `app-builder-lib@26.18.1` tarball, `electron-builder` and `playwright` GitHub release notes
- Playwright Electron docs: https://playwright.dev/docs/api/class-electron
- Chrome system requirements: https://support.google.com/chrome/answer/95346
