# Kite visual and UX audit (running app, Electron build in dist/)

Audited 25 Nov 2026 against the built app (`dist/` built 20:02; `src/renderer/styles/app.css` 19:53, `Customize.tsx` 19:51, so the build includes the new Customize panel). Read-only: nothing in the repo was changed by this audit. Note: `src/main/main.ts` was modified by someone else at 20:12 (3 insertions), after the build, so it is not reflected here.

All screenshots are in
`/private/tmp/claude-501/-Users-apple-Personal-MArc/77deb0da-8950-4039-9159-d14524519f6f/scratchpad/audit/shots/`
(file names below are relative to that folder). Prefixes: `a` = empty profile, `b` = dark default with a realistic profile, `c`/`d` = follow-up dark captures, `L` = light. `-2x` files are native-resolution crops.

Profile used: 2 Spaces, 3 Favorites, 4 pinned items including one folder with 2 tabs, 8 Today tabs with real sites loaded, seeded history and archive. Window 1400x859 (the display is 1512 wide, so that is the widest capture).

Judging criteria: the `impeccable` critique rubric (cognitive load, Nielsen heuristics), `apple-design` (response, materials, typography, spatial consistency, reduced motion), `ui-taste` anti-slop laws (one accent, one grey family, shape lock, full state cycles, motion frequency gate). `web-design-guidelines` was not run as a formal pass; its usual checks (focus-visible, contrast, truncation, reduced motion) are applied by hand below.

---

## 1. The short answer: why it feels "okay", not premium

1. **No typographic hierarchy.** Every explicit `font-weight` in `app.css` is 500 to 800 (80 declarations: 37x600, 15x700, 13x650, 12x500, 2x550, 1x800; none regular), and there are eight font sizes between 10.5 and 14px. Tab rows, settings labels, buttons, menu items and headings all read as the same medium-bold grey. macOS chrome is regular weight with weight spent only on the selected or titled thing.
2. **It is a painted web page, not a Mac window.** The chrome is an opaque CSS gradient (`.app` background, `app.css:62`), no window vibrancy, backdrop blur is 8px (`theme.ts:163`), sidebar menus are HTML with 30px rows while the page context menu is a real native menu, and sheets pop in the centre at a different height each time.
3. **Inconsistency in the small things.** 17 distinct corner radii, 114 `box-shadow` declarations, three slider styles, three segmented-control treatments, two search-field heights, two spellings (Colour/Color), two date formats, four places to edit a theme. The tokens to fix this already exist (`--r-xs..xl`, `--elev-1..3`, `app.css:77-96`) but are used about 13 times against ~135 literals.
4. **States are weak or misleading.** Hover and selected rows are nearly the same grey; rows shrink when pressed; sleeping tabs look disabled; dark favicons (GitHub) disappear on dark; the accent fill fails text contrast.
5. **It makes you think in the wrong places.** "New Tab" appears twice and means two things; the new Customize panel has no button; the Privacy tab opens 3,090px down the page; Appearance is a three-screen wall; a new user gets a blank window with no guidance; and the periwinkle-on-slate look with a gem logo is the generic "AI app" palette rather than something that is Kite's.

Heuristic scores (Nielsen, 0 to 4): status 3, real-world match 3, user control 3 (Undo toasts, Esc everywhere), consistency 2, error prevention 3, recognition over recall 2 (key features are command-bar only), flexibility 4, minimalist design 2, error recovery 3, help 1. Total 26/40: solid function, mid polish. Cognitive-load failures: visual hierarchy, minimal choices (Appearance), progressive disclosure (Appearance, menus) = moderate.

---

## 2. Surface by surface

Format: **what is wrong** / screenshot / where / fix.

### 2.1 First launch (empty profile)
Verdict: empty and silent. Nothing explains Spaces, pinning or the command bar in the first minute.

- **No onboarding runs.** The Welcome tour exists but "nothing here runs by itself" (`src/shared/welcome.ts:2`); the only trigger is the command-bar action (`commands.ts:482`). A new user sees "Good evening", a search box and one "Add shortcut" tile. / `a01-first-launch.jpg` / `Welcome.tsx`, `welcome.ts` / Open Welcome once on an empty profile (a `settings.welcomed` flag). Three steps, each doing something: import (Arc, plus Chrome/Safari bookmarks), pick look (light/dark/auto + 3 presets, not 13 tiles), make default. Finish by landing on the start page with 4 to 6 starter Favorites.
- **Sidebar empty state is two orphan rows** ("Home", a divider, "New Tab") with 650px of nothing. / `a01-first-launch-sidebar-2x.jpg` / `Sidebar.tsx:68-80` (only Pinned has a hint, and only as a drop hint) / Quiet one-line hints in ink-3: under the Space name "Pin tabs you keep (⌘D)", under the divider "Tabs you open land here and tidy themselves after 12 hours". Remove them after the first pin and first tab.
- **The Welcome sheet itself is bland**: 64px logo, one sentence, a neutral "Continue". The third step shows 13 unlabeled tiles. / `b25-welcome-1.jpg`, `b25-welcome-3.jpg` / `Welcome.tsx:44-77` / Make "Continue" the accent primary, label every preset, and show the window changing behind an undimmed scrim.

