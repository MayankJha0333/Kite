# Kite design-system audit (read-only)

Source of truth: the working tree of `/Users/apple/Personal/MArc` (uncommitted changes included).
All line numbers refer to `src/renderer/styles/app.css` as it is on disk now (6,841 lines) unless a file is named.

How the numbers were produced: `app.css` was parsed with the repo's own `postcss`; class usage was cross-checked against every `.ts/.tsx/.html` under `src/`; the default theme values were computed by bundling the real `themeVars()` with esbuild and running it in node. Scripts and their JSON output are in
`/private/tmp/claude-501/-Users-apple-Personal-MArc/77deb0da-8950-4039-9159-d14524519f6f/scratchpad/research/tools/` (`parse.mjs`, `inv1-4.mjs`, `vars.mjs`, `states.mjs`, `zones.mjs`, `entry.ts`). Nothing in the repo was modified.

Headline totals: 1,004 style rules, 3,868 declarations, 490 class names, 32 `@keyframes`, 29 `!important`, 3 container contexts, 5 `@container` queries, 6 `@media` blocks.

Uncommitted state that matters for the overhaul:
- `theme.ts:46` `FONT` was just changed from `'Figtree', …` to `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Figtree', …`.
- 12 headings in `app.css` just lost `'Bricolage Grotesque'` (now `var(--font)`), so Bricolage is imported but no longer referenced.
- New docked sheet for the Customize panel: `app.css` 4211-4243, `Sheet.tsx` `dock` prop, `Customize.tsx`, `src/shared/customize.ts`.
- `.home-fab` was restyled (6433-6453).

---

## A. Section map of app.css

### A.1 Every section, in file order

"Zone" is the ownership zone proposed in A.4. "SHARED" marks rules used by several surfaces.

| Lines | What it styles | Main component file(s) | Zone |
|---|---|---|---|
| 1-52 | Reset and base: `box-sizing`, `html/body/#root` (hard-coded `#f4f1ec`), `body.resizing`, `body.dragging`, `button`, `kbd`, `.boot` | `App.tsx`, `dnd.tsx`, `Sidebar.tsx` | A |
| 53-69 | App frame: `.app` (font, 13.5px base size, backdrop), `.app[data-side='right']` | `App.tsx`, `LittleApp.tsx` | A |
| 70-126 | CSS-side tokens on `.app` (`--r-*`, `--ease-*`, `--t-*`, `--elev-*`), dark elevations, `.grain`, `.pattern`, `.drag`, `.no-drag` | `App.tsx` | A |
| 127-221 | Sidebar shell: `.sidebar`, collapsed and peek states, `.edge-hotzone`, `.sidebar-peek-catcher`, `.sb-top`, `.sb-top-btns` | `Sidebar.tsx`, `App.tsx` | B |
| 222-251 | `.icon-btn` SHARED (43 call sites in 15+ files) | everywhere | D |
| 252-311 | `.url-pill`, `.url-lock`, `.url-text`, `.sb-scroll`, `.sb-section` | `Sidebar.tsx` | B |
| 312-413 | Favorites grid and tiles (`.favorites*`, `.fav`) | `Favorites.tsx` | B |
| 414-463 | Space header (`.space-header`, `.space-icon`, `.space-name`) | `Spaces.tsx` | B |
| 464-888 | Rows: `.row`, drop indicators, folders, `.drag-ghost` badge, row parts, `.rename`, `.site-icon` SHARED, `.list-end`, `.drop-hint`, `.hint`, `.sb-divider`, `.sb-clear`, `.sb-footer`, `.space-bar`, `.space-dot`, `.sb-resizer` | `ItemRow.tsx`, `Sidebar.tsx`, `Spaces.tsx`, `SiteIcon.tsx`, `dnd.tsx` | B |
| 889-984 | Stage and page card: `.stage`, window-drag strip, `.card`, `.surface-slot`, `.surface`, `.load-bar` | `Stage.tsx`, `WebSurface.tsx` | G |
| 985-1067 | Old empty state. Only `.empty` (987-998) is still used, by the little window. The rest is dead (A.3) | `LittleApp.tsx:179` | H |
| 1068-1084 | STRAGGLER: Kite's own Reduce Motion block (`.app[data-motion='reduced']`), global | all | A |
| 1085-1113 | Find bar | `FindBar.tsx` | G |
| 1114-1126 | Command bar scrim (`.cb-scrim`) | `CommandBar.tsx` | C |
| 1127-1147 | STRAGGLER: shared keyframes `fade-in`, `fade-up`, `pop-in` (used by 19 rules across the file) | all | A |
| 1148-1188 | Command bar shell: `.cb`, `.cb-input-row`, `.cb-icon`, `.cb-input` | `CommandBar.tsx` | C |
| 1189-1316 | Menus and toasts: `.menu*`, `.toasts`, `.toast`, `.toast-action`, `.spin` + `@keyframes spin` | `ContextMenu.tsx`, `Toasts.tsx`, `LittleApp.tsx` | C |
| 1317-1358 | STRAGGLER (sidebar): `.kite-logo`, `.drag-ghost`, `body.dragging .surface`, `.space-more`, `.folder-row .row-glyph` | `KiteLogo.tsx`, `dnd.tsx`, `Spaces.tsx`, `ItemRow.tsx` | B |
| 1359-1417 | Spaces: `.space-pane` slide keyframes, `.space-dot-wrap`, `.space-rename`, `.space-add` | `Spaces.tsx`, `Sidebar.tsx` | B |
| 1418-1491 | Sheets: `.sheet-scrim`, `.sheet`, head, title, sub, body, foot, `.spacer` | `Sheet.tsx` (every panel) | D |
| 1492-1534 | Welcome tour | `Welcome.tsx` | D |
| 1535-1734 | FORM CONTROLS, SHARED: `.btn` (+`.primary`, `.danger`, `.small`), `.field*`, `.input`, `.segmented`, `.toggle`, `.range` | `Sheet.tsx` (`Field`, `Segmented`, `Toggle`) and every panel | D |
| 1735-1841 | New/edit Space sheet: `.space-preview*`, `.emoji*`, `.swatches`, `.swatch`, `.swatch-custom` | `Spaces.tsx`, `ThemeEditor.tsx`, `Settings.tsx` | D |
| 1842-1898 | Shared text bits: `.link`, `.muted`, `.btn.danger-solid`, `.search-box`, `.empty-list` | Archive, History, Downloads, Boosts, Extensions, Routing | D |
| 1899-1976 | Archive and History list (`.arch-*`) | `ArchivePage.tsx`, `HistoryPage.tsx` | D |
| 1977-2118 | Command bar results (`.cb-badge`, `.cb-list`, `.cb-row*`, footer) | `CommandBar.tsx` | C |
| 2119-2181 | Split view: `.surface-slot[data-split]`, `.split-chrome`, `.pane-*` | `SplitView.tsx`, `Stage.tsx` | G |
| 2182-2187 | `.icon-btn.tiny` SHARED | many | D |
| 2188-2277 | Split divider, `body.resizing*`, `.card[data-split]` | `SplitView.tsx` | G |
| 2278-2338 | Peek: `.peek-scrim`, `.peek`, `.peek-bar`, `.peek-title` | `Peek.tsx` | G |
| 2339-2348 | `.btn.ghost` SHARED | many | D |
| 2349-2358 | `.peek-body` | `Peek.tsx` | G |
| 2359-2459 | Little window | `LittleApp.tsx` | H |
| 2460-2467 | `.boost-title` | `Boosts.tsx` | D |
| 2468-2481 | STRAGGLER (sidebar address bar): `.url-boost` | `Sidebar.tsx` | B |
| 2482-2592 | Boosts: `.zap-*`, `.chip` SHARED, `.warn`, `.inline-form` SHARED, `.boost-row*`, `.field-inline` | `Boosts.tsx`, Routing, AdBlock, Extensions | D |
| 2593-2640 | Routing | `Routing.tsx` | D |
| 2641-2852 | Notes editor (`.note*`, TipTap content) | `NoteEditor.tsx` | G |
| 2853-2934 | Import from Arc | `ImportArc.tsx` | D |
| 2935-2975 | Kite page shell: `.kite-page` (a container), `page-in`, `.page-close`, `.app[data-page]` overrides for the sidebar row, load bar and find bar | `Sheet.tsx` (`Page`), `Stage.tsx` | E |
| 2976-3232 | Settings chrome: `.settings` (a container), bar, tabs, search, main, body, sections, intro; `@container` 920px and 760px | `Settings.tsx` | E |
| 3233-3401 | Settings cards and rows: `.set-group-*`, `.set-card`, `.set-row*`, `.set-link` SHARED (also in sheets, AdBlock, Customize) | `Sheet.tsx` (`Group`, `Row`, `SwitchRow`), `Settings.tsx`, `AdBlock.tsx`, `Customize.tsx` | E |
| 3402-3516 | Settings misc: `.shields-status-wrap`, `.keys`, `.key-*`, `.danger-zone`, `.about*` | `Settings.tsx` | E |
| 3517-3543 | STRAGGLER `.sheet { max-height }` (3518-3520), then `@container (max-width: 720px)` for Settings | `Sheet.tsx`, `Settings.tsx` | E |
| 3544-3565 | Playing/muted indicator on a row (`.row-sound`) | `ItemRow.tsx` | B |
| 3566-3570 | `.field-inline[data-off]` | `Boosts.tsx` | D |
| 3571-3971 | Floating video controls (`.pipd*`), its own window, outside `.app` | `PipFrameApp.tsx` | H |
| 3972-4165 | Mini player (`.pipm*`), outside `.app` | `PipFrameApp.tsx` | H |
| 4166-4185 | Sleeping tabs (`.row[data-asleep]`) | `ItemRow.tsx`, `SiteIcon.tsx` | B |
| 4186-4210 | MOTION, part 1: `.sheet` `sheet-in`, scrim fades | global | A |
| 4211-4243 | STRAGGLER: docked sheet for Customize (`.sheet-scrim[data-dock]`, `dock-in`, `.cz-toggles`) | `Sheet.tsx`, `Customize.tsx` | D |
| 4244-4359 | MOTION, part 2: `.cb` animation off, `menu-in`, `toast-in`, `blur-in`, `rise-in`, sidebar peek slide, press and hover transitions for `.btn`, `.icon-btn`, `.space-dot`, `.set-link`, `.row`, `.fav`, toggle, Settings stagger, `[data-off]` | global | A |
| 4360-4449 | Address bar: `.url-sec`, `.url-host`, `.url-path`, `.url-shield` | `Sidebar.tsx` | B |
| 4450-4542 | Site info popover | `SiteInfo.tsx` | G |
| 4543-4607 | Load error page | `LoadError.tsx` | G |
| 4608-4802 | Downloads | `Downloads.tsx` | D |
| 4803-4914 | Extensions | `Extensions.tsx` | D |
| 4915-4982 | Mixed: `.shields-status`, `.chip-list`, `.perm-*`, `.space-isolated`, `.space-badge`, reduced-motion `dl-bar` | `AdBlock.tsx`, `Extensions.tsx`, `Spaces.tsx` | D |
| 4983-5020 | "Audit fixes": global `:focus-visible` ring (4986), `.input` focus, `.sb-top-btns`, `@media (max-width: 900px)`, `prefers-contrast` | global | A |
| 5021-5109 | "Details": `svg.lucide` stroke width, `::selection`, scrollbars, `.range`, system Reduce Motion, `hit-flash`, `.chip-list:empty`, focus resets for `.cb-input` and find input, Settings button lit | global | A |
| 5110-5133 | Dead keyframes `bg-drift`, `bg-swirl`, `bg-spin`, `bg-breathe`, `bg-hue` | none | A |
| 5134-5152 | `.settings-scope` chip | `Settings.tsx` | E |
| 5153-5240 | Settings → Spaces (`.space-picker`, `.space-pick*`) | `Settings.tsx` | E |
| 5241-5556 | Start page: `.start` (a container), greeting, search box, suggest list, sections, tiles, foot, `.site-icon.newtab` | `StartPage.tsx`, `SiteIcon.tsx` | F |
| 5557-5570 | STRAGGLER: toast leaving, `toast-out` | `Toasts.tsx` | C |
| 5571-5587 | STRAGGLER: `.cb-brand`, `brand-tilt` | `CommandBar.tsx` | C |
| 5588-5609 | Shared empty states (`.empty-state-*`) | Archive, History, Boosts, Routing, SourceView | D |
| 5610-5633 | STRAGGLER: sheet and kite-page leaving, `fade-out`, `sheet-out` | `Sheet.tsx` | D |
| 5634-5683 | Brand chip (`.start-brand, .cb-brand`), tile names, `.start[data-tone]`, first copy | `StartPage.tsx`, `CommandBar.tsx` | F |
| 5684-5736 | Colour wheel | `ThemeEditor.tsx` | E |
| 5737-5874 | Settings → Ad blocking | `AdBlock.tsx` | E |
| 5875-5950 | Site popover: what was blocked | `SiteInfo.tsx` | G |
| 5951-5968 | Find bar match count | `FindBar.tsx` | G |
| 5969-5977 | STRAGGLER (sidebar): address bar zoom chip | `Sidebar.tsx` | B |
| 5978-5985 | History tweaks | `HistoryPage.tsx` | D |
| 5986-6000 | About details | `Settings.tsx` | E |
| 6001-6066 | Crash screen (`.app-crash*`, rendered outside `.app`) and `.lazy-wait` | `main.tsx`, `Stage.tsx` | G |
| 6067-6134 | View Page Source | `SourceView.tsx` | G |
| 6135-6157 | "Guidelines pass": overscroll list, `text-wrap` list, menu origin | global | A |
| 6158-6238 | Home: scene background, `.start[data-tone]` second copy, engine chip, add-shortcut tile, shortcut editor | `StartPage.tsx` | F |
| 6239-6454 | Home widgets: `.home-widgets`, `.widget*`, `.wg-*`, `.home-fab` (written as one-line rules, unlike the rest of the file) | `home/WidgetLayer.tsx`, `home/widgets.tsx` | F |
| 6455-6491 | Shared: `.look-h`, `.look-inline-range` | Downloads, Settings, Extensions, SiteInfo | D |
| 6492-6543 | Theme editor: `.theme-controls`, `.swatch-rows`, `.set-theme` | `ThemeEditor.tsx`, `Customize.tsx` | E |
| 6544-6585 | STRAGGLER (sidebar): `.sb-pin-toggle`; frosted sidebar over a picture (`.app[data-backdrop] .sidebar::before`) | `Sidebar.tsx` | B |
| 6586-6639 | Theme editor: backdrop tiles | `ThemeEditor.tsx` | E |
| 6640-6650 | STRAGGLER (sidebar): pin chevron over the divider | `Sidebar.tsx` | B |
| 6651-6670 | STRAGGLER (home): `.start-foot` over a picture | `StartPage.tsx` | F |
| 6671-6683 | `.visually-hidden` utility | `ThemeEditor.tsx` | A |
| 6684-6785 | Theme editor: upload tile, gradient editor | `ThemeEditor.tsx` | E |
| 6786-6841 | STRAGGLER (downloads): segmented bar, bolt, add-URL field | `Downloads.tsx` | D |

