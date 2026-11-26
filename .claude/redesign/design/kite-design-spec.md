# Kite design language: "Calm Air"

The one document every engineer on the redesign follows. If something here conflicts with
what you find in the code, this wins; if something is not covered, pick the quietest option
that matches the rest and say so in your report. Product truth is in
`/Users/apple/Personal/MArc/PRODUCT.md`; the direction contract is in
`/Users/apple/Personal/MArc/.impeccable/surfaces/src-renderer-app-tsx.md`.

## What the owner asked for

> "The current designs are okay for a browser, but they don't feel like something I would
> personally want to use every day. I want a more professional, polished experience, similar
> to macOS. Think about how Apple designs its products — simple, intuitive, consistent, and
> so enjoyable to use that people naturally get attached to them and build habits around
> them. It shouldn't just look visually appealing; the entire experience should feel
> premium, thoughtfully designed, and effortless to use. Take inspiration from macOS, Arc,
> Safari and other best-in-class applications, but don't simply copy them. Create something
> with its own identity. Focus on the actual user experience, not just making the UI look
> attractive."

Confirmed with the owner: the primary user is any Mac user (most from Safari or Chrome, new
to sidebars); only the name and the kite icon must stay; this is a redesign, not a polish of
the old indigo look. The owner asked that the installed design skills be used properly:
before writing UI, load `impeccable` (read its `reference/craft-floor.md` and
`reference/operate.md`; do NOT run its init/new-work/concept-seed flows, the direction is
already decided and recorded) and `emil-design-eng`; load `animate` / `review-animations`
when you touch motion, and `apple-design` for macOS conventions.

## The world: a chart of still air

Kite is drawn like an aeronautical / weather chart on a calm day. The world lends exactly
four things; it never changes layout, navigation or controls, which stay standard macOS.

1. **Palette.** A tinted chart-paper shell: sea-glass by day, night-chart slate after dark.
   Not grey. The page card sits on it like a sheet on a chart table.
2. **Type.** San Francisco, 13px regular, with small exact 11px "chart labels" and tabular
   numerals wherever a number can change.
3. **Density.** Compact and exact: 28–32px rows, hairlines, nothing oversized.
4. **One signature move: the string.** A 2px chart-magenta line, the kite's string, drawn
   only while something is in flight: a page loading, a download, a timer. Behind the start
   page and empty states lie the contour lines of a calm pressure field. They never move.
   The string is the only thing in the chrome that moves by itself.

Matte, not glass: surfaces are paper. No `backdrop-filter` anywhere, except the existing
frosted sidebar over a Space *picture*, where it is needed for legibility.

## Why it feels "okay" today (from the audit — fix these, do not repaint them)

1. No type hierarchy: every weight is 500–800 and eight sizes sit between 10.5 and 14px.
2. It reads as a painted web page: 87 different shadows, 37 radii, 33 control heights.
3. Three sliders, three segmented controls, two search fields, four theme editors.
4. Weak states: hover looks like selected, rows shrink when pressed, sleeping tabs look disabled.
5. Friction in the wrong places, a blank first launch, a generic periwinkle look.

Full findings with file and line: `research/03-kite-visual-audit.md` (per surface, with
screenshots in `audit/shots/`) and `research/04-design-system-audit.md`, both under
`/private/tmp/claude-501/-Users-apple-Personal-MArc/77deb0da-8950-4039-9159-d14524519f6f/scratchpad/`.
Read the sections for your surface before you start.

## The five rules

1. **The page is loud, the chrome is quiet.** Four ink levels, three weights. Nothing in the
   chrome competes with the web page.
2. **One accent, five jobs.** Chart magenta appears only on: the focus ring, the primary
   button of a surface, switches/sliders/checkboxes that are on, links, and the string.
   Never on icons, folder glyphs, selection fills, hover fills, section labels or borders.
   Selection and hover are tinted from the shell, not from the accent.
3. **The string means "in flight".** One progress language everywhere. No other progress
   bars, no decorative motion, nothing idles, pulses or floats.
4. **Keyboard is instant, the pointer settles.** Anything started from the keyboard (tab
   switch, command bar, shortcuts) appears with no animation at all. Things that arrive
   under the pointer (popovers, sheets, Peek) settle in briefly. Hover and selection fills
   never animate in.
