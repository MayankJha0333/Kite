# Kite — macOS design spec (research pass 02)

Compiled 2026-11-25. Target: an Electron + React + plain-CSS sidebar browser that should read as a first-party Mac app.

## How to read this

Every number carries a provenance tag. Do not treat the tags as equal.

| Tag | Meaning |
|---|---|
| **[M]** | Measured on this machine (macOS 27.2.1 "Golden Gate", build 26B131, SDK 27.2) by a read-only AppKit script that asks the system for intrinsic sizes, resolved colours and frames. Scripts: `scratchpad/scripts/metrics.swift`, `radius.swift`. These are the most reliable numbers here. |
| **[A]** | Stated by Apple (HIG, developer docs, WWDC transcript). URL beside the fact. |
| **[S]** | Third-party source (open-source browser CSS, a blog, a forum). URL beside the fact. Community numbers are flagged. |
| **[C]** | Computed by me from a stated formula (spring to `linear()`, contrast ratios). Scripts: `scratchpad/scripts/spring.js`, `fit.js`, `fit2.js`. |
| **[E]** | Estimate or my recommendation. Not verified against a native screenshot. Tune by overlaying a 2x screenshot of the native control. |

Three facts change how the rest should be read:

1. **This Mac runs macOS 27, not 26.** macOS 27 walked back parts of Tahoe: sidebars are edge-to-edge again with no shadow, window corners are uniform across apps and less round, toolbars are uniform, and there is a system Liquid Glass opacity slider. [S] https://www.macrumors.com/2026/06/09/macos-golden-gate-liquid-glass/ — so do not build Kite around Tahoe's floating glass sidebar; it lasted one release.
2. **Tahoe (26) pixel values are mostly not published.** Apple's WWDC25 AppKit session gives no point values for radii, control heights or sidebar insets. [A] https://developer.apple.com/videos/play/wwdc2025/310/ — where I give Tahoe numbers they are community-reported or estimates, and say so.
3. **Sequoia (15) numbers I could not measure** (no Sequoia machine). The "compact" control metrics below are what AppKit returns with `prefersCompactControlSizeMetrics`, which Apple describes as "sizing that is compatible with previous releases of macOS". [A] same session.

---

## 1. macOS desktop metrics

### 1.1 Type scale (built-in macOS text styles)

[A] https://developer.apple.com/design/human-interface-guidelines/typography — confirmed [M] on 27.2.1 (`NSFont.preferredFont(forTextStyle:)` returned the same sizes and line heights).

| Style | Size / line height | Weight | Emphasized weight | Where macOS uses it |
|---|---|---|---|---|
| Large Title | 26 / 32 | Regular | Bold | Onboarding, start-page hero |
| Title 1 | 22 / 26 | Regular | Bold | Sheet titles in large layouts |
| Title 2 | 17 / 22 | Regular | Bold | Section titles |
| Title 3 | 15 / 20 | Regular | Semibold | Large-sidebar row text, card titles |
| Headline | 13 / 16 | **Bold** | Heavy | Window title, alert title |
| Body | 13 / 16 | Regular | Semibold | Default UI text, sidebar rows, menus |
| Callout | 12 / 15 | Regular | Semibold | Secondary descriptions |
| Subheadline | 11 / 14 | Regular | Semibold | Small-sidebar rows, section headers, help text |
| Footnote | 10 / 13 | Regular | Semibold | Badges, captions |
| Caption 1 | 10 / 13 | Regular | Medium | |
| Caption 2 | 10 / 13 | Medium | Semibold | |

macOS default text size is 13 pt, minimum 10 pt. [A] same page. macOS text styles do not scale with Dynamic Type. [S] https://wwdcnotes.com/documentation/wwdc20-10104-adopt-the-new-look-of-macos/

System font roles [M]: menu 13, menu bar 13, window title 13 (face `.AppleSystemUIFaceHeadline`, i.e. bold), tooltip 11, message 13, control content 12, small system 11, label 10. Control font sizes: mini 9, small 11, regular/large/extra-large 13.

SF 13 pt vertical metrics [M]: ascender 12.57, descender 2.74, cap height 9.16, x-height 6.84. An icon that should look centred on 13 px text wants its optical centre about 4.6 px above the baseline.

```css
:root {
  --font-ui: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;
  --font-serif: ui-serif, "New York", Georgia, serif;

  /* size / line-height pairs straight from the HIG table */
  --text-caption: 10px;  --lh-caption: 13px;
  --text-small: 11px;    --lh-small: 14px;
  --text-callout: 12px;  --lh-callout: 15px;
  --text-body: 13px;     --lh-body: 16px;
  --text-title3: 15px;   --lh-title3: 20px;
  --text-title2: 17px;   --lh-title2: 22px;
  --text-title1: 22px;   --lh-title1: 26px;
  --text-large: 26px;    --lh-large: 32px;

  --weight-regular: 400; --weight-medium: 500; --weight-semibold: 600; --weight-bold: 700;
}
body { font: var(--weight-regular) var(--text-body)/var(--lh-body) var(--font-ui); }
```

### 1.2 Sidebar rows

Apple's published table [A] https://developer.apple.com/design/human-interface-guidelines/sidebars (values as surfaced by search of that page):

| Sidebar size | Row height | Icon | Text |
|---|---|---|---|
| Small | 24 pt | 16 x 16 | 11 pt (Subheadline) |
| Medium (default) | 28 pt | 20 x 20 | 13 pt (Body) |
| Large | 32 pt | 24 x 24 | 15 pt (Title 3) |

What AppKit actually returns on macOS 27.2.1 [M] (`NSOutlineView`, `style = .sourceList`): small **24**, medium **32**, large **40**; indentation per level 13; intercell spacing 3 x 0. So the current OS is 4 to 8 pt taller per row than the published table. Plain tables: row 24, horizontal intercell 17.

Other sidebar rules [A] same HIG page:
- No more than two levels of hierarchy.
- Sidebar icons take the user's accent colour unless you give one a fixed colour for meaning.
- Do not put critical actions at the bottom (windows get dragged off-screen).
- Do not hide the sidebar by default.

Selection style [E]: sidebars use the *unemphasized* selection, a neutral rounded fill, not solid accent blue. The fill is in the range of `systemFill` (black or white at about 10% [M]); the label keeps `labelColor`; the icon keeps the accent tint. Solid accent fill with white text is for content lists in a focused window (`selectedContentBackgroundColor`, rgb(0,100,225) light / rgb(0,89,209) dark [M]). Selection radius: about 5 to 6 px on Sequoia, about 8 px on 26/27 [E].

**Recommended for Kite** [E]:

| Token | Value | Why |
|---|---|---|
| Tab row height | **32 px** (compact option 28, never below 24) | Matches the measured medium source-list row |
| Row horizontal inset from sidebar edge | 8 px | Leaves room for an inset rounded selection |
| Row inner padding | 0 8 px | Favicon sits 16 px from the sidebar edge |
| Favicon | 16 x 16, radius 3 px | 16 is the small-sidebar icon size and the web favicon size |
| Icon to title gap | 8 px | |
| Title | 13 / 16, regular, `label` | |
| Section header | 11 / 14, semibold, `secondaryLabel`, padding 0 8 px, 20 px tall, 12 px above | |
| Row radius | 8 px | Concentric inside a 16 px window corner with an 8 px inset |
| Row gap | 0 to 2 px | Native source lists have no visible gap |
| Sidebar width | 240 default, min 180, max 400 | Arc study uses 240 expanded [S]; Zen's toolbox minimum is 163 px [S] |

### 1.3 Control heights

[M] intrinsic heights on 27.2.1 (default metrics) and with compact metrics (the pre-Tahoe sizing):

| Control size | Push button | Compact (pre-26) push | Text field | Pop-up | Segmented | Search field | Checkbox | Slider |
|---|---|---|---|---|---|---|---|---|
| Mini | 16 | 13 | 19 | 16 | 16 | 16 | 12 | 12 |
| Small | 20 | 16 | 22 | 20 | 20 | 20 | 14 | 14 |
| Regular (medium) | **24** | 20 | **24** | 24 | 24 | 24 | 16 | 16 |
| Large | 28 | 28 | 24 | 28 | 28 | 28 | 18 | 20 |
| Extra large | 36 | 36 | 24 | 36 | 36 | 36 | 18 | 20 |

Switch: 54 x 24 at every size [M].

Shape rule [A] https://developer.apple.com/videos/play/wwdc2025/310/ : "The mini through medium sizes retain a rounded-rectangle shape... while the large and extra-large sizes round out into a capsule shape." Mini, small and medium are "slightly taller" than before. Extra large is for "the most prominent actions".

Tint prominence [A] same session: a default button (Return key) automatically gets primary accent tint; secondary actions get a restrained tint; destructive uses red "at a restrained level so it doesn't overpower nearby controls". One primary-tinted button per surface.

```css
:root {
  --control-h-mini: 16px;
  --control-h-small: 20px;
  --control-h: 24px;        /* regular: buttons, fields, pop-ups */
  --control-h-large: 28px;  /* capsule */
  --control-h-xl: 36px;     /* capsule, one per surface */
}
.btn        { height: var(--control-h); padding: 0 10px; border-radius: 6px; font: 400 13px/16px var(--font-ui); }
.btn--small { height: var(--control-h-small); padding: 0 8px; border-radius: 5px; font-size: 11px; line-height: 14px; }
.btn--large { height: var(--control-h-large); padding: 0 14px; border-radius: 999px; }
.btn--xl    { height: var(--control-h-xl); padding: 0 18px; border-radius: 999px; font-weight: 500; }
.field      { height: var(--control-h); padding: 0 7px; border-radius: 6px; }
```
Padding and the 5 to 6 px radii are [E].

### 1.4 Corner radii and the concentric rule