### A.2 Stragglers worth knowing by name

Rules for a surface that sit far from that surface's section:

- Sidebar: main block is 127-888, with pieces at 1317-1358, 1359-1417, 2468-2481, 3544-3565, 4166-4185, 4360-4449, 5969-5977, 6544-6585 and 6640-6650. Its transitions are redefined at 4295-4326.
- Sheets: base 1418-1491; max-height at 3518; entry animation at 4194; docked variant at 4211; leaving animation at 5610; scrollbars at 5033; overscroll at 6136.
- Toast: base 1274; animation redefined at 4265; leaving at 5557.
- Command bar: 1114-1188, results at 1977-2118, animation switched off at 4246, brand chip at 5571 and 5634, focus reset at 5097.
- Menu: 1191; animation at 4253; transform origin again at 6154.
- Home page: 5241-5556, 5634-5683, 6158-6454, 6651-6670. The `.start[data-tone='dark']` overrides exist twice (5660-5672 and 6178-6180) with different values; the later copy wins.
- Settings: 2935-3543, then 5134-5240, 5684-5874, 5986-6000, 6492-6543, 6586-6639, 6684-6785.
- Downloads: 4608-4802 and 6786-6841.
- Reduce Motion: 1068-1084 (Kite's switch) and 5060-5076 (system setting) are two copies of the same block, 4,000 lines apart.
- Shared keyframes `fade-in`, `fade-up`, `pop-in` live inside the command bar section (1127-1146).

### A.3 Dead CSS (provable)

Never emitted by any file under `src/`:

| Lines | What | Proof |
|---|---|---|
| 1000-1003 | `.empty-mark` | no reference |
| 1005-1011 | `@keyframes kite-land` | only used by `.empty-mark` |
| 1013-1015, 1025-1031 | `.empty-title` | no reference |
| 1017-1019, 1033-1054 | `.empty-search` | only exists as a `data-testid` on `.start-search` (`StartPage.tsx:255`) |
| 1021-1023, 1056-1066 | `.empty-hints` | no reference |
| 4168, 4179 | the `.row-icon` half of two selectors | class never emitted; the `.site-icon` half is live |
| 6142 | the `.arch-list` arm of the overscroll list | class never emitted |
| 5110-5131 | `@keyframes bg-drift`, `bg-swirl`, `bg-spin`, `bg-breathe`, `bg-hue` | not named in CSS or TS |

Declarations that can never apply, because a later rule with the same selector overrides them (the Motion block wins by source order):

- `.cb` animation at 1155 (set to `none` at 4247); `.cb-scrim` animation at 4208 (set to `none` at 4250)
- `.toast` animation at 1286 (4266); `.sheet` animation at 1440 (4195); `.sheet-scrim` animation at 1428 (4208)
- `.sheet` max-height at 1435 (3519)
- `.toggle` transition at 1707 (4329); `.toggle-knob` transition at 1723 (4333)
- `.btn` transition at 1550, `.icon-btn` at 232, `.space-dot` at 854, `.set-link` at 3374 (all replaced at 4308)
- `.row` transition at 481, `.fav` at 359 (replaced at 4314)
- `.icon-btn:active` `scale(0.94)` at 241 and `.fav:active` `scale(0.96)` at 367 (both forced to `scale(0.97)` at 4322)

Tokens that are defined and never used: `--r-xs`, `--r-xl`, `--elev-3` (CSS); `--sidebar-w` (theme.ts; the sidebar width is an inline `style={{ width }}` in `Sidebar.tsx:50`); 33 of the 36 scale variables (only `--gray-a2`, `--gray-a3`, `--gray-a5` are read, once each).

One variable is used and never defined: `--font-ui` (3584), so the pip window always falls back to Figtree.

Bundled and unused: `@fontsource/inter` 400/500/600 and `@fontsource/bricolage-grotesque` 500/700 (`main.tsx:7-11`). No `font-family` in the stylesheet names either.

Not dead although they look it: `.is-editor-empty` (2739, TipTap adds it), `svg.lucide` (5024, lucide-react adds it), `body.resizing`, `body.dragging`, `html.pip-frame-doc` (added through `classList`).

Class names in TSX with no rule (hooks or unstyled): `pipd-close`, `menu-row-wrap`, `menu-chev`, `row-close`, `field-control`, `set-group`, `site-info-log`, `start-sec`, `widget-icon`.

### A.4 Proposed ownership zones

Eight zones. Verified by script: together they cover lines 1-6841 exactly once, and no rule straddles a boundary.

| Zone | Owns | Line ranges | Lines / rules |
|---|---|---|---|
| A. Foundations | reset, app frame, tokens, shared keyframes, Motion block, focus ring, scrollbars, Reduce Motion, utilities; plus `theme.ts`, `designTokens.ts`, `flip.ts` | 1-126, 1068-1084, 1127-1147, 4186-4210, 4244-4359, 4983-5133, 6135-6157, 6671-6683 | 492 / 60 |
| B. Sidebar | shell, favorites, Space header and bar, rows, folders, drag ghost, address bar | 127-221, 252-888, 1317-1417, 2468-2481, 3544-3565, 4166-4185, 4360-4449, 5969-5977, 6544-6585, 6640-6650 | 1,041 / 145 |
| C. Command bar, menus, toasts | `.cb*`, `.menu*`, `.toast*`, `.spin` | 1114-1126, 1148-1316, 1977-2118, 5557-5587 | 355 / 43 |
| D. Sheets, shared controls, list panels | `.sheet*`, `.btn`, `.icon-btn`, `.input`, `.segmented`, `.toggle`, `.range`, `.chip`, `.search-box`, empty states; Welcome, Archive, History, Boosts, Routing, Import, Downloads, Extensions | 222-251, 1418-1976, 2182-2187, 2339-2348, 2460-2467, 2482-2640, 2853-2934, 3566-3570, 4211-4243, 4608-4982, 5588-5633, 5978-5985, 6455-6491, 6786-6841 | 1,414 / 203 |
| E. Settings and theme editor | `.kite-page`, `.settings*`, `.set-*`, shortcuts, About, Spaces tab, Ad blocking, colour wheel, swatches, backdrop tiles, gradient editor | 2935-3543, 5134-5240, 5684-5874, 5986-6000, 6492-6543, 6586-6639, 6684-6785 | 1,130 / 163 |
| F. Home page and widgets | `.start*`, `.widget*`, `.wg-*`, `.home-fab`, shortcut editor | 5241-5556, 5634-5683, 6158-6454, 6651-6670 | 683 / 142 |
| G. Page area | stage, card, load bar, find bar, split view, peek, notes, site info, load error, crash screen, view source | 889-984, 1085-1113, 2119-2181, 2188-2338, 2349-2358, 2641-2852, 4450-4607, 5875-5968, 6001-6134 | 947 / 132 |
| H. Little window and pip | `.little-*`, `.empty`, `.pipd*`, `.pipm*` | 985-1067, 2359-2459, 3571-4165 | 779 / 116 |

Rules for working in parallel:

1. Zone A lands first, or at least freezes the token names first. Every other zone reads its variables.
2. The Motion block (4186-4359) deliberately redefines transitions for classes owned by B, C and D. Either zone A keeps owning all transitions and animations for `.btn`, `.icon-btn`, `.row`, `.fav`, `.space-dot`, `.set-link`, `.toggle`, `.sheet`, `.menu`, `.toast`, `.cb`, or those declarations move into the owning zones in a single commit. Editing only the earlier copy changes nothing.
3. Zone D's shared controls are consumed by C, E, F, G and H. Agree their sizes and states before anyone else restyles around them.
4. `.set-row`, `.set-card` and `.set-link` are owned by E but are rendered inside D's sheets, the docked Customize panel and the home widgets.
5. `.site-icon` (679-692, zone B) is also used on the start page, the command bar, Archive and History.

---

## B. Token inventory

### B.1 Where the variables come from

There are two sources.

1. `themeVars()` in `src/renderer/theme.ts:112-187` computes 39 named variables plus 36 scale variables plus `colorScheme`, and `App.tsx:34,67` (and `LittleApp.tsx:88,105`) writes them as an inline `style` on `.app`.
2. `app.css` defines a small set of static tokens on `.app` (76-97) and a few local ones.

Because the theme variables are inline on `.app`, a stylesheet rule on `.app` cannot override them unless it uses `!important` (the `prefers-contrast` block at 5014-5016 does exactly that). Descendants can re-scope them, and two places do (see B.4).

Everything outside `.app` gets none of them: the pip window (`.pipd`, `.pipm-wrap`) and the crash screen (`.app-crash`).

### B.2 Variables computed in TypeScript (change `theme.ts`, not CSS)

Constants that feed the formulas (`theme.ts:60-75`): `TONE.light = { base #f4f1ec, card #ffffff, ink #1e1c1a, tint 0.18→0.62 }`, `TONE.dark = { base #16171c, card #1f2027, ink #f1efea, tint 0.12→0.38 }`, `BORDER = 0.35`, `SHADOW = 0.5`, `EASE = cubic-bezier(0.16, 1, 0.3, 1)`, `DUR = 220`, `ROW = { compact 30, comfortable 36, roomy 42 }`.

Default values below are the "Quiet" theme (`DEFAULT_THEME = { colors: ['#7b82a8', '#8f8cff'], mode: 'dark', intensity: 0.2, grain: false }`) with default settings, computed by running the real function. "Light" is the same theme with `mode: 'light'`.

| Variable | theme.ts line | Formula | Driven by | Default dark | Default light | CSS uses |
|---|---|---|---|---|---|---|
| `--chrome-a` | 147 | `mix(base, colors[0], k)`, or the first gradient stop painted the same way; `k = tint0 + intensity × (tint1 − tint0)` | `theme.colors[0]`, `intensity`, `mode`, `gradient` | `#272934` | `#d4d3da` | 2 |
| `--chrome-b` | 148 | `mix(base, colors[1], k)`, or the last gradient stop | `theme.colors[1]`, `intensity`, `mode`, `gradient` | `#2b2b43` | `#d9d6f1` | 2 |
| `--chrome-mid` | 149 | `mix(a, b, 0.5)`, or the running mean of the gradient stops | same | `#292a3c` | `#d7d5e6` | 3 |
| `--backdrop` | 150 | picture: `url(…) center / cover no-repeat, chromeMid`; own gradient: `linear-gradient(<angle>deg, stops)`; else `linear-gradient(165deg, a 0%, mid 55%, b 100%)` | `theme.photo`, `theme.backdrop`, `theme.gradient` | `linear-gradient(165deg, #272934 0%, #292a3c 55%, #2b2b43 100%)` | `linear-gradient(165deg, #d4d3da 0%, #d7d5e6 55%, #d9d6f1 100%)` | 1 (line 62) |
| `--wash` | 152 | dark `rgba(14,15,20, 0.62 − 0.36t)`, light `rgba(255,255,255, 0.66 − 0.38t)` | `intensity`, `mode` | `rgba(14,15,20,0.548)` | `rgba(255,255,255,0.584)` | 1 (6580) |
| `--ink` | 153 | `TONE.ink` | `mode` only | `#f1efea` | `#1e1c1a` | 65 |
| `--ink-2` | 156 | ink at alpha 0.78 dark, 0.72 light | `mode` | `rgba(241,239,234,0.78)` | `rgba(30,28,26,0.72)` | 57 |
| `--ink-3` | 157 | ink at 0.60 dark, 0.62 light | `mode` | `rgba(241,239,234,0.6)` | `rgba(30,28,26,0.62)` | 52 |
| `--ink-4` | 158 | ink at 0.42 dark, 0.40 light (decoration only) | `mode` | `rgba(241,239,234,0.42)` | `rgba(30,28,26,0.4)` | 8 |
| `--hover` | 102 | white at 0.07 dark, 0.42 light | `mode` | `rgba(255,255,255,.07)` | `rgba(255,255,255,.42)` | 50 |
| `--active` | 103 | white at 0.13 dark, 0.78 light | `mode` | `rgba(255,255,255,.13)` | `rgba(255,255,255,.78)` | 18 |
| `--active-shadow` | 104 | fixed two-layer recipe per mode | `mode` | `0 1px 0 rgba(255,255,255,.06) inset, 0 2px 10px rgba(0,0,0,.25)` | `0 1px 2px rgba(60,40,20,.08), 0 2px 10px rgba(60,40,20,.06)` | 2 |
| `--line` | 160 | dark `rgba(255,255,255, 0.02 + BORDER×0.2)`, light `rgba(40,30,20, 0.02 + BORDER×0.2286)` | `mode` | `rgba(255,255,255,0.090)` | `rgba(40,30,20,0.100)` | 53 |
| `--card` | 161 | `TONE.card` | `mode` | `#1f2027` | `#ffffff` | 44 |
| `--overlay` | 162 | dark: card mixed 15% toward black, alpha 0.92; light: card mixed 30% toward base, alpha 0.94 | `mode` | `rgba(26,27,33,0.92)` | `rgba(252,251,249,0.94)` | 7 |
| `--blur` | 163 | constant `8px` | none | `8px` | `8px` | 6 |
| `--scrim` | 164 | fixed per mode | `mode` | `rgba(0,0,0,.45)` | `rgba(40,30,20,.22)` | 3 |
| `--accent` | 165 | `colors[1]`, mixed 18% toward ink up to 8 times until contrast against `--chrome-mid` reaches 3 | `theme.colors[1]`, `intensity`, `mode` | `#8f8cff` | `#6a67b4` | 95 |
| `--accent-ink` | 166 | `#1e1c1a` if `luminance(accent) > 0.45`, else `#ffffff` | accent | `#ffffff` | `#ffffff` | 10 |
| `--accent-soft` | 167 | accent at alpha 0.22 dark, 0.14 light | accent, `mode` | `rgba(143,140,255,0.22)` | `rgba(106,103,180,0.14)` | 17 |
| `--tint-1` | 168 | raw `colors[0]`, unmixed | `theme.colors[0]` | `#7b82a8` | `#7b82a8` | 4 |
| `--tint-2` | 169 | raw `colors[1]`, unmixed | `theme.colors[1]` | `#8f8cff` | `#8f8cff` | 2 (+ `KiteLogo.tsx:6`) |
| `--shadow` | 170 | hairline ring + contact shadow + ambient shadow, from `BORDER` and `SHADOW` | `mode` | `0 0 0 1px rgba(255,255,255,0.060), 0 1px 2px rgba(0,0,0,0.300), 0 14px 36px -8px rgba(0,0,0,0.500)` | `0 0 0 1px rgba(60,40,20,0.060), 0 1px 2px rgba(60,40,20,0.050), 0 14px 36px -8px rgba(60,40,20,0.150)` | 7 |
| `--grain-opacity` | 171 | `.10` dark, `.16` light, `0` when grain is off | `theme.grain`, `mode` | `0` | `0` | 1 |
| `--pattern`, `--pattern-size` | 172-173 | `patternCss()` gradient layers (lines 81-97) | `theme.pattern`, `patternStrength`, `mode` | `none`, `auto` | `none`, `auto` | 1 each |
| `--font` | 174 | constant `FONT` (line 46) | none | `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Figtree', ui-sans-serif, system-ui, sans-serif` | same | 17 |
| `--scale` | 175 | `settings.fontScale` (0.85 to 1.25) | Settings → text size | `1` | `1` | 123 |
| `--radius` | 176 | `settings.radius` px (0 to 24; Customize steps 4, 12, 20) | Settings / Customize "Corners" | `12px` | `12px` | 8 (6 declarations) |
| `--gap` | 177 | `settings.gap` px (0 to 20; Customize steps 0, 8, 14) | Settings / Customize "Margin" | `8px` | `8px` | 10 (5 declarations) |
| `--sidebar-w` | 178 | `settings.sidebarWidth` px | sidebar resizer | `264px` | `264px` | 0 (unused) |
| `--row-h` | 179 | `ROW[density]`: 30, 36, 42 | Settings / Customize "Density" | `36px` | `36px` | 1 (line 472) |
| `--ease` | 180 | `FEEL[motionFeel].ease`, else `EASE` | `settings.motionFeel` | `cubic-bezier(0.16, 1, 0.3, 1)` | same | 15 |
| `--dur` | 181 | `round((FEEL.ms or 220) / motionSpeed)` | `motionFeel`, `motionSpeed` | `220ms` | `220ms` | 56 |
| `--speed` | 182 | `1 / motionSpeed` | `settings.motionSpeed` (0.5 to 2) | `1` | `1` | 94 |
| `--press-ease`, `--press-dur` | 183-184 | spring curve and 455ms only when `motionFeel === 'spring'`; otherwise `cubic-bezier(0.16, 1, 0.3, 1)` and 160ms; duration divided by `motionSpeed` | `motionFeel`, `motionSpeed` | `cubic-bezier(0.16, 1, 0.3, 1)`, `160ms` | same | 7 each |
| `--gray-1…12`, `--gray-a1…12`, `--indigo-1…12` | 146 (`designTokens.ts:48`) | fixed light/dark pairs | `mode` | 36 values | 36 values | 3 in total |
| `colorScheme` | 185 | `dark` or `light` | `mode` | `dark` | `light` | (property, not a variable) |

Motion feel table (`theme.ts:49-55`): `style` → 220ms `cubic-bezier(0.16, 1, 0.3, 1)`; `smooth` → 300ms `cubic-bezier(0.32, 0.72, 0, 1)`; `snappy` → 130ms `cubic-bezier(0.2, 0, 0, 1)`; `bouncy` → 320ms `cubic-bezier(0.34, 1.45, 0.64, 1)`; `spring` → 388ms `linear(…)`. Spring settle times: default 388ms, press 455ms, pop 402ms (`pop` is defined and unused).

### B.3 How light/dark and the Space colours flow

1. `resolveDark()` (line 41): dark if `theme.mode === 'dark'`, or `'system'` and the OS is dark. `App.tsx:69` mirrors the result as `data-theme` on `.app`.
2. The mode picks a `TONE`: base, card and ink are fixed per mode. A Space's colours never change `--ink`, `--ink-2/3/4`, `--card`, `--line`, `--hover`, `--active`, `--overlay`, `--scrim` or `--shadow`. Those are identical in every Space of the same mode.
3. The Space's two colours are blended into the base by `k`, which depends on `intensity`: 12% to 38% in dark, 18% to 62% in light. That gives `--chrome-a`, `--chrome-b`, `--chrome-mid` and the default `--backdrop` gradient. Only the window frame (the sidebar is transparent over `.app`'s background) takes the Space colour.
4. `--accent` is the Space's second colour, darkened or lightened toward ink until it has 3:1 contrast on `--chrome-mid`. `--accent-soft` and `--accent-ink` derive from it. `--tint-1` and `--tint-2` are the raw, unmixed colours.
5. A picture or own gradient replaces `--backdrop`; `App.tsx:80` sets `data-backdrop`, which turns on the frosted sidebar (`6575-6584`, uses `--wash`).
6. Seven rules key off `.app[data-theme='dark']` in CSS: 93 (elevations), 375 (favourite tile), 1289 and 1303 (toast), 3465 (shortcut warning), 5308 (start search), 5507 (start tile icon).