### 2.2 Start page / new tab
Verdict: the nicest single screen, undermined by a duplicate row, misaligned widgets and a slow entrance.

- **"New Tab" twice.** Clicking "+ New Tab" adds a row called "New Tab" directly beneath the "+ New Tab" button; ⌘T does something different (opens the command bar). / `b38-home-widgets.jpg`, `d10-wide-home.jpg` / `commands.ts:167-172`, `Sidebar.tsx:103-107` / One meaning: "+ New Tab" and ⌘T both open the command bar; no placeholder row is created until a page loads. If the start page must stay a tab, hide its row while it is the active tab.
- **Widgets ignore the content column.** Greeting, search and tiles sit in a 640px centred column (x 512 to 1148); widgets start 24px from the page edge (x 287) and tall ones are cut by the window bottom. / `b38-home-widgets.jpg` / `.home-widgets` `app.css:6244` (margin `28px 24px 0`) vs column `app.css:5262` / Lay widgets on the same column grid (max 3 small across, centred) and let the page scroll.
- **Floating "+" button bottom right** is a Material FAB, not a Mac idiom, and its menu mixes adding widgets, backgrounds and three show/hide toggles. / `b39-home-customize.jpg` / `StartPage.tsx` (`home-customize`) / Replace with a small text button "Customize" (opens the Customize panel) and a right-click menu on the page.
- **Failed loads enter "Frequently visited"** after one visit ("Kite-audit-nonexist…"). / `b38-home-widgets.jpg` / history recording / Do not record history for loads that end in the error page; require 2+ visits for the frequent row.
- **Entrance is staged on every new tab**: search box rises after an 88ms delay over 330ms; tiles start at 198ms plus 40ms each over 352ms, so the page settles in roughly 0.6 to 0.9s. This is a 100-times-a-day action. / `app.css:5289`, `app.css:5464-5484` / Stage only on app launch. On later new tabs: one 120ms fade, no stagger, focus already in the field.
- GitHub tile icon is invisible on dark. / `b38b-home-2x.jpg` / see 2.3 favicons.

### 2.3 Sidebar
Verdict: structurally right (Arc model, clean left edge at x=18, traffic lights line up with the toolbar icons), but flat, heavy and ambiguous in its states.

Anatomy measured: width 264; rows 36px high on a 37px pitch, 13.5px/500, title at 78% ink; URL pill 34px, radius 10; Favorites tiles 77x48, radius 12; row radius 9; icon buttons 28x28, radius 8; Space header 30px, 13px/650. Traffic lights are not in the captures: `main.ts:235` puts them at (16,16), so their centre line is y=22 and they end near x=68; the sidebar toggle icon is centred at (92,23), which lines up. They are hidden when the sidebar is collapsed (`main.ts:905`).