| Surface | Sequoia (15) and earlier | Tahoe (26) | macOS 27 |
|---|---|---|---|
| Window | 10 [S, community] | 26 with a toolbar, smaller for titlebar-only [S community; Apple confirms only that the two differ] | uniform; community says 20; AppKit's private `_cornerRadius` returns **16** for every titled window [M] |
| Menu | about 6 [E] | about 12 to 13 [E] | same as 26 [E] |
| Menu item highlight | about 4 [E] | 8 [S: Firefox switches `--menuitem-border-radius` to its medium token under `-moz-mac-tahoe-theme`] | same |
| Popover | about 10 [E] | about 16 to 20 [E] | same [E] |
| Sheet / alert | about 10 to 12 [E] | about 20 to 26 [E] | about 16 to 20 [E] |
| Regular button, text field | about 5 to 6 [E] | about 6 to 8, capsule at large and XL [A for shape, E for value] | same |
| Sidebar selection | about 5 to 6 [E] | about 8 to 10 [E] | about 8 [E] |
| Web content card (Arc pattern) | 8 to 10 [E] | | |

Sources for window radii: https://forums.macrumors.com/threads/override-window-corner-radius-disable-floating-sidebar.2484925/ ("26 is Tahoe's standard, 20 is Golden Gate's standard, 10 is for previous versions"), https://developer.apple.com/videos/play/wwdc2025/310/ ("Windows with toolbars now use a larger radius... Titlebar-only windows retain a smaller corner radius"), https://www.macrumors.com/2026/06/09/macos-golden-gate-liquid-glass/ (uniform radius in 27). Firefox ships a 16 px chrome-block radius for Tahoe versus 10 px default. [S] https://bugzilla.mozilla.org/show_bug.cgi?id=2053333

The window radius is drawn by the OS; Kite should never draw it. What Kite controls is everything nested inside it.

**Concentric rule** [A]: "Each element is designed with a curvature that sits neatly within the corner radius of its container." Formula: `inner radius = outer radius − gap between the two edges`, with a floor so small elements do not go square. Zen implements exactly this with a 5 px floor. [S] https://raw.githubusercontent.com/zen-browser/desktop/dev/src/zen/common/styles/zen-theme.css (`max(5px, radius − separation/2)`).

```css
:root {
  --window-radius: 16px;  /* set from main process per OS: 10 on <=15, 16 on 26/27. Verify with a 2x screenshot. */
  --chrome-gap: 8px;      /* gap between window edge and the content card / sidebar rows */
  --radius-card: max(6px, calc(var(--window-radius) - var(--chrome-gap)));   /* 8 */
  --radius-row:  var(--radius-card);                                          /* 8 */
  --radius-control: 6px;
  --radius-menu: 12px;
  --radius-menu-item: max(4px, calc(var(--radius-menu) - 5px));               /* 7 */
  --radius-popover: 14px;
  --radius-sheet: 16px;
  --radius-pill: 999px;
}
```
State the scale as a rule and never add a value outside it: window 16, sheet 16, popover 14, menu 12, card/row 8, control 6, capsule for large actions. (ui-taste "shape lock": "Mixed radii without a stated rule read as assembled-from-parts.")

### 1.5 Menus

[M] on 27.2.1 (`NSMenu.size` deltas): item height **24**, top and bottom padding **5** each, separator item **11** tall (a 1 px line with 5 px above and below), font 13. Adding icons does not change item height.

[S] Firefox's native-matching values, https://raw.githubusercontent.com/mozilla-firefox/firefox/main/toolkit/themes/shared/menu.css : macOS item padding `3px 9px` before Tahoe, `4px 11px` under the Tahoe theme, comment "use px values on macOS to match native menus". 13 px text with 16 px line height + 2 x 4 px = 24, which agrees with the measurement; the pre-Tahoe 3 px padding gives 22.

Tahoe added icons to menu items "in a single column that's easy to scan". [A] WWDC25 310. macOS 27 uses "far fewer" of them. [S] via 9to5Mac search summary. Recommendation: icons only on the handful of items where they speed scanning.

[E]: highlight inset 5 px from the menu edge; shortcut glyphs right-aligned in `tertiaryLabel`, white when highlighted; highlighted item is accent fill with white text; disabled items use `tertiaryLabel`; min width about 180 px; max about 320 px then truncate; submenu chevron 10 px.

```css
.menu {
  padding: 5px; min-width: 180px; border-radius: var(--radius-menu);
  font: 400 13px/16px var(--font-ui);
}
.menu-item {
  height: 24px; padding: 0 9px; border-radius: var(--radius-menu-item);
  display: flex; align-items: center; gap: 8px;
}
.menu-item[data-highlighted] { background: var(--accent); color: #fff; }   /* instant, no transition */
.menu-item[data-disabled]    { color: var(--label-3); }
.menu-item .shortcut         { margin-left: auto; padding-left: 24px; color: var(--label-3); }
.menu-item[data-highlighted] .shortcut { color: rgba(255,255,255,.85); }
.menu-sep { height: 1px; margin: 5px 9px; background: var(--separator); }
```

### 1.6 Popovers, sheets, alerts

Rules [E] unless tagged; layout numbers are recommendations:

| Surface | Layout |
|---|---|
| Popover | Anchored to its trigger with an arrow or a 6 to 8 px gap. Padding 12 to 16. Width 260 to 360. No scrim. Closes on outside click and Esc. Scale origin at the trigger. `NSPopover.animates` defaults to true [M]. |
| Sheet | Card centred horizontally in the parent window, attached below the toolbar. Padding 20. Width 420 to 520. Scrim about black 20% light / 40% dark over the window only. Buttons bottom-right, default button rightmost, Cancel to its left, destructive far left. |
| Alert | 260 px wide, centred. 64 px app icon, title 13 bold centred, message 11 regular centred, buttons full width (stacked when 3 or labels are long). Return activates default, Esc activates Cancel. |
| Tooltip | 11 px text [M], padding 3 6, radius 4, appears after roughly 1 to 1.5 s, no animation in, short fade out. |

### 1.7 Focus ring

[M] `keyboardFocusIndicatorColor`: rgba(0,103,244,0.498) light, rgba(26,169,255,0.498) dark (with default blue accent; it follows the accent colour). Ring is about 3 px thick, hugs the control with no gap, radius = control radius + ring width [E].

```css
:root { --focus-ring: color-mix(in srgb, var(--accent) 50%, transparent); }
:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 0; }
/* rows inside the sidebar: draw the ring inside so it is not clipped */
.row:focus-visible { outline-offset: -3px; }
/* macOS does not ring buttons on mouse click; :focus-visible already gives that */
```
The ring appears instantly. macOS only shows it for keyboard focus on buttons, always on text fields.

### 1.8 Separators and hairlines

[M] `separatorColor`: rgba(0,0,0,0.10) light, rgba(255,255,255,0.12) dark. A native separator is one device pixel, i.e. 0.5 CSS px on a Retina display.

```css
:root { --hairline: 0.5px; }
@media (resolution < 2dppx) { :root { --hairline: 1px; } }
.sep-h { height: var(--hairline); background: var(--separator); }
/* borders that must not shift layout */
.ring { box-shadow: 0 0 0 var(--hairline) var(--separator); }
```
Chromium rounds a 0.5px `border` up on some elements; `box-shadow` spread or a 1 px pseudo-element with `transform: scaleY(.5)` is reliable. [E]

### 1.9 Title bar, toolbar, traffic lights

[M] on 27.2.1 (`NSWindow.frame − contentLayoutRect`, `standardWindowButton(_:)` frames):

| Window style | Chrome height | Traffic light x (left of first) | y (from top) | Button size | Pitch |
|---|---|---|---|---|---|
| Title bar only | **32** | 9 | 9 | 14 x 14 | 23 (9 px gap) |
| Unified toolbar | **52** | 19 | 19 | 14 x 14 | 23 |
| Unified compact | **40** | 12 | 13 | 14 x 14 | 23 |
| Expanded (empty toolbar) | 48 | 9 | 9 | 14 x 14 | 23 |
| Preference | 88 | 9 | 9 | 14 x 14 | 23 |

The cluster is 60 px wide (3 x 14 + 2 x 9). Sequoia and earlier [E, widely reproduced]: title bar 28, unified 52, compact 38, lights 12 px circles on a 20 px pitch, about 8 px from the left in a plain title bar and about 20 px in a unified toolbar. Zed had to raise its traffic-light padding from 71 to 78 px when building against the macOS 26 SDK. [S] via search summary of the Zed commit "Fix title bar spacing when building on the macOS Tahoe SDK (#45351)".

Recommendation for Kite [E]: a 40 px top strip in the sidebar (unified-compact metrics), lights at x 12 / y 13; reserve 12 + 60 + 12 = 84 px before the first sidebar button. Set `trafficLightPosition` in the main process and branch on OS major version; with `titleBarStyle: 'hiddenInset'` Electron picks an inset for you (verify the Electron option names against current docs; I did not fetch them). The whole strip is `-webkit-app-region: drag` with every control inside it `no-drag`. Double-click on the drag strip must zoom or minimise per the user's Dock setting; do not swallow it.

Other [M]: scroller track width 17 (15 small); default `NSAnimationContext` duration 0.25 s; double-click interval 0.5 s.

---

## 2. Materials and depth

### 2.1 What the system does