Measured contrast on the default theme (useful when retuning):

| Pair | Dark | Light |
|---|---|---|
| `--ink` on `--chrome-mid` / on `--card` | 12.26 / 14.12 | 11.77 / 16.99 |
| `--ink-2` on chrome / card | 8.09 / 9.04 | 5.53 / 6.68 |
| `--ink-3` on chrome / card | 5.42 / 5.93 | 4.17 / 4.79 |
| `--ink-4` on chrome / card | 3.45 / 3.63 | 2.33 / 2.49 |
| `--accent` on chrome / card | 4.94 / 5.69 | 3.45 / 4.99 |
| `--accent-ink` on `--accent` (primary button label) | 2.85 | 4.99 |

Two existing problems: `--ink-3` on the light sidebar is 4.17:1 although the comment at `theme.ts:154` says it reaches 4.5; and white `--accent-ink` on the default dark accent `#8f8cff` is 2.85:1. No test covers either.

### B.4 Variables defined in app.css

| Variable | Line | Selector | Value | Uses |
|---|---|---|---|---|
| `--r-xs` | 77 | `.app` | `6px` | 0 |
| `--r-sm` | 78 | `.app` | `8px` | 5 |
| `--r-md` | 79 | `.app` | `10px` | 4 |
| `--r-lg` | 80 | `.app` | `14px` | 4 |
| `--r-xl` | 81 | `.app` | `20px` | 0 |
| `--ease-out` | 82 | `.app` | `cubic-bezier(0.16, 1, 0.3, 1)` | 49 |
| `--ease-in` | 83 | `.app` | `cubic-bezier(0.32, 0, 0.67, 0)` | 8 |
| `--ease-move` | 84 | `.app` | `cubic-bezier(0.65, 0, 0.35, 1)` | 5 |
| `--t-fast` | 85 | `.app` | `calc(120ms * var(--speed, 1))` | 49 |
| `--t-exit` | 86 | `.app` | `calc(var(--dur, 220ms) * 0.55)` | 10 |
| `--elev-1` | 87 / 94 dark | `.app` | light `0 1px 2px rgba(40,30,20,.05)`; dark `0 1px 2px rgba(0,0,0,.25)` | 2 |
| `--elev-2` | 88 / 95 dark | `.app` | two-layer | 2 |
| `--elev-3` | 89 / 96 dark | `.app` | ring + two layers | 0 |
| `--set-card` | 2982 | `.settings` | `color-mix(in srgb, var(--ink) 2.5%, var(--card))` | 3 |
| `--page-col` | 2983 | `.settings` | `680px` | 1 |
| `--pip-chip`, `--pip-chip-hover`, `--pip-hairline`, `--pip-ease` | 3627-3630 | `.pipd` | `rgba(33,33,35,.8)`, `rgba(52,52,56,.9)`, `rgba(255,255,255,.2)`, `cubic-bezier(0.2, 0.9, 0.3, 1.2)` | 5, 2, 5, 7 |