- **Hover and selected look the same.** Hover is white 7%, selected white 13% plus a faint shadow; in a list you cannot tell at a glance which tab you are on. / `b04-row-hover-2x.jpg` / `--hover`, `--active` `theme.ts:102-104`; `.row:hover` `app.css:484`, `.row[data-active]` `app.css:488` / Selected: fill white 16% (light: white 90% + `--elev-1`), title 100% ink at weight 500. Hover: 5%. All other rows weight 400 at 85% ink.
- **Rows shrink when pressed.** `transform: scale(0.97)` applies to `.row`, so the row and its text jump inward on every click. / `b05-row-pressed-2x.jpg` / `app.css:4317-4326` / Remove `.row` (and `.space-header`) from that rule; pressed row = fill 10% on pointer-down, no transform. Keep the scale for buttons and Favorites tiles.
- **Dark favicons vanish.** GitHub is near-invisible in the Favorites tile, in rows, in History, the command bar and the start-page tile. / `b02-sidebar-2x.jpg`, `b06-favorites-hover-2x.jpg`, `b27-history.jpg` / `SiteIcon.tsx:37` (plain `<img>`), `.site-icon` `app.css:679` / On first load, sample the icon's mean luminance and alpha (16x16 canvas, cache per host). If it is dark and the theme is dark, draw it on a light plate (white 92%, radius 4, 1px inset); mirror for light icons in light mode.
- **Sleeping tabs look disabled.** Icon gets `saturate(0.3)` and 50% opacity, title is dimmed. A normal list ends up with random bright and grey rows and no explanation. / `b08-pinned-2x.jpg`, `L02-sidebar-2x.jpg` (the Apple icon nearly disappears in light) / `app.css:4168-4180` / Drop the icon filter. If sleep must show, title at 80% ink only; say "Asleep" in the tooltip.
- **No section hierarchy.** The Space name is styled like a row (same left edge, similar size) and the folder icon is the only accent-coloured thing in the list. / `b02-sidebar-2x.jpg` / `.space-header` `app.css:416`, `.space-name` (13px/650) / Space header as a macOS sidebar section label: 11px/600, ink-3, 14px above, 4px below, emoji 12px. Folder icon in ink-2, not accent.
- **Density.** 37px pitch shows about 17 rows at 860px height; with 4 pinned + 2 in a folder + 10 Today the list already runs under the footer. / `b38-home-widgets.jpg` / `ROW` `theme.ts:60` (30/36/42) / Compact 28, Regular 32, Roomy 36; text 13px.
- **List runs into the footer with a hard cut**, half a row visible, no fade or hairline. / `d07-narrow-settings.jpg`, `b38-home-widgets.jpg` / `.sb-scroll` `app.css:~287-298` (scrollbar hidden, no mask) / `mask-image: linear-gradient(#000 calc(100% - 20px), transparent)` on `.sb-scroll` and a 1px `--line` top border on `.sb-footer` when scrolled.
- **Space switcher uses emoji as chrome.** The kite emoji is muddy at 14px on dark and the inactive Space icon is almost invisible. / `b03c-footer-2x.jpg`, `b40-space2.jpg` / `.space-dot` `app.css:842` / Offer a small set of monochrome glyphs plus a colour dot from the Space theme; keep emoji as an option, at full opacity when inactive (use size or a dot for "active").
- **Focus ring on Space icons is clipped** top and bottom, so it renders as two brackets. / `b10-focus-ring-footer-2x.jpg` / `.space-bar` `app.css:838` (`overflow-x: auto`) / Add `padding: 3px` (and negative margin) to the bar, or draw the ring inset.
- **Footer has no Customize entry.** The sliders icon opens Settings; Customize is command-bar only. / `b03c-footer-2x.jpg` / `Sidebar.tsx:124` / see 2.6.
- Good: the row spinner and the 2px accent progress line on the page card while loading (`c01-loading-250ms-2x.jpg`, `c01b-loading-row-2x.jpg`), the keyboard focus ring on rows (`b10b-focus-ring-row-2x.jpg`), the host-first URL pill with shield count (`b07-urlpill-hover-2x.jpg`), the speaker icon on a playing tab (`b08-pinned-2x.jpg`).

### 2.4 Command bar
Verdict: fast and capable, but loud and noisy; the best feature in the app deserves the calmest surface.

- **Selected row is a full periwinkle bar with white text**: measured `rgb(143,140,255)` under `#fff` = 2.85:1 for the title, less for the URL at 75% opacity (needs 4.5:1). / `b12-cmdbar-query-2x.jpg` / `.cb-row[data-on]` `app.css:2007-2010` / Neutral selection (ink 10%, title 100% ink); accent only on the Enter glyph. If an accent fill is kept, use a fill of #5B58E0 or darker under white text.
- **"Switch to Tab" pill on every row.** Six identical pills in the empty state. / `b11-cmdbar-empty.jpg` / `.cb-pill` `app.css:2084` / Show the hint on the selected row only; other open tabs get a small tab glyph.
- **Empty state starts with the tab you are already on**, selected, so Enter does nothing useful. / `b11-cmdbar-empty.jpg` / `suggest()` in `src/shared/commandbar.ts` / Exclude the current tab; order by most recent other tabs.
- **Fuzzy matching is too loose and the highlighting shows it.** "git" returns "Kite - Wikipedia", "Toggle Light / Dark", "History", "Customize Kite", with single letters bolded across a URL. / `b12-cmdbar-query-2x.jpg` / `commandbar.ts` scoring / Require a contiguous or word-prefix match for actions; drop subsequence matches below a threshold; highlight only contiguous runs.
- **No grouping**: tabs, search, history and actions interleave. Add 11px section labels (Open Tabs, History, Actions).
- **Copy**: "git — search google". / Use "Search Google for “git”".
- **Row metrics**: min-height 46, radius 11; panel radius 18; footer hint bar always on. / `app.css:1149-1156`, `1997-2005` / Rows 40px, radius 8, panel radius 14; hide the footer hints after the first few uses.
- Good: opens in about 160ms, long titles and URLs truncate cleanly (`b14-cmdbar-long-2x.jpg`), ⌘L pre-fills the address (`b15-cmdbar-editurl.jpg`).

