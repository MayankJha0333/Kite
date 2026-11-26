# Controls contract

The shared control vocabulary, as it is in `src/renderer/styles/controls.css` today. Write
your markup against these classes; do not restyle a control inside your surface (place it,
size its container, nothing more). If you need something that is not here, ask for it in
your report instead of making a private variant.

Every control already has default, hover, pressed, focus-visible and disabled states. Hover
and pressed fills are instant; keyboard focus is the real `outline` from foundations.css.
Everything is built from tokens only, so it follows the Space, light/dark and text size.

A rendered sheet of all of it, light and dark:
`/private/tmp/claude-501/-Users-apple-Personal-MArc/77deb0da-8950-4039-9159-d14524519f6f/scratchpad/controls/shots/gallery-light-bottom.png`
and `.../controls/shots/gallery-dark-bottom.png`.

## Buttons

| Class | What | Size |
|---|---|---|
| `.btn` | neutral button (well + hairline) | 28 high, 13/500, padding 0 12 |
| `.btn.primary` | the one accent button of a surface, placed last/right | same |
| `.btn.ghost` | no fill until hover, `--ink-2` text | same |
| `.btn.danger` | destructive: red text on the neutral button | same |
| `.btn.danger.ghost` | destructive as plain red text (sheet footers, left side) | same |
| `.btn.small` | combine with any of the above | 24 high, 12/500, padding 0 8 |

```html
<button class="btn">Cancel</button>
<button class="btn primary"><Plus size={14} /> Add</button>   <!-- optional leading icon, 14–16px; the 6px gap is built in -->
<button class="btn small ghost">Look again</button>
```

- Disabled: the `disabled` attribute (or `aria-disabled="true"`).
- A file picker: `<label class="btn"><input type="file" class="visually-hidden" /> Choose file…</label>`
  (the label shows the input's focus ring; do not use the `hidden` attribute, it removes
  the input from the keyboard).
- Inside `.sheet-foot`, non-small buttons are 32 high automatically.
- Do not set `background` on a `.btn`: hover and pressed are a `background-image` layer over
  the button's `background-color`.

`.icon-btn`: a 24×24 button holding one 16px lucide icon, `--ink-2`; hover = fill + `--ink`.

```html
<button class="icon-btn" aria-label="Close"><X size={16} /></button>
<button class="icon-btn small" aria-label="Remove"><X size={14} /></button>  <!-- 20px to look at, 24px hit area; for rows and fields -->
```

- `data-active` or `aria-pressed="true"`: held-down look (its panel is open, a toggle is on).
- Always give it an `aria-label`.

## Text fields

`.input`: 28 high, 13/400, well + hairline, radius `--r-sm`. Focus is the accent ring drawn
tight against the field; the hairline does not change color.

```html
<input class="input" placeholder="news.example.com" />
<input class="input" aria-invalid="true" />        <!-- error: red hairline and red ring -->
<textarea class="input"></textarea>                <!-- grows from 88px, resizes vertically -->
<textarea class="input code"></textarea>           <!-- .code: monospaced, for code the user types -->
```

`.search-field`: THE search field. 32 high, radius `--r-md`. The container is the well and
carries the focus ring (`:has(input:focus-visible)`), so never put `.input` on the inner input.

```html
<label class="search-field">
  <Search size={14} aria-hidden="true" />
  <input type="search" placeholder="Search history" aria-label="Search history" />
  <button class="icon-btn small" aria-label="Clear search"><X size={14} /></button>   <!-- only while there is text -->
</label>
```

React: `<SearchField value onChange placeholder label testId autoFocus />` from `Sheet.tsx`
renders exactly this (Esc clears the text first, then lets the surface close).

`.select`: a pop-up button, 28 high, with two small up/down arrows drawn from the ink color.

```html
<select class="select">…</select>          <!-- native select; width follows its content -->
<button class="select" aria-haspopup="menu">Home</button>   <!-- a button that opens a menu -->
```

Give it a width from your layout if it should fill a column (`width: 100%` on the element).

## Choices

`.segmented`: a track of buttons; the chosen one is a raised pill. Selection is instant (no
sliding pill, by rule 4 of the spec).

```html
<div class="segmented" role="radiogroup" aria-label="Side">
  <button role="radio" aria-checked="true" data-on>Left</button>
  <button role="radio" aria-checked="false">Right</button>
</div>
```

- Chosen segment: `data-on`, or `aria-checked="true"` / `aria-selected="true"` / `aria-pressed="true"`.
- `.segmented.fill`: the track takes the full width and every segment is the same width
  (use this in narrow panels such as Customize instead of ragged left-aligned tracks).
- React: `<Segmented value options onChange testId label fill />` from `Sheet.tsx`
  (arrow keys move the choice, one tab stop, test ids `${testId}-${value}` as before).

