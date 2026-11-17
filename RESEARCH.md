# Arc research — how its features work

Arc **1.171.0** (build 89666, built 28 Oct 2026), `/Applications/Arc.app`, bundle id `company.thebrowser.Browser`.
Researched 4 Nov 2026 for a fresh, offline Electron + React + TypeScript rebuild.

## How to read this file

| Mark | Meaning |
|---|---|
| ✅ **Confirmed** | Seen directly in Arc's app files (text, file names, field names, config files) |
| 🟡 **Likely** | Strong hint in the files, but the exact behavior isn't proven |
| ⚪ **Guess** | From public knowledge of how Arc behaves — not checked on this Mac yet |

**Evidence codes** used below:
- **[S]** = readable text found inside Arc's program file (`Contents/MacOS/Arc`). Arc still contains its own source file names (like `WindowData+SplitViewHelpers.swift`) and its on-screen sentences.
- **[R]** = a resource file inside Arc.app (named in the line).
- **[REA]** = result from the REA tool.
- **[AS]** = Arc's AppleScript dictionary (the list of things other apps can ask Arc to do).

Raw evidence is in `research-evidence/`.

---

## 1. What Arc is built from

- ✅ Native **Swift** Mac app, not Electron. [R] `Info.plist` → `NSPrincipalClass = Arc.BrowserApp`.
- ✅ Web pages are drawn by **Chromium**, inside `Frameworks/ArcCore.framework`. [R] [S "Chromium has finished restoring session for profile"]
- ✅ App logic uses a "one big state + actions" pattern (The Composable Architecture — every change is an *action* that updates one *state* tree). [S `ComposableArchitecture`, `AppSidebarReducer.swift`]
- ✅ Each feature is its own module: `CommandBar`, `LittleBrowser`, `BoostsEditor`, `LinkRouting`, `Archive`, `SpaceStyleEditor`, `StorableSidebar` … [R `Resources/ARC_*.bundle`] — full list in `research-evidence/arc-source-file-names.txt`.
- ✅ Online parts we will **not** copy: Firebase sign-in + sync, CloudKit sync, Sentry/Datadog crash reports, LaunchDarkly feature flags, ChatGPT/"Arc Max". [S + R]

**What this means for us:** Electron's `WebContentsView` replaces Chromium-in-Swift. A single store with actions (Zustand or a reducer) matches Arc's design well.

---

## 2. Where Arc saves Spaces and tabs

- ✅ **Folder:** `~/Library/Application Support/Arc/`. [S "Failed to query application support directory", `ApplicationPaths.swift`]
  - 🟡 Folder name "Arc" itself is not spelled out in the text — macOS normally uses the app name. Confirm when you copy the files.
- ✅ **Spaces, tabs, folders, favorites, pinned:** `StorableSidebar.json`. [S, `StorableSidebar.swift`]
- ✅ Other save files Arc writes there [S, full list in `research-evidence/arc-saved-file-names.txt`]:

| File | Holds | Needed for import? |
|---|---|---|
| `StorableSidebar.json` | Spaces, tabs, folders, favorites, pinned | **Yes** |
| `StorableWindows.json` | Open windows and what each one shows | Nice to have |
| `StorableArchive.json`, `StorableArchiveItems.json` | Archived tabs | Nice to have |
| `StorableLinkRouting.json` | Link routing rules | Nice to have |
| `StorableBoostsData.json` | Boosts | Nice to have |
| `StorableARCDocuments/` (folder) | Notes | Nice to have |
| `StorableProfiles.json` | Profiles (which Space uses which login set) | Nice to have |
| `StorableKeyBindings.json` | Custom shortcuts | No |
| `User Data/` (Chromium) | Cookies, passwords, history | **Never** — private |

- ✅ macOS **blocks** Claude from opening this folder directly (protected location). You must copy the JSON files into `MArc/` yourself.

### 2a. Shape of `StorableSidebar.json`