- Liquid Glass "forms a distinct functional layer for controls and navigation elements... that floats above the content layer". "Don't use Liquid Glass in the content layer." "Use Liquid Glass effects sparingly... Limit these effects to the most important functional elements." [A] https://developer.apple.com/design/human-interface-guidelines/materials
- Two variants. Regular "blurs and adjusts the luminosity of background content to maintain legibility"; use it "when components have a significant amount of text, such as alerts, sidebars, or popovers". Clear is "highly translucent" and only for "components that float above media backgrounds"; over bright content add "a dark dimming layer of 35% opacity". [A] same page.
- Glass has no colour of its own. "Apply color sparingly"; "To emphasize primary actions, apply color to the background rather than to symbols or text"; "Refrain from adding color to the background of multiple controls." Small glass elements flip between light and dark based on what is under them. [A] https://developer.apple.com/design/human-interface-guidelines/color
- Tahoe: sidebars are "a pane of glass that floats above the window's content", inspectors are edge-to-edge glass; toolbar buttons are grouped onto shared glass capsules; a scroll edge effect (soft: progressive fade and blur; hard: more opaque backing) replaces the toolbar separator. Apple tells developers to *remove* `NSVisualEffectView` from sidebars because it blocks the glass. [A] https://developer.apple.com/videos/play/wwdc2025/310/
- macOS 27: sidebars edge-to-edge again, no sidebar shadow, sidebar icons coloured again, uniform toolbars, uniform window radius, Liquid Glass "diffuses complex content more effectively", darker edge and brighter specular highlight, user-controlled opacity slider. [S] https://www.macrumors.com/2026/06/09/macos-golden-gate-liquid-glass/
- Standard materials (pre-glass, still used in the content layer): choose by semantic role (sidebar, menu, popover, sheet, header, HUD, tooltip, under-window, under-page), not by colour; "use vibrant colors on top of it"; two blend modes, behind-window and within-window. [A] materials page.
- Linear shipped its own glass rather than Apple's: Gaussian blur base, a subtle gradient, a specular highlight, a soft shadow; no refraction, because it "can make dense interfaces harder to read". They call it ProKit discipline over Aqua exuberance. [S] https://linear.app/blog/linear-liquid-glass

### 2.2 What this means in Electron

1. `backdrop-filter` can only blur what is inside the web contents. It cannot see the desktop or other windows. The classic Mac sidebar is *behind-window* vibrancy: the desktop wallpaper tints it. To get that, the sidebar region of the DOM must be transparent and the window must use Electron's native vibrancy (`vibrancy: 'sidebar'` or `'under-window'`, `visualEffectState: 'followWindow'` so it greys out when the window is inactive). Verify option names in Electron docs. [E]
2. Menus, popovers and the command bar sit over web content, so *within-window* `backdrop-filter` is correct for them.
3. Never stack translucent on translucent (apple-design skill: "Never stack a light translucent surface on another — legibility collapses"). One blur layer per stack; anything on top of it is opaque or a plain tint.
4. Respect `prefers-reduced-transparency` and `prefers-contrast: more` with opaque fallbacks, and the inactive-window state: native sidebars lose saturation and vibrancy when the window is not key.
5. Do not copy the Tahoe floating sidebar. The durable pattern across 15, 26 and 27 is: sidebar is the window background material, web content is an inset rounded card with a contact shadow (the Arc/Zen layout). Zen uses a 7 px default radius and derives the inner radius concentrically. [S] zen-theme.css.

### 2.3 Material tokens (copy-paste)

All values [E], tuned to sit next to native surfaces. `--tint` is the per-Space colour if Kite has one; keep it under 8% so the material still reads as neutral.

```css
:root {
  /* light */
  --mat-sidebar: rgba(246, 246, 246, 0.72);         /* over native vibrancy; opaque fallback below */
  --mat-menu: rgba(246, 246, 246, 0.78);
  --mat-popover: rgba(250, 250, 250, 0.82);
  --mat-sheet: rgba(252, 252, 252, 0.96);           /* sheets are nearly opaque: they hold forms */
  --mat-hud: rgba(30, 30, 30, 0.72);                /* toasts, find bar: dark in both themes is acceptable */
  --mat-blur: blur(30px) saturate(180%);
  --mat-blur-heavy: blur(50px) saturate(200%);
  --edge-highlight: inset 0 0.5px 0 rgba(255, 255, 255, 0.6);
}
:root[data-theme="dark"] {
  --mat-sidebar: rgba(30, 30, 30, 0.70);
  --mat-menu: rgba(40, 40, 40, 0.78);
  --mat-popover: rgba(44, 44, 46, 0.82);
  --mat-sheet: rgba(44, 44, 46, 0.96);
  --mat-hud: rgba(50, 50, 50, 0.78);
  --edge-highlight: inset 0 0.5px 0 rgba(255, 255, 255, 0.14);
}
.surface-menu    { background: var(--mat-menu);    backdrop-filter: var(--mat-blur); }
.surface-popover { background: var(--mat-popover); backdrop-filter: var(--mat-blur); }
.surface-palette { background: var(--mat-popover); backdrop-filter: var(--mat-blur-heavy); }

@media (prefers-reduced-transparency: reduce) {
  :root { --mat-sidebar: #f2f2f2; --mat-menu: #f6f6f6; --mat-popover: #fafafa; --mat-sheet: #fcfcfc; --mat-blur: none; --mat-blur-heavy: none; }
  :root[data-theme="dark"] { --mat-sidebar: #1e1e1e; --mat-menu: #282828; --mat-popover: #2c2c2e; --mat-sheet: #2c2c2e; }
}
@media (prefers-contrast: more) {
  :root { --separator: rgba(0,0,0,.5); }
  :root[data-theme="dark"] { --separator: rgba(255,255,255,.5); }
}
/* window not key: flatten, like AppKit does */
:root[data-window-inactive] { --mat-sidebar: #ececec; }
:root[data-theme="dark"][data-window-inactive] { --mat-sidebar: #262626; }
```

A glass control (toolbar capsule, floating pill), restrained in the Linear manner: blur, a faint gradient, one specular edge, one soft shadow.

```css
.glass {
  background:
    linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,.08)),
    rgba(255,255,255,.42);
  backdrop-filter: blur(20px) saturate(180%);
  box-shadow:
    inset 0 0.5px 0 rgba(255,255,255,.8),      /* specular top edge */
    inset 0 0 0 0.5px rgba(255,255,255,.35),   /* rim */
    0 0 0 0.5px rgba(0,0,0,.08),
    0 2px 8px rgba(0,0,0,.10);
  border-radius: 999px;
}
:root[data-theme="dark"] .glass {
  background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.03)), rgba(60,60,60,.45);
  box-shadow: inset 0 0.5px 0 rgba(255,255,255,.22), inset 0 0 0 0.5px rgba(255,255,255,.10), 0 0 0 0.5px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.35);
}
```

### 2.4 Shadow recipes

All [E]. Native shadows have three parts: a hairline ring that defines the edge, a tight contact shadow, and a wide ambient shadow offset downward. In dark mode the ambient shadow is nearly invisible against the background, so the edge does the work: a dark outer hairline plus a light inner hairline.

```css
:root {
  --shadow-card:     0 0 0 0.5px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06);
  --shadow-menu:     0 0 0 0.5px rgba(0,0,0,.14), 0 1px 3px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.16);
  --shadow-popover:  0 0 0 0.5px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.08), 0 12px 32px rgba(0,0,0,.18);
  --shadow-sheet:    0 0 0 0.5px rgba(0,0,0,.15), 0 4px 12px rgba(0,0,0,.10), 0 24px 60px rgba(0,0,0,.28);
  --shadow-floating: 0 0 0 0.5px rgba(0,0,0,.20), 0 8px 20px rgba(0,0,0,.12), 0 22px 70px 4px rgba(0,0,0,.36); /* command bar, little windows */
  --shadow-inner-edge: inset 0 0.5px 0 rgba(255,255,255,.6);
}
:root[data-theme="dark"] {
  --shadow-card:     0 0 0 0.5px rgba(0,0,0,.6),  inset 0 0 0 0.5px rgba(255,255,255,.06), 0 4px 16px rgba(0,0,0,.30);
  --shadow-menu:     0 0 0 0.5px rgba(0,0,0,.7),  inset 0 0 0 0.5px rgba(255,255,255,.12), 0 8px 24px rgba(0,0,0,.45);
  --shadow-popover:  0 0 0 0.5px rgba(0,0,0,.7),  inset 0 0 0 0.5px rgba(255,255,255,.12), 0 12px 32px rgba(0,0,0,.50);
  --shadow-sheet:    0 0 0 0.5px rgba(0,0,0,.8),  inset 0 0 0 0.5px rgba(255,255,255,.12), 0 24px 60px rgba(0,0,0,.60);
  --shadow-floating: 0 0 0 0.5px rgba(0,0,0,.8),  inset 0 0 0 0.5px rgba(255,255,255,.14), 0 22px 70px 4px rgba(0,0,0,.65);
  --shadow-inner-edge: inset 0 0.5px 0 rgba(255,255,255,.14);
}
```
Rules: (1) shadows are neutral black, never tinted with the accent; (2) the y-offset is always positive, light comes from above; (3) bigger surface, bigger blur *and* bigger offset (apple-design: "Bigger surfaces should read as thicker"); (4) a CSS shadow is clipped by the window, so any menu that can reach the window edge should be a native menu (see 7.8); (5) in dark mode never drop the inner light hairline, it is what separates a popover from the page.

Reference points from open source: Firefox's hover card and Chrome's menus use a single ambient shadow around 20% black; the Arc design study reconstructs the command bar as `0 4px 24px rgba(0,0,0,.2)` plus a 1 px `rgba(255,255,255,.1)` ring and Little Arc as `0 8px 32px rgba(0,0,0,.3)`. [S] https://blakecrosley.com/guides/design/arc (author's reconstruction, not Arc's source).

---

## 3. Colour and contrast

### 3.1 Label colours and fills

[M] on 27.2.1, default contrast, resolved to sRGB. The label alphas match dumps from Monterey, so these four have been stable for years. [S] https://gist.github.com/andrejilderda/8677c565cddc969e6aae7df48622d47c

| Token | Light | Dark | Contrast on window bg [C] |
|---|---|---|---|
| label | black **0.85** | white **0.85** | 14.9:1 / 12.2:1 |
| secondaryLabel | black **0.50** | white **0.55** | 3.95:1 / 5.9:1 |
| tertiaryLabel | black **0.26** | white **0.25** | 1.9:1 / 2.3:1 |
| quaternaryLabel | black **0.10** | white **0.10** | decorative only |
| quinaryLabel | black 0.05 | white 0.05 | decorative only |
| placeholderText | black 0.50 | white 0.55 | (was 0.25 on Monterey; now equals secondary) |
| disabledControlText | black 0.25 | white 0.25 | |
| separator | black 0.10 | white 0.12 | |
| systemFill | black 0.098 | white 0.098 | strongest neutral fill: selected row, pressed |
| secondarySystemFill | black 0.078 | white 0.078 | |
| tertiarySystemFill | black 0.047 | white 0.047 | hover |
| quaternarySystemFill | black 0.027 | white 0.027 | resting control background |
| quinarySystemFill | black 0.008 | white 0.008 | |