5. **Mac-true metrics.** 13px body text at weight 400, native control heights, hairlines,
   concentric radii. When in doubt, do what Finder, Safari and System Settings do.

## Tokens (defined on `.app` in `src/renderer/styles/foundations.css`; use names, never literals)

### Type
Font stays `var(--font)` (San Francisco on macOS). No `letter-spacing` anywhere. Sizes go
through the tokens (they multiply by `var(--scale)`), never a raw px font-size.

| Token | Size / line | Use |
|---|---|---|
| `--fs-micro` | 11 / 14 | chart labels: captions, shortcut hints, counts, section labels |
| `--fs-small` | 12 / 15 | secondary lines, descriptions, a URL under a title |
| `--fs-body` | 13 / 16 | everything by default: rows, menus, buttons, inputs |
| `--fs-title` | 15 / 20 | sheet and popover titles, Settings group titles |
| `--fs-large` | 20 / 24 | page titles (Settings, History, Archive) |
| `--fs-display` | 28 / 32 | the start page greeting, Welcome |

Weights: `--fw-regular: 400` (body, rows, menus, inputs, descriptions), `--fw-medium: 500`
(buttons, the selected row, field labels, tab labels), `--fw-semibold: 600` (titles, section
labels). Nothing else. Changing numbers use `font-variant-numeric: tabular-nums`.

### Ink (set per mode by theme.ts; tinted from the shell hue, never neutral grey)
`--ink` primary · `--ink-2` secondary (still 4.5:1) · `--ink-3` tertiary text (still 4.5:1) ·
`--ink-4` decoration only (chevrons, placeholder glyphs, disabled, contour lines).

### Fills and lines
| Token | Meaning |
|---|---|
| `--fill-hover` | pointer over a row / menu item / icon button (instant) |
| `--fill-press` | pointer down (instant; stronger than hover) |
| `--fill-selected` | the current row / tab / segment (clearly stronger than hover) |
| `--fill-field` | background of text fields and wells |
| `--line` | hairline separators and field borders |
| `--line-strong` | edges that must read on any backdrop (page card, focused well) |
| `--danger`, `--danger-soft` | destructive text / its hover fill (one red, both modes) |

`--hover` and `--active` stay as aliases of `--fill-hover` / `--fill-selected`.
Pressing never scales a row, menu item or tile. Free-standing buttons press to
`scale(0.97)` over 120ms.

### Shape
| Token | px | Use |
|---|---|---|
| `--r-xs` | 5 | items inside a menu, tags, kbd chips |
| `--r-sm` | 6 | buttons, text fields, selects, segmented controls, checkboxes |
| `--r-md` | 8 | sidebar rows, list rows, favorite tiles, search fields |
| `--r-lg` | 12 | menus, popovers, widgets, toasts |
| `--r-xl` | 16 | sheets, the command bar, Peek, floating panels |
| `--radius` | user | the page card only (Customize → Corners) |

Concentric: inner radius = outer − padding, never below 5. Fully round only for switches,
Space dots and count badges.

### Control heights
| Token | px | Use |
|---|---|---|
| `--h-xs` | 20 | inline icon buttons inside rows (hit area still ≥ 24) |
| `--h-sm` | 24 | menu items, small buttons, toolbar icon buttons |
| `--h-md` | 28 | buttons, text fields, selects, segmented controls |
| `--h-lg` | 32 | search fields, the primary action of a sheet |
| `--h-xl` | 44 | command bar input, start page search |

Sidebar rows: 28 compact / 32 regular / 36 roomy (`--row-h`). Favicon 16, gap 8, inline padding 8.

### Depth (paper on a chart table)
`--elev-1` raised control, selected segment, widget ·
`--elev-2` menus, popovers, toasts, the page card ·
`--elev-3` sheets, command bar, Peek, floating windows.
Each token already contains its own hairline ring, so never add a `border` to something
that has an elevation, and never write another `box-shadow` (inset field rings excepted).
Surfaces are opaque: `--surface-1` (raised on the shell), `--surface-2` (menus, popovers),
`--surface-3` (sheets, command bar). In dark mode higher surfaces are lighter.

### Layers
`--z-raised 10 · --z-sticky 20 · --z-sidebar 30 · --z-popover 40 · --z-sheet 50 ·
--z-command 60 · --z-menu 70 · --z-toast 80 · --z-drag 90`