### 2.5 Context menus
Verdict: usable, but they are web menus sitting beside native ones.

- **Two menu systems.** Sidebar menus are HTML (`ContextMenu.tsx`, `.menu` `app.css:1191`); the page/link menu is `Menu.popup()` (`main.ts:752-809`). Different material, row height, font weight and animation. (The native menu cannot be captured with `capturePage`.) / `b17-menu-submenu.jpg` / Use native menus for every context menu on macOS (cheapest path to "feels like a Mac app"), or match native metrics exactly.
- **Rows are 30px and the list is long**: tab menu 13 items, Space menu 12. / `b17-menu-submenu.jpg`, `b19-menu-space.jpg` / `.menu-item` `app.css:1203` / 24px rows, 13px/400, menu radius 8, item radius 5, 5px padding. Group: move "Copy as Markdown Link", "Put to Sleep", "Collapse/Expand All Folders" under a "More" submenu.
- **Submenu depth**: Move to Space → Travel → Pinned/Today is three levels for one decision. / `b17-menu-submenu.jpg` / `itemMenus.ts:153-158` / Space name moves to Today; hold ⌥ (or a second item) for Pinned.
- **Spelling**: "Edit Theme Color…" here, "Colour" in the editor it opens. / `b19-menu-space.jpg` / `Spaces.tsx:116`.

### 2.6 Settings, Space editor, Customize
Verdict: Settings is the most Mac-like surface (toolbar tabs, grouped cards) but the information architecture is lopsided and the controls disagree with each other.

- **Privacy tab opens 3,090px down.** Clicking "Privacy" lands on the "Privacy & Security" section with the whole ad-blocking page above it (`settings-main` scrollTop measured 3090). The tab id and a section id are both `privacy`, so the jump logic scrolls to the section. / `c02-settings-privacy-fresh.jpg` / `Settings.tsx:109`, `:122-128` (`resolveSettings`), tabs at `:53-58` / A tab click must always reset to top; only an explicit section link may jump. Move the full ad-blocking page behind its existing "Ad blocking ›" row.
- **Appearance is a wall**: 7 presets, 6 patterns, 14 backgrounds, 27 swatches plus 2 custom, a hue slider, Vivid, Intensity, mode, Grain, then name, icon, behaviour, delete, then Layout. About 2,400px. Meanwhile Links holds two rows. / `b21-settings-appearance.jpg`, `b22c-settings-appearance-scrolled.jpg`, `b22d-settings-appearance-scrolled2.jpg`, `b21-settings-links.jpg` / `Settings.tsx:53-58`, `ThemeEditor.tsx` / Appearance = Light/Dark/Auto, presets (labelled), Layout. Everything else behind "Customize theme…" (disclosure). Move Search engine to General; fold Links into General.
- **The theme editor exists four times**: Settings › Appearance, Edit Space sheet, Customize panel, Welcome step 3. / `b23-space-editor.jpg`, `b24-customize.jpg`, `b25-welcome-3.jpg` / One editor component in one home (Customize); the others link to it.
- **Preset tiles are unlabeled** except the selected one; orphan rows of 2 (7 in a 5-column grid, 7 in a 3-column grid). / `b21-settings-appearance.jpg`, `L24b-customize-2x.jpg` / Name under every tile; 4 columns x 2 rows (add an eighth or drop to 6).
- **Three slider styles in one card**: hue (large ringed thumb), Vivid (indented, small thumb), Intensity (different track, white fill). / `b22c-settings-appearance-scrolled.jpg` / `ThemeEditor.tsx:254+` / One slider: 4px track, 16px white knob with `--elev-1`, accent fill, label left and value right on one line.
- **Three segmented treatments**: bordered (Side: Left/Right), unbordered (Row height), and in Customize left-aligned with ragged widths (170, 110, 225, 190, 235px). / `b22d-settings-appearance-scrolled2.jpg`, `L24b-customize-2x.jpg` / `.segmented` `app.css:1665`, `Customize.tsx:47-64` / One control. In Customize: label left, control right, or full-width equal segments.
- **Icon picker has about 150px of dead space** above the emoji grid; the custom-emoji field shows an unreadable "✎". / `b22e-settings-search.jpg` / `.set-row .emoji-input` `app.css:5235`, `.emoji-grid` `app.css:1758` / Align grid to the row top; placeholder "Type an emoji".
- **Content column shifts 5px between tabs** when there is no scrollbar (Links at x=492, others 487). / `b21-settings-links.jpg` vs `b21-settings-general.jpg` / `.settings-main` `app.css:3121` / `scrollbar-gutter: stable`.
- **At 900px wide the toolbar collapses** to six unlabeled 20px icons in the top-left; title and search disappear. / `d07-narrow-settings.jpg` / `app.css:3211`, `:3534` / Keep labels down to about 760px with tighter padding; keep search as an icon that expands.
- **Customize has no entry point** other than typing its name, although it is the right tool for "change the look". / `b24-customize.jpg` / `Customize.tsx:2` / Footer sliders button opens Customize (anchored to that corner), with "All settings…" already in its footer; ⌘, opens Settings.
- **Weights**: section title 18/700, group title 13/600+, row label 13/600. / `b22-settings-general-2x.jpg` / Row labels 13/400, group titles 13/600, section 15/600.
- **Spelling**: "Colour", "Colours", "Behaviour" next to "Favorites", "Customize", "Color". / `ThemeEditor.tsx:127,222,254`, `Settings.tsx:302`, `StartPage.tsx:190`.
- Good: the toolbar-tab layout, grouped cards with hairlines, live search with highlight (`b22e-settings-search.jpg`), key-cap editor (`b21-settings-shortcuts.jpg`), danger zones clearly separated.