Re-scoped theme variables (a restyle that edits `theme.ts` should check these still read well):

- `prefers-contrast: more` (5014-5016): `--line`, `--ink-2`, `--ink-3` with `!important`.
- `.start-brand, .cb-brand` (5637-5639): `--tint-1`, `--tint-2`, `--ink` forced to white so the kite mark is white on the accent chip.
- `.start[data-tone='dark'] .widget` (6262-6268): `--ink`, `--ink-2`, `--ink-3`, `--ink-4`, `--line`, `--card`, `--hover` replaced by white alphas, a local "dark glass" theme.

Variables set inline by components: `--indent`, `--child-indent` (`ItemRow.tsx:99,222`; read at 504 and 524), `--wheel-thumb` (`ThemeEditor.tsx:256`; read at 5722), `--i` (`StartPage.tsx:324,380`; read at 5480), `--p` (`home/widgets.tsx:266`; read at 6424-6428).

The same easing curve is written in four places: `app.css:82`, `theme.ts:74`, `theme.ts:183`, `flip.ts:13`.

---

## C. Inconsistency inventory

### C.1 Typography

Font families:
- `--font` resolves to `-apple-system` (San Francisco) on macOS. On Windows and Linux the first match is the bundled Figtree. 17 declarations use it.
- Bundled webfonts, all imported in `src/renderer/main.tsx:3-11`: Figtree 400/500/600/700, Inter 400/500/600, Bricolage Grotesque 500/700. Inter and Bricolage are not referenced by any rule.
- Monospace is written three ways: `ui-monospace, 'SF Mono', Menlo, monospace` (1646, 5818, 5846), `ui-monospace, Menlo, monospace` (4590), `ui-monospace, 'SF Mono', Menlo, Consolas, monospace` (6112).
- The pip window uses `var(--font-ui, 'Figtree', system-ui, sans-serif)` (3584). `--font-ui` is never defined, so pip is Figtree while the main window is San Francisco.
- The crash screen uses `ui-sans-serif, system-ui, sans-serif` (6010).

Font sizes: 144 declarations, 38 distinct values. 122 are `calc(Npx * var(--scale))`, 18 are raw px (ignore the text-size setting), 4 are em.

| Size (× scale) | Count | Examples |
|---|---|---|
| 10.5px | 3 | 4971, 5809, 6415 |
| 11px | 13 | 42, 619, 1907, 1985 |
| 11.5px | 25 | 399, 711, 767, 813 |
| 12px | 23 | 1061, 1585, 1647, 1856 |
| 12.5px | 23 | 265, 1467, 1610, 1681 |
| 13px | 14 | 460, 1214, 1282, 1549 |
| 13.5px | 2 | 60 (the base), 5285 |
| 14px | 2 | 2053, 5602 |
| 15, 16, 17, 18, 20, 22, 24, 28, 30, 32, 38, 40px | 1, 2, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3 | 1045, 2734, 3000, 1179, 4579, 1459, 1752, 3502, 5275, 6366, 2721, 1029 |

Eight half-pixel steps between 10.5 and 14px carry 105 of the 122 scaled sizes. Unscaled px sizes: 448 (13), 596 (11), 851 (14), 1746 (30), 1769 (18), 1787 (16), 2034 (15), 2927 (17), 5204 (17), 6027 (20), 6039 (12), and the pip window (3707, 3778 at 7.5px, 3807, 3839, 3955, 4064, 4073).

Font weights (80 declarations): 600 × 37, 700 × 15, 650 × 13, 500 × 12, 550 × 2 (3306, 5477), 800 × 1 (2060). The bundled Figtree is static 400/500/600/700, so 550, 650 and 800 only render as intended with San Francisco.

Letter-spacing (24 declarations, 12 values): −0.03em × 4, −0.02em × 4, −0.005em × 3, −0.025em × 2, −0.015em × 2, 0.04em × 2, 0.06em × 2, and one each of 0.02em, 0.08em, 0.005em, 0, −0.01em.

Line-height (30 declarations, 11 values): 1.5 × 7, 1 × 4, 1.55 × 4, 1.45 × 4, 1.2 × 3, 1.4 × 2, 1.25 × 2, and one each of 1.7, 1.3, 1.1, 1.6. Most text has no line-height at all and inherits `normal`.

Uppercase labels: 4 (1910, 3841, 5448, 6291), each with a different tracking (0.08, 0.06, 0.06, 0.04em). `tabular-nums`: 15.

Icons (lucide `size=`): 16 distinct sizes. 14 × 55, 13 × 49, 15 × 35, 12 × 34, 16 × 26, 18 × 16, 11 × 10, 17 × 7, 20 × 6, 22 × 4, then 10, 26, 30, 34, 44, 64. Stroke width is 1.75 globally (5024) with 13 inline `strokeWidth` overrides (0, 2, 2.2, 2.4, 2.6).

### C.2 Radius, shadow, border, blur

Border radius: 163 declarations, 37 distinct values. 19 (12%) use a token.

| Value | Count | Value | Count |
|---|---|---|---|
| 12px | 19 | 7px | 5 |
| 10px | 17 | 18px | 4 (+2 split corners) |
| 999px | 17 | 16px | 4 |
| 50% | 14 | 14px | 2 |
| 6px | 12 | 20px | 2 |
| 8px | 11 | 1px, 2px, 3px, 15px, 28px | 2, 1, 1, 1, 1 |
| 9px | 7 (+2 split corners) | `var(--r-lg)` | 4 |
| 4px | 7 | `var(--r-md)` | 4 |
| 11px | 5 | `var(--r-sm)` | 5 |
| 5px | 5 | `var(--radius)` and `calc()` on it | 6 |

18 distinct literal px radii from 1 to 28. The user's "Corners" setting (`--radius`) reaches only the page card (935), the peeking sidebar (168), split panes (2122, 2135, 2150) and Peek (2299). Buttons, inputs, menus, sheets, rows and tiles ignore it.

Box shadow: 114 declarations, 87 distinct recipes. 7 are a bare token (`--shadow` × 5, `--active-shadow` × 2), 4 more embed `--elev-1` or `--elev-2` (3258, 3496, 5185, 6230), 5 are `none`.

Elevated surfaces each have their own recipe:

| Surface | Line | Shadow |
|---|---|---|
| Page card, find bar, note toolbar, peeking sidebar, split pane | 937, 1098, 2701, 170, 2250 | `var(--shadow)` |
| Command bar | 1153 | `0 0 0 1px var(--line), 0 30px 80px rgba(0,0,0,.28)` |
| Menu | 1199 | `0 0 0 1px var(--line), 0 16px 40px rgba(0,0,0,.22)` |
| Sheet | 1438 | `0 0 0 1px var(--line), 0 30px 80px rgba(0,0,0,.3)` |
| Peek | 2301 | `0 0 0 1px var(--line), 0 40px 100px rgba(0,0,0,.35)` |
| Site info | 4468 | `0 0 0 1px var(--line), 0 24px 60px rgba(0,0,0,.28)` |
| Toast | 1284 | `0 10px 30px rgba(0,0,0,.25)` |
| Drag ghost | 1332 | `0 12px 30px rgba(0,0,0,.22)` |
| Zap hint | 2545 | `0 10px 30px rgba(0,0,0,.3)` |
| Widget | 6254 | `0 0 0 1px var(--line), 0 1px 2px rgba(20,16,12,.08), 0 14px 36px -10px rgba(20,16,12,.25)` |
| Start search box | 5303 / 5310 dark | three-layer warm / dark variant |

`--elev-3` was written for this job and nothing uses it. Shadow ink comes in four bases: pure black (52 uses), `40,30,20` (12), `20,16,12` (6), `60,40,20` (2 in CSS, plus `theme.ts`). The same shadow is also not adjusted for dark mode on the overlays above.

