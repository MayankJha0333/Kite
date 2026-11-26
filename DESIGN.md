---
name: Kite
description: A calm, sidebar-first Mac browser drawn on a chart of still air.
colors:
  sea-glass-shell: "#e9f0ee"
  night-chart-shell: "#141c22"
  paper-card: "#ffffff"
  night-card: "#1b242b"
  chart-ink: "#14211f"
  night-ink: "#e6eef0"
  chart-magenta: "#c2187a"
  dusk-magenta: "#e27aa8"
  on-magenta-day: "#ffffff"
  on-magenta-night: "#1b0a13"
  night-surface-1: "#222c34"
  night-surface-2: "#242f38"
  night-surface-3: "#27333d"
  signal-red: "#c2302b"
  signal-red-night: "#ff6b63"
  secure-green: "#1d7a4c"
  secure-green-night: "#5fd08f"
  caution-amber: "#8f5600"
  caution-amber-night: "#f2b34a"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Figtree', system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "32px"
  large:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Figtree', system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "24px"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Figtree', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "20px"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Figtree', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "16px"
  small:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Figtree', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "15px"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Figtree', system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "14px"
  mono:
    fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
rounded:
  xs: "5px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "999px"
spacing:
  control-xs: "20px"
  control-sm: "24px"
  control-md: "28px"
  control-lg: "32px"
  control-xl: "44px"
  row-compact: "28px"
  row-regular: "32px"
  row-roomy: "36px"
components:
  button:
    textColor: "{colors.chart-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: "{spacing.control-md}"
    padding: "0 12px"
  button-primary:
    backgroundColor: "{colors.chart-magenta}"
    textColor: "{colors.on-magenta-day}"
    rounded: "{rounded.sm}"
    height: "{spacing.control-md}"
    padding: "0 12px"
  button-primary-night:
    backgroundColor: "{colors.dusk-magenta}"
    textColor: "{colors.on-magenta-night}"
  input:
    textColor: "{colors.chart-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: "{spacing.control-md}"
    padding: "0 8px"
  search-field:
    rounded: "{rounded.md}"
    height: "{spacing.control-lg}"
  sidebar-row:
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "{spacing.row-regular}"
    padding: "0 8px"
  menu:
    backgroundColor: "{colors.paper-card}"
    rounded: "{rounded.lg}"
    padding: "5px"
  menu-item:
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    height: "{spacing.control-sm}"
  sheet:
    backgroundColor: "{colors.paper-card}"
    rounded: "{rounded.xl}"
  command-bar:
    backgroundColor: "{colors.paper-card}"
    rounded: "{rounded.xl}"
    width: "640px"
---

# Design System: Kite

## Overview

**Creative North Star: "Calm Air"**

Kite is drawn like a weather chart on a still day. The window frame is one flat sheet of
tinted chart paper (sea-glass by day, night-chart slate after dark, following the system),
the web page lies on it like a sheet on a chart table, and the contour lines of a calm
pressure field sit quietly behind the start page, the first run and large empty states. The
page is the loud part; the chrome is quiet, exact and matte.

The world lends four things and only these: a tinted palette, San Francisco at Mac sizes,
compact density, and one signature move — the string, a 2px chart-magenta line that appears
only while something is in flight (a page loading, a download, the first-run steps). Layout,
navigation and controls stay standard macOS: a person who uses Finder and Safari should know
where everything is before they notice the world.

Rejected by decision: the grey window with one blue accent, and the pastel gradient sidebar.
Glass and blur are not part of the world; surfaces are paper.

**Key Characteristics:**
- One flat tinted shell per mode; a page card on a hairline and a soft shadow.
- Four ink strengths, three weights, 13px regular body text.
- Magenta only for focus, the primary action, things switched on, links, and the string.
- Keyboard actions are instant; things that arrive under the pointer settle in without bounce.
- The contour field never moves; the string is the only thing in the chrome that does.

## Colors

A restrained palette: neutrals tinted from the shell's hue, one accent, three state colors.