### 2.7 Sheets and popovers (History, Archive, Downloads, Edit Space, Welcome, site info)
Verdict: one component, five personalities.

- **Vertical position jumps.** Sheets are vertically centred, so the title sits at y=48 (History), 155 (Archive), 237 (Downloads), 290 (Welcome). / `b27-history.jpg`, `b28-archive.jpg`, `b26-downloads.jpg`, `b25-welcome-1.jpg` / `.sheet-scrim` / Anchor every sheet's top at 12% of the window height (or as a macOS sheet from the top of the page card).
- **Search field differs and its focus ring is broken.** History's field is 18px tall (squashed), Archive's is 40px (measured), and both show a square-cornered 2px accent outline, offset 2px, on a radius-0 input inside a radius-12 container. / `b27-history.jpg`, `b28-archive.jpg` / `.search-box` `app.css:1868-1882`; the generic `:focus-visible` rule at `app.css:4986` overrides `outline: none` / One 32px field, radius 8; ring on the container via `:focus-within`, none on the input.
- **Primary button is inconsistent.** "Done" (Edit Space) is accent; "Continue" (Welcome) is neutral; destructive buttons are outlined red on the left. / `b23-space-editor.jpg`, `b25-welcome-1.jpg` / `.btn`, `.btn.primary` `app.css:1535-1561` / One accent primary at the right of every footer; secondary neutral; destructive red text, no outline.
- **Shape**: sheet radius 20, title 22px/700 with -0.02em. Heavy for a utility sheet. / `.sheet` `app.css:1431`, `.sheet-title` `app.css:1456` / Radius 14, title 15/600; keep the big title for Welcome only.
- **Date labels differ**: "MONDAY, NOVEMBER 23" (History) vs "MON, NOV 23" (Archive). / `HistoryPage.tsx`, `ArchivePage.tsx` / One formatter.
- **Site-info popover**: three outlined buttons at the bottom, "On" in accent as body text, and it covers the Favorites. Acceptable; tidy by making the two settings links plain text links. / `b31-siteinfo.jpg` / `.site-info` `app.css:4456` (radius 16).
- **Downloads empty state** is two paragraphs of caveats before the user has downloaded anything. / `b26-downloads.jpg` / Show "No downloads yet" and move the DRM note behind "Why can’t some videos be saved?".

### 2.8 Page-level surfaces (Split, Peek, Find, zoom, note, toast, error, little window)
Verdict: generally good; these are the most finished parts.