✅ **These field names exist in Arc** [S, exact matches]: `sidebar`, `sidebarSyncState`, `containers`, `spaces`, `items`, `topAppsContainerIDs`, `containerIDs`, `childrenIds`, `parentID`, `title`, `savedURL`, `savedTitle`, `timeLastActiveAt`, `isUnread`, `createdAt`, `customInfo`, `iconType`, `emoji_v2`, `windowTheme`, `profile`, `directoryBasename`, `tab`, `list`, `splitView`, `easel`, `arcDocument`, `arcDocumentID`, `pinned`, `unpinned`, `global`.

⚪ **How they fit together (guess, from public Arc-export tools — verify on your real file):**

```text
{ sidebar: { containers: [ {global:{}}, {                        ← 2nd entry is the real data
    spaces: [ "id1", {space}, "id2", {space}, ... ],             ← flat list: id, object, id, object
    items:  [ "idA", {item},  "idB", {item},  ... ],
    topAppsContainerIDs: [ {default:true}, "favContainerId", ... ]  ← favorites per profile
}]}}

space = { id, title, containerIDs: ["pinned","<pinnedId>","unpinned","<unpinnedId>"],
          customInfo: { iconType: { emoji_v2: "🚀" }, windowTheme: {...} },
          profile: { default: true } | { custom: { _0: { directoryBasename: "Profile 1" } } } }

item  = { id, parentID, childrenIds: [...], title, createdAt, isUnread,
          data: { tab: { savedURL, savedTitle, timeLastActiveAt } }   ← a tab
              | { list: {} }                                          ← a folder
              | { splitView: {...} } | { easel: {...} } | { arcDocument: { arcDocumentID } } }
```

- ✅ Everything is a **tree of items**: a Space has a "pinned" container and an "unpinned" container; folders hold children; tabs are leaves. [S `parentID`, `childrenIds`, "Item belongs to an outdated unpinned container… parentID"]
- ✅ A Space links to a **Profile** (separate cookies/logins). [S "Edit Space profile", "Arc has reverted to using your Default profile for space(s)"]
- ✅ Arc can already **export Spaces and tabs as Markdown**. [S "Button label; exports Arc Spaces and tabs as Markdown."]

**Importer plan:** read `StorableSidebar.json` → walk the tree → make our Spaces / Pinned / Folders / Today tabs / Favorites. Copy only titles, URLs, emoji icons and colors. No cookies, no logins.

---

## 3. Features, one by one

### 3.1 Sidebar tabs
- ✅ Tabs live in a **vertical sidebar**, not a top bar. [S `SidebarContainer`, `AppSidebarReducer.swift`]
- ✅ Each tab sits in one of three places: **Favorites** ("topApp"), **Pinned**, or **Unpinned** (Today). [AS `location: 'topApp' | 'pinned' | 'unpinned'`]
- ✅ "Tidy unpinned tabs" and "Clear unpinned tabs in this space" buttons. [S]
- ✅ Optional **tidy titles**: tab titles get shorter when you pin them. [S "Have your tabs automatically renamed with tidier, shorter titles when you Pin them."]
- ✅ Hover a Folder / Pinned / Favorite tab → **preview card**. [S "Hover your mouse over an Arc Folder, Pinned, or Favorited tab to quickly preview…"]
- ✅ Recently closed tabs can be undone. [S `ClosedSidebarItemsCache.swift`, `ArcUndoManager`]
- ⚪ Drag to reorder; New Tab button at the bottom opens the Command Bar.

### 3.2 Favorites
- ✅ Icon-only tiles at the **top of the sidebar** — "Favorites keep your most used sites and apps close". [S]
- ✅ Favorites belong to a **Profile**, not a Space — so Spaces that share a profile share favorites. [S "Each Profile has different browser data, so you might… see different Favorites up top"; `topAppsContainerIDs` keyed by profile]
- ✅ Commands: favorite / unfavorite / move current tab to Favorites. [S query candidates]
- ✅ ⌘1…⌘9 can include or skip Favorites (a setting). [S "Include Favorites in ordering.", `excludeFavoritesInSwitchToNthTab`]