`.toggle`: the switch, 36×22, knob 18, on = accent. Needs the knob span.

```html
<button class="toggle" role="switch" aria-checked="true" data-on aria-label="Boosts on">
  <span class="toggle-knob"></span>
</button>
```

On: `data-on` or `aria-checked="true"`. React: `<Toggle checked onChange label testId />`.

`.slider`: a native range input (arrow keys, Home, End work). 4px track, 16px knob, the part
left of the knob is accent.

```html
<input type="range" class="slider" min="0" max="1" step="0.05" value="0.4" aria-label="Volume" />
```

- The fill reads the CSS variable `--p` (0 to 1) on the input. You normally do not set it:
  it is computed from the input's own `value`, `min` and `max` attributes, which React keeps
  current for a controlled input. Set `--p` inline only when those attributes are not there
  or not current (an uncontrolled input): `style={{ '--p': (v - min) / (max - min) }}`.
- React: `<Slider value min max step onChange label testId />` from `Sheet.tsx` does that for you.
- Width is 100% of its container; height 24 (the hit area). Put a label on the left and the
  value on the right (tabular numerals) on one line around it.
- Do not restyle the track or thumb. A gradient strip (the hue picker) is a different
  control and should keep its own class without `.slider`/`.range`.

`.checkbox`: `<input type="checkbox" class="checkbox" />`, 16×16 (24 hit area), checked and
indeterminate are accent with the tick in `--accent-ink`.

## Labels and small pieces

| Class | Markup | What |
|---|---|---|
| `.section-label` | `<h3 class="section-label">Today</h3>` | 11/600 `--ink-3`, sentence case; add your own margin |
| `.kbd` | `<kbd class="kbd">⌘</kbd><kbd class="kbd">T</kbd>` | key cap: 18 high, `--fs-micro`, `--r-xs`, hairline |
| `.chip` | `<span class="chip">example.com <button aria-label="Remove example.com">×</button></span>` | a tag; the remove button is optional; `<code>` inside is truncated |
| `.badge` | `<span class="badge">12</span>` | a count, fully round, tabular numerals |
| `.divider` | `<hr class="divider" />` | hairline; `data-vertical` for a vertical one in a flex row |
| `.muted` | `<span class="muted">…</span>` | 12/400 `--ink-3` secondary text |
| `.link` | `<button class="link">Change</button>` or `<a class="link">` | accent, underlined |
| `.warn` | `<span class="warn"><AlertTriangle size={12} /> …</span>` | a caution under a field, `--warn` |
| `.notice` | `<p class="notice">…</p>` | a boxed explanatory line; `.notice.danger` (+ `role="alert"`) is the inline error |
| `.keys` | `<span class="keys"><kbd class="kbd">⌘</kbd><kbd class="kbd">⌥</kbd><kbd class="kbd">B</kbd></span>` | several caps that make one shortcut; never breaks across lines |
| `.disclosure` | `<details class="disclosure"><summary>Why can’t some videos be saved?</summary><p class="muted">…</p></details>` | a question the panel answers only when asked |
| `.spacer` | `<span class="spacer" />` | pushes what follows to the right in a flex row |
| `[data-off]` | any wrapper | switched off by a setting above it: 45% and no pointer |
| `.field` | `<label class="field"><span class="field-label">Name <span class="field-hint">hint</span></span><span class="field-control">…</span></label>` | a labeled control; `data-inline` puts label and control on one line. React: `<Field label hint inline>` |
| `.field-inline` | `<span class="field-inline"><Toggle … /> Boosts on</span>` | a switch or tick with its label |
| `.inline-form` | `<form class="inline-form"><input class="input" /><button class="btn primary">Add</button></form>` | a field and its button; the field stretches |

## List row

`.list-row`: one row of any list (History, Archive, Downloads, Extensions, Boosts, rules).
36px minimum, radius `--r-md`, hover fill instant, never scales.

```html
<div class="list-row">
  <button class="list-row-main">                    <!-- the row's own action; use a <div> when the row does nothing itself -->
    <SiteIcon url={…} size={16} />                  <!-- leading icon, 16px -->
    <span class="list-row-text">
      <span class="list-row-title">Title</span>
      <span class="list-row-meta">example.com · 10:24 AM</span>   <!-- optional second line, 12 `--ink-3`, tabular -->
    </span>
  </button>
  <span class="list-row-actions">                   <!-- shown on hover and while the keyboard is in the row -->
    <button class="icon-btn small" aria-label="Remove from history"><X size={14} /></button>
  </span>
  <span class="list-row-trailing">3.0 MB <Toggle … /></span>      <!-- optional: things that always show -->
</div>
```

