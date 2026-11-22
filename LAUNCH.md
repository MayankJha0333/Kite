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
- **Home page** (`src/shared/home.ts`, `src/renderer/components/home/`): the new-tab page is a start page with a greeting, a search box (engine switchable in a chip), Favorites as tiles you can add, edit and remove from the page, frequently visited sites (off by default; one click in the + menu shows them), and up to 12 widgets — Clock (12/24h, seconds), Weather (place you pick, °C/°F, 4-day forecast when wide), Note, To-do, Calendar, Focus timer (5/15/25/50 min, toast and sound when done). Widgets are dragged by their title, snapped to a 20px grid, resized (Small/Wide/Tall/Large) and removed from their menu, and kept inside the page as the window shrinks. Seven background scenes (the Space's own colours plus Aurora, Dusk, Ocean, Forest, Ember, Night) from the + button; greeting, frequent sites and hints can be hidden. Everything is plain JSON in the saved state and checked on load. The Weather widget is the one feature that talks to a server: the place name goes to open-meteo.com from the main process (no key, no account), cached for 30 minutes; the page says so before the first lookup. Tests: `tests/unit/home.test.ts`, `tests/e2e/28-home.spec.ts`.
- **Real site icons everywhere** (`src/shared/icons.ts`): history entries remember the icon a page reported, so search suggestions, Frequently visited tiles, the command bar's history rows and the History page show the site rather than a coloured letter. A site nothing has reported yet (a shortcut typed by hand, a search engine, an imported tab that has not loaded) is asked once, from the main process (`site:icon`): its home page's `<link rel="icon">` (`src/shared/siteIcon.ts` picks SVG or the largest), else its `/favicon.ico` when that is really an image, trying the www host when the apex stalls. The answer is stamped on every tab and history entry of that site that has none (`rememberSiteIcon`); a miss is not asked again in the session. Only the site itself is contacted, through the app's own session (no site cookies), with browser-like headers. Limitation: a site whose edge refuses non-tab requests (Stack Overflow's Cloudflare challenge answers 403 to Electron's network stack) keeps its letter until it is opened once; from then on the page's own icon is remembered.

## Design and motion pass

Run with the installed design skills (impeccable critique/animate, Emil Kowalski's animation audit, Apple's fluid-interface rules, Vercel's Web Interface Guidelines). What changed:

- **Instant where it matters.** Tab switches and the command bar (⌘T) no longer animate: at 100+ uses a day, motion there reads as latency.
- **The sidebar is a physical list.** Rows glide to their new place when pinned, unpinned, dropped, or left behind by a closed neighbour (FLIP over the Web Animations API, `src/renderer/flip.ts`); a new row slides in. Measured inside the list, so the list itself shifting (the address bar appearing) never moves rows; a drag snaps everything to rest first.
- **Reduce Motion is gentler, not dead.** Nothing slides, scales or blurs; sheets, menus and toasts fade in 140ms; hover, press and toggle colours still answer; decorative background loops stop outright. Both the system setting and Kite's own switch.
- **Shorter choreography.** Settings sections settle within ~250ms (was ~420ms); Space switches no longer re-stagger every row; Peek uses the shared arrival curve instead of a one-off overshoot; one `transition: all` and a dead duplicate menu animation removed.
- **Menus grow from the corner nearest the pointer**, even when flipped to fit the window.
- **Keyboard access.** Sidebar tabs and folders are reachable with Tab, moved through with ↑/↓, opened with Enter or Space, folders opened and closed with → and ←.
- **Menus never wrap.** Labels and hints stay on one line (a long hint is cut with an ellipsis); a submenu with no room on the right opens on the left of its parent instead of over it.
- **Guidelines pass.** Scroll containment on every scrolling pane, balanced headings, a quiet neutral rule on note quotes instead of a thick accent bar. The mechanical design detector reports no findings.
- Tests: `tests/e2e/27-motion-keyboard.spec.ts` covers the glide, the instant actions, reduced motion and keyboard navigation; the drag specs now measure rows at rest.

## Layout sweep (finds overlap and clipping without anyone looking)

`tests/e2e/29-layout-sweep.spec.ts` opens every menu and submenu, the home page and its widgets, the command bar, every Settings section, History and the Archive, at a normal and a small window, and runs `layoutProblems()` (`tests/e2e/fixtures.ts`) on each: any text drawn over other text, text spilling past its box, or text outside the window fails the test with a plain sentence ("“Now and the next days…” overlaps “A sticky note…” by 603px²"). Text scrolled out of a pane is ignored; toasts are ignored. It runs with the rest of the web suite in `npm run test:report`, so CI catches these on every push. On its first run it found the three bugs fixed here: widget-menu hints wrapping into the next row, a submenu sliding over its parent menu at the window edge, and the Motion "Feel" control pushed over its label in a small window. Add any new surface to the sweep when you add it to the app.

## Page-load performance (measured 22 Nov 2026)

Chromium's own load events, Kite tab versus a bare Electron window in the same process, same network:

| Site | Kite, repeat visit | Bare window, warm | Kite, first visit | Bare window, cold |
|---|---|---|---|---|
| example.com | 72 ms to navigate, 111 ms loaded | 73 ms, 95 ms | 417 ms, 574 ms | 1299 ms, 1485 ms |
| news.ycombinator.com | 400 ms, 437 ms | 393 ms, 416 ms | 1117 ms, 2223 ms | 1331 ms, 2435 ms |
| en.wikipedia.org | 174 ms, 299 ms | 182 ms, 324 ms | 539 ms, 1677 ms | 904 ms, 2238 ms |

Kite adds no measurable overhead over Chromium itself; Shields makes ad-heavy pages faster (The Verge: 10.5 s with Shields, 14 s without). First visits are dominated by DNS and TLS setup on the network, not by Kite. The `handshake failed … net_error -100` lines in the dev console are Chromium noting third-party hosts that closed a TLS handshake (trackers, odd servers); they are logged, retried where sensible, and do not fail the page.

What changed to make first visits quicker:
- **Preconnect while typing.** The command bar and the new-tab box open the connection (DNS, TCP, TLS) to the address being typed, or the highlighted suggestion, about 180 ms after typing pauses, once per origin per 10 s.
- **First launch stays quiet.** When a saved filter is already blocking, filter-list downloads wait 15 s after launch so the first pages you open get the connection.
- **Saves never block the network.** Routine state saves flush to disk off the main thread (the quit-time save is still synchronous).

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