### 3.3 Pinned tabs
- ✅ "Like a bookmarks bar, your Pinned Tabs keep the things you need within reach." [S]
- ✅ A pinned tab **remembers its home URL**. If you browse away, you get **"Back to Pinned URL"**, and you can **"Edit the pinned URL"** or replace it. [S]
- ✅ Closing a pinned tab can **"Close and Keep Pinned"** — it unloads but stays in the sidebar. [S]
- 🟡 Pinned tabs are **never auto-archived** — only unpinned (Today) tabs are. [S `AutoArchiveType`; public Arc behavior]

### 3.4 Folders
- ✅ Folders live in the pinned area and can be **nested**. [S `WindowData+Folders.swift`, "Action to pin this tab to a folder"]
- ✅ Can hold tabs, Notes, Easels, split views. [S "Creates a new folder for your tabs, Easels, Notes, and everything else… Supports multiselect"]
- ✅ Expand all / collapse all in the current Space. [S]
- ✅ Deleting a folder **archives** the tabs inside. [S "Deleting this folder will archive the tabs inside it."]
- ✅ "Live Folders" (auto-filled from GitHub/Notion etc.) exist. [S `LiveFoldersFeature`] — needs online services, **skip**.

### 3.5 Auto-archive
- ✅ Unpinned tabs you haven't used for a while move to the **Archive**. Default: **12 hours**. [S "Arc archives tabs that you haven't used in the past 12 hours."]
- ✅ Choices: **1 hour, 6 hours, 12 hours, 24 hours, 7 days, 30 days, never**. [S "Auto archive threshold; …" ×7]
- ✅ Setting is **per profile**; Arc asks whether to apply a change to all profiles. [S `AutoArchiveTimeThresholdsPerProfile`, dialog strings]
- ✅ Little Arc windows have their **own** archive timer. [S "Archive Little Arcs after:", `autoArchiveLittleArcTimeThreshold`]
- ✅ Based on each tab's **last-active time**, checked by a **timer**. [S `timeLastActiveAt`, `autoArchiveTimer`, `autoArchiveStartTime`]
- ✅ Archive page: browse, restore, **Clear Archive**. [S "Are you sure you'd like to Clear Archive?"]
- ✅ Toast: "Auto archived %d tabs". [S]

### 3.6 Spaces
- ✅ A Space = a named set of pinned + unpinned tabs — "for your work tabs, personal tabs, or otherwise". [S]
- ✅ Each Space has: **name, icon (emoji), color theme, profile**. [S "Edit Space theme", "Edit Space profile", `customInfo`, `emoji_v2`, `windowTheme`]
- ✅ Theme editor has **light / dark / automatic**. [R `SpaceStyleEditor.bundle/{sun,moon,automatic}.json`]
- ✅ Switch with a shortcut per position ("1st Space"…); drag to reorder; delete closes its tabs. [S]
- ✅ Move tabs between Spaces; move Spaces between profiles. [S]
- ⚪ Swipe two fingers left/right on the sidebar to switch Spaces; ⌃1…⌃9.

### 3.7 Command Bar
- ✅ Opens with **⌘T**; "search the web, navigate to recent tabs, launch an extension, and more". [S]
- ✅ Result types include: open URL / search, **switch to open tab** (even inside a split view), history, actions (e.g. "Clean up Folders", "Create new folder with items"), Spaces ("Focus on <space>"). [S captions]
- ✅ **De-duplicates** results by title + host for sites like figma.com, notion.so, github.com. [R `CommandBar.bundle/command_bar_behavior.json`]
- ✅ Has a ranking model with extra saved ranking data. [S `CommandBarAdditionalRankingDataStoreClient`]
- ✅ ⌘L edits the current URL; Copy URL buttons. [S]
- Skip: ChatGPT in Command Bar (online).

### 3.8 Split View
- ✅ Show **2–4 pages side by side** in one tab. [S "Jumps to the fourth Split View page"]
- ✅ Add left / right / top / bottom; flip between **vertical and horizontal**. [S menu strings]
- ✅ Create by **dragging a tab from the sidebar into the middle** of the page. [S "Drag a tab from your sidebar into the middle of the screen to create a Split View."]
- ✅ A split view is **one sidebar item**; "separate a tab from split view" undoes it. [S `splitView` item data, "Fallback title for a sidebar split view item"]
- ✅ Layout sizes are remembered. [S `SplitViewLayoutCache.swift`]