Note: light-mode `secondaryLabel` is 3.95:1 on white, under WCAG 4.5:1 for small text. Apple ships it; for Kite use 0.60 for 11 px secondary text in light mode (5.7:1) and keep 0.50 for 13 px and larger [E].

| Background / accent | Light | Dark |
|---|---|---|
| windowBackground | rgb(255,255,255) | rgb(30,30,30) |
| controlBackground, textBackground | rgb(255,255,255) | rgb(30,30,30) |
| underPageBackground | rgb(246,246,246) | rgb(40,40,40) |
| alternating row | rgb(244,245,245) | white 0.047 |
| controlColor (button face) | rgb(255,255,255) | white 0.247 |
| selectedContentBackground (focused) | rgb(0,100,225) | rgb(0,89,209) |
| unemphasizedSelectedContentBackground | rgb(220,220,220) | rgb(70,70,70) |
| selectedTextBackground | rgb(179,215,255) | rgb(63,99,139) |
| controlAccent (default blue) | rgb(0,122,255) | rgb(0,122,255) |
| keyboardFocusIndicator | rgba(0,103,244,0.50) | rgba(26,169,255,0.50) |
| link | rgb(0,104,218) | rgb(65,156,255) |
| findHighlight | rgb(255,255,0) | rgb(255,255,0) |
| systemBlue | rgb(0,136,255) | rgb(0,145,255) |
| systemRed | rgb(255,56,60) | rgb(255,66,69) |
| systemGreen | rgb(52,199,89) | rgb(48,209,88) |
| systemOrange | rgb(255,141,40) | rgb(255,146,48) |
| systemYellow | rgb(255,204,0) | rgb(255,214,0) |
| systemTeal | rgb(0,195,208) | rgb(0,210,224) |
| systemMint | rgb(0,200,179) | rgb(0,218,195) |
| systemIndigo | rgb(97,85,245) | rgb(109,124,255) |
| systemGray | rgb(142,142,147) | rgb(152,152,157) |

Window background changed between OS generations: Monterey was rgb(236,236,236) light and rgb(50,50,50) dark [S gist]; macOS 27 is pure white and rgb(30,30,30) [M]. So "native grey" depends on the OS you target; on 26/27 the window body is white and the sidebar material carries the grey.