### Motion (Emil Kowalski's rules, applied)
| Token | Value | Use |
|---|---|---|
| `--t-instant` | 0ms | hover in, press, selection, tab switch, command bar, menus opening |
| `--t-fast` | 120ms | hover out, color changes, icon swaps, press feedback, menu close |
| `--t-pop` | 180ms | popovers, tooltips, toasts arriving |
| `--t-settle` | 240ms | sheets, Peek, panels arriving |
| `--t-move` | 280ms | things that travel on screen: sidebar slide, row reorder, Space change |
| `--t-exit` | 140ms | everything leaving |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | all arrivals, exits and color changes |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | on-screen travel |
| `--ease-settle` | no-bounce spring as `linear()` | sheets and Peek |

- Never `ease-in`, never `transition: all`, never from `scale(0)`.
- An arrival starts at `opacity: 0; transform: translateY(4px) scale(0.98)` and ends at rest.
  Popovers and menus grow from the corner nearest their trigger (`transform-origin`); sheets
  stay centered. Exits are faster than entrances and travel at most 4px.
- Prefer CSS transitions (with `@starting-style` for entry) over keyframes for anything that
  can be interrupted or re-triggered; keyframes only for the string and one-shot entrances.
- Only `opacity`, `transform`, `clip-path`, colors and `box-shadow` animate. Never
  width/height/top/left/margin/padding.
- Tooltips: 500ms delay for the first, instant for the next while the pointer stays in the group.
- The string is linear (constant motion). Stagger, where a group arrives at launch only: 30–60ms.
- All durations multiply by `var(--speed, 1)` through the tokens. The user's Motion feel
  setting (`--ease`, `--dur`) stays wired where it is today.
- Reduce Motion: no travel or scale; opacity only, 140ms. The string becomes a static line.

### The string
`--thread: var(--accent)`; `--thread-w: 2px`. Shared classes in foundations.css:
`.thread` (2px rounded line; determinate through `--p: 0..1` using `transform: scaleX`,
origin left) and `.thread[data-busy]` (indeterminate: a segment travelling left to right,
1.1s linear). Uses: page loading (top inner edge of the page card), download progress, the
focus timer. A 13px spinner is allowed only in a sidebar row in place of the favicon.

### The contour field
One authored asset, generated by a script from a fixed seed (smooth scalar field → nested
closed isobars, 1px, `--ink-4` at low opacity, with two or three tiny tabular pressure
labels). It is a background only: the start page, the Welcome screen, and large empty
states (Archive, History, Downloads when empty). Never behind dense text, never animated,
never in the sidebar. `--contour` is the token; foundations provides it per mode.

## Color: the default look

Light or dark follows the system by default (people use a browser from morning daylight to
a lamp-lit evening). Each Space can still pin Light or Dark.

| | Light: "Sea-glass" | Dark: "Night chart" |
|---|---|---|
| Shell (window frame + sidebar) | `#E9F0EE` | `#141C22` |
| Page card | `#FFFFFF` | `#1B242B` |
| Ink | `#14211F` | `#E6EEF0` |
| Accent (chart magenta) | `#C2187A` | `#FF6FAE` |
| Text on accent | white | `#1B0A13` |

- The shell is one flat tint, not a two-color gradient. Secondary ink is the ink color at
  lower strength, so it carries the shell's hue.
- Every Space still has its own color: it tints the shell through Intensity and may set its
  own accent, as now. Pictures and custom gradients still work. The 27 swatches stay.
- No periwinkle, no purple-to-teal gradient, no warm creams (`#f4f1ec`, `#1e1c1a`).
- State colors on top of the palette only where they carry meaning: `--danger` red,
  a green for "secure / blocked / done", an amber for warnings. One value each per mode.
- Browser surfaces belong to the design too: `::selection` (accent at low strength with
  ink text), `caret-color: var(--accent)`, thin shell-tinted scrollbars on Windows/Linux
  (native overlay scrollbars on macOS), `text-underline-offset: 2px` on links.

## Component rules everyone shares (classes live in `controls.css`)