Hairlines are drawn four ways: `border: 1px solid var(--line)` (18), `box-shadow: inset 0 0 0 1px var(--line)` (4 bare, 8 more inside composites), `0 0 0 1px var(--line)` outer ring (10), and 0.5px or 1.5px variants (`inset 0 0 0 1.5px var(--accent)` × 4, `0.5px var(--pip-hairline)` × 5, `1.5px dashed` × 3). Other border colours: `var(--ink-4)` × 2, `rgba(127,127,127,.35)`, `#3a6ed8`, `rgba(255,255,255,.14)`.

Focus rings: one global outline, `2px solid var(--accent)` with `outline-offset: 2px` (4986-4989). Four other outline rules: 672 (`.rename`), 6531 (swatch, offset 2px), 6617 (backdrop tile, offset 3px), 6699 (upload tile, offset 3px). Text fields use a different look: accent border plus `0 0 0 3px var(--accent-soft)` (4992-4997), the start search uses a 4px soft ring (5319), and `.input:focus` at 1653 uses a third recipe (`3px` at 22% accent). `outline: none` appears 17 times.

Backdrop filter (4 recipes):
- `blur(var(--blur, 20px)) saturate(1.3)` × 6: find bar 1099, command bar 1154, menu 1200, sheet 1439, site info 4469, widget 6255. `--blur` is always `8px`, so the 20px fallback never applies.
- `blur(2px)`: Peek scrim 2289.
- `blur(28px) saturate(1.25)`: sidebar over a picture, 6581-6582.
- `blur(14px) saturate(1.3)`: start-page hint pill over a picture, 6659-6660.

Toasts, the drag ghost and the zap hint are opaque (`#1e1c1a`) and take no blur.

### C.3 Motion

Transitions: 80 declarations.

Durations, 26 distinct expressions:

| Duration | Count | Note |
|---|---|---|
| `var(--t-fast)` (120ms × speed) | 48 | token |
| `calc(0.15s * var(--speed, 1))` | 24 | no token |
| `calc(0.12s * var(--speed, 1))` | 16 | same value as `--t-fast`, not using it |
| `calc(var(--dur) * 1)` | 9 | |
| `var(--press-dur, 160ms)` | 7 | token |
| `calc(120ms * var(--speed, 1))` | 6 | same value as `--t-fast` again (pip) |
| `var(--t-exit)` | 5 | token |
| `calc(var(--dur) * 1.2)` | 5 | |
| `calc(0.2s …)`, `calc(0.3s …)`, `calc(160ms …)` | 4 each | |
| `calc(0.45s …)`, `calc(var(--dur) * 0.8)` | 3 each | |
| `calc(0.28s …)`, `calc(0.18s …)` | 2 each | |
| `0.4s`, `4s`, `0.1s`, `0.25s`, `180ms`, `220ms`, `--dur × 1.25`, `× 1.1`, `× 1.4` | 1 each | |

Easing: 94 of the roughly 160 transition parts name no easing and get the browser's `ease`. Then `var(--ease-out)` × 21, literal `ease` × 7, `var(--press-ease, var(--ease-out))` × 6, `var(--ease-in)` × 5, `var(--ease-move)` × 4, `var(--pip-ease)` × 5, and one-offs: `linear` × 2, `ease-out` (4632), `cubic-bezier(0.1, 0.7, 0.3, 1)` (982).

The motion-feel variable `--ease` is wired into only 15 places, with three different fallbacks: `cubic-bezier(0.2, 0.8, 0.2, 1)` × 7, `ease-out` × 7, `var(--ease-out)` × 1. So "Bouncy" or "Snappy" changes the sidebar slide, the Space switch, sheets, the site popover, the load error, download rows and extension rows, and nothing else. `--dur` reaches 56 places.

Animations: 58 `animation` declarations. Durations use 13 different multipliers of `--dur` (0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2, 3) plus six legacy literals (`0.14s`, `0.16s`, `0.18s`, `0.24s`, `0.26s`, `0.4s` × speed).

Durations that ignore `--speed`: `.spin` 0.9s (1308), `.pipm-eq` 0.9s with 0.2s and 0.1s delays (4037-4045), `dl-slide` 1.2s (4779), and the Reduce Motion values 120ms, 140ms, 100ms.

All `@keyframes` (32):

| Name | Lines | Animates | Used at |
|---|---|---|---|
| `drop-line-in` | 528-534 | opacity, transform | 512 |
| `kite-land` | 1006-1011 | opacity, transform | 1002 (dead) |
| `fade-in` | 1127-1131 | opacity | 1022, 1079, 1428, 2290, 4208, 5071, 5286, 5449, 5542, 6168 |
| `fade-up` | 1134-1139 | opacity, transform | 4559, 4672, 4824 |
| `pop-in` | 1141-1146 | opacity, transform | 1155, 1286, 1440 (all three overridden), 2547, 4447, 6258 |
| `spin` | 1311-1315 | transform | 1308 |
| `slide-next`, `slide-prev` | 1375-1387 | opacity, transform | 1368, 1372 |
| `peek-in` | 2306-2311 | opacity, transform | 2302 |
| `page-in` | 2951-2956 | opacity, transform | 2948 |
| `pipd-spin-back`, `pipd-spin-fwd` | 3762-3771 | transform | 3757, 3760 |
| `pipm-eq` | 4047-4055 | transform | 4037 |
| `sheet-in` | 4199-4204 | opacity, transform | 4195, 4471 |
| `dock-in` | 4232-4237 | opacity, transform | 4229 |
| `menu-in` | 4258-4263 | opacity, transform | 4254, 5391, 6231 |
| `toast-in` | 4269-4274 | opacity, transform | 4266 |
| `blur-in` | 4276-4281 | opacity, filter | 1014 (dead), 5279 |
| `rise-in` | 4283-4288 | opacity, transform | 1018 (dead), 1896, 5292 |
| `section-in` | 4346-4352 | opacity, transform, filter | 4338 |
| `dl-slide` | 4782-4789 | transform | 4779 |
| `hit-flash` | 5083-5089 | background, box-shadow | 5080 |
| `bg-drift`, `bg-swirl`, `bg-spin`, `bg-breathe`, `bg-hue` | 5110-5131 | transform, filter | none (dead) |
| `tile-in` | 5484-5489 | opacity, transform | 5479 |
| `toast-out` | 5563-5569 | opacity, transform, filter | 5559 |
| `brand-tilt` | 5581-5586 | transform, opacity | 5577 |
| `fade-out` | 5621-5625 | opacity | 1082, 5074, 5612 |
| `sheet-out` | 5627-5632 | opacity, transform | 5617 |

No keyframe animates a layout property. `hit-flash` animates background and box-shadow; `blur-in`, `section-in` and `toast-out` animate `filter: blur`.

There is no `transition: all`. Transitions on layout properties (13 parts):

| Line | Selector | Property |
|---|---|---|
| 137 | `.sidebar` | `margin` |
| 783 | `.sb-divider-line` | `margin` |
| 976, 982 | `.load-bar` | `width` (982 runs for 4s) |
| 1527 | `.welcome-dots > i` | `width` |
| 3906 | `.pipd-track` | `height` |
| 4333 | `.toggle-knob` | `width` |
| 4410 | `.url-pill:has(.url-sec[data-side='end'])` | `padding` |
| 6257 | `.widget` | `left`, `top`, `width`, `height` |
| 6798 | `.dl-bar-parts > i[data-part]` | `width` |

Other paint-heavy transitions: `box-shadow` × 21, `border-radius` × 2 (940, 5305), `filter` × 4, `background` × 36. No `will-change` or `contain` anywhere.

JS motion (`flip.ts`): Web Animations on `[data-flip]` rows, id `'flip'`, 240ms × speed for a move and 160ms × speed for a new row, easing hard-coded to `cubic-bezier(0.16, 1, 0.3, 1)` (does not follow the motion-feel setting). It skips under Reduce Motion and while `body.dragging`.

Sound (`sound.ts`): seven synthesised tones (`open`, `close`, `switch`, `pop`, `done`, `toggle`, `error`), master gain `soundVolume × 0.16`. Triggered from a store subscription (tab count ±1, Space switch, a panel opening, the command bar opening), plus `done`/`error` for downloads (`browserRuntime.ts:35`), the timer widget and the Settings test button. `toggle` is called from `Sheet.tsx:127`.

### C.4 Control sizes

33 distinct px heights are in use. For interactive controls:

| Control | Selector, line | Height | Padding | Radius | Font |
|---|---|---|---|---|---|
| Button | `.btn` 1535 | 32 | 0 14px | `--r-md` (10) | 13px, 600 |
| Small button | `.btn.small` 1581 | 28 | 0 11px | `--r-sm` (8) | 12px |
| Shortcut button | `.key-btn` 3437 | 28 | 0 10px | `--r-sm` | 600 |
| Toast action | `.toast-action` 1294 | 26 | 0 10px | 7 | 600 |
| Icon button | `.icon-btn` 222 | 28 × 28 | none | 8 | |
| Tiny icon button | `.icon-btn.tiny` 2182 | 22 × 22 | none | 6 | |
| Row button (close, more) | `.row-btn` 633 | 24 × 24 | none | 6 | |
| Row sound, boost chip | `.row-sound` 3550, `.url-boost` 2472 | 22 × 22 | none | 6 | |
| Address-bar lock | `.url-sec` 4366 | 20 × 20 | none | 6 | |
| Note tool | `.note-tool` 2666 | 30 × 30 | none | 8 | |
| Space dot | `.space-dot` 845 | 28 × 28 | none | 8 | 14px |
| Text input | `.input` 1628 | 36 | 0 12px | 10 | inherits |
| Select in a Settings row | `.set-row-control > select.input` 3351 | 32 | | | |
| Find input | `.find-bar input` 1103 | 28 | 0 10px | 8 | |
| Settings search | `.settings-search` 3062 | 30 | 0 6px 0 10px | `--r-md` | |
| Archive/History search | `.search-box` 1864 | 40 | 0 12px | 12 | |
| Download add-URL | `.dl-add-input` 6830 | 30 | | | 13px |
| To-do input | `.wg-todo-add .input` 6396 | 30 | | | |
| Little-window address | `.little-url` 2389 | 30 | 0 10px | 9 | 12.5px, 500 |
| Sidebar address | `.url-pill` 253 | 34 | 0 12px | `--r-md` | 12.5px, 500 |
| Start search | `.start-search` 5298 | 56 | 0 12px 0 14px | 18 | |
| Command bar input row | `.cb-input-row` 1161 | 60 | 0 20px | | 18px |
| Toggle | `.toggle` 1699, knob 1714 | 24 × 40, knob 18 | | 999 | |
| Segmented | `.segmented` 1665, button 1673 | track padding 3px, button 28 | 0 12px | 10 / 8 | 12.5px, 600 |
| Range | `.app .range` 5052 | 18 | | | |
| Menu item | `.menu-item` 1203 | 30 | 0 10px | 7 | 13px |
| Start suggestion | `.start-suggest li` 5397 | 40 | 0 10px | 11 | |
| Command bar result | `.cb-row` 2000 | min 46 | 6px 12px | 11 | |
| Sidebar row | `.row` 466 | min `--row-h` (30 / 36 / 42) | 0 6px 0 8px | 9 | 500 |
| Space header | `.space-header` 416 | 30 | 0 8px | `--r-sm` | |
| Favourite tile | `.fav` 351 | 48 | | 12 | |
| Clear button | `.sb-clear` 803 | 22 | 0 7px | 6 | 11.5px, 600 |
| Settings row | `.set-row` 3265 | min 52 (sub-row min 46) | 10px 16px | | |
| Settings link row | `.set-link` 3362 | min 58 | 10px 14px | | |
| Shortcut row | `.key-row` 3417 | min 38 | 2px 6px 2px 10px | `--r-sm` | |
| Download / extension row | `.dl-row` 4672, `.ext-row` 4824 | by content | 10px 12px | 12 | |
| Boost row | `.boost-row` 2559 | by content | 8px 10px | 12 | |
| Route row | `.route-row` 2607 | by content | 6px | 12 | |
| Permission row | `.perm-row` 4936 | by content | 6px 10px | 10 | 12.5px |
| Site-info row | `.site-info-row` 4523 | by content | 10px | 12 | |
| Import row | `.import-space` | by content | 8px 12px | 12 | |
| Archive row | `.arch-row` | by content | | 10 | |
| Top bars | `.sb-top` 44, `.little-bar` 44, `.peek-bar` 40, `.source-head` 40, `.pane-bar` 30, `.widget-head` 32, `.sb-footer` 40 | | | | |

