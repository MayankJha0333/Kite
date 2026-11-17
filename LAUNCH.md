# Kite — launch readiness

What was checked for the public launch, what shipped, and what is knowingly left out.
Last audit: 17 November 2026, against Arc 1.171 as the behaviour and design reference.

## Readiness checklist

| Area | State |
|---|---|
| Type check | clean (`npm run typecheck`) |
| Unit tests | 303 pass (`npm test`), including the new history module; the Objective-C runtime test is skipped where libobjc is absent |
| UI tests (browser, simulated pages) | all pass (`npm run test:e2e`), including the new History, Find, zoom and About tests |
| Real-app tests (Electron) | pass (`env -u ELECTRON_RUN_AS_NODE npm run test:electron`): security, Shields, downloads, extensions, permissions, PiP controls, view source, page-crash recovery, menu bar, About. The two "switch to another app" PiP tests need Kite to be the active macOS app and must run from a normal terminal, not an IDE-hosted one |
| Production build | `npm run build` — UI 2.0 MB (editor and Settings load on demand), main 2.4 MB |
| Packaging | `npm run dist:dir` then `npm run test:packaged` starts the packaged app and checks CSP and the native window bridge |
| Crash handling | UI process crash → automatic reload (dialog after 3 in a minute); page crash → readable error with Try again; everything else → `kite-errors.log` in the data folder |
| Security | pages sandboxed, no Node, Kite's preload stripped from webviews, IPC sender checks, strict CSP in the built UI, HTTPS-only, GPC, permission prompts, popup and little-window rate limits, filename and archive-path sanitising, extension manifests reviewed before install |

## Fixed in this audit

- Settings closed itself a moment after opening when the active item had just changed (an effect read live store state). Settings could also be closed by the exit timer of the previous panel when reopened quickly. Both fixed; the exit animation now draws a "leaving" copy in state.
- A hidden sidebar could slide back out by itself: Chromium's synthetic pointer move after layout counted as a hover on the edge strip.
- The Objective-C unit test crashed on macOS during collection (it loaded a library it should have skipped).
- The version was typed by hand in two places; it now comes from `package.json` in the UI and from Electron in the main process.
- The Space editor and Settings → Spaces offered two different palettes with clashing names; there is one palette now.
- The Downloads sheet repeated its own title as a section heading.

## Added for launch

- History page (⌘⇧H, History menu, command bar, Settings → Privacy).
- Find in page shows "n of m" and "No matches".
- Zoom level badge in the address bar; ⌘0 resets.
- Print (⌘P), Save Page As… (⌘⇧S), View Page Source, developer tools for the page.
- A complete menu bar (File, Edit, View, History, Tabs, Tools, Window, Help) showing every shortcut, rebuilt when shortcuts change. Labels follow Arc's menu ("Go Back", "View History", "Force Refresh the Page", "Zoom to Actual Size", "Reveal Kite Data", "Copy Kite Info"), taken from the REA menu inventory in `research-evidence/arc-inventory/menu.txt`.
- Page commands Arc has that Kite lacked: Force Refresh (⌘⇧R), Stop Loading, Rename Current Item, Reset Tab to Original URL, Set as Default Browser (File menu and command bar).
- View Source renders in Kite's own page (`kite://source/…`) with line numbers, wrap and copy: Chromium refuses the `view-source:` scheme inside webviews, so the HTML is fetched through the Space's cookie jar as the server sent it.
- About page with build details, data-folder and error-log access.
- Root error boundary with a recovery screen; crash logging in every build.
- Windows (NSIS) and Linux (AppImage, deb) build targets.

## Known limitations

- **Unsigned builds.** There is no Apple Developer ID or Windows code-signing certificate in this repository. macOS users must right-click → Open the first time; Windows SmartScreen will warn. To sign: set `CSC_LINK`/`CSC_KEY_PASSWORD` (and `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` for notarisation) in CI and remove `CSC_IDENTITY_AUTO_DISCOVERY: 'false'` from the workflow.
- **No auto-update.** Kite is offline by design; new versions are downloaded by hand. If that changes, `electron-updater` with GitHub Releases is the natural fit.
- **Windows and Linux are built but less exercised.** CI runs the full test suite on all three systems, but the floating-video window (panel level, mouse pass-through) is macOS-only; elsewhere the video simply floats as a normal window. The Linux build target is a directory in CI; AppImage/deb packaging is configured but not yet produced by CI.
- **Passwords and autofill** are not built in; the system password manager (Passwords on macOS) works in pages.
- **Private windows** do not exist; a Space with "separate logins" is the closest thing and keeps no history exemption.
- **Extensions** run what Electron supports: content scripts, background workers, popups and options pages. Toolbar buttons, tab APIs and some Chrome-only APIs do not work (the install screen says so per extension).
- **Save Page As…** saves HTML plus its files ("complete web page"); PDF export is not offered (use Print → Save as PDF).
- **Translation, casting, sync, Easels, Live Folders, AI features** need services Kite does not talk to.

## Release steps

1. `npm version <x.y.z>` (updates `package.json`; the version shows in About and the menu).
2. `npm run test:report` (every check; writes `test-report/`).
3. `npm run dist` on macOS; `npm run dist:linux` on Linux; `npm run dist:win` on Windows.
4. `npm run test:packaged` against the produced app.
5. `git tag vX.Y.Z && git push --tags` — CI builds and attaches the macOS app to a GitHub Release.