### Primary
- **Chart Magenta** (#c2187a, day) / **Dusk Magenta** (#e27aa8, night): the one accent. Focus
  ring, the primary button of a surface, switches/sliders/checkboxes that are on, links, and
  the string. Text on it is white by day and #1b0a13 at night (both ≥ 5.6:1). Each Space may
  bring its own accent; theme.ts fits its lightness until it reads ≥ 4.5:1 on the shell.

### Neutral
- **Sea-glass Shell** (#e9f0ee) / **Night-chart Shell** (#141c22): window frame and sidebar,
  one flat tint (a Space's first color, mixed in by Intensity).
- **Paper Card** (#ffffff) / **Night Card** (#1b242b): the page card and, by day, every raised
  surface. At night raised surfaces get lighter instead: #222c34, #242f38, #27333d.
- **Chart Ink** (#14211f) / **Night Ink** (#e6eef0): primary text. Secondary and tertiary text
  are the same ink at lower strength (computed per Space so they stay ≥ 4.5:1 on shell and
  card); the fourth strength is decoration only (chevrons, contour lines, disabled).
- **Hairline**: ink at 10% (day) / 12% (night). **Fills**: hover 6%, press 9–10%, selected 12%,
  field 5–7% of the ink — so every fill carries the shell's hue.

### State colors
- **Signal Red** (#c2302b / #ff6b63): destructive text and icons; never a red field.
- **Secure Green** (#1d7a4c / #5fd08f): "connection is secure", things done or blocked.
- **Caution Amber** (#8f5600 / #f2b34a): warnings.

### Named Rules
**The Five Jobs Rule.** The accent does exactly five jobs: focus, primary action, on-state,
link, string. Never on icons, folder glyphs, selection or hover fills, section labels or borders.

**The Tinted Ink Rule.** No neutral grey anywhere: every grey is the shell's ink at a strength.

## Typography

**Body Font:** San Francisco through `-apple-system` (Figtree on Windows and Linux).
**Label/Mono Font:** ui-monospace only for code, View Source, error codes and key caps.

**Character:** one family carrying everything at Mac sizes; hierarchy comes from size and
weight steps, never from letter-spacing or uppercase.

### Hierarchy
- **Display** (600, 28/32): the start-page greeting and the first-run headline.
- **Large** (600, 20/24): page titles — Settings, History, Archive.
- **Title** (600, 15/20): sheet and popover titles, Settings group titles.
- **Body** (400, 13/16): everything by default — rows, menus, buttons (500), inputs.
- **Small** (400, 12/15): secondary lines, descriptions, a URL under a title.
- **Label** (600, 11/14): section labels in sentence case; captions, counts, shortcut hints at 400.

All sizes multiply by the user's text-size setting. Numbers that change use tabular figures.
Notes are the one reading surface: about 15/24 on a ~68-character measure.

### Named Rules
**The Three Weights Rule.** 400 for reading, 500 for what you can press or what is selected,
600 for titles. No 550, 650, 700 or 800.

## Layout

A sidebar (default 240px, resizable, left or right) beside a page card inset by the page
margin (Edge to edge 0, Floating 8px, Airy 14px). Sidebar rows are 28/32/36px for Compact,
Regular, Roomy, with 8px inline padding, a 16px favicon and an 8px gap; folders indent 16px.
The start page and Settings use one centered column (640px and ~660px). Widgets snap to a
3-column grid on the start page (2 or 1 when narrow) and never overlap. Sheets anchor at 12vh
in three widths: 440, 560, 720. Windows work from 720px wide; Settings keeps labelled tabs to
about 760px. More space above a heading than below it.

## Elevation & Depth

Paper on a chart table: a hybrid of tonal layering and soft shadows. Every elevation token
carries its own 0.5px hairline ring, so an elevated thing never also gets a border. At night,
height also reads as a lighter surface and a faint inner top highlight.

### Shadow Vocabulary
- **Raised** (`--elev-1`): the selected segment, widgets, the start-page search field.
- **Floating** (`--elev-2`): menus, popovers, toasts, the page card.
- **Lifted** (`--elev-3`): sheets, the command bar, Peek.

### Named Rules
**The Matte Rule.** No backdrop blur. The single exception is the sidebar over a Space
picture, where frosting is needed for legibility.

## Shapes

Gently rounded and concentric: 5px (items inside menus, key caps), 6px (buttons, fields,
segmented controls), 8px (rows, list rows, tiles, search fields), 12px (menus, popovers,
widgets, toasts), 16px (sheets, command bar, Peek). An inner radius is the outer radius minus
its padding, never below 5px. Fully round only for switches, Space dots, count badges and the
string's ends. The page card's radius is the user's Corners setting.

## Components

### Buttons
- **Shape:** gently rounded (6px), 28px tall, 13px medium, 12px side padding.
- **Default:** a neutral well (field fill + hairline). **Primary:** the accent with its own text
  color; one per surface, on the right. **Ghost:** no fill until hover. **Danger:** red text on
  neutral. **Small:** 24px, 12px text.
- **States:** hover adds the hover fill instantly; press adds the press fill and scales to 0.97
  over 120ms; focus is the 2px accent outline, offset 2px, keyboard only.

### Inputs / Fields
- **Style:** 28px, 6px radius, field fill, hairline; placeholder at the third ink.
- **Search field:** 32px, 8px radius, leading 14px magnifier; the focus ring sits on the container.
- **Focus:** the accent outline; the border never changes color. **Error:** `aria-invalid` shows
  red text below, not a red field.

### Choice controls
- **Segmented:** 28px track, 6px radius; the chosen segment is a raised paper pill (night: ink at 17%).
- **Switch:** 36×22, 18px knob, on = accent. **Slider:** 4px track, 16px knob, filled part accent.
- **Disclosure:** a drawn chevron that turns when open; labels say what opens ("Patterns",
  "More layout options").

### Sidebar rows
- 32px regular, 8px radius, title at 400; the selected row is 500 on the selected fill; hover
  and press fills are instant and rows never scale. Trailing actions (close, more) fade the
  title's end instead of re-truncating it. A loading row shows a still 10px ring where its
  icon will be. Icons too dark or too light for the shell sit on a small neutral plate.

### Menus
- 12px radius, 5px padding, 24px items at 5px radius, 13px regular; shortcut hints 12px at the
  third ink; 1px separators with 5px margin. They open in one frame and fade out in 120ms,
  growing from the corner nearest the pointer. Long menus end in one "More" submenu.

### Command bar
- 640px wide, 16px radius, lifted; a 44px input with 15px text and a magnifier; 36px result
  rows on a neutral selected fill with matched letters in 600. Open tabs rank first; the tab you
  are on is never listed. Opens and closes with no animation, above sheets.

### The string (signature)
- A 2px rounded line in the accent. Indeterminate while a page loads (a segment travelling left
  to right, linear 1.1s), shown only after 150ms, finishing taut and fading in 140ms;
  determinate for downloads, the focus timer and the first-run steps (`--p` 0…1). Under Reduce
  Motion it stands still.

### The contour field (signature)
- Generated isobars (`scripts/backgrounds/contour.mjs`), drawn as a mask in the fourth ink at
  ~10%, thinning around the content column; on the start page, first run, error pages and large
  empty states only. It never moves and never sits behind dense text.

## Do's and Don'ts

### Do:
- **Do** use the tokens: `--fs-*`, `--fw-*`, `--r-*`, `--h-*`, `--fill-*`, `--surface-*`, `--elev-*`, `--z-*`, `--t-*`, `--ease-*`.
- **Do** keep keyboard actions instant: tab switches, ⌘T, menus opening.
- **Do** settle things that arrive under the pointer in 180–240ms on `--ease-out` or `--ease-settle`, from `translateY(4px) scale(0.98)`; exits 140ms.
- **Do** keep text at ≥ 4.5:1 and the accent at ≥ 3:1 in every Space and mode.
- **Do** write one calm sentence for an empty state, saying what will appear and how.

### Don't:
- **Don't** put the accent on icons, selection fills or borders (The Five Jobs Rule).
- **Don't** add a second progress language: no spinners in the chrome, no other progress bars.
- **Don't** use backdrop blur, gradient text, uppercase tracked labels, or a border under an elevation.
- **Don't** animate width, height, top, left, margin or padding; never `transition: all`; never ease in; nothing bounces.
- **Don't** use emoji as icons in the chrome (a Space's own emoji is the person's content).
