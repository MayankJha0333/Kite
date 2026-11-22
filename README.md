# Kite

A calm, sidebar-first web browser for macOS — built from the behaviour notes in
[RESEARCH.md](RESEARCH.md). Everything works offline: no account, no server, nothing
leaves your computer.

Electron + React + TypeScript. Written from scratch — no code, name, logo or icons
from Arc.

---

## Run it

You need **Node.js 20 or newer** (`node -v`).

```bash
npm install        # once — downloads Electron for your Mac
npm run dev        # run with live reload while you change code
npm start          # build and run the real app
npm run dist       # make Kite.dmg + Kite.zip in release/ (Apple Silicon and Intel)
npm run dist:linux # AppImage + .deb (x64 and arm64)
npm run dist:win   # Windows installer (x64 and arm64); best built on Windows
```

The `.dmg` is not signed with an Apple Developer ID, so the first time you open it:
right-click **Kite.app → Open → Open**.

**Make Kite your default browser:** Settings → Links & Boosts → Link Routing →
“Make Kite the default browser”.

**Bring your Arc setup across:** Settings → Your Data → Import from Arc (or ⌘T → “import”).
Kite finds `~/Library/Application Support/Arc/StorableSidebar.json` by itself and shows
a preview before adding anything. It only reads that one file — never passwords,
cookies or history.

---

## What's in it

| Feature | What you get |
|---|---|
| **Sidebar tabs** | Vertical tabs, newest on top. Close + Undo, ⌘⇧T reopen, rename, duplicate, middle-click close, ⌘1…⌘9, ⌃Tab, resizable or hidden sidebar (slides out from the edge) |
| **Home page** | Every new tab: a greeting, a big search box with a search-engine chip, your Favorites as site tiles (add, edit, remove right there), frequently visited sites, and widgets you place anywhere — Clock, Weather, Note, To-do, Calendar, Focus timer. Drag widgets by their title, resize from their menu, pick one of seven background scenes from the + button. Everything is saved with your data; only the Weather widget uses the network (the place name you type goes to open-meteo.com, nothing else) |
| **Favorites** | Icon grid at the top, shared by every Space |
| **Pinned tabs** | Remember their home page; “back to pinned page”; closing keeps them and resets them |
| **Folders** | Nested, drag and drop, collapse/expand all, ungroup; deleting moves contents to the Archive (with Undo) |
| **Auto-archive** | Unused Today tabs move to the Archive after 1h…30 days (default 12h) or never; per-Space override; pinned and Favorites never touched |
| **Archive** | Grouped by day, search, restore (notes keep their text), delete, clear |
| **History** | ⌘⇧H: every page you visited, grouped by day; search, reopen (⌘-click for the background), forget one, clear the last hour / today / week / all (with Undo) |
| **Pages** | Find in page with match counts (⌘F), zoom with a level badge in the address bar (⌘+ / ⌘− / ⌘0), print (⌘P), Save Page As… (⌘⇧S), View Page Source, developer tools for a page; a page whose process dies says so and offers Try again |
| **Spaces** | Name, emoji, two colours, light/dark/auto, colour strength, grain; ⌃1…⌃9, ⌘⌥←/→, two-finger swipe; drop tabs on a Space icon to move them |
| **Command bar** | ⌘T: fuzzy search over open tabs (switch instead of duplicating), notes, history, 40 actions and Spaces; Google search by default (DuckDuckGo, Bing, Brave, Kagi or your own in Settings); the connection to the address you're typing opens before you press Enter |
| **Split View** | 2–4 pages side by side or stacked, resizable; ⌘⇧=, drag a tab onto the page, or from a link's menu |
| **Peek** | Links from pinned tabs to other sites (and shift-click) open in a floating preview; Open / Split / Esc |
| **Little window** | Small quick window (⌘⌥N, works even when Kite is in the background); “Open in Kite” moves the page into a Space |
| **Boosts** | Per-site CSS, font, zap (click to hide anything), optional script; live while you type; import/export |
| **Link routing** | Rules for links from other apps: site → Space or little window; try-a-link preview |
| **Video pop-out** | Switch tabs or apps while a video plays and it floats in a window you can drag and resize anywhere — on top of every app, even full-screen ones; come back and it returns to the page. Its controls: Close and Minimize top-left, Back to tab, play/pause, ±10 s and a seek slider you can drag back; drag the video to move it, drag an edge or corner to resize. Minimize turns it into a mini player (sound keeps playing) with its own slider. Speaker icon on playing tabs (click to mute); ⌘⇧P by hand; switches in Settings |
| **Notes** | Rich text in the sidebar: headings, lists, to-dos, quotes, code, links; Markdown export |
| **Customise** | Sidebar side, spacing, 4 fonts, text size, sidebar width, corners, page margin, favorites per row, reduce motion, your own CSS for Kite, every shortcut re-recordable |
| **Shields** | Ad and tracker blocking (EasyList, EasyPrivacy and more, downloaded and built off the main thread), cookie-banner and annoyance lists, your own rules and lists, per-site exceptions, tracking-parameter removal, referrer and search-query hiding, WebRTC leak protection, third-party cookie lifetimes, Global Privacy Control |
| **Downloads** | Progress, pause/resume, cancel, open and reveal; images saved converted; videos (plain files and unprotected HLS streams) saved in the quality you pick; programs always ask first |
| **Extensions** | Chrome extensions from the Web Store, a .crx/.zip or an unpacked folder; what each one can do is shown before it's added; on/off, remove, popup and options pages |
| **Site controls** | The address bar's site popover: connection security, what Shields blocked (by host), remembered permissions, erase this site's cookies and data |
| **Your data** | One JSON file, saved safely (flushed, atomic, last-save backup + 7 daily copies); back up / restore; crashes and unexpected errors go to `kite-errors.log` in the data folder (Help → Show Error Log) |