```css
:root {
  --label: rgba(0,0,0,.85);  --label-2: rgba(0,0,0,.50);  --label-3: rgba(0,0,0,.26);  --label-4: rgba(0,0,0,.10);
  --label-2-small: rgba(0,0,0,.60);
  --separator: rgba(0,0,0,.10);
  --fill: rgba(0,0,0,.10);  --fill-2: rgba(0,0,0,.08);  --fill-3: rgba(0,0,0,.05);  --fill-4: rgba(0,0,0,.03);
  --bg-window: #fff;  --bg-under: #f6f6f6;  --bg-raised: #fff;
  --accent: AccentColor;            /* Chromium resolves this to the user's macOS accent */
  --accent-fg: AccentColorText;
  --selection-focused: rgb(0,100,225);
  --selection-unfocused: rgb(220,220,220);
}
:root[data-theme="dark"] {
  --label: rgba(255,255,255,.85);  --label-2: rgba(255,255,255,.55);  --label-3: rgba(255,255,255,.25);  --label-4: rgba(255,255,255,.10);
  --label-2-small: rgba(255,255,255,.60);
  --separator: rgba(255,255,255,.12);
  --fill: rgba(255,255,255,.10);  --fill-2: rgba(255,255,255,.08);  --fill-3: rgba(255,255,255,.05);  --fill-4: rgba(255,255,255,.03);
  --bg-window: #1e1e1e;  --bg-under: #282828;  --bg-raised: #2c2c2e;
  --selection-focused: rgb(0,89,209);
  --selection-unfocused: rgb(70,70,70);
}
```
(`AccentColor` support and exact resolution in Electron's Chromium should be checked; the fallback is `systemPreferences.getAccentColor()` pushed into a CSS variable from the main process. [E])

### 3.2 Accent rules

- The user's accent wins. "If people set their accent color setting to a value other than multicolor, the system applies their chosen color to the relevant items throughout your app, replacing your accent color." Only fixed-colour icons that carry meaning are exempt. [A] https://developer.apple.com/design/human-interface-guidelines/color
- Sidebar icons take the accent; row text does not. [A] sidebars page.
- One accent per app, spent on the primary action, active state and progress (ui-taste "One accent, locked"; "One grey family": warm or cool greys, never both).
- Accent appears as: default button fill, focus ring at 50%, selected-menu-item fill, text selection, toggle on-state, progress, links. It does not appear as: row hover, sidebar selection fill, borders, icons in the toolbar, headings.
- Per-Space or per-site colour, if Kite has it, is a *tint* (low chroma, under 8% mix into neutrals), not an accent. Keep the accent for interactive state so the two never fight.

### 3.3 Hover, pressed, selected

Native AppKit list rows have **no hover state**; toolbar buttons show a shape on hover only ("Buttons have no border; a shape appears only on hover" [S] wwdcnotes Big Sur notes). A browser sidebar needs hover because rows carry close buttons, so keep it at the weakest fill.

| State | Light | Dark | Timing |
|---|---|---|---|
| Rest | transparent | transparent | |
| Hover | `--fill-3` (5%) | `--fill-3` (5%) | 0 ms in, 0 to 100 ms out |
| Pressed | `--fill` (10%) | `--fill` (10%) | 0 ms, on pointerdown |
| Selected, window key | `--fill` (10%), or a raised white card with `--shadow-card` (Arc/Safari active-tab pattern) | `--fill` to white 14% | instant |
| Selected, window inactive | `--fill-2` (8%) | `--fill-2` | instant |
| Focused list selection | `--selection-focused`, white text | same | instant |
| Disabled | 40% opacity on content, no fill | same | |

Use neutral fills, not accent-tinted fills, for hover. Tinting hover with the accent is the most common "web app" tell.

### 3.4 Dark-mode elevation

Dark surfaces get lighter as they rise; shadows barely register. Measured ladder [M]: window rgb(30,30,30) → under-page rgb(40,40,40) → unfocused selection rgb(70,70,70); button face is white at 25% over whatever is beneath. Suggested ladder [E]:

| Level | Surface | Dark value | Light value |
|---|---|---|---|
| 0 | Sidebar / window body | #1e1e1e (or vibrancy at 70%) | #f6f6f6 over vibrancy |
| 1 | Web content card, active tab card | #262626 | #ffffff |
| 2 | Menu, popover | #2c2c2e at 78 to 82% + blur | #fafafa at 80% + blur |
| 3 | Sheet, command bar | #323234 | #ffffff |
| Edge | every raised surface | inner hairline white 12%, outer hairline black 70% | outer hairline black 12% |

Never use pure #000 for surfaces or pure #fff for text; the system uses 85% for primary text in both modes.

---

## 4. Motion

### 4.1 Springs Apple publishes

| Preset | Parameters | Source |
|---|---|---|
| `.spring()` default | duration 0.5, bounce 0.0 | [A] https://developer.apple.com/documentation/swiftui/animation/spring(duration:bounce:blendduration:) |
| `.smooth` | duration 0.5, no bounce | [A] https://developer.apple.com/documentation/swiftui/animation/smooth |
| `.snappy` | duration 0.5, base bounce **0.15** | [A] https://developer.apple.com/documentation/swiftui/animation/snappy(duration:extrabounce:) |
| `.bouncy` | duration 0.5, base bounce 0.3 | [A] WWDC23 10158 shows 0.5/0.3 as the "large bounce" example; the docs describe bouncy as "higher amount of bounce" |
| Fluid Interfaces: move / reposition | damping 1.0, response 0.4 | apple-design skill (WWDC18 Designing Fluid Interfaces) |
| Fluid Interfaces: drawer / sheet | damping 0.8, response 0.3 | same |
| Fluid Interfaces: rotation | damping 0.8, response 0.4 | same |
| AppKit default animation | 0.25 s | [M] `NSAnimationContext.current.duration` |

Rules from WWDC23 "Animate with springs" [A] https://developer.apple.com/videos/play/wwdc2023/10158/ :
- Bounce 0 is "a great general purpose spring that's the most versatile". 0.15 "doesn't feel very bouncy yet, but the long tail feels a little more brisk". 0.3: "noticeable bounciness". "Be cautious about using values higher than around 0.4."
- Add bounce "when you want an animation to feel more physical, like if it's going to be used at the end of a gesture".
- Conversion: mass 1, stiffness = (2π / duration)², damping = 4π(1 − bounce) / duration for bounce ≥ 0. Damping ratio = 1 − bounce.
- "A spring animation uses the velocity it had when it was retargeted as the initial velocity towards its new destination", which is why interruption looks right. "Springs are the only type of animation that maintains continuity both for static cases and cases with an initial velocity."
- `duration` is perceptual, not settling time. For a critically damped spring the value reaches 50% at 0.27 x duration, 90% at 0.62 x, 99% at 1.06 x, and 99.9% at 1.47 x [C].

### 4.2 CSS equivalents

A CSS `linear()` curve cannot carry velocity through an interruption; it reproduces the *shape*. Every critically damped spring has the same shape, so one curve serves all of them and only the duration changes: **CSS duration = 1.47 x spring response** [C].

```css
:root {
  /* Critically damped spring (bounce 0). 21 stops, max error 0.25%. */
  --spring: linear(0, 0.004 1%, 0.0188 2.3%, 0.0422 3.5%, 0.0789 5%, 0.1613 7.8%, 0.3625 13.8%, 0.4654 17%, 0.5578 20.3%, 0.6382 23.5%, 0.7066 26.8%, 0.7679 30.3%, 0.8177 33.8%, 0.8602 37.5%, 0.8992 42%, 0.9291 46.8%, 0.9533 52.3%, 0.9712 58.5%, 0.9834 65.5%, 0.9914 73.8%, 1);

  /* SwiftUI .snappy (bounce 0.15): overshoots 0.6%. Use duration = 1.39 x response. */
  --spring-snappy: linear(0, 0.0056 1.3%, 0.0253 2.8%, 0.0561 4.3%, 0.0953 5.8%, 0.1902 8.8%, 0.4109 15%, 0.5115 18%, 0.61 21.3%, 0.6957 24.5%, 0.7628 27.5%, 0.823 30.8%, 0.8715 34%, 0.9121 37.5%, 0.9444 41.3%, 0.97 45.5%, 0.9881 50.2%, 0.9996 55.8%, 1.0063 68%, 1);

  /* Fluid Interfaces sheet/drawer (damping 0.8): overshoots 1.5%. Duration = 1.35 x response. */
  --spring-sheet: linear(0, 0.0053 1.3%, 0.024 2.8%, 0.0535 4.3%, 0.0985 6%, 0.2014 9.3%, 0.4321 15.8%, 0.5332 18.8%, 0.6324 22%, 0.7186 25.3%, 0.7862 28.2%, 0.8466 31.5%, 0.8949 34.8%, 0.9324 38%, 0.9642 41.8%, 0.9874 45.8%, 1.0033 50.2%, 1.0121 55.3%, 1.0147 64.8%, 1);

  /* SwiftUI .bouncy (bounce 0.3): overshoots 4.6%. Duration = 1.64 x response. Rare, celebratory only. */
  --spring-bouncy: linear(0, 0.0078 1.3%, 0.0293 2.5%, 0.0619 3.8%, 0.1126 5.3%, 0.2157 7.8%, 0.4829 13.5%, 0.5928 16%, 0.7012 18.8%, 0.786 21.3%, 0.857 23.8%, 0.9195 26.5%, 0.9668 29.3%, 1.0033 32.3%, 1.022 34.5%, 1.0355 37%, 1.0435 39.8%, 1.046 42.8%, 1.042 47.3%, 1.0137 61.5%, 1.0026 70.5%, 0.998 82.3%, 1);

  /* cubic-bezier fallback for the critically damped spring: max error 3.1%, no overshoot */
  --spring-bezier: cubic-bezier(0.28, 0.52, 0.1, 1);

  /* Core Animation named curves, for non-spring fades */
  --ease-default: cubic-bezier(0.25, 0.1, 0.25, 1);   /* kCAMediaTimingFunctionDefault = CSS `ease` */
  --ease-out: cubic-bezier(0, 0, 0.58, 1);
  --ease-in-out: cubic-bezier(0.42, 0, 0.58, 1);

  /* durations, already multiplied by 1.47 */
  --dur-micro: 294ms;   /* response 0.20 */
  --dur-quick: 441ms;   /* response 0.30 */
  --dur-panel: 515ms;   /* response 0.35 */
  --dur-move: 588ms;    /* response 0.40 */
  --dur-smooth: 735ms;  /* response 0.50 = SwiftUI .smooth */
}
```
These durations look long but are not: 90% of the travel is done at 42% of the duration (185 ms for `--dur-quick`); the rest is the invisible settle that removes the hard stop. If `linear()` is unavailable, pair `--spring-bezier` with the same durations. Do not use `cubic-bezier(0.32, 0.72, 0, 1)` (the often-quoted "iOS sheet curve") as a stand-in for a spring: it is 11% off the critically damped curve [C].

For anything a pointer drives (sidebar resize, drag-reorder, swipe between Spaces) use a real spring in JS (Web Animations or Motion) so release velocity is handed off and a re-grab continues from the on-screen value. apple-design: "Always animate from the presentation (current) value, never the target value"; "Avoid CSS transitions and @keyframes for anything gesture-driven". CSS transitions are fine for state changes without a gesture: they do retarget from the current computed value when reversed.

### 4.3 What macOS does not animate

| Behaviour | macOS |
|---|---|
| Menu open | Instant, no fade or scale [E, long-standing behaviour] |
| Menu close after choosing | Chosen item blinks once, then the menu fades out in roughly 150 to 250 ms [E] |
| Menu close on dismiss | Fades out [E] |
| Menu item highlight while moving the pointer | Instant [E] |
| List and sidebar selection | Instant [E] |
| Button press highlight | Instant on mouse-down, instant on release [E] |
| Focus ring | Instant [E] (older macOS animated it inward from larger) |
| Tab switch | Instant; content swaps with no cross-fade [E] |
| Hover on toolbar buttons | Instant [E] |
| Tooltip | Appears after a delay with no animation; fades out [E] |
| Window open | Fast scale-fade from about 0.9, well under 200 ms [E] |
| Popover | Scale and fade from the anchor; `animates` true by default [M] |
| Sheet | Scale-fade onto the window centre since Big Sur; about 250 to 300 ms [E] |
| Sidebar collapse | Animated slide with content resizing alongside; AppKit default 0.25 s [M for the default duration] |

The ui-taste frequency gate states the same thing as policy: "Met 100+ times a day (tab switch, keyboard, scroll, back) → the platform default and nothing else; tens a day (press, row select) → near-imperceptible, under 150 ms; occasional (sheets, modals, toasts) → standard motion; delight only on rare, first-time moments." "When unsure, the strongest move is to delete the animation."

### 4.4 Kite motion table

All [E], derived from the above.

| Interaction | Frequency | Motion |
|---|---|---|
| Tab select, Space select via click | 100s/day | None. Selection fill and page swap in the same frame. |
| Row hover | 100s/day | Fill in 0 ms, out 80 ms linear |
| Press | 10s/day | Fill on pointerdown, 0 ms. No scale on rows. Buttons may scale to 0.97 in 100 ms ease-out. |
| Address field focus | 100s/day | 0 ms. Ring appears instantly; text selects on the same frame. |
| Command bar open / close | 10s/day | Open: opacity 0→1 and scale 0.98→1 over 120 ms `--ease-out`. Close: 80 ms fade. Must accept typing from frame 0. |
| Context menu | 10s/day | Open 0 ms. Close 150 ms fade. Highlight 0 ms. |
| Popover (downloads, permissions, site info) | occasional | Open: scale 0.96→1 + fade, `--spring` `--dur-micro`, origin at trigger. Close: 120 ms fade, no scale. |
| Sheet / settings | occasional | `--spring` `--dur-quick`, scale 0.96→1 + fade; scrim fades 150 ms. |
| Sidebar collapse / expand | occasional | Width via transform on a fixed-width inner, `--spring` `--dur-panel`. Web content resizes once at the end or tracks via transform; never animate layout width per frame on a live webview. |
| Sidebar resize drag | occasional | 1:1 with the pointer, no easing. Snap to closed below 140 px with a JS spring carrying release velocity. |
| New tab row | 10s/day | Height 0→32 and opacity in 150 ms `--ease-out`; neighbours move with it. |
| Close tab row | 10s/day | Height collapse 120 ms. Do not re-flow under the pointer until it leaves the list (browser convention so repeated close clicks hit the next tab). |
| Drag reorder | occasional | Dragged row follows 1:1 with a lifted shadow; others make room with `--spring` `--dur-micro`. Firefox uses 200 ms for the same shift. [S] tabs.css `--tab-dragover-transition: transform 200ms` |
| Space switch by trackpad swipe | occasional | 1:1 horizontal track, JS spring on release (response 0.35, damping 0.9), projected-momentum target, rubber-band at ends. |
| Page load progress | 100s/day | See 7.2. |
| Toast | rare | Slide 8 px + fade, `--spring` `--dur-quick`; leaves the way it came. |

Reduced motion: every transform above collapses to a 150 ms opacity cross-fade; progress bars stay. Exits are faster than entrances and leave along the entry path.

---

## 5. Typography details

### 5.1 SF Pro tracking by size

[A] https://developer.apple.com/design/human-interface-guidelines/typography (macOS SF Pro table). CSS `letter-spacing` in em = tracking / 1000.

| Size | Tracking (1/1000 em) | In points | CSS |
|---|---|---|---|
| 9 | +19 | +0.17 | 0.019em |
| 10 | +12 | +0.12 | 0.012em |
| 11 | +6 | +0.06 | 0.006em |
| 12 | 0 | 0 | 0 |
| 13 | −6 | −0.08 | −0.006em |
| 14 | −11 | −0.15 | −0.011em |
| 15 | −16 | −0.23 | −0.016em |
| 16 | −20 | −0.31 | −0.020em |
| 17 | −26 | −0.43 | −0.026em (tightest) |
| 18 | −25 | −0.44 | −0.025em |
| 20 | −23 | −0.45 | −0.023em |
| 22 | −12 | −0.26 | −0.012em |
| 24 | +3 | +0.07 | 0.003em |
| 26 | +8 | +0.22 | 0.008em |
| 28 | +14 | +0.38 | 0.014em |
| 34 | +12 | +0.40 | 0.012em |
| 40 | +10 | +0.37 | 0.010em |
| 48 | +8 | +0.35 | 0.008em |
| 64 | +4 | +0.22 | 0.004em |
| 80+ | 0 | 0 | 0 |

Read it as: positive below 12 pt, zero at 12, most negative at 17, back to slightly positive from 24 up (the display optical size takes over around 20 pt and has its own spacing).

**Important:** when the font is the system font (`system-ui` / `-apple-system`), the OS applies this table itself. Do not add `letter-spacing` on top; you would double it. Apply the table only if Kite ships a custom UI face. Check by overlaying a Chromium render on a native label at 11, 13 and 17 px. [E, not verified in this Electron build]

### 5.2 Weight

[M] AppKit weight values: regular 0, medium 0.23, semibold 0.30, bold 0.40, heavy 0.56. CSS 400 / 500 / 600 / 700 / 800.

| Use | Weight |
|---|---|
| Body, sidebar rows, menu items, field text | 400 |
| Emphasized body, default-button label on a tinted fill, selected segmented control, tab title on dark where 400 reads thin | 500 |
| Section headers at 11 px, popover titles, table headers, emphasized Body per the HIG table | 600 |
| Window title, alert title (Headline 13 bold) | 700 |
| Never | 700+ below 13 px; 300 or lighter anywhere in chrome |

Do not change weight between unselected and selected tab rows: it changes the text width and makes the row jump. Use fill and colour. If weight must change, reserve the width with an invisible bold duplicate.

### 5.3 Numerals

`font-variant-numeric: tabular-nums` on anything that updates in place: download sizes and percentages, "3 of 12" find counts, zoom level, tracker counts, timers, tab-count badges. Proportional figures everywhere else. SF Mono (`ui-monospace`) for URLs only where alignment matters (dev surfaces); the address field itself uses the UI face like Safari.

### 5.4 Truncation

| Content | Method |
|---|---|
| Tab titles in the sidebar | Fade the trailing edge with a mask, no ellipsis. The fade leaves room for the close button on hover without re-truncating. Firefox uses a 40 px gradient for the equivalent fade. [S] tab-hover-preview.css `--gradient-width: 40px` |
| Menu items, buttons, labels | Tail ellipsis |
| File names, URLs in lists (downloads, history) | Middle truncation so the extension or the page slug survives, as Finder does |
| Address field, unfocused | Show the registrable domain; no truncation needed |

```css
.tab-title {
  overflow: hidden; white-space: nowrap;
  mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
}
.row:hover .tab-title, .row[data-selected] .tab-title {
  mask-image: linear-gradient(to right, #000 calc(100% - 44px), transparent calc(100% - 20px)); /* clears a 20px close button */
}
```

### 5.5 Rendering

```css
html {
  -webkit-font-smoothing: antialiased;   /* AppKit text has been greyscale-AA since Mojave; Chromium's default looks a weight heavier, worst on dark */
  text-rendering: auto;
  font-optical-sizing: auto;             /* lets SF switch Text/Display designs by size */
  font-synthesis: none;                  /* never fake bold or italic */
}
```
On dark backgrounds light text blooms: keep primary text at 85% white, not 100%; prefer 400 over 300; at 11 px on dark, 500 is acceptable for section headers. On translucent materials do not use flat mid-grey text; use the label alphas so text picks up the material (apple-design section 12: "use higher-contrast, slightly heavier weight").

Leading: use the HIG pairs (13/16, 11/14, 12/15, 15/20, 17/22). UI chrome on macOS is tighter than web defaults; `line-height: 1.5` on 13 px text is a web tell.

---

## 6. Reference apps

Measured or sourced numbers are tagged; the rest are observations [E] to be checked against the app.

### Safari 26 / 27
- Toolbar and address field are translucent and "reflect colors from the webpage"; tabs are rounded. [S] https://www.igeeksblog.com/safari-ios-26-macos-tahoe-features/
- The compact layout (tabs and address field in one row) was removed at 26.0 and restored in 26.4 after complaints. [S] https://www.macrumors.com/2026/02/16/macos-tahoe-26-4-compact-tab-bar/ — lesson: people are attached to density; ship a compact option.
- Sidebar gained more sources (Recently Saved, iCloud Tabs). [S] same igeeksblog page.
- Address field [E]: centred, about 28 px tall in a 52 px toolbar, shows the bare domain centred when unfocused and the full URL left-aligned and selected on focus; reader and page-menu controls live inside the field at its edges; progress is a thin accent line along the bottom edge of the field.
- Start page [E]: sections (Favourites, Frequently Visited, Privacy Report, Reading List, iCloud Tabs) on an optional background image; favourites are 56 to 64 px rounded icons on a regular grid with 11 px labels.

### Arc
- Sidebar replaces the tab bar; tab list, address field, pinned and favourites all live in it. A ring of Space colour around the window marks the current Space. [S] https://tidbits.com/2023/05/01/arc-will-change-the-way-you-work-on-the-web/ , https://en.wikipedia.org/wiki/Arc_(web_browser)
- Design-study reconstruction (not Arc source) [S] https://blakecrosley.com/guides/design/arc : sidebar 240 px expanded / 48 collapsed, width transition 0.2 s ease-out; Space switch `spring(response 0.3, dampingFraction 0.7)`; command bar `min(600px, 90vw)` at 20% from top, 18 px input, results max 400 px, rows 10 x 20 px padding; Little Arc chrome 36 px with a 13 px URL field; split divider 4 pt, ratio clamped 0.2 to 0.8; today-tabs auto-archive after 12 h.
- What makes it feel premium [E]: the web page is an inset card (about 8 px gap, about 8 px radius, soft shadow), so chrome and content read as two materials; the active tab is a raised white card, not a tinted bar; the command bar is the only way to open a URL, so one surface gets all the polish.

### Zen (open source, values from its CSS)
[S] https://github.com/zen-browser/desktop (`src/zen/common/styles/zen-theme.css`, `src/zen/tabs/zen-tabs/vertical-tabs.css`, dev branch, fetched today)
- `--zen-border-radius: 7px`; tab radius 8 px; inner radius derived concentrically with a 5 px floor; squircle corners via `corner-shape: superellipse(1.3)` (2.3 in one mode).
- Toolbar height 38 px, **42 px on macOS**; toolbar icon 16 px, 17 px on macOS; sidebar padding 5 to 6 px; sidebar min width 163 px; essentials (pinned grid) tiles 46 px tall; workspace indicator 38 to 44 px.
- Hover fill = 7% of the reverse-brand colour mixed with transparent; active = 10%. Translucent toolbar: white 60% light, white 15% dark.
- Transitions are short and plain: 0.1 s ease-in-out for indents and transforms, 0.15 s for hidden-toolbar reveal, 0.12 s for the close-button glyph.

### Dia
- Deliberately conventional: top tabs, Chrome-like layout "with a lot more polish", single obvious way to do each task, URL bar doubles as the assistant entry, chat in a right-hand panel. The Browser Company concluded Arc's layout was "too intimidating for mainstream users". [S] https://techcrunch.com/2025/06/11/the-browser-company-launches-its-ai-first-browser-dia-in-beta , https://browsercompany.substack.com/p/the-strategy-behind-dias-design , https://www.thurrott.com/a-i/324493/what-dia-says-about-the-ai-powered-future-of-web-browsing
- Lesson for Kite: sidebar-first is an identity choice that costs familiarity; pay it back with zero-learning defaults (Cmd-T, Cmd-L, Cmd-W, Cmd-1..9, Cmd-Shift-T all behave exactly as in Safari).

### Linear (desktop)
- Sidebar dimmed "a few notches" so content leads; separators removed or softened ("Structure should be felt not seen"); icons fewer and smaller; palette moved from cool blue-grey to a warmer, less saturated grey; tabs compact with rounded corners. "If most people don't immediately notice what changed, that's probably a good sign." [S] https://linear.app/now/behind-the-latest-design-refresh
- Inter for text, Inter Display for headings; themes generated in LCH so elevation steps are perceptually even. [S] https://linear.app/now/how-we-redesigned-the-linear-ui
- Own glass: blur + gradient + specular highlight, no refraction. [S] https://linear.app/blog/linear-liquid-glass
- Observed [E]: 13 px UI text, 28 px rows, 6 px radii, keyboard hint chips in every menu, every hover state instant.

### Raycast
- Community-documented radius scale 4 / 6 / 10 / 13 / 18 on a 4 px grid, Inter. [S, unofficial] https://www.shadcn.io/design/raycast — Raycast added an Interface Size setting that scales every window. [S] https://www.raycast.com/changelog/macos/0-66
- Observed [E]: window about 750 x 474, search field about 56 px tall with 17 px text, rows 40 px with 20 px icons, a bottom action bar about 40 px with the primary action and its shortcut always visible. Opens with no perceptible animation and takes keystrokes immediately; that latency, not the visuals, is the premium feel.

### Things 3
- Reviewers single out the nuanced animation and the draggable "Magic Plus" button; "every individual bit and pixel has been redesigned" is Cultured Code's own copy. [S] https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/ , https://culturedcode.com/
- Observed [E]: almost no chrome and no visible separators, hierarchy from whitespace and weight alone; rows open in place into a card (the list parts around it) rather than a detail pane; a blue circular-progress pie per project; a single accent blue with a yellow star reserved for Today. One colour carries one meaning.

### Craft
- Observed [E]: large type and generous margins make the document the hero; cards with 10 to 12 px radii and soft two-layer shadows; a quiet sidebar that collapses fully; page-open transitions that grow from the tapped card (spatial continuity).

### Notes and Finder (system baseline)
- Finder sidebar: medium rows (32 px on this OS [M]), section headers in small semibold secondary text, accent-tinted icons, neutral rounded selection. Three-pane Notes: sidebar, 13 px list with two-line rows, content; selection in the middle list is solid accent only while that list has focus and turns grey when focus moves. That focused/unfocused selection swap is a detail web apps almost never implement and Mac users notice subconsciously.
- Both use the system toolbar (52 px unified [M]) with borderless icon buttons that gain a shape on hover.

---

## 7. Browser-specific chrome

### 7.1 Address field
- First click focuses and selects all; a second click places the caret; click-drag selects a range without first selecting all. Cmd-L always selects all. Esc restores the current page URL and blurs; a second Esc on an unchanged field returns focus to the page.
- Unfocused: show the registrable domain (`example.com`) in `--label`, drop scheme, `www.` and path, or keep the path in `--label-2`. Focused: full URL, including scheme, left-aligned.
- Security: no lock for normal HTTPS (it is the default and a green lock misleads). Show state only when it deviates: "Not Secure" in `--label-2` for HTTP, a red warning glyph for certificate errors. A site-settings glyph at the leading edge opens the site popover.
- Height 28 px inside a 40 px strip (Zen's macOS toolbar is 42 px [S]); radius 8; fill `--fill-4` at rest, `--bg-raised` plus focus ring when focused; text 13 px.
- Suggestions: first result pre-highlighted and inline-autocompleted; Tab/arrow moves; row 32 px with 16 px icon, title in `--label`, URL in `--label-2`; matched substring in weight 600, not colour.
- Typing must never be dropped: the field accepts input in the same frame it gains focus.

### 7.2 Loading progress
- A 2 px accent bar along the bottom edge of the address field (Safari's placement) or the top edge of the content card. In a sidebar browser, also swap the tab's favicon for a 16 px spinner so background tabs show state.
- Behaviour: jump to 10% immediately on navigation start; ease toward 80% asymptotically (time constant about 2 s); on `did-stop-loading` run to 100% in 150 ms, hold 100 ms, fade out 200 ms. Never go backwards. If the load finishes in under 150 ms, skip the bar.
- Firefox's tab loading animation for reference: a "burst" on completion of 375 ms `cubic-bezier(0, 0, 0.58, 1)`; throbber 1.05 s per cycle. [S] https://raw.githubusercontent.com/mozilla-firefox/firefox/main/browser/themes/shared/tabbrowser/tabs.css — Zen has pulse, long-load and settle keyframes for its bar. [S] zen-animations.css

### 7.3 Tab row anatomy (vertical)

```
| 8 | [favicon 16] | 8 | Title 13/16 ........fade | [audio 16] | [close 20] | 6 |
  ^ row inset 8 from sidebar edge, row height 32, radius 8
```
- Favicon 16 x 16, radius 3; fallback is the first letter on a neutral tile, never a generic globe for every site. Loading replaces the favicon with a spinner; a crashed or discarded tab dims the favicon to 50%.
- Close button: 20 x 20 hit area with a 12 px glyph (Firefox's new tab design: `--tab-content-button-size: 20px` holding a 12 px icon; the older design used 24 px in a 36 px tab [S] tabs.css). Visible on row hover and on the selected row; its own hover fill is `--fill`. Middle-click on the row closes.
- Audio indicator: 16 px speaker glyph between title and close, always visible while audible, click toggles mute; muted state is a struck glyph in `--label-2`.
- Tab heights in the wild [S] tabs.css: Firefox 32 px (new design) or 36 px (current), compact 28 to 29, touch 41. Kite at 32 sits in the same band and matches the native source-list row.
- Pinned / favourite tiles: grid of square-ish tiles about 44 to 48 px tall (Zen: 46 [S]) with a centred 16 to 20 px favicon, radius 8 to 10, `--fill-4` background, active tile raised.
- Unread or updated background tab: a 6 px accent dot at the trailing edge, not bold text.

### 7.4 Tab hover preview
- Card 280 px wide with a 264 px thumbnail, title in heading weight, 16 px favicon. [S] https://raw.githubusercontent.com/mozilla-firefox/firefox/main/browser/themes/shared/tabbrowser/tab-hover-preview.css
- Delay: Firefox settled on 500 ms to match tooltips ("It's 500 everywhere"), and moving to an adjacent tab shows the next preview instantly. [S] https://bugzilla.mozilla.org/show_bug.cgi?id=1922105 and related bug via search. Older Chromium scaled the delay with tab width between 50 and 1000 ms, faded in over 200 ms, and re-showed instantly if the pointer had left the strip for under 500 ms. [S] crrev copies of `tab_hover_card_bubble_view.cc` via search summary.
- Kite [E]: 500 ms initial delay, 0 ms between rows while the card is up, 300 ms grace after leaving before the delay re-arms; fade in 120 ms, out 80 ms; card sits to the right of the sidebar, top aligned with the row, 8 px gap; never under the pointer; hide on scroll, click, drag start and any key press; do not show for the selected tab. Content: title (13 / 600, two lines), domain (11, `--label-2`), thumbnail 16:10, memory or audio line optional.

### 7.5 Find bar
- Floating card at the top-right of the content area: about 320 x 36, radius 10, `--mat-popover` with `--shadow-popover`. Field, match count `3 of 12` in tabular numerals and `--label-2`, previous / next chevrons, Done.
- Cmd-F opens and selects existing text; Enter next, Shift-Enter previous; Cmd-G / Cmd-Shift-G work with the bar closed; Esc closes and returns focus to the page with the match still selected.
- Matches use the system find colour rgb(255,255,0) [M]; the current match gets the macOS "find indicator" pulse: a yellow rounded rect that scales about 1.0 → 1.25 → 1.0 in roughly 300 ms [E].
- Zero results: count reads "Not found" in `--label-2`; do not shake or flash red.

### 7.6 Downloads popover
- Anchored to its toolbar/sidebar button, width 320 to 360, max height about 400 then scroll.
- Row 48 px: 32 px file-type icon, name 13 px middle-truncated, status 11 px `--label-2` with tabular numerals ("12.4 of 80 MB, 20 s remaining"), trailing 20 px circular controls (cancel while active, reveal-in-Finder when done). Progress as a 2 px bar under the text or a ring around the control.
- The trigger icon shows aggregate progress as a ring; on completion it bounces once (`--spring-snappy`). Double-click a row opens the file; drag a row out to Finder.
- Empty: a single centred line "No downloads" in `--label-2`. Header has Clear on the right.

### 7.7 Permission prompts
- A non-modal popover anchored to the leading edge of the address field, 320 px wide: site icon, "example.com wants to use your camera", buttons right-aligned.
- For a browser pitched on privacy: the default (Return) button is **Don't Allow**; Allow is the secondary. "Never for This Website" behind a disclosure or an Option-click. The prompt dismisses on navigation and never steals keyboard focus from the page.
- While a capability is live, show a persistent glyph in the address field using the system's own colours: orange for microphone, green for camera, blue for location. Clicking it opens the same site popover with a revoke control.
- One prompt at a time; queue the rest. Never use a sheet for site permissions (a sheet blocks the whole window).

### 7.8 Context menus
- Use native menus (`Menu.popup` in Electron) for every right-click and every pull-down from chrome. This is the cheapest large win available: they extend past the window, use the real material and shadow, support type-to-select, submenu hover intent, VoiceOver, the user's accent colour, and the correct open/close timing for the running OS, including whatever macOS 28 changes.
- Custom-rendered menus only where a native menu cannot hold the content (colour pickers, emoji grids). Then follow 1.5 exactly.
- Order: most frequent first, destructive last and separated, no more than 12 items before a submenu. Title Case. Ellipsis on any item that opens further UI. Show shortcuts.

### 7.9 Empty states and the start page
- Empty states are one line of `--label-2` text at 13 px, optionally one 11 px line saying how to fill it, and at most one small button. No illustrations in chrome-level surfaces (sidebar sections, popovers). ui-taste: "empty states are composed (and say how to fill them), errors are inline and specific".
- Empty sidebar section: collapse it to its header; show "Drag a tab here to pin it" only while a drag is in progress.
- Start page for an offline, private browser: nothing that needs the network. A focused address field or search (centred, 40 px tall, 15 px text, 560 px max width), a grid of the user's own pinned sites (tiles 64 x 64, radius 14, 16 px gap, 11 px label), optionally a locally computed line ("14 trackers blocked this week"), and recently closed. No news, no weather, no account prompts. Renders in one frame from local data; no skeletons.
- Error pages (offline, DNS, certificate) are part of the brand for an offline-capable browser: plain language title at 17 / 600, one line of explanation, Retry as the default button, technical detail behind a disclosure.

---

## 8. Identity

### 8.1 Where identity can live without breaking the native shell

A native-feeling app spends its difference in a few named places and is orthodox everywhere else. Menus, shortcuts, focus rings, text selection, window controls, scrollbars and context menus must be stock. Identity budget:

| Slot | Rule |
|---|---|
| One signature material | A single surface treatment the app is recognisable by in a cropped screenshot (the sidebar, or the content card edge). Everything else uses plain system materials. |
| One signature motion | One transition users will see a few times a day, not hundreds. It must be interruptible and under 400 ms perceived. |
| One accent behaviour | Decide what colour *means* in Kite and use it for nothing else. |
| A start page | The only full-bleed canvas a browser owns. It should be recognisably Kite with the chrome hidden. |
| Sound | At most three, under 150 ms each, quiet, off when the system's "Play user interface sound effects" is off, never on frequent actions. |
| Icon set | One family (SF Symbols weight-matched to 13 px regular text, or a single custom set at 1.5 px stroke). No emoji in chrome. |
| Voice | One label per intent; sentence-length errors; no exclamation marks. |

Tests before shipping any identity element: does it survive the user picking a different system accent colour; does it survive Reduce Transparency and Increase Contrast; does it still look intentional on macOS 15, 26 and 27; is it absent from the 100-times-a-day paths.

### 8.2 Three directions for Kite

"Calm, offline, private, sidebar-first." A kite is paper, a frame and a line held from the ground; it is also a quiet bird that hangs in the wind. None of the three below uses a purple or multi-hue gradient, and none uses Arc's user-picked pastel gradient as the brand.

#### Direction A — Paper and Thread

The browser as a quiet sheet of paper with one red line through it.

- **Palette:** one warm grey family. Light: sidebar `#EFECE6`, content card `#FBFAF7`, text `rgba(28,25,23,.86)`, secondary `rgba(28,25,23,.52)`, separators `rgba(28,25,23,.10)`. Dark: sidebar `#1C1A18`, card `#242220`, text `rgba(245,240,232,.86)`. Signature colour: madder red `#C8402F` (dark: `#E0604C`), used only as "the thread". The system accent stays in charge of focus rings, default buttons and selection.
- **Type:** SF for all chrome. Apple's system serif (`ui-serif`, New York) in exactly two places: the start-page date line and reader mode. Section headers 11 px semibold in small caps via `font-variant-caps: all-small-caps` with +0.04em tracking.
- **Material:** matte, not glass. The sidebar is near-opaque warm paper with a 2 to 3% monochrome grain (a tiled 128 px noise PNG, `mix-blend-mode: multiply`, off under Reduce Transparency); no blur anywhere in the sidebar. The content card sits on it like a page: 8 px inset, 8 px radius, `--shadow-card`. Menus and popovers stay system-standard.
- **Signature interaction, "the thread":** a 1.5 px red line. It is the active-tab marker (a 14 px vertical tick at the row's leading edge that slides between rows with `--spring` `--dur-micro` only when selection changes by keyboard or click, instant on rapid repeats); it is the load indicator (the same line draws across the top edge of the page card); and on the start page it is a single hand-drawn curve from the address field to the corner, the kite line. One element, three jobs.
- **Sound:** a soft paper tick on pin and on download complete.
- **Risk:** warm paper can look dated if the grain is visible at a glance; it must be subliminal. Per-Space colour becomes a change of paper tone (five curated low-chroma papers), not a free colour picker.

#### Direction B — High Air

The window as clear air at altitude: cool, thin, bright, with the page floating in it.

- **Palette:** one cool grey family with a slight blue cast. Light: sidebar tint `rgba(236,241,246,.70)` over native vibrancy, card `#FFFFFF`, text `rgba(13,22,33,.86)`. Dark: sidebar `rgba(18,24,32,.72)`, card `#1B2129`, text `rgba(232,240,248,.86)`. Signature colour: none of its own; the sidebar takes a single flat, very low-chroma tint (chroma under 0.02 in OKLCH) that follows local time of day, computed on-device: pale apricot at dawn, neutral at noon, slate blue at dusk, near-black at night. A flat tint, never a gradient. The system accent is the only saturated colour on screen.
- **Type:** SF for chrome; SF Mono (`ui-monospace`) for the address field's path segment, download sizes and counts, so numbers read like instrument readouts. Start-page clock in SF at 64 px, weight 300 is the one permitted light weight.
- **Material:** real behind-window vibrancy in the sidebar (Electron native vibrancy), so the desktop shows through faintly; a single specular hairline on the top edge of floating controls (`--edge-highlight`). The content card has the deepest shadow of the three directions so it reads as lifted.
- **Signature interaction, "lift":** surfaces rise instead of sliding. Hovering the collapsed sidebar edge lifts the sidebar over the page (2 px up, shadow from `--shadow-card` to `--shadow-popover`, `--spring` `--dur-quick`); a new tab's row rises 6 px into place; dragging a tab out to make a window lifts it with scale 1.02 and a growing shadow. Releasing always settles with a critically damped spring, no bounce: air, not rubber.
- **Sound:** a short breath of filtered noise on Space switch, nothing else.
- **Risk:** closest of the three to stock macOS 26/27, so it is the least distinctive in a screenshot; its identity is mostly felt in motion and in the time-of-day tint.

#### Direction C — Graphite and Signal

A private instrument: monochrome, exact, with one signal colour that only ever means "privacy state".

- **Palette:** neutral greys with no hue. Light: sidebar `#EDEDED`, card `#FFFFFF`, text `rgba(0,0,0,.88)`, hairlines `rgba(0,0,0,.14)`. Dark (the hero mode): sidebar `#161616`, card `#1E1E1E`, raised `#262626`, text `rgba(255,255,255,.88)`, hairlines `rgba(255,255,255,.12)`. Signal colour: kite-tail orange `#F26B1D` (dark `#FF8A3D`). It appears only for privacy facts: private-window marker, tracker-blocked count, live camera/mic, offline indicator. It is never a button fill, never selection, never decoration.
- **Type:** SF for chrome at a slightly denser rhythm (28 px rows as the default, 32 optional). Section labels 10 px, weight 600, uppercase, +0.06em tracking, `--label-2`. All numerals tabular. Monospace for hostnames in the site popover.
- **Material:** none. Solid matte surfaces, crisp 0.5 px hairlines, no blur and no translucency at all. This is a deliberate statement (nothing shows through; nothing leaks) and it is also the cheapest to render, which suits "offline" and battery. Depth comes only from the dark-mode elevation ladder and edge hairlines.
- **Signature interaction, "the shutter":** entering a private window or a locked Space runs a 120 ms horizontal wipe across the sidebar, after which the sidebar's trailing hairline is the signal colour for as long as the mode lasts. The tracker count in the address field ticks up digit by digit with tabular numerals as blocks happen. Clearing site data closes the same shutter in reverse.
- **Sound:** a muted mechanical click on entering and leaving private mode.
- **Risk:** can feel austere. It needs excellent typography and spacing to read as precise rather than unfinished, and the light theme needs as much care as the dark.

### 8.3 Choosing

| | Calm | Private | Distinct from Arc / Zen / Dia | Cost to build | Survives OS redesigns |
|---|---|---|---|---|---|
| A Paper and Thread | strongest | medium | strongest | medium (grain, thread element) | high (no glass dependency) |
| B High Air | strong | weak | weakest | medium (native vibrancy plumbing) | medium (tracks Apple's material) |
| C Graphite and Signal | medium | strongest | strong | lowest | highest |

My read: A is the best fit for "calm" and the hardest to mistake for another browser; C is the best fit for "private" and the cheapest. They combine well: A's paper and thread in light mode with C's rule that the signature colour carries exactly one meaning. B is the safe choice and the one most likely to look like everyone else by next year.

---

## 9. The ten details that most separate "native" from "web app"

1. Native context menus and pull-downs, not DOM menus (7.8).
2. Nothing animates on the 100-times-a-day paths: tab select, hover, press, menu open, focus (4.3).
3. Primary text at 85% not 100%, and the four label alphas used consistently (3.1).
4. 13 / 16 px body, 11 / 14 px small, with macOS line heights instead of web 1.5 (1.1, 5.5).
5. 0.5 px hairlines and a light inner edge on raised dark surfaces (1.8, 2.4).
6. Neutral hover and selection fills; accent only for focus, default action, progress (3.2, 3.3).
7. Focused versus unfocused selection, and a visibly inactive window state (3.3, 2.3).
8. Concentric radii from the window corner inward on one stated scale (1.4).
9. Greyscale antialiasing and system-font tracking left alone (5.1, 5.5).
10. Traffic lights at the OS's own coordinates for the running version, with a correct drag region and double-click behaviour (1.9).

---

## Sources

Apple
- HIG Typography: https://developer.apple.com/design/human-interface-guidelines/typography
- HIG Sidebars: https://developer.apple.com/design/human-interface-guidelines/sidebars
- HIG Materials: https://developer.apple.com/design/human-interface-guidelines/materials
- HIG Color: https://developer.apple.com/design/human-interface-guidelines/color
- WWDC25 "Build an AppKit app with the new design": https://developer.apple.com/videos/play/wwdc2025/310/
- WWDC23 "Animate with springs": https://developer.apple.com/videos/play/wwdc2023/10158/
- SwiftUI spring / snappy / smooth: https://developer.apple.com/documentation/swiftui/animation/spring(duration:bounce:blendduration:) , https://developer.apple.com/documentation/swiftui/animation/snappy(duration:extrabounce:) , https://developer.apple.com/documentation/swiftui/animation/smooth
- AppKit UI element colours: https://developer.apple.com/documentation/appkit/ui-element-colors

Third party
- macOS 27 design changes: https://www.macrumors.com/2026/06/09/macos-golden-gate-liquid-glass/
- Window radius community values: https://forums.macrumors.com/threads/override-window-corner-radius-disable-floating-sidebar.2484925/
- Firefox Tahoe chrome radius: https://bugzilla.mozilla.org/show_bug.cgi?id=2053333
- Firefox source (menus, tabs, hover preview): https://raw.githubusercontent.com/mozilla-firefox/firefox/main/toolkit/themes/shared/menu.css , https://raw.githubusercontent.com/mozilla-firefox/firefox/main/browser/themes/shared/tabbrowser/tabs.css , https://raw.githubusercontent.com/mozilla-firefox/firefox/main/browser/themes/shared/tabbrowser/tab-hover-preview.css
- Firefox hover preview delay: https://bugzilla.mozilla.org/show_bug.cgi?id=1922105
- Zen source: https://github.com/zen-browser/desktop
- NSColor dump (Monterey / Big Sur): https://gist.github.com/andrejilderda/8677c565cddc969e6aae7df48622d47c
- Big Sur AppKit notes: https://wwdcnotes.com/documentation/wwdc20-10104-adopt-the-new-look-of-macos/
- Arc design study (reconstruction): https://blakecrosley.com/guides/design/arc
- Arc overview: https://tidbits.com/2023/05/01/arc-will-change-the-way-you-work-on-the-web/
- Linear: https://linear.app/now/behind-the-latest-design-refresh , https://linear.app/now/how-we-redesigned-the-linear-ui , https://linear.app/blog/linear-liquid-glass
- Safari 26: https://www.igeeksblog.com/safari-ios-26-macos-tahoe-features/ , https://www.macrumors.com/2026/02/16/macos-tahoe-26-4-compact-tab-bar/
- Dia: https://techcrunch.com/2025/06/11/the-browser-company-launches-its-ai-first-browser-dia-in-beta , https://browsercompany.substack.com/p/the-strategy-behind-dias-design
- Raycast (unofficial system notes, changelog): https://www.shadcn.io/design/raycast , https://www.raycast.com/changelog/macos/0-66
- Things 3: https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/

Local skills folded in: `apple-design` (fluid interfaces, materials, typography, reduced motion) and `ui-taste` (`reference/anti-slop-craft.md`: frequency gate, one accent, one grey family, shape lock).

## Not verified, and worth ten minutes each

- Real on-screen window corner radius on 15, 26 and 27: screenshot a native window at 2x and measure. Community says 10 / 26 (toolbar) / 20; AppKit's private getter says 16 on 27.
- Whether Electron's Chromium applies SF tracking to `system-ui` (5.1) and resolves `AccentColor` to the user's accent (3.1).
- Electron option names in 2.2 and 1.9 (`vibrancy`, `visualEffectState`, `trafficLightPosition`, `titleBarStyle`) against the installed Electron version.
- All [E] shadow and material alphas: tune against a native menu and popover side by side.
- Sequoia control and title-bar metrics: only the compact (compatibility) values were measurable here.
- Mobbin was not used: its search covers iOS and web only, not macOS apps.
