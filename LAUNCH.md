# Kite — launch readiness

What was checked for the public launch, what shipped, and what is knowingly left out.
Last audit: 17 November 2026, against Arc 1.171 as the behaviour and design reference.

## Readiness checklist

| Area | State |
|---|---|
| Type check | clean (`npm run typecheck`) |
| Unit tests | 321 pass (`npm test`), including the new history module; the Objective-C runtime test is skipped where libobjc is absent |
| UI tests (browser, simulated pages) | all pass (`npm run test:e2e`), including the new History, Find, zoom and About tests |
| Real-app tests (Electron) | pass (`env -u ELECTRON_RUN_AS_NODE npm run test:electron`): security, Shields, downloads (multi-connection, pause/resume, fallback, resume after restart), Brave-style privacy, link warming, extensions, permissions, PiP controls, view source, page-crash recovery, menu bar, About. The two "switch to another app" PiP tests need Kite to be the active macOS app and must run from a normal terminal, not an IDE-hosted one |
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

## Settings like Arc's, own backgrounds, dark default (23 Nov 2026)

- **Settings is laid out like Arc's**: a row of icon tabs across the top (General, Appearance, Links, Privacy, Shortcuts, Advanced), one centred 680px column, sections 44px apart and groups 20px apart on an 8px rhythm. The 11 former sections stack inside those tabs under their own headings; links from elsewhere in Kite (`panelArg` with an old section id) open the right tab and scroll to the section (`resolveSettings` in `Settings.tsx`). Settings opens on General, which starts with Arc's "works best as your default browser" prompt until Kite is the default. Search stays, on the right of the tab bar. The bar drops its title, then shrinks search, as the window narrows (container queries).
- **Your own picture** (`SpaceTheme.photo`): upload from the theme editor's Background row; it is shrunk to 2880px, stored in IndexedDB on this computer (`src/renderer/images.ts`), measured for brightness and two colours, and the theme takes its light or dark and its accent from it. Unused pictures are deleted at the next start.
- **Your own gradient** (`SpaceTheme.gradient`): 2–4 colours and an angle, edited inline. It is painted toward the base by Intensity in the frame and sidebar (so text stays readable) and shown in full on the home page.
- **One background at a time**: your picture, else a built-in one, else your gradient, else plain colours; picking a colour returns to plain colours.
- **Dark default for everyone**: a dark theme with an indigo-violet-teal gradient at 160°, periwinkle accent. New Spaces get the same design turned to their own hue. Existing Spaces moved to it once (`settings.themeVersion`, `THEME_VERSION = 2` in `spaceTheme.ts`) and can be changed afterwards. Text on the chrome keeps 4.5:1 for the default and every new-Space hue (unit tested).

## Theme pictures and finishing pass (23 Nov 2026)