### 3.9 Peek
- ✅ "A way to preview a link without opening a new tab." [S]
- ✅ Opens when clicking a link **from a Pinned/Favorite tab to another site**, or with **Shift+click**. [S "Open a Peek window when clicking on links to other sites", "…with Shift held"]
- ✅ Floats over the page; **Esc** closes it; closing can be undone. [S]
- ✅ Can be expanded into a full tab. [S `WindowData+Expansion.swift`]

### 3.10 Little Arc (small window)
- ✅ "A smaller, simpler Arc window… perfect for quick lookups." [S]
- ✅ **Links from other apps** open here (setting). [S "Links from other apps open in Little Arc"]
- ✅ Has its own **global hotkey** (works when Arc isn't in front). [S `globalLittleBrowserHotkeyEnabled`, `GlobalHotkeyListenerClient`] — ⚪ default ⌥⌘N.
- ✅ **⌥⌘+click** a link opens it in Little Arc. [S "Open Little Arc when clicking on links with ⌥⌘ held"]
- ✅ **"Open in"** button moves the page into a full window / a chosen Space. [S]

### 3.11 Boosts (change how a site looks)
- ✅ Per-site edits; can be turned on/off per site from the site menu. [S "Enable Boosts on websites you visit", "Subtitle for active/inactive Boost"]
- ✅ Kinds: **CSS**, **JS**, **Zap** (hide an element). [S `editCSS`, `editJS`, `zaps`, "Zap all related elements"]
- ✅ Zap picker: hover an element → highlight → build a **CSS selector** (with `:nth-child`) → hide it. [REA `ev_a924df20…` on `SelectorPicker.js`]
- ✅ Disabled in Incognito. [S]
- ✅ Saved in `StorableBoostsData.json`. [S]
- Skip: sharing Boosts by link (needs Arc's server).

### 3.12 Link routing ("Air Traffic Control")
- ✅ "Routes let you choose where specific sites open inside Arc. For example, you can route Spotify links to always open inside your Personal space." [S]
- ✅ Has a **default destination** plus a list of **rules**. [S `defaultLinkRoutingDestination`, `LinkRoutingRuleChangeType`, `matchType`]
- ✅ Applies to links **from other apps**. [S `externalLinkDestination`]
- ✅ Saved in `StorableLinkRouting.json`. [S]
- 🟡 Rule = "URL contains / host matches X" → open in Space Y or Little Arc. Exact match options unknown.

### 3.13 Notes
- ✅ "Creates a new Note beside your current page." Lives in the sidebar like a tab. [S, `arcDocument` item data]
- ✅ Rich text editor. [R `ARC_ArcRichTextEditor.bundle`]
- ✅ Saved under `StorableARCDocuments/`. [S] Notes > 1 MB can't sync. [S]
- ✅ Arc has **deprecated Notes** (shows an end date + export option). [S "Notes deprecation", "Alert button; Export notes."]
- Related: **Easels** (freeform canvas) exist, also deprecated-looking — **skip** unless you want them.

### 3.14 Other things found (not on your list)
- Profiles, Incognito windows, picture-in-picture, media controls, native ad blocker, Captures (screenshots), Downloads page, keyboard shortcut editor. [S/R]

---

## 4. What I could not check yet

| Item | Why | How to fix |
|---|---|---|
| Exact JSON nesting (§2a) | Arc's data folder is macOS-protected | You copy `StorableSidebar.json` into `MArc/` |
| Watching Arc on screen | Claude needs **Screen Recording + Accessibility** in macOS settings; then quit + reopen Claude | Optional — and even then browsers are **look-only** for Claude (no clicking) |
| Default shortcuts (⌘S, ⌥⌘N, ⌃1…) | Stored in a compiled menu file | Live look, or you confirm |
| Deep code logic (decompiling) | REA's decompiler needs Ghidra/Hopper on macOS; my shell is Linux | Not needed for a rebuild |

## 5. Tools used
- **REA 6.7.0** via its command line (`npx rea-agents@6.7.0`): `doctor`, `analyze-javascript-application` (worked); `inspect-macho`, `inspect-plist`, `demangle-swift` (refused — need a macOS host).
- `strings` on the Arc program file (944k lines of text), Arc's `Info.plist`, resource bundles, AppleScript dictionary.
- **Nothing from Arc goes into the new app** — only behavior notes. No code, name, logo or icons.

---

## 6. Build status (Kite, 4 Nov 2026)

Every feature in §3 was rebuilt from these notes, written fresh. See README.md for how to run it.

| Feature | Built | Differences from Arc |
|---|---|---|
| Sidebar tabs, Favorites, pinned tabs, folders | ✅ | Favorites are shared by all Spaces (Kite has no profiles) |
| Auto-archive + Archive | ✅ | Same choices (1h … 30d, never), per-Space override |
| Spaces | ✅ | Two-colour themes, light/dark/auto, grain |
| Command bar | ✅ | No ChatGPT (offline) |
| Split View | ✅ | 2–4 panes, rows or columns |
| Peek | ✅ | Pinned-tab external links + shift-click |
| Little window | ✅ | Global hotkey ⌘⌥N |
| Boosts | ✅ | CSS, font, zap, script; sharing by file (scripts never shared) |
| Link routing | ✅ | Rules → Space / little window / current Space |
| Notes | ✅ | Rich text, Markdown export |
| Auto picture-in-picture (`PictureInPicture`, `disableAutoPipGlobally` in §1) | ✅ | Pops out on tab or app switch, returns when you come back; mute from the sidebar |
| Arc import | ✅ | Reads `StorableSidebar.json` (both layouts in §2a); Arc note text isn't readable, so notes import by title |
| Easels, Live Folders, sync, profiles, AI | ❌ | Left out on purpose (online-only or out of scope) |

**Still to confirm with your real file:** the exact nesting in §2a. The importer accepts
both known layouts and reports anything it skips, so a mismatch shows up as a clear
message, not lost data.

---

## 7. Floating video over other apps on macOS (added during the build)

**Goal:** like Arc, a popped-out video stays visible when you switch to another app, including an app in full screen.

| Finding | Status | Evidence |
|---|---|---|
| Chromium's (and so Electron's) floating video window is a normal window; macOS keeps it off other apps' full-screen desktops | Confirmed | Kite's debug log on the user's Mac; [Ardia #386](https://github.com/mantrakp04/ardia/issues/386) |
| Only a *non-activating panel* may appear there; setting the panel style flag on a normal window is silently ignored | Confirmed | Kite log: `mask 32776→32776`; [Zen PR #15287](https://github.com/zen-browser/desktop/pull/15287) measured the same |
| Arc hosts its floating video in a real panel: non-activating, floating level, every desktop + full-screen auxiliary | Reported by others | Ardia's reading of Arc 1.170 ([PR #396](https://github.com/mantrakp04/ardia/pull/396)) |
| macOS asks the window `_isNonactivatingPanel`, and checks it **when the window is first shown** | Reported by others | [Ardia PR #396](https://github.com/mantrakp04/ardia/pull/396) (tested on real full-screen Spaces) |
| Swapping the window's class crashes (macOS's change-watching keeps data in the hidden class) | Confirmed | Kite crashed with SIGSEGV on the user's Mac; Ardia saw the same |

**What Kite does:** at startup on macOS it overrides `_isNonactivatingPanel`, `setLevel:` and `setCollectionBehavior:` on `NSWindow` (via koffi). When Chromium sets up a frameless, floating, every-desktop window — the video window — Kite marks it before it is shown: it answers "panel", keeps "every desktop + over full-screen apps", and doesn't bring Kite forward when clicked. Every other window gets the original answers. If this ever crashes Kite, the next launch of that build skips it.

---

## 8. Arc's design system: type, colour, motion (17 Nov 2026)

Arc 1.171.0, `/Applications/Arc.app`. Tools: **REA 6.7.0** over MCP on this Mac
(`open_binary` → `inspect_asset_catalog`, evidence `ev_291a0473ee9d…`: 48 asset
catalogs, 2,205 records, 95 colour records → 535 named colours with light/dark
values), `strings` on `Contents/MacOS/Arc` (976k lines), and the Metal shader
libraries and Lottie files in the resource bundles. Full colour table:
`research-evidence/arc-design-colors.txt`.

### 8.1 Type

| Finding | Status | Evidence |
|---|---|---|
| Window chrome (sidebar, tabs, menus) uses the **system font** (SF Pro) | 🟡 Likely | [S] `systemFontOfSize:weight:`, `systemFontSizeForControlSize:`; no bundled face is named in sidebar code |
| A `FontsManager` module ships ~90 font files: ABC Favorit (+Mono, Lining), Söhne / Söhne Breit, Pitch / Pitch Sans, GT Ultra (variable), Marlin Soft SQ, National 2, ABC Oracle, Inter, Nunito, EB Garamond, Space Mono, Inconsolata | ✅ | [R] `ARCClients_FontsManager.bundle` |
| Those faces are for content features (Boosts' font picker, Notes, Easels, onboarding), not the chrome | 🟡 Likely | [S] `FontsManager/Fonts.swift`, `FontManagerClient.swift`; the names appear beside Boosts/Easel strings |
| Most of those fonts are **commercial** (Favorit, Söhne, Pitch, GT, Marlin) — not copied. Inter, Nunito, EB Garamond, Space Mono, Inconsolata are open (OFL) | ✅ | font licences |

**Kite:** the Halo style uses the system font; a new **Rounded** font choice (SF Pro Rounded via `ui-rounded`) is available to every style.

### 8.2 Colour

| Finding | Status | Evidence |
|---|---|---|
| A 12-step **Gray**, **GrayA** (alpha) and **Indigo** scale, each with light and dark values (Radix-style: 1–2 backgrounds, 3–5 surfaces, 6–8 borders, 9–10 solid, 11–12 text) | ✅ | [REA] `ARCUI_ARCUI` catalog `Gray1…12`, `GrayA1…12`, `Indigo1…12` |
| Primary button `#3139fb` (hover `#2c33e2`, pressed `#2a30d5`); destructive `#f53714` | ✅ | [REA] `PrimaryButton*`, `DestructiveButton*` |
| Command bar: text 80% / 33% ink, row hover 5% ink, hairline 10% ink, accessory chip 5% | ✅ | [REA] `ARC_CommandBar` `CommandBarTextPrimaryColor`, `…RowHoverBackgroundColor`, `…HairlineDividerColor` |
| Sidebar border white 30%; page-over-tab-list border 5% ink; drag hint 20% / 50% ink | ✅ | [REA] app catalog `SidebarBorderColor`, `TabListOverlapBorder`, `DragHint*` |
| Space colour picker: three rows of nine swatches (Pastel, Drab, Greyscale), Display P3 | ✅ | [REA] `ARC_SpaceStyleEditor` `ColorPicker{Pastel,Drab,Greyscale}1…9` |
| Space theme = **primary colour as hue/saturation/lightness + second colour as a hue offset**, driven by a colour wheel, plus grain and intensity | ✅ field names | [S] `primaryHueDegrees`, `primarySaturation`, `primaryLightness`, `secondaryHueOffset`, `colorWheelDriven`, `noiseFactor`, `intensityFactor`, `translucencyStyle`, `min/maxContrastColor`, `lightnessRange` |
| The window background is drawn by a Metal shader: several gradient layers plus a textured overlay | ✅ | [R] `ARC_WindowThemeUI.bundle/default.metallib`: `gradientFragment`, `GradientLayer`, `colorCount`, `layerCount`, `overlayFragment`, `fromOverlayAlpha` |

**Kite:** the scales are CSS variables on every style (`--gray-1…12`, `--gray-a1…12`, `--indigo-1…12`, `src/shared/designTokens.ts`). Halo uses the command-bar and border tokens directly. **Colour wheel** in Settings → Spaces → Background: one hue, a harmony (same / neighbour / triad / opposite = the hue offset), and vividness.

### 8.3 Motion

| Finding | Status | Evidence |
|---|---|---|
| Arc has its own `Motion` module with spring animations described by **response + damping ratio** | ✅ names | [S] `Motion/ValueAnimation.swift`, `Motion/NSScreen+AnimationEnvironment.swift`, `dampingRatio`, `transitionSpring`, `springManager` |
| Sidebar rows **bounce** when clicked; icons have a bounce animator | ✅ names | [S] `SidebarBouncyClickCell.swift`, `iconBounceAnimator` |
| Page-load indicator is a **glow** shader, not a bar: inputs `progress`, `intensity`, `inset`, `cycleProgress`, `primaryColor`, `secondaryColor` | ✅ | [R] `ARC_GlowProgressLoadingIndicator.bundle/default.metallib` |
| Other named animations: animated grain, feathered cross-fading labels, flip transitions, window expansion, hover cards | ✅ names | [S] `AnimatedGrainView`, `FeatheredTransitioningLabel`, `FlipTransitionView`, `WindowExpansionAnimator`, `HoverCards/*` |
| Lottie icon animations run at 60 fps, 1 s (sun/moon/auto, home-button icons), 3 s for the logo wave | ✅ | [R] `SpaceStyleEditor/{sun,moon,automatic}.json`, `HomeButton/*.json`, `ARCUI/logo-wave.json` |
| Exact spring constants, durations, sidebar widths, corner radii | ⚪ Unknown | Compiled into the 167 MB binary as float literals; recovering them needs a full decompile (not done) |

**Kite:** springs are computed from response + damping (`springAt`, `springDuration`) and drawn as CSS `linear()` curves (`springEasing`). Our constants: default 0.38 s / 0.86, press 0.30 s / 0.58, pop 0.32 s / 0.70 — **our choice**, not Arc's. A **Springy** motion feel uses them in every style; rows and favourites spring back after a press. Halo replaces the load bar with a **glow ring** that sweeps the Space's two colours round the page edge and breathes.

### 8.4 Not copied, on purpose
Arc's fonts, icons (`icomoon.ttf`, `ionicons.ttf`), Lottie art, videos (`orb.mp4`, `background.mp4`), sounds (`event.m4a`, `capture.wav`), shader code and name. Only measurements and structure are used.

---

## 9. Ad blocking, modelled on AdGuard (17 Nov 2026)

Reference: **AdGuard AdBlocker 5.5.3.42** (Manifest V3), installed in Dia at
`~/Library/Application Support/Dia/User Data/Default/Extensions/bgnkhhnnamicmpeenaelnjfhikgbkllg/`.
Tools: REA `analyze_javascript_application` on `manifest.json`, `pages/options.js` and the
content scripts (evidence `ev_0a7f45e4da79…`, summary `ev_c52802b8e0be…`), plus the
extension's English strings (`_locales/en/messages.json`, 317 option strings), filter
catalog (`filters/filters_i18n.json`) and settings schema/defaults in `pages/background.js`.
Only behaviour and structure are used. No AdGuard code, text or art is copied.

### 9.1 What AdGuard has

| Area | Finding | Evidence |
|---|---|---|
| General | Master switch; "Block search ads and self-promotion" (= disabling the *unblocking* filter 10); "Activate the most appropriate filters automatically" (by language); auto-update period Disabled / 1 / 6 / 12 / 24 / 48 h; phishing check (online, off by default); statistics | `options_*` strings; `FiltersUpdateTime` enum; `defaultSettings` |
| Filters | 7 groups: Ad blocking, Privacy, Social widgets, Annoyances, Security, Other, Language-specific; per-list rules count + "updated" date; search box | `filters_i18n.json`; `options_filters_*` |
| First run | Turns on **AdGuard Base (2)** + **Search ads & self-promotion (10)** + language lists for the UI and browser languages | `initDefaultFilters()` in `background.js` |
| Custom lists | Add by URL or file; rejects a URL that returns a web page ("The URL returned a web page instead of a filter list"); optional "trusted" | `options_add_custom_filter_*` |
| User rules | Editor with import / export, line wrap, count of rules, limit warnings | `options_user_rules_*`, `options_userfilter_*` |
| Allowlist | Domains where nothing is blocked; **can be inverted** (block only on listed sites); stored as two separate lists | `allowlist-domains`, `block-list-domains`, `default-allowlist-mode` |
| Tracking protection ("stealth") | Off by default as a whole. Inside: hide search queries, hide referrer from third parties, send GPC + DNT, remove X-Client-Data, block WebRTC, third-party cookie lifetime (default 2880 min), first-party cookie lifetime (4320 min, off), block trackers, strip tracking parameters | `StealthOption` enum; `DEFAULT_*_COOKIES_SELF_DESTRUCT_MIN` |

### 9.2 Two engine problems found while testing (and fixed in Kite)

| Problem | Effect | Fix |
|---|---|---|
| AdGuard's lists use **CRLF** line endings; the engine keeps the `\r` inside rule options | e.g. `$removeparam=fbclid\r` never matches; many AdGuard rules silently fail | Line endings are normalised before parsing (`shieldsWorker.ts`) |
| With optimizations on, the engine merges generic `$removeparam` rules and then applies almost none of them (bisected: adding `$removeparam=pjclid` stopped `fbclid` removal in AdGuard's URL Tracking list) | tracking parameters not stripped | `$removeparam` rules go into a second engine with `enableOptimizations: false` |

Measured on this Mac: parsing AdGuard Base + EasyPrivacy + uBlock + URL Tracking + Cookie notices takes **~0.7 s** (35 MB of lists: ~2 s); loading the saved engine takes **10–40 ms**. Hence: build in a worker thread, save the result, load it at start.

### 9.3 What Kite does now

| Feature | How |
|---|---|
| On out of the box | AdGuard Base, uBlock filters + unbreak + quick fixes, EasyPrivacy, uBlock badware; language lists for macOS's languages; tracking parameters stripped. A small built-in list blocks from the first second, before anything downloads. |
| 29 lists in 6 groups | `FILTER_LISTS` in `shared/shields.ts`; AdGuard lists are fetched in their uBlock-syntax builds (`filters.adtidy.org/extension/ublock/…`) |
| Lists on disk + auto-update | `main/filterLists.ts`: per-list cache, `lists.json` metadata, retry back-off, rejects web pages, 40 MB cap; checked hourly, refreshed per "Update lists" |
| Build off the main thread | `main/shieldsWorker.ts` (worker thread), result saved to `engine.bin` / `params.bin` and reused when the lists and rules match |
| Page fixes before page scripts | `main/pagePreload.ts`, registered per session with `registerPreloadScript`: synchronous ask at document start → scriptlets run in the page world, CSS inserted as user styles; a MutationObserver asks for generic hiding rules as the page adds elements. It exposes nothing to the page. |
| Network | `main/network.ts`: block / redirect, `$csp` rules, tracking-parameter removal on page and frame navigations, referrer and search-query hiding, third-party cookie lifetime cap, WebRTC IP policy, GPC + DNT |
| Your lists, your rules, allowlist (+ invert) | Settings → **Ad blocking**; rules apply after Save without a restart; unreadable lines are listed |
| Statistics and per-site log | Total blocked (kept across restarts, can be cleared); the address-bar popover lists blocked hosts on the page |

### 9.4 Not done (on purpose or for now)

- **Online phishing check** (sends addresses to a server): replaced by offline Security lists.
- **First-party cookie lifetime** and **X-Client-Data** (Electron doesn't send that header).
- **Extended CSS selectors** (`:has-text`, `:upward`…) are skipped; native `:has()` rules work.
- A full **filtering log** window: Kite shows blocked hosts per page instead.
- "Trusted" custom lists: every list gets the same powers (scriptlets only come from uBlock's library, never from the list itself).