So text fields come in six heights (28, 30, 32, 36, 40, 56), push buttons in three (26, 28, 32), icon buttons in five (20, 22, 24, 28, 30), list rows in six paddings with three radii.

`padding` has 98 distinct values over 162 declarations; `gap` has 21 (8px × 44, 6px × 24, 4px × 21, 12px × 20, 2px × 17, 10px × 15, then 3, 14, 1, 16, 18, 7, 9, 24, 20, 5, 40, 44, 26, 1.5px).

Surface paddings: sheet head `20px 20px 8px 24px`, body `8px 24px 20px`, foot `14px 20px`; menu `5px`; site info `14px`; Settings bar `12px 64px 12px 24px`; sidebar `0 6px 6px 8px` (asymmetric, mirrored by hand for the right side at 140).

### C.5 Hover, pressed, focus-visible coverage

The stylesheet has 82 `:hover` selectors, 21 `:active`, 19 `:focus-visible` (plus 9 `:focus`/`:focus-within`), 9 `:disabled`.

Keyboard focus is covered globally by 4986 for every native `button`, `[role='button']`, `a`, `input`, `select`, `textarea`, `summary`. The address-bar chips `.url-sec`, `.url-shield`, `.url-boost` (`Sidebar.tsx:165-207`) are `span role="button"` with no `tabIndex`, so they match the ring selector but cannot be reached by keyboard. `.cb-row` is a `div` whose hover is the selection itself (`onMouseMove` sets `[data-on]`, `CommandBar.tsx:148-150`).

| Class | Element | Hover | Pressed | Own focus style |
|---|---|---|---|---|
| `.btn` | button × 96 | yes | yes | global ring |
| `.icon-btn` | button × 43 | yes | yes | global ring |
| `.row` | div/button | yes | yes (4320) | global ring |
| `.fav` | button | yes | yes | global ring |
| `.space-dot`, `.space-header`, `.settings-tab`, `.start-tile`, `.home-fab`, `.backdrop-tile`, pip buttons (`.pipd-*`) | button | yes | yes | mixed |
| `.menu-item` | button | yes | no | `.focus` class only |
| `.segmented button` | button | yes (not when on) | no | global ring |
| `.toggle` | button | no | no | global ring |
| `.row-btn`, `.row-sound`, `.note-tool`, `.emoji`, `.swatch`, `.space-pick`, `.set-link`, `.sb-clear`, `.sb-pin-toggle`, `.url-pill`, `.start-engine`, `.wg-link`, `.dl-name`, `.grad-add`, `.chip button`, `.pipm-btn`, `.pipm-play`, `.adb-group-head` | button | yes | no | global ring |
| `.url-sec`, `.url-shield`, `.url-boost` | `span role="button"`, no tab stop | yes | no | global ring, unreachable |
| `.key-btn`, `.toast-action`, `.link`, `.arch-main`, `.settings-search-clear`, `.little-url`, `.wg-chip`, `.wg-todo-check`, `.wg-cal-month`, `.wg-clock-time`, `.wg-weather-temp`, `.wg-weather-place`, `.set-row` when it is a button | button | no | no | global ring |
| `.cb-row` | div, mouse-move selects | via `[data-on]` | no | none (the input keeps focus) |
| `.grad-remove` | button | no | no | yes |
| `.input`, `.cb-input`, `.start-input`, `.dl-add-input`, `.wg-note` | input | no | n/a | own |
| `.range` | input | no | only `.wheel-hue` thumb | global ring |
| `.rename`, `.note-title` | input | no | n/a | `.rename` has an outline |

Disabled styling exists for `.btn`, `.icon-btn`, `.menu-item` and through `[data-off]` (4355); nothing else.

The pressed scale is inconsistent where it exists: 0.97 for `.btn`, `.icon-btn`, `.row`, `.fav`, `.space-dot` (4322), 0.94 for `.home-fab` (6452), other values for tiles and pip buttons.

Cursor: `pointer` on 23 rules, `default` on 8, the rest inherit. A first-party macOS feel would use the default arrow on controls.

### C.6 z-index

48 declarations, 23 distinct values, no tokens.

| Value | Where |
|---|---|
| −1 | frosted sidebar layer (6579) |
| 0 | `.grain`, `.pattern`, split and start backgrounds |
| 1 to 8 | local stacking inside surfaces (`.sidebar` 2, `.stage` 1, favourites 4, `.sb-resizer` 5, `.load-bar` 6, drag strip 7, `.find-bar` 8, `.kite-page` 8) |
| 20 | `.sidebar-peek-catcher` (197) |
| 25 | `.edge-hotzone` (184) |
| 30 | peeking sidebar (164) |
| 35 | `.peek-scrim` (2283) |
| 40 | `.cb-scrim` (1119) |
| 44, 45 | `.site-info-catcher`, `.site-info` (4453, 4460) |
| 50 | `.sheet-scrim` (1423) |
| 60 | `.zap-hint` (2535) |
| 90 | `.toasts` (1265) |
| 100 | `.menu` (1193) |
| 200 | `.drag-ghost` (1323) |

Consequences of the current order: the command bar (40) opens underneath a sheet (50); the site-info popover (45) sits above the command bar.

### C.7 Hard-coded colours

238 colour literals in `app.css`, 116 distinct. By purpose:

| Purpose | Occurrences | Distinct | Most common |
|---|---|---|---|
| Shadows | 76 | 49 | `rgba(0,0,0,.3)` × 7, `rgba(0,0,0,.5)` × 5, 22 different black alphas in total |
| Backgrounds | 69 | 47 | `#fff` × 9, `#d64545` × 3, `#1e1c1a` × 3, white alphas .1, .12, .14, .16, .22, .24, .66, .85, .92, .94 |
| Text and icons | 66 | 25 | `#fff` × 21, `#d64545` × 9, `#1e1c1a` × 7, `rgba(255,255,255,.78)` × 3 |
| Custom property values | 23 | 19 | elevations, pip chips, widget dark glass |
| Borders | 3 | 3 | `rgba(127,127,127,.35)`, `#3a6ed8`, `rgba(255,255,255,.14)` |

Grouped by meaning:

- Danger: `#d64545` × 12 (1236, 1240, 1572, 1860, 3476, 4380, 4520, 4574, 4752, …), `rgba(214,69,69,α)` × 7 at five alphas (.10, .12, .14, .28, .30), `#b33a3a` (2881), `#ff453a` (3848), `rgba(255,69,58,.25)` (3849). There is no `--danger` token.
- Warning: `#b4651f` × 2 (2526, 3461), `#f0a35e` (3466, the dark variant). No token.
- Inverse surface (toast, drag ghost, zap hint, note code): `#1e1c1a`, `#f4f1ec`, `#f1efea` (1280-1291, 2542, 2785-2786). These repeat `TONE.ink` and `TONE.base` from `theme.ts` by hand.
- Boot and root background: `#f4f1ec` at 16 and 50. It is the light base, so a dark-theme launch flashes light before React mounts.
- Home page over a picture: 14 white-alpha and black-alpha literals in 5660-5682 and 6178-6195, including a hard-coded light search box (`rgba(255,255,255,.92)`, text `#1e1c1a`, placeholder `#6b6762`).
- Widget accents: `#ffd166` × 3, `#a5d8ff`.
- Pip window: `#212123`, `#2a2c35`, `#f4f5f7`, `#d6d8de`, `#8d919c`, `#111216`, `#b9bcc6` (its own dark palette, by design).
- Crash screen: `#f3efe9`, `#16171c`, `#3a6ed8`, grey alphas (needed, since it renders without theme variables).
- Hue strip for the colour wheel: 9 literals at 5707.

`color-mix()` is used 46 times with 39 different recipes (for example `var(--ink)` at 2%, 2.5%, 3%, 3.5%, 4%, 5%, 7%, 8%, 16%, 18%, 30% for near-identical tints).

In TypeScript: `theme.ts` holds the tone colours and shadow inks; `ThemeEditor.tsx:33,52` repeats `#16171c` and `#f4f1ec`; `KiteLogo.tsx:6` falls back to `#8f8cff`; `SiteIcon.tsx:44` computes `hsl(hue 42% 87%)` on `hsl(hue 45% 28%)` for letter icons (not theme-aware; the same pastel in dark and light).

### C.8 Inline styles in TSX

38 `style=` attributes. Those that set visual properties:

| File:line | What it sets |
|---|---|
| `App.tsx:67`, `LittleApp.tsx:105` | all theme variables |
| `Sidebar.tsx:50` | sidebar `width` |
| `ItemRow.tsx:99, 222, 263` | `paddingLeft` (indent = 8 + depth × 14; +22 for the empty-folder line), `--indent`, `--child-indent` |
| `Favorites.tsx:18` | `gridTemplateColumns` |
| `SiteIcon.tsx:25, 32, 44` | `width`, `height`, `fontSize` (size × 0.62), letter background and colour |
| `ContextMenu.tsx:72` | `left`, `top`, `transformOrigin` |
| `SplitView.tsx:28, 53, 94`, `Stage.tsx:107` | pane and divider geometry |
| `home/WidgetLayer.tsx:41, 116` | `minHeight`; widget `left`, `top`, `width`, `height`, drag `transform` |
| `StartPage.tsx:245` | `backgroundImage` of the scene |
| `StartPage.tsx:324, 380` | `--i` (stagger index) |
| `home/widgets.tsx:266` | `--p` (timer progress) |
| `ThemeEditor.tsx:52, 63, 67, 124, 137, 151, 184, 196, 237` | preset, pattern, gradient, photo and swatch previews |
| `ThemeEditor.tsx:256` | `--wheel-thumb` |
| `Settings.tsx:266`, `Spaces.tsx:263` | Space preview background |
| `ImportArc.tsx:115` | imported Space gradient |
| `Downloads.tsx:100, 106` | segment `left`, bar `transform: scaleX` |
| `PipFrameApp.tsx:231, 235` | scrub fill `width`, knob `left` |
| `ArchivePage.tsx:32` | `verticalAlign: -2px`, `marginRight: 4` (the only purely cosmetic one) |
| `dnd.tsx:238-239` | drag ghost `left`, `top` |