- **11 built-in pictures** (`src/shared/backdrops.ts`, files in `src/renderer/assets/backgrounds/`, under 1 MB in all): Dawn, Dunes, Meadow, Forest and Haze (light); Bloom, Aurora, Dusk, Ocean, Ember and Night (dark). They are Kite's own: drawn as SVG from fixed seeds by `scripts/backgrounds/make.mjs` and rendered once by Chromium to JPEG (2560×1600 plus a thumbnail). Rerun the script to change or add one; nothing is downloaded.
- **A picture is part of the Space theme** (`SpaceTheme.backdrop`). Picking one sets the theme's two colours and light or dark from the picture, so accent and chrome agree with it; picking a colour goes back to plain colours. The window frame shows the picture, the sidebar frosts it (blur plus a wash whose strength follows Intensity), and the home page shows it crisp with text in the picture's tone. Chosen from the theme editor's Background row or the home page's + › Background.
- **Home scenes became pictures.** The CSS-drawn home scenes are gone; a scene saved by an earlier version becomes the active Space's picture on load.
- **Finishing fixes**: the shortcut hints on the home page sit on a frosted pill over pictures (they were unreadable on the forest's tree line); the Pinned chevron no longer pushes the sidebar divider inward; an identical toast replaces the one on screen instead of stacking copies; download rows, extension rows and the page-error card now get the rise-in they always referenced (`fade-up` was never defined).
- **Stylesheet repair**: an earlier cleanup left an unclosed comment that silently disabled the colour wheel's styles and the rules after it; fixed, and `tests/unit/stylesheet.test.ts` now fails on unclosed comments or blocks and on animations that name undefined keyframes. Leftover styles of the removed gradient designer and picture uploader were deleted.

## Arc commands added (22 Nov 2026)

From the Arc menu inventory (`research-evidence/arc-inventory/menu.txt`), the offline commands Kite lacked, now in the same places Arc puts them (Tabs and View menus, the Space menu, the command bar, re-recordable shortcuts):

- **Collapse / Expand Pinned Section** (`Space.pinnedCollapsed`): the Pinned list folds away behind a divider that shows the count; the pinned tab you are on, or the folder it sits in, stays in view like Arc's closed folders do.
- **Reset All Tabs in This Space**: every pinned tab, in folders too, back to its pinned page; pages you cannot see unload.
- **Clear Cookies and Refresh / Clear Cache and Refresh** for the site you are on, through the existing per-site clearing.
- **Capture (⌘⇧2) / Capture Full Page (⌘⇧1)**: a PNG in Downloads and on the clipboard, with a "Show" on the toast. The full page is taken through the page's own debugger (`Page.captureScreenshot` beyond the viewport, capped at 16k pixels), so nothing scrolls. No area selection, portrait mode or editing.
- **Two behaviour fixes**: a plain click on the Space name no longer pops its menu (the … button, right-click and Enter do; double-click renames); closing a pinned tab that sits inside a closed folder now moves on to a neighbour instead of leaving an empty window.
- Not built, on purpose: hover previews, several windows, private windows, Easels, Library, passwords, import from other browsers, Cast. `FEATURES.md` has the full ledger.

## Theme controls, cut down to Arc's (22 Nov 2026)

Arc's shipped binary (1.171) has one theme surface, the per-Space editor in the `SpaceStyleEditor` module: a colour pad with 27 swatches (pastel, muted, grey; `ColorPicker{Pastel,Drab,Greyscale}1…9` in its asset catalogue), an intensity dial, grain (`noiseFactor`, "Cycle noise texture"), and light/dark/automatic. Its Settings have no appearance section at all. Kite had grown to about 25 appearance controls across two pages; almost none would be used. They are gone, not hidden:

- **Kept, in one editor** (`src/renderer/components/ThemeEditor.tsx`, in the Space editor and Settings › Spaces): colour (the same three rows of nine, measured from Arc, plus a hue wheel and two colour inputs), Intensity, Grain, Light / Dark / Auto. Changes apply live and are saved on the Space.
- **Removed**: the six chrome styles, 15 ready-made themes, accent picker, surfaces, contrast, border/shadow/glass sliders, theme codes, six fonts, custom CSS for Kite, the gradient designer, background animations, background pictures, "use for every Space", and the preview/apply/undo flow. Text size moved to Layout, which also has the one Reset.
- **Model**: a Space theme is `{ colors, mode, intensity, grain }` (`src/shared/spaceTheme.ts`); saved files from earlier versions load, with the extra fields dropped on load. Settings no longer carry `look`, `font` or `chromeCss`. The window is painted by one tuned look (the former Calm style) in `src/renderer/theme.ts`.
- **Size**: about 1,000 lines of CSS and 1,200 lines of TypeScript and tests removed; `tests/unit/spaceTheme.test.ts` checks every swatch keeps text at 4.5:1 in both modes, and `tests/e2e/20-layout-themes-sound.spec.ts` does the same in the running app.

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
- **Warm on hover.** Resting the pointer on a link to another site (90 ms) or pressing on it opens that site's connection before the click; nothing is fetched until you click. Sidebar rows, Favorites and home-page tiles do the same for tabs that aren't loaded yet, and pinned and favourite sites (up to 8) are warmed 2.5 s after launch. Hosts Shields would block are never warmed; once per origin per 10 s. This saves the DNS, TCP and TLS time only, not the page itself.

## Downloads, IDM-style

- **Several connections per file.** When a server accepts byte ranges (checked with a one-byte `Range` request before taking over from Chromium), Kite splits the file into parts and fetches them in parallel: 8 connections by default, 4 or 16 in Settings → Downloads → Accelerate downloads, or Off. A finished part takes over the back half of the largest part still running, so connections never sit idle. The row shows each part's progress, the connection count and a fast badge.
- **Safe resume.** Parts are written in place into `name.kitepart`, which is renamed when complete. Pause/resume, dropped connections (6 retries with backoff) and quitting Kite all resume where they stopped; the server's ETag or Last-Modified is checked so a file that changed on the server restarts instead of being stitched together.
- **Falls back cleanly.** Servers without range support, or that answer a range with the whole file, download through Chromium as before. Retry on a failed download, and an "Add link" box in the Downloads sheet (sent with the right Space's cookies). A tab opened only to download a file closes once the download starts.

## Privacy, Brave-style

Four switches in Settings → Privacy → Shields, all on by default:
- **Fingerprinting protection** ("farbling", as Brave's standard mode): canvas and audio read-back vary by an invisible amount, WebGL reports a generic GPU, and CPU core count and memory are plausible per-site values. The answers stay the same on one site for a session and differ between sites and launches; the wrapped functions still report native code.
- **Block cross-site cookies**: third-party requests neither send nor set cookies.
- **Skip tracking redirects** (debouncing): links through known bouncers such as `google.com/url?q=` go straight to the destination.
- **Skip AMP pages** (De-AMP): Google AMP and AMP-cache links open the publisher's own page.

## Floating video, Arc's layout

Laid out after Arc's floating-video controls (names read from Arc 1.171's binary: corner buttons, a Back to Tab pill, play with animated skip buttons, a scrubber with a time label, a mute toggle, size classes, grow-on-hover). Arc's exact pixel measurements aren't recoverable from its binary, so sizes and spacing here are Kite's own reading of it. Arc's own colours are used: a #212123 chip with a 20% white hairline. The controls are drawn in a window above Chromium's video window, so the chips are near-opaque rather than blurred.
- Close and Minimize as 24 px round buttons top-left; a "Back to Tab" pill top-right.
- Play in the middle with 10-second skips whose arrows turn when pressed.
- A bottom bar with the time, a slider that thickens under the mouse, a time label that follows the knob while you drag, the length, and a speaker button. The speaker mutes the video's whole tab, and the sidebar shows it; unmuting also unmutes the video if the page had silenced it.
- Videos under 340×190 drop the skips, the length and the pill's words.

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