- **Button** `.btn`: `--h-md`, radius `--r-sm`, 13/500, padding 0 12px. Default is a neutral
  well (`--fill-field` + hairline). `.btn.primary` is the accent (one per surface, on the
  right). `.btn.ghost` has no fill until hover. `.btn.danger` is red text on neutral.
  `.btn.small` is `--h-sm`, 12/500.
- **Icon button** `.icon-btn`: 24 square, radius `--r-sm`, 16px icon at `--ink-2`; hover =
  fill + `--ink`.
- **Text field** `.input`: `--h-md`, radius `--r-sm`, `--fill-field`, hairline, 13/400.
  Focus = the ring; the border does not change color.
- **Search field** `.search-field`: `--h-lg`, radius `--r-md`, leading 14px magnifier; the
  ring goes on the container. One implementation for History, Archive, Settings, Downloads.
- **Segmented** `.segmented`: track `--h-md`, radius `--r-sm`, 2px inset; the selected
  segment is a raised paper pill (`--surface-1` + `--elev-1`), 13/500.
- **Switch** `.toggle`: 36×22, knob 18, on = accent.
- **Slider** `.slider`: 4px track, 16px knob with `--elev-1`, filled part accent. One implementation.
- **Select** `.select`: a button with a trailing up/down chevron, `--h-md`.
- **Focus ring**: `outline: 2px solid var(--accent); outline-offset: 2px` (−2px inside menus
  and rows), `:focus-visible` only. It must stay a real `outline`.
- **Menu**: radius `--r-lg`, padding 5, items `--h-sm` with radius `--r-xs`, 13/400, shortcut
  hints 12 at `--ink-3`, separators 1px with 5px margin, `--surface-2` + `--elev-2`.
  Highlighted item = `--fill-hover`, instant. Menus open in one frame.
- **Sheet**: top anchored at 12vh, radius `--r-xl`, `--surface-3` + `--elev-3`, title 15/600,
  optional 12/400 subtitle at `--ink-2`, body padding 20, footer right-aligned with the
  primary button last. Three widths only: 440, 560, 720. Before adding a sheet, ask whether
  the task needs a modal at all; inline or a popover is usually better.
- **Section label**: 11/600 `--ink-3`, sentence case, never uppercase.
- **Empty state**: one 13/400 sentence at `--ink-2` that teaches the next step, optionally
  one button, on the contour field when the area is large. No illustrations, no emoji.
- **Icons**: lucide only, 16px, stroke 1.75, `--ink-2`. No emoji as icons in the chrome
  (a Space's own emoji is the user's content and stays).

## Voice

US spelling (Color, Favorites, Customize, Behavior). Sentence case. Buttons are verbs
("Import", "Add Space"). No exclamation marks. Say what happens. Errors name the problem
and the way out. Product names stay: Spaces, Favorites, Pinned, Today, Peek, Split View,
Boosts, Shields, Little window, Archive.

## Refused (impeccable's craft floor, applied to Kite)

Gradient text; glass or blur as decoration; a colored left/right border on cards or rows;
nested cards; an eyebrow/kicker above a heading; uppercase tracked micro-labels; monospace
as costume (mono only for code, URLs in View Source, and key caps); emoji as icons;
`repeating-linear-gradient` textures; a border under a wide soft shadow; spinners in the
middle of content; orchestrated load sequences on a new tab; a modal as the first thought.

## Guard rails

- Do not rename classes or `data-testid`/`data-*` attributes that tests select
  (`research/04-design-system-audit.md` section D lists them) unless you update every test
  that uses them, and say so.
- Tests may be updated when the design deliberately changes what they assert (a size, a
  color, a duration, a default). Never weaken a test's intent: text contrast stays ≥ 4.5:1
  and accent ≥ 3:1, text must not overlap or clip, the keyboard ring stays a real outline,
  the command bar and tab switches stay un-animated.
- Works in light and dark, sidebar left and right, three densities, text scale 0.9–1.2,
  Reduce Motion, windows from 720px wide, and on Windows/Linux (macOS-only details live
  under `[data-mac]`).
- Every interactive element has hover, pressed, focus-visible and (where it applies)
  disabled states, a hit area of at least 24×24, and an accessible name.
- Verify by looking: render your surface (web mode, `npx vite --port 5174 --strictPort`,
  Playwright screenshots at 2x, light and dark) and read the result before you call it
  done. Batch your looks: fix everything one look shows before looking again.
