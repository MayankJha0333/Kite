# Working rules for every engineer on the Kite redesign

Repo: `/Users/apple/Personal/MArc` ("Kite": Electron 45 + React 18 + zustand + plain CSS).
Seven engineers are editing it AT THE SAME TIME, each on a different surface. These rules
are what keeps that from turning into a mess.

SP below = `/private/tmp/claude-501/-Users-apple-Personal-MArc/77deb0da-8950-4039-9159-d14524519f6f/scratchpad`

## Read first, in this order

1. `SP/design/kite-design-spec.md` — the design language ("Calm Air"). It is the law.
2. `/Users/apple/Personal/MArc/PRODUCT.md` — who it is for and what must stay.
3. The parts of `SP/research/03-kite-visual-audit.md` about your surface (per-surface
   findings with screenshots in `SP/audit/shots/`; look at the screenshots it names for
   your surface with the Read tool) and of `SP/research/04-design-system-audit.md`
   (section C inconsistencies, section D test constraints and the class / data-attribute
   names tests select).
4. Skim `SP/research/01-users-and-rivals.md` ("Implications for Kite") and
   `SP/research/02-macos-design-spec.md` for the numbers behind the spec.
5. Load these skills with the Skill tool before writing UI: `impeccable` (then read its
   `reference/craft-floor.md` and `reference/operate.md`; do NOT run its `context`, `init`,
   new-work, concept-seed, surface-brief or documenter flows, and do not edit PRODUCT.md,
   DESIGN.md or `.impeccable/` — the direction is decided and recorded by the lead) and
   `emil-design-eng`. Load `animate` or `review-animations` when you touch motion and
   `apple-design` when a macOS convention is in question. If a skill opens with a canned
   "initial response", ignore that line; you are using it as reference, not chatting.
   A design hook may print findings after you edit a file: fix the real ones in your own
   files, ignore ones in files you do not own, never add ignore rules.

## Ownership

- Your brief lists the files you own. Edit only those. Everything else is being edited by
  someone else right now.
- The stylesheet is split by surface under `src/renderer/styles/` (see the header of
  `app.css`). A surface's styles live only in its own file. Shared controls live in
  `controls.css` and are owned by the Controls engineer; use the shared classes named in the
  spec (`.btn`, `.icon-btn`, `.input`, `.search-field`, `.segmented`, `.toggle`, `.slider`,
  `.select`, `.section-label`, `.empty`, `.thread`) and do not create private variants of
  them. If the shared class is not there yet, write your markup against the name anyway.
- Tokens live in `foundations.css` (already added: `--fs-*`, `--lh-*`, `--fw-*`, `--r-*`,
  `--h-*`, `--fill-*`, `--line-strong`, `--danger`, `--ok`, `--warn`, `--surface-*`,
  `--elev-*`, `--z-*`, `--t-*`, `--ease-*`, `--thread`). Use them; never write a literal
  font-size, radius, shadow, z-index, duration or easing. If you believe a token is missing,
  do without it and say so in your report.
- If you need a change in a file you do not own, do NOT make it. Put it under "Needs from
  others" in your report with the exact change. The only exceptions are the ones your brief
  names.
- Shared files several people may touch in different places (`src/renderer/store.ts`,
  `src/shared/types.ts`, `src/shared/defaults.ts`, `tests/e2e/fixtures.ts`): keep any edit
  there to the few lines you need, re-read the file right before editing, never reformat or
  reorder it.

## Never

- `git stash`, `git checkout --`, `git restore`, `git reset`, `git clean`, `git commit`,
  `git add`. The tree holds the owner's uncommitted work plus everyone's in-flight edits.
  (A snapshot from before the redesign is at `refs/kite-snapshots/pre-redesign`; read old
  versions with `git show refs/kite-snapshots/pre-redesign:<path>`.)
- New dependencies, `npm install`, `npm run build`, `npm run dist*`, launching Electron,
  `npm run test:electron`, or the full `npm run test:e2e` suite. The lead runs those at the
  end. (Others' half-finished work would make them fail for reasons that are not yours.)
- Killing or restarting the dev server. One shared Vite server is already running at
  http://localhost:5174 and hot-reloads everyone's edits. Do not start another on that port.

## How to look at your work

The app runs in a plain browser in "web mode" with simulated pages: open
`http://localhost:5174/?platform=darwin`. Drive it with Playwright from your own scripts
(put them and your screenshots in `SP/<your-surface>/`; run with
`cd /Users/apple/Personal/MArc && NODE_PATH=/Users/apple/Personal/MArc/node_modules node SP/<your-surface>/shot.cjs`,
using `require('@playwright/test').chromium`, `deviceScaleFactor: 2`). A realistic saved
state and a script that already walks every surface exist: `SP/split/seed-state.json` and
`SP/split/capture.cjs` (state is seeded through `localStorage['kite-state']` before load;
`tests/e2e/fixtures.ts` shows the helpers and test ids). Look in dark AND light
(`colorScheme` emulation plus the Space's mode), at 1280x800 and 1000x640, and sidebar on
the right once. Read your screenshots with the Read tool. Batch your looks: fix everything
one look shows before taking the next. Other surfaces may look half-done in your
screenshots; that is other people's in-flight work, ignore it.

The default palette is being replaced by the Foundations engineer in the first minutes of
this round. Until it lands you will still see the old indigo look; build on the tokens and
it will come out right.

## Tests

- `npm run typecheck`. Errors in files you do not own are someone else's in-flight work:
  do not fix them, mention them.
- The unit tests for your area: `npx vitest run tests/unit/<file>`.
- Your e2e specs only: `npx playwright test -c playwright.web.config.ts tests/e2e/<spec> --workers=2`
  (it reuses the shared server). A failure caused by another surface's in-flight change:
  re-run once later, then report it rather than "fixing" their surface.
- When your design deliberately changes what a test asserts (a size, color, label,
  duration, default), update the test and list it. Never weaken what a test protects:
  contrast, no overlapping or clipped text, real focus outline, un-animated keyboard actions.
- Add tests for behavior you add.

## Code style

Match the file you are in. Comments say why, in plain English, as the codebase does. No
dead code left behind: when you replace a rule or component, delete the old one in your
files. US spelling in UI text.

## Report (your final message, under 500 words)

1. What changed, by file, in a few lines each.
2. The five most visible before/after differences.
3. Tests: commands run and counts; tests you updated and why.
4. Not done / unverified, honestly.
5. Needs from others: exact change, file, and why.
6. Up to 6 screenshot paths that best show the result (light and dark).