**Left out on purpose:** accounts and sync, AI features, Easels, Live Folders,
passwords and autofill (use your system's password manager), private windows (use a
Space with separate logins), auto-updates (Kite never phones home; new versions are
plain downloads). See [LAUNCH.md](LAUNCH.md) for the full list of known limitations.

### Privacy and safety

- Websites run in locked-down processes with no access to Node or Kite's own functions.
- Websites must **ask** before using your camera, mic, location or notifications.
- Links that try to open other apps ask first (mail, phone and meeting links open directly).
- Kite's own helpers run hidden from websites, so pages can't fake them.

---

## Keyboard shortcuts (defaults — change any in Settings → Keyboard)

| Keys | Action | Keys | Action |
|---|---|---|---|
| ⌘T | Command bar / new tab | ⌘L | Edit address |
| ⌘W | Close tab | ⌘⇧T | Reopen closed tab |
| ⌘D | Pin / unpin | ⌘S | Show / hide sidebar |
| ⌘⇧O | New note | ⌘⌥F | New folder |
| ⌘⇧= | Add to split view | ⌘⇧C | Copy URL |
| ⌘⌥N | Little window | ⌘⌥B | Boost this site |
| ⌘Y | Archive | ⌘, | Settings |
| ⌘1…⌘9 | Go to tab | ⌃1…⌃9 | Go to Space |
| ⌘⌥→ / ← | Next / previous Space | ⌘F | Find in page |
| ⌘⇧P | Pop out / bring back video | ⌘⇧H | History |
| ⌘+ / ⌘− / ⌘0 | Zoom in / out / actual size | ⌘P | Print |
| ⌘⇧S | Save page as… | ⌘⇧J | Downloads |
| ⌘⇧R | Force refresh (ignore cache) | | |

Every shortcut also appears in the menu bar beside its command.

---

## Tests

**One command, on macOS, Linux or Windows:**

```bash
npm run test:report         # everything this computer can check (≈5 min)
npm run test:report:quick   # same, without the slower UI tests (≈1 min)
```

It writes `test-report/`:

| File | What's in it |
|---|---|
| `report.html` | Open in a browser: ✅/❌ per feature, every failure with its reason, screenshots |
| `summary.md` | The same, as short text |
| `results.json` | Everything, for tools |
| `logs/` | Full output of each step, and Kite's own debug log |

What runs:

| Check | Where |
|---|---|
| Type check, 216 logic tests | every system |
| 154 UI tests (simulated pages) | every system |
| 23 tests in the real app (Electron), incl. security attacks and a real playing video | every system |
| Floating video on the real desktop: switches to another app for real, checks the window is a panel over full-screen apps, ignores the mouse, Kite's controls cover it, play/pause, drag and resize (no crash), mini player, show video, back, close, crash reports | **macOS only** — don't touch the mouse for about a minute |

On macOS, allow **Screen Recording** for your terminal (System Settings → Privacy & Security) to get screenshots of the floating video in the report.

### CI/CD on GitHub (`.github/workflows/ci.yml`)

| When | What happens |
|---|---|
| Push to `main`, or a pull request into `main` | `npm run test:report` on **macOS, Linux and Windows**; each report is kept with the run and its summary shows on the run page |
| All three pass on `main` | **Kite.dmg + Kite.zip** (Apple Silicon and Intel, unsigned) are built and kept with the run |
| Push a version tag, e.g. `git tag v0.2.0 && git push --tags` | Same, plus a **GitHub Release** with the app attached |

To stop anything untested reaching `main`: GitHub → Settings → Branches → add a rule for `main` →
*Require status checks to pass* → pick **Test · macOS**, **Test · Linux** and **Test · Windows**.

The UI tests run the app in a normal browser with simulated web pages that execute
the **same** injected scripts as the real app (link catcher, Boosts, zap picker).

If the Electron tests fail at once with *Process failed to launch*, your terminal has
`ELECTRON_RUN_AS_NODE=1` set (VS Code's integrated terminal does this): run them with
`env -u ELECTRON_RUN_AS_NODE npm run test:electron`.

---

## How it's built

```
src/
  shared/     pure logic, no UI — the state model and every action (fully unit-tested)
    types.ts  ops.ts  tree.ts  folders.ts  spaces.ts  split.ts  archive.ts
    commandbar.ts  links.ts  boosts.ts  zap.ts  routing.ts  notes.ts  pip.ts
    arcImport.ts  settings.ts  persistence.ts  shortcuts.ts  url.ts
  main/       Electron main process — windows, saving, permissions, page security
  renderer/   React UI — sidebar, page area, panels, little window
tests/
  unit/  e2e/  electron/  fixtures/   (sample Arc files)
scripts/    build, dev, icon, screenshot helpers
```

State is one plain JSON object. Every change is a small function in `src/shared/`
applied with Immer, then saved automatically.

Made by Mayank Jha.