---

## D. Constraints the tests place on a restyle

### D.1 `tests/unit/stylesheet.test.ts`

- 10: `expect(css.split('/*').length).toBe(css.split('*/').length)` and 12, 17, 19: no stray comment markers; brace depth never negative and ends at 0.
- 21-29: every name in an `animation` or `animation-name` value must be a defined `@keyframes`. The test treats the first bare word that is not in its keyword list as the name. The list is `none|infinite|alternate|ease|ease-in|ease-out|ease-in-out|linear|both|forwards|backwards|reverse|normal|running|paused|var|calc`. Writing `alternate-reverse`, `step-end`, `step-start`, `inherit` or `initial` in an `animation` shorthand will fail it. Deleting a keyframe that is still named (for example `kite-land` while `.empty-mark` remains) will also fail it.

### D.2 `tests/unit/designTokens.test.ts`

- 10-14: `light['--gray-12']` is `'#171717'`, `dark['--gray-12']` is `'#ededed'`, `light['--gray-a3']` is `'rgba(0,0,0,0.047)'`, `dark['--gray-a3']` is `'rgba(255,255,255,0.056)'`, and `expect(Object.keys(light)).toHaveLength(36)`. Removing the unused scale variables or adding one breaks the count.
- 19-20: grey text steps keep contrast (> 12 and ≥ 4.5).
- 36: `expect(peak(SPRINGS.press)).toBeGreaterThan(1.05)`; 42-43: every spring settles in more than 150ms and less than 800ms.
- 50-51: `springEasing(SPRINGS.default, 16)` matches `/^linear\(0, .*, 1\)$/` with 17 points.

### D.3 `tests/unit/spaceTheme.test.ts`

- 29-30: `DEFAULT_THEME` is dark, no grain, intensity 0.2, no gradient.
- 62-70, for a light theme: `expect(v['--card']).toBe('#ffffff')`, `expect(v['--ink']).toBe('#1e1c1a')`, `expect(v['--line']).toBe('rgba(40,30,20,0.100)')`, `expect(v['--backdrop']).toMatch(/^linear-gradient\(165deg/)`, `expect(v['--font']).toContain('Figtree')`, `expect(v['--grain-opacity']).toBe('.16')`; dark: `expect(dark['--card']).toBe('#1f2027')`, grain `'0'`.
- 80-83: for all 27 swatches in both modes at the default intensity, `r.text` ≥ 4.5, `r.accent` ≥ 2.9, and `contrast(v['--ink'], v['--chrome-mid'])` ≥ 4.5.
- 117-119: for all 11 pictures, `v['--backdrop']` contains `` `${b.id}.jpg") center / cover no-repeat, #` ``, `v['--wash']` matches `/^rgba\(/`, text ≥ 4.5.
- 162-164: for the 7 default Space hues, backdrop matches `/^linear-gradient\(165deg, #/`, text ≥ 4.5, accent ≥ 3.
- 171, 186: seven presets in a fixed order, each `readability(...).ok` (text ≥ 4.5 and accent ≥ 3).
- 218-229: pattern CSS contains `'255,255,255'` in dark and `'40,30,20'` in light; one size per layer; alpha never above 0.6; `v['--pattern-size']` is `'18px 18px'` for dots; `'none'` by default.

So changing `TONE` (card, ink), `BORDER` (line alpha), the 165° default gradient, the tint ranges, the font list or the pattern ink colour needs matching test edits.

### D.4 `tests/e2e/20-layout-themes-sound.spec.ts`

- 21, 25: with the sidebar hidden, `expect([card.x, card.y, vp.width - card.x - card.width, vp.height - card.y - card.height]).toEqual([8, 8, 8, 8])`. The card's inset must be exactly `--gap` (8) on all four sides: no extra border, margin or title band on `.stage` or `.card`.
- 33, 35: `expect(await lastButtons(page)).toEqual({ visible: true, x: 22, y: 22 })` while the sidebar peeks, then `{ x: 16, y: 16 }`. The 6px comes from `App.tsx:51` and must match `.app[data-sidebar-peek] .sidebar { top: 6px; left: 6px }` (165-167).
- 75-77: with gap 0, the card is at 0,0 and exactly the viewport size.
- 88-89: sidebar on the right: card at `[8, 8]`; buttons at `x: 1280 - 264 + 14, y: 16`.
- 91, 98, 102, 111: `.sb-top` carries `data-lights` (and loses it in full screen).
- 103: `expect(… 'btn-toggle-sidebar' … x).toBeLessThan(before - 60)`: the traffic-light reserve (`.sb-top[data-lights] { padding-left: 70px }`, 208-210) must stay above 60px.
- 118-119: at 720 × 480 the sidebar is at most 216px wide and the card wider than 490px (the `@media (max-width: 900px)` rule at 5005-5009).
- 123: `expect(await page.getByTestId('btn-settings').evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid')`. Keyboard focus must stay a real `outline`; replacing the ring with a box-shadow fails this.
- 130-132: `--tint-2` is `'#8f8cff'`, `data-theme` is `dark`, `--backdrop` matches `/^linear-gradient\(165deg/`.
- 136-137: test ids `space-hue`, `space-vivid`, `space-intensity`, `space-grain`, `space-mode-light|dark|system`, `color-a`, `color-b`, and exactly 27 `swatch-*`.
- 146-175: for 27 swatches × light and dark, contrast of `--ink` against the sidebar is ≥ 4.5. The helper reads `getComputedStyle(sidebar).backgroundColor`; if it is transparent it uses `--chrome-mid`, otherwise it uses that colour's RGB and ignores alpha. Giving `.sidebar` a translucent `background-color` (for a vibrancy look) makes this test compare against the wrong colour. Also `expect(page.locator('.row[data-active]')).toBeVisible()`.
- 189, 195: the exact sound sequence `['pop', 'open', 'pop', 'open']` then `['close', 'pop', 'switch', 'done']`.
- 213: `.set-row[data-off]` wraps the volume control when sounds are off.

### D.5 `tests/e2e/27-motion-keyboard.spec.ts`

- 5, 14-22: rows are `.sb-scroll [data-flip]`; a moving row has an animation with `id === 'flip'`; after `waitForTimeout(400)` none remain. The FLIP duration must stay under 400ms at speed 1.
- 30-31: `page.locator('.cb').evaluate((el) => el.getAnimations().length)` is `0` right after opening. No CSS animation or transition may run on `.cb` itself when it appears.
- 34-35: `.surface-slot[data-visible]` has 0 animations after a tab switch. No fade or slide on tab change.
- 43: `data-motion="reduced"` on `[data-testid=app]`.
- 51-55: under Reduce Motion, `expect(anim).toEqual({ name: 'fade-in', ms: 140 })` for `.sheet`. The keyframe name `fade-in` and the 140ms are both asserted.
- 66-75: the active row is focusable; arrow keys move focus between rows; `data-active="true"`.

### D.6 `tests/e2e/29-layout-sweep.spec.ts` (with `layoutProblems` in `tests/e2e/fixtures.ts:69-146`)

Runs at 1280 × 800 and 1000 × 640 over: the home page, the home menu and its two submenus, all six widgets, a widget menu and its Size submenu, the shortcut editor, the tab menu, the Space menu, the command bar with results, the six Settings tabs (`general`, `appearance`, `links`, `privacy`, `shortcuts`, `advanced`), History and Archive. For each, `expect(await layoutProblems(page, scope)).toEqual([])`.

What counts as a problem:
- Two text-bearing elements (neither an ancestor of the other) overlapping by more than 12px² and more than 3px in each direction (`fixtures.ts:142`).
- Text outside the window by more than 1px, unless an ancestor scrolls in that direction (`fixtures.ts:127-129`).
- A `white-space: nowrap` element with `overflow-x: visible` whose content is more than 1px wider than its box (`fixtures.ts:132`).

Elements with opacity 0, `display: none`, `visibility: hidden`, inside `.toasts` or under `[aria-hidden="true"]` are skipped.

Timing the sweep depends on: 150ms after a menu appears (line 12, "menu-in animation", currently 132ms), 300ms after adding widgets, 350ms after Settings opens, 300ms per Settings tab. Longer entrance animations or wider staggers can make it measure mid-flight.

Practical meaning: larger type, tighter rows, or wider labels in menus, Settings rows and widgets will show up here first, especially at 1000 × 640.

### D.7 Other test files that assert styling (not in the list, but a restyle will hit them)

- `tests/e2e/19-shields-downloads-extensions.spec.ts:259-267`: `--dur` is `'220ms'`, `--speed` `'1'`; at speed 2, `'110ms'` and `'0.5'`; bouncy gives `'160ms'` and `--ease` contains `'1.45'`.
- same file, 269-270: `expect(parseFloat(sheetAnim)).toBeCloseTo(0.176, 2)` for `[data-testid=settings]`. That is `.kite-page`'s `page-in calc(var(--dur) * 1.1)` (2948): the 1.1 multiplier is pinned.
- same file, 279: under Reduce Motion, `toEqual(['fade-in', '0.14s'])` for the Settings page.
- `tests/e2e/14-settings.spec.ts:27-34`: `data-density="compact"`, `--row-h` `'30px'`, `--scale` `'1.15'`, `await expect(page.getByTestId('page-card')).toHaveCSS('border-radius', '20px')` after setting radius 20 (the card radius must equal `--radius` exactly), `--gap` `'0px'`.
- `14-settings.spec.ts:229`: the Space header starts at most 16px below the address bar.
- `14-settings.spec.ts:270-273`: the Settings button's background colour changes while Settings is open (5103-5107).
- `14-settings.spec.ts:279-280`: `.row[data-active] .row-btn` is at least 24 × 24.
- `tests/e2e/01-tabs.spec.ts:185`: double-clicking the resizer returns the sidebar to 264px.
- `tests/e2e/04-spaces.spec.ts:80, 87, 89`: `toHaveCSS('--tint-1', '#123456')`, `--grain-opacity` `'.16'` then `'0'`.
- `tests/e2e/13-import-arc.spec.ts:70`: `--tint-1` `'#3366cc'`.
- `tests/e2e/32-halo-features.spec.ts:18-40, 131, 156-174`: `--pattern`, `--pattern-size` `'28px 28px, 28px 28px'`, `--tint-2` per preset, `--radius` `'20px'` then `'12px'`, `--gap` `'0px'`.
- `tests/e2e/31-own-backgrounds.spec.ts:35, 59`: `--backdrop` matches `/^linear-gradient\(90deg/`; `start-bg` has a `blob:` background image.
- `tests/e2e/16-pip-frame.spec.ts`: close button is 24 × 24 (43-44) with `background-color` `'rgba(33, 33, 35, 0.8)'` (49); `.pipd-bottom` has `border-radius` `'10px'` (203, 212); `.pipd-ring` is `'0px'` then `'10px'` with an inset shadow (216-220); `.pipd-corner` opacity `'0'` then `'1'` (20, 24); `html`, `body`, `#root` are `rgba(0, 0, 0, 0)` (224).
- `tests/electron/browser.spec.ts:431-442`: window buttons at `{ x: 16, y: 16 }` and the card at x = 8 in the real app.