- **Split View**: each pane has a 30px bar with four always-visible 12px icons (swap, flip, pop out, close), about 20px targets; the focused pane has a 2px accent outline. Adding an already-open tab left the original "The Verge" row in the list as well. / `d05-split.jpg`, `d05b-split-top-2x.jpg`, `d05c-split-sidebar-2x.jpg` / `.pane-bar` `app.css:2144`, `.pane-frame` `app.css:2133` / Show pane actions on bar hover; 24px targets; focus ring 1.5px at 70% accent; move, do not copy, an existing tab into the split.
- **Peek**: clean. Header buttons "Split" and "Open" are outlined web buttons; radius is `--radius + 4`. / `c03-peek.jpg`, `c03b-peek-top-2x.jpg` / `.peek` `app.css:2293` / Borderless toolbar buttons as in the sidebar.
- **Find bar**: floats top-right over page content (covers GitHub's Sign in / Sign up). Works; consider docking it under the top edge of the page card and pushing content down as Safari does. / `b29-find.jpg`, `b29b-find-2x.jpg` / `.find-bar` `app.css:1087`.
- **Zoom badge and shield count** in the URL pill are clear. / `b30-zoom-badge-2x.jpg`.
- **Note**: good typography (large title, comfortable body). The toast overlaps the note's status line. / `b35-note.jpg`, `b36-toast.jpg`.
- **Toast**: hard-coded warm dark `#1e1c1a`, rendered light-on-dark-inverted in dark mode, radius 12. / `b36b-toast-2x.jpg` / `.toast` `app.css:1274` / Use `--overlay` with blur, offset 16px above any bottom bar.
- **Load error**: clear and well written ("Site not found… Check it for typos", Try again). / `b37-load-error.jpg`.
- **Little window**: good; the title shows a letter tile instead of the site's favicon, and "Open in Kite" is a large accent split button that dominates a 560px window. / `c11b-little-page.jpg` / Favicon lookup parity; neutral button.
- **Sidebar hidden / slide-out**: correct and tidy. / `b41-sidebar-hidden.jpg`, `b42-sidebar-slideout.jpg`.
- **Narrow and minimum sizes**: layout holds at 900x600 and 720x480 apart from Settings (2.6). / `d06-narrow-900.jpg`, `d09-min-720-home.jpg`.

### 2.9 Light theme
Verdict: noticeably more refined than dark. The white selected row with a soft shadow reads clearly; chrome is a calm lavender-grey. / `L01-overview.jpg`, `L02-sidebar-2x.jpg`
- Widgets and some cards are warm cream on a cool lavender page (two grey families). / `L38-home-widgets.jpg` / `.widget` `app.css:6247` (`--overlay`), body `#f4f1ec` `app.css:16`.
- Sleeping-tab icons wash out (Apple icon). / `L02-sidebar-2x.jpg`.
- Command-bar selection is a darker indigo here and passes contrast. / `L11-cmdbar-empty.jpg`.

---

## 3. Cross-cutting findings

### 3.1 Consistency ledger
| Thing | Found | Use |
|---|---|---|
| Corner radius | 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 18, 20, 28px (row 9, menu item 7, menu 12, URL pill 10, tile 12, toast 12, site info 16, command bar 18, widget 18, sheet 20) | 5 control-inner, 8 control, 10 field/popover, 14 sheet/card, page card = user setting |
| Shadows | 114 declarations, most one-off | `--elev-1` rows/knobs, `--elev-2` popovers/menus, `--elev-3` sheets/command bar |
| Font sizes | 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14 (+ 15 to 40) | 11 caption, 12 secondary, 13 body, 15 title, 20/28 display |
| Weights | 500, 550, 600, 650, 700, 800 | 400 body, 500 selected/buttons, 600 titles |
| Buttons | `.btn` 32px/600 with inset border; `.btn.small` 28px; `.toast-action` 26px; primary accent or neutral by sheet | 28px/500 standard, 22px small; one primary per surface |
| Inputs | `.input` 36px radius 10; search-box radius 12 rendering 18px (History) or 40px (Archive); settings search 30px radius 10; start input 56px | 32px radius 8 everywhere except the start page |
| Sliders | 3 looks | 1 |
| Segmented | 3 looks | 1 |
| Menus | HTML (sidebar) + native (page) | native on macOS |
| Greys | warm ink `rgb(241,239,234)`, `#1e1c1a`, `#f4f1ec` on cool slate/lavender chrome | one cool-neutral family |
| Spelling | Colour/Behaviour vs Color/Favorites/Customize | US throughout |

### 3.2 Colour and identity
- Default "Quiet" (slate `#7b82a8` at 20% + periwinkle `#8f8cff`, `spaceTheme.ts:29`) is calm but generic: with the faceted-gem logo it reads as Linear/Discord/AI-app indigo. The presets (Indigo Tide, Ember, Rosewood) are purple-led gradients with a glow pattern.
- Accent is overused as a fill: command-bar selection, toggles, sliders, Make Default, Try again, Done, split focus ring, folder icon, calendar today, selection rings.
- White on `#8f8cff` is 2.85:1 (measured on Make Default and the command-bar row in dark; Try again and Done use the same fill).
- Recommendation: neutral graphite chrome by default (Graphite preset tuned cooler), one signature accent that is Kite's own (a clear sky blue such as `#2F7FF7`, or a kite-tail vermilion `#F0603A`), used only for primary buttons, toggles/sliders, focus rings and the loading line. A custom monochrome kite glyph for the default Space instead of the emoji.

### 3.3 Materials and depth
- No window vibrancy; the "frost" is a gradient. `--blur` is 8px (`theme.ts:163`) with `saturate(1.3)`; menus and sheets look like tinted rectangles.
- Page-versus-chrome boundary is crisp (8px gap, 12px radius) but the card has no visible lift in dark.
- Fix: on macOS set `vibrancy: 'sidebar'`, `visualEffectState: 'followWindow'` and a translucent chrome layer (keep the gradient at 55 to 70% alpha so Space colour still tints it); menus/popovers `blur(30px) saturate(1.8)`; a 1px top inner highlight on floating surfaces; page card `--elev-2`. Honour `prefers-reduced-transparency` (not handled today; only reduced-motion and contrast are, `app.css:3961, 5012`).

### 3.4 Motion (read from CSS and `flip.ts`; not observed)
| Transition | Value | Verdict |
|---|---|---|
| Tab switch | visibility swap, no animation (`app.css:947-956`) | Correct |
| Hover / press | 120ms; press-in 70ms, release 160ms (`app.css:4307-4326`) | Good timing; remove scale on rows |
| Menu in | 220 x 0.6 = 132ms, origin top-left (`app.css:4253`) | Good; origin should follow the trigger corner |
| Command bar | 160ms pop (`app.css:1155`) | Good |
| Sheet in | 242ms, y+10 and scale .975 (`app.css:4194`) | Fine; exits 121ms |
| Toast | 286ms (`app.css:4265`) | Slightly slow; 200ms |
| Space switch | 260ms slide 24px + fade (`app.css:1367-1387`) | Fine |
| Row reorder (FLIP) | 240ms move, 160ms enter (`flip.ts:58,66`) | Good |
| Sidebar slide-out | 275ms transform, 176ms opacity (`app.css:2951`) | Borderline for a frequent hover; 200ms |
| Start page | 330ms after 88ms; tiles 352ms after 198ms + 40ms each (`app.css:5289, 5464`) | Too slow for every new tab |
| Window background | 450ms ease both ways (`app.css:63`) | Fine (theme change is rare) |
Motion "feel" is user-selectable (Calm/Snappy/Bouncy); "Bouncy" applies overshoot to non-gesture surfaces such as menus and sheets, which Apple reserves for momentum. Keep the option but exclude menus, sheets and toasts from overshoot.

### 3.5 Flow friction
| Task | Steps today | Note |
|---|---|---|
| Open a URL | ⌘T, type, Enter | Good. Sidebar "+ New Tab" does something else (start page tab). |
| Switch tab | click, ⌃Tab, ⌘1-9 | Good; selected row hard to spot. |
| Pin a tab | ⌘D, or right-click › Pin, or drag above divider | Good. No visible hint that the divider is a boundary. |
| Make a folder | right-click › Move to Folder › New Folder…, or Space "…" › New Folder, or ⌘⌥F | 3 clicks and hidden; add "New Folder" to the pinned-area right-click and a "+" on Space-header hover. |
| Create / switch Space | "+" in footer; click icon, ⌃1-9, swipe | Good. |
| Split two tabs | ⌘⇧= opens a picker, or right-click › Open in Split View, or drag onto page | Fine; picker copies instead of moving an open tab. |
| Find a setting | footer icon › search | Good. Privacy tab bug costs a scroll every time. |
| Change theme | footer icon › Appearance › scroll; or ⌘T "customize" | The fast path is hidden. |

---

## 4. Top 25 changes, ordered by impact on perceived quality

1. **Set the type scale and weights**: body 13px/400, selected row and buttons 500, titles 600; sizes 11/12/13/15/20/28 only. Replace every 550/650/700/800 and the 10.5/11.5/12.5/13.5 sizes in `app.css`.
2. **Make the selected tab unmistakable and stop rows shrinking**: selected fill 16% (light: white + `--elev-1`), hover 5%, pressed 10% on pointer-down; remove `.row` from the `scale(0.97)` rule (`app.css:4317-4326`).
3. **Fix invisible and washed-out favicons**: luminance-aware plate in `SiteIcon.tsx`; delete the `saturate(0.3)`/50% sleeping-tab filter (`app.css:4168-4180`).
4. **Give the window a real material**: macOS vibrancy under a translucent chrome layer, popover blur 30px/saturate 1.8 (`theme.ts:163`), inner top highlight, page card `--elev-2`.
5. **Adopt the tokens that already exist**: radii 5/8/10/14, shadows `--elev-1..3`; remove the ~135 literal radii and ~100 one-off shadows.
6. **Calm the command bar**: neutral selection (or a darker accent that passes 4.5:1), "Switch to Tab" hint only on the selected row, exclude the current tab, section labels, stricter fuzzy matching, "Search Google for “…”".
7. **One meaning for New Tab**: "+ New Tab" and ⌘T both open the command bar; no placeholder "New Tab" row.
8. **Restrain the accent and pick Kite's own**: accent only on primary buttons, toggles, sliders, focus rings, loading line; replace periwinkle `#8f8cff` with a signature colour that passes contrast under white text; folder icon neutral.
9. **Restructure the sidebar**: Space name as an 11px/600 section label, row heights 28/32/36, neutral folder icon, fade mask above the footer.
10. **Fix the Privacy tab jump** (opens 3,090px down; `Settings.tsx:109-128`) and add `scrollbar-gutter: stable` to `.settings-main`.
11. **Cut Appearance to one screen**: mode, labelled presets, layout; the rest behind "Customize theme…". Move Search engine into General and remove the Links tab.
12. **Give Customize a front door**: footer sliders button opens Customize; ⌘, opens Settings; one theme editor instead of four.
13. **Unify sheets**: top-anchored at 12%, radius 14, title 15/600, three widths, one accent primary on the right, destructive as red text.
14. **One search field**: 32px, radius 8, ring on the container; fixes the 18px/40px mismatch and the square focus outline in History and Archive.
15. **Use native context menus on macOS** for sidebar items (or match them: 24px rows, 13px/400, radius 8/5) and shorten the tab and Space menus with a "More" submenu.
16. **Run a real first launch**: auto-open a three-step Welcome on an empty profile (import, look, default browser), starter Favorites, one-line hints in the empty Pinned and Today areas.
17. **One slider, one segmented control, one pop-up button** across Settings, Edit Space and Customize; in Customize align label left / control right.
18. **Align the start page**: widgets on the 640px column grid, scrolling page, replace the floating "+" with a quiet "Customize" button, keep failed loads out of Frequently visited.
19. **Make new tab instant**: stage the start-page entrance only at app launch; otherwise a single 120ms fade (`app.css:5289, 5464-5484`).
20. **Keep Settings usable at half-screen width**: labelled tabs and search down to about 760px (`app.css:3211, 3534`).
21. **One grey family**: replace warm `rgb(241,239,234)`, `#1e1c1a`, `#f4f1ec` and the cream widget surface with cool neutrals that match the chrome.
22. **Space switcher**: monochrome glyph set plus colour dot, inactive icons at full opacity, fix the clipped focus ring (`app.css:838`).
23. **Copy pass**: US spelling everywhere (Color, Behavior), one date format in History and Archive, label every preset, shorter Downloads empty state.
24. **Quiet the Split View and Peek bars**: pane actions on hover, 24px targets, 1.5px focus ring, borderless Peek buttons; move an already-open tab into a split instead of duplicating it.
25. **Finish the edges**: toast on `--overlay` clear of bottom bars, emoji-picker dead space, little-window favicon, `prefers-reduced-transparency`, no overshoot on menus/sheets in "Bouncy".

---

## 5. What is already good; do not break

- The sidebar model and its geometry: clean x=18 left edge for every icon, 8px page gap, traffic lights on the same line as the toolbar icons and hidden with the sidebar.
- Instant tab switching with no animation; fast command bar (about 160ms) and menu (about 130ms) entrances; FLIP row moves.
- Loading feedback: row spinner plus a 2px line on the page card; the shield count and zoom badge in the URL pill; host-first URL text.
- Keyboard focus ring on rows and Esc closing every overlay; Undo on close and on destructive actions.
- Settings layout: toolbar tabs, grouped hairline cards, live search with row highlight, key-cap shortcut editor, clearly separated danger zones.
- Load-error page copy and layout; Note editor typography; Peek's overall structure; sidebar slide-out.
- The light theme's selected-row treatment (white card with soft shadow) is the reference for how dark should feel.
- Customize's idea: named steps (Square/Soft/Round, Edge to edge/Floating/Airy) instead of raw numbers, applied live.
- Text contrast for ink-2/ink-3 on chrome, `prefers-reduced-motion` and `prefers-contrast` support, user-adjustable density and motion.

---

## 6. Not reached

- Native traffic lights (not in `capturePage`; position reasoned from `main.ts:235`, `:905`).
- Native page/link context menu (`Menu.popup`, `main.ts:752-809`) and the permission prompt (`dialog.showMessageBox`, `permissions.ts:70`): both are OS-drawn and blocking.
- Windows wider than 1512px (display limit).
- Motion: read from CSS and `flip.ts`, not watched.
- Drag-and-drop states, Downloads with active items, video pop-out, Boost editor in use. Boosts list, Extensions and Import sheets were captured (`b28b-boosts.jpg`, `b28c-extensions.jpg`, `b28d-import.jpg`) but not reviewed in depth.
- Audio: the speaker icon appeared on the Figma tab by chance; mute hover/toggle was not exercised.
- Peek did not close on a host-level Esc sent by the test driver; not treated as a finding because real key routing differs.