- `.list-row-aside` (inside `.list-row-main`, last): a time or a size at the right end, 12 `--ink-3`, tabular.
- `data-on` on the row: the selected look (`--fill-selected`).
- `data-shown` on `.list-row-actions`: keep the actions visible (for example while a menu is open).
- Title and meta are single-line and truncate with an ellipsis; long names are safe.
- Group rows in `<section class="list-group">` under an `<h3 class="section-label">` (the label
  lines up with the row icons); lists need no gap between rows. When the heading carries one
  quiet action, use `<header class="list-head"><h3 class="section-label">Recent</h3><button class="btn small ghost">Clear finished</button></header>`.
- `<div class="list-more"><button class="btn small">Show 150 more</button></div>` under a long list.
- A row may wrap a second line under itself (a progress string, an inline question): give
  the row `flex-wrap: wrap` and the extra element `width: 100%` in your own file.

## Empty state

One sentence that teaches the next step, at most one button. No icon, no illustration.

```html
<div class="empty"><p>Tabs you haven’t used for 12 hours move here. Nothing yet.</p></div>

<!-- a large area (a whole page or sheet body): add data-field and the contour layer first -->
<div class="empty" data-field>
  <div class="contour-field" aria-hidden="true"></div>
  <p>Pages you visit are listed here, newest first.</p>
  <button class="btn">Open a page</button>
</div>
```

`data-field` makes it fill the space (min 240px) and puts `.contour-field` (shipped by
Foundations) behind the text.

## Sheet

Use the React component; do not write the markup by hand.

```tsx
<Sheet title="Boosts" subtitle="Restyle any site." size="medium" testId="boosts-list"
       footer={<><button className="btn danger ghost">Delete Boost</button><span className="spacer" /><button className="btn">Cancel</button><button className="btn primary">Done</button></>}>
  …body…
</Sheet>
```

- `size`: `"small"` 440, `"medium"` 560 (default), `"large"` 720. Nothing else. (`wide` still
  works and means `"large"`.)
- Top edge is always at 12vh; the body scrolls by itself; the sheet never grows past the window.
- Body is a flex column with a 16px gap and 20px padding; its children keep their height.
- Footer: right-aligned, primary last. Put a `.spacer` after anything that belongs on the
  left (a count, or the destructive action as `.btn.danger.ghost`).
- Esc and a click outside close it; focus is trapped inside and returns to whatever opened it;
  `role="dialog"`, `aria-modal`, labeled by its title.
- `dock`: a non-modal panel in the top corner away from the sidebar, as tall as its content,
  no dim, the page stays usable, no focus trap (focus still moves in and comes back). 340 wide
  unless `size` is given (Downloads uses `size="small"`).
- A long title wraps; put no icon in a title.
- Under Reduce Motion it fades in 140ms (`.sheet` is in the motion.css lists; keep the class).

## Aliases (old names that still work; use the new one in new markup)

| Old | New |
|---|---|
| `.range` | `.slider` |
| `select.input` | `.select` |
| `.icon-btn.tiny` | `.icon-btn.small` |
| `.btn.danger-solid` | `.btn.danger` |
| `.look-h` | `.section-label` |
| `.empty-list` (+ `.empty-state-title`) | `.empty` with one `<p>` |
| `.import-error` | `.notice.danger` |
| `data-wide` / `wide` on a sheet | `size="large"` |

## Behavior the shared pieces now have

- Buttons: pressing goes in over `--t-fast`; letting go follows the user's motion feel
  (`--press-ease`, `--press-dur`).
- Search field: Esc empties it first; a second Esc closes the surface.
- Segmented: one tab stop; arrow keys move the choice and wrap.
- Sheet: focus moves in on open and returns to the opener on close; Tab stays inside a modal one.

## Changed sizes you will notice

`.btn` 32 → 28, `.btn.small` 28 → 24, `.icon-btn` 28 → 24, `.icon-btn.tiny` 22 → 20,
`.input` 36 → 28, search field 40 → 32, switch 40×24 → 36×22, segmented buttons 28 inside a
34 track → 24 inside a 28 track. All weights are now 400/500/600.

## Known gaps

- `windows.css` still defines an older, unscoped `.empty` (absolute, full-bleed) for the
  little window. The shared `.empty` is written to win over it, but that rule should be
  renamed (`.little-empty`) by its owner.
- The knob of the switch and the slider is `--surface-1` by day and `--ink` at night (paper
  would be darker than the track in the dark). There is no knob token; say so if you need one.
- The selected segment is `--surface-1` + `--elev-1`, as the spec says. At night, on a sheet
  or a menu (`--surface-2/3`), `--surface-1` is darker than the track, so the pill reads as
  a dark well, not raised paper. It needs a token decision (Foundations), not a local fix.
- Pieces of other surfaces still live at the bottom of controls.css (Welcome, the Space
  editor, swatches, the emoji grid, `.look-inline-range`, `.cz-toggles`, Shields' chip list,
  site permission rows). They are on tokens and keep working; move them into your own file
  when you restyle them and tell the Controls engineer, who then deletes them here.