Class names the test suites select on (renaming any of them breaks tests): `.folder-row` (45 uses), `.row` (20), `.surface-slot` (19), `.folder-children` (15), `.folder` (14), `.cb-row` (11), `.folder-peek` (8), `.pane-frame` (6), `.site-icon`, `.sb-top`, `.pipd-ring`, `.pipd-bottom`, `.perm-row`, `.chip` (4 each), `.set-row` (3), `.space-icon`, `.space-header`, `.settings-tab`, `.pipm-thumb`, `.pipd-shade`, `.arch-day`, `.adb-group-head` (2 each), and once each: `.widget-head`, `.wg-weather-day`, `.wg-cal-day`, `.warn`, `.toasts`, `.sheet`, `.sb-scroll`, `.row-btn`, `.pipd-corner`, `.pane-bar`, `.letter`, `.folder-more`, `.folder-empty`, `.emoji`, `.dl-row`, `.dl-list`, `.cb-badge`, `.cb`, `.adb-list`.

Data attributes the suites assert or select on: `data-theme`, `data-side`, `data-density`, `data-collapsed`, `data-sidebar-peek`, `data-motion`, `data-fullscreen`, `data-backdrop`, `data-tone`, `data-lights`, `data-active`, `data-visible`, `data-picked`, `data-drop`, `data-over`, `data-asleep`, `data-on`, `data-off`, `data-shown`, `data-size`, `data-mode`, `data-spin`, `data-leaving`, `data-hit`, `data-flip`, `data-dnd-row`, `data-space-dot`, `data-kind`, `data-title`, `data-level`, `data-state`, `data-focused`, `data-count`, `data-done`, `data-today`, `data-section`.

---

## E. Risks and gotchas for parallel editing

### E.1 Cascade order is load-bearing

44 selector-and-property pairs are declared twice with equal specificity, and the later one wins only because it comes later. The Motion block (4186-4359) must stay after everything in 127-1734. Moving a section, or splitting the file into several files imported in a different order, silently changes transitions and animations for `.btn`, `.icon-btn`, `.row`, `.fav`, `.space-dot`, `.set-link`, `.toggle`, `.toggle-knob`, `.sheet`, `.sheet-scrim`, `.cb`, `.cb-scrim`, `.toast`, `.menu`.

Other order dependencies:
- `.cb { animation: none }` (4247) must stay after 1155, or the motion test at D.5 fails.
- The focus resets at 5097 and 5354 rely on `.app .x:focus-visible` (specificity 0,3,0) beating the global ring at 4986 (0,2,0, because of `:where`). A new input that wants no ring needs the same `.app` prefix.
- `.app .input:focus` (4992) overrides `.input:focus` (1651).
- `.start[data-tone='dark']` at 6178-6180 overrides the copy at 5660-5672.
- `.sheet` is declared three times (1431, 3518, 4194); `.menu` three times (1191, 4253, 6154).
- 29 `!important`: 14 belong to the two Reduce Motion blocks, 3 to `prefers-contrast`, 3 to resize and drag cursors, the rest to pip and one-offs (2437-2438, 3512, 3575, 3707, 4161-4162, 4592, 4977).

### E.2 Selectors shared across surfaces

- `.icon-btn` (222): sidebar, sheets, panes, Peek, find bar, search boxes, widgets.
- `.btn` and variants: 96 call sites. `.app-crash .btn` (6045-6058) restyles it outside `.app`.
- `.input`: 31 call sites, including inside widgets where `.start[data-tone='dark'] .widget .input` (6274) restyles it.
- `.set-row`, `.set-card`, `.set-link`: Settings, every sheet built with `Row`/`SwitchRow`, AdBlock, Customize.
- `.segmented`, `.toggle`, `.range`, `.chip`, `.muted`, `.link`, `.search-box`, `.empty-state-*`, `.look-h`, `.inline-form`, `.field*`.
- `.site-icon`: rows, favourites, start tiles, command bar, Archive, History.
- `.row`: sidebar rows and the new-tab button (`.row.new-tab`). `.app[data-page] .row[data-active]:not(:hover)` (2966) dims it from the Settings section.
- `.menu-item`: the context menu and the little window's menu.
- `.kite-page`: Settings, History, Archive, Downloads and the other full pages; also the lazy-load placeholder.
- Grouped selector lists that name classes from several zones: the Reduce Motion lists (1078, 1081, 5070, 5073), scrollbars (5033-5047: `.settings-main, .sheet-body, .cb-list, .menu`), overscroll (6136-6142), balanced headings (6145-6150), press transitions (4304-4321), brand chip (5635).
- `[data-off]` (4355) and `[data-on] > .dl-count` (4697) are bare attribute selectors with no class.

### E.3 Container queries

Three elements are size containers: `.kite-page` (2947), `.settings` (2981), `.start` (5256). All queries are unnamed, so each resolves against the nearest container ancestor:

- 3197 (920px), 3207 (760px): children of `.settings`, measured against `.settings`.
- 3524 (720px): styles `.settings` itself (3525), which is measured against `.kite-page`, and its children, which are measured against `.settings`.
- 5458 and 6235 (620px): `.start-grid` and `.shortcut-editor`, measured against `.start`.

Adding `container-type` to a wrapper (for example `.card`, `.stage`, `.sheet`, `.widget`) changes which box those queries measure. `container-type: inline-size` also applies layout containment, so a container cannot size itself from its contents' inline size.

Viewport media queries are separate: 900px for the sidebar's max width (5005), and nothing else is responsive.

### E.4 `--scale`, `--speed`, `--dur`

- `--scale` multiplies font sizes only (122 declarations and one `font` shorthand). Heights, paddings, icon sizes and line boxes do not scale. At 1.25 a 13px label becomes 16.25px inside a 30px menu item or a 28px segmented button. Any new font size must be written `calc(Npx * var(--scale))`; 18 existing ones are not.
- `--speed` is `1 / motionSpeed`. Raw durations must be written `calc(Ns * var(--speed, 1))` (94 places do).
- `--dur` already includes the speed. Never multiply `--dur` by `--speed`. Line 5480 shows the correct mix: `calc((var(--dur) * 0.9) + min(var(--i, 0), 10) * 40ms * var(--speed, 1))`.
- `--t-fast` and `--t-exit` are derived from them and are only defined on `.app`, so they do not exist in the pip window.
- `--ease` can be an overshooting curve (`bouncy`, 1.45) or a `linear()` spring. Applying it to opacity or colour gives odd results; it is currently only on transforms and margins.
- `--press-ease`/`--press-dur` change only for the `spring` feel.

### E.5 Density

`data-density` is set on `.app` and no selector reads it. Density changes one thing: `--row-h` (30, 36, 42) for `.row { min-height }` at 472. Favourites, the Space header, menus, Settings rows and the command bar do not respond. If the overhaul introduces density-aware spacing, the hook exists but nothing is wired. Tests pin `--row-h` to `30px` for compact.

### E.6 `[data-side='right']`

Nine rules mirror the layout by hand: 66 (row-reverse), 140 (sidebar padding), 154 and 173 (collapsed and peeking sidebar), 189 (hot zone), 884 (resizer), 900 (stage padding), 4221 (docked sheet), 4475 (site info). The stylesheet uses physical properties throughout (`left`, `padding-left`, `margin-right`), not logical ones. Any new asymmetric spacing in the sidebar, stage, docked sheet or site popover needs a matching right-side rule. `App.tsx:52` computes the window-button position for the right side in JS (`innerWidth − inset − sidebarWidth + 14`), and a test pins it.

### E.7 Reduce Motion

Four mechanisms, all of which must agree:

1. `.app[data-motion='reduced']` (1069-1083), Kite's own switch.
2. `@media (prefers-reduced-motion: reduce)` (5060-5076), an identical copy for the system setting.
3. The pip window's own blocks (3961-3970, 4158-4164), because it is outside `.app`.
4. `flip.ts:15-18`, which checks both in JS.

Both CSS blocks use `*` with `!important`: animations collapse to 0.001ms, and `transition-property` is restricted to colours, opacity, shadow, fill and stroke at 120ms. Any transform transition added anywhere is switched off automatically. The exception lists (`.sheet, .kite-page, .menu, .toast, .peek, .cb, .site-info` fade in for 140ms; leaving ones fade out for 100ms) name classes explicitly, in both copies. A new overlay class must be added to both, and tests pin `fade-in` and 140ms.

Extra one-offs: 4976 (`.dl-bar`), 6636 (`.backdrop-tile`). The little window never sets `data-motion`, so only the system setting reduces motion there.

### E.8 Platform differences

- There are no Windows or Linux classes. The only platform hooks are `data-electron` and `data-mac` on `.app`, and `data-lights` on `.sb-top`.
- macOS traffic lights: the main window reserves 70px (`.sb-top[data-lights]`, 208) with buttons at 16,16 (`main.ts:235`); the little window reserves 76px (2375) with buttons at 12,13 (`main.ts:553`).
- Window dragging: `-webkit-app-region` at 120, 124, 186, 911, 915, 927, 3993, 3997. The whole `.stage` padding is a drag region in Electron and its children are `no-drag`. A new element placed in the stage margin, or a larger gap, changes what drags the window.
- Fonts: macOS renders San Francisco; Windows and Linux render the bundled Figtree (static 400 to 700), where weights 550, 650 and 800 snap to the nearest available weight. Glyph widths differ, so the layout sweep can pass on macOS and fail on CI or the reverse.
- Scrollbars are styled with `::-webkit-scrollbar` only (298, 5033-5047).
- Tests run the web build with `/?platform=darwin&chrome=electron` (`20-layout-themes-sound.spec.ts:10`), so most e2e runs see the macOS layout; the real-app tests run on macOS only.

### E.9 Things outside `.app`

- Pip window (`.pipd`, `.pipm-wrap`): no theme variables, its own `--pip-*` tokens, `--speed` falls back to 1, and tests pin its colours and radii.
- Crash screen (`.app-crash`): hard-coded colours, `prefers-color-scheme` for dark.
- `html, body, #root` and `.boot`: hard-coded light `#f4f1ec`.
- `body.dragging`, `body.resizing`, `body.resizing-v`: global cursor overrides with `!important`.
- The drag ghost is appended to `document.body` by `dnd.tsx` and is positioned from JS, but its colours are literals so it works without the variables.

### E.10 Smaller traps

- `--blur` is `8px` from `theme.ts`; every `var(--blur, 20px)` fallback is misleading. Changing the blur means changing `theme.ts:163`.
- Theme variables are inline on `.app`. A new token that should vary by Space or mode has to be added in `themeVars()`; a new static token can go in the `.app` block at 76-91, with a dark override at 93-97.
- `.sidebar` has no background; it shows `.app`'s backdrop. The frosted look over pictures is a `::before` at z-index −1 (6575-6584). The contrast test reads the sidebar's computed background (D.4).
- `.card` uses `isolation: isolate` and `overflow: hidden`; web content is a `webview` inside `.surface-slot`. Shadows and radius on the card are what the user perceives as the page edge, and `border-radius` must stay exactly `var(--radius)`.
- The widget rules (6239-6454) are written one rule per line, so line-based merges there conflict more easily than in the rest of the file.
- The stylesheet test will fail on any unbalanced brace or comment, which makes a bad merge in one zone fail everyone's unit run.
- `vite.config.ts.timestamp-*.mjs` files in the repo root are untracked build leftovers, not part of the styling.
