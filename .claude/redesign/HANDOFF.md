# Kite redesign: FINISHED (26 Nov 2026, ~10:05 IST) — kept as the record

# Kite redesign: where things stood (saved 26 Nov 2026, ~09:25 IST)

Read this first when resuming. Nothing is committed; everything is in the working tree.
The tree from before the redesign is at git ref `refs/kite-snapshots/pre-redesign`.

## Goal (owner's words)

Make Kite a browser people prefer over Arc and love from the first interaction: "a more
professional, polished experience, similar to macOS … premium, thoughtfully designed,
effortless … its own identity … focus on the actual user experience." Use the installed skills
properly (impeccable, emil-design-eng, design-taste-frontend, apple-design, ui-taste).

## Decisions the owner made (do not re-ask)

- Primary user: any Mac user (from Safari/Chrome, new to sidebars). Arc import is a side door.
- Must keep: only the name and the kite icon.
- Auto-update allowed (signed security updates). Otherwise offline: no account, sync, AI.
- Visual direction: "whichever is the best one" → **Calm Air** (weather-chart world: sea-glass /
  night-chart flat shell, contour lines, one magenta "string" for anything in flight).
- Arc stops working on 22 December 2026 (verified).

## Documents

- `.claude/redesign/design/kite-design-spec.md` (the law), `agent-rules.md`, `controls-contract.md`,
  `research/01…05`. `PRODUCT.md` (repo root). Direction contract:
  `.impeccable/surfaces/src-renderer-app-tsx.md`. Review screenshots: `.impeccable/review/`.
- Scripts copied to `.claude/redesign/scripts/` (real.cjs, recap.cjs, look.cjs, seed-state.json; they read the seed from the scratch path — point them at this copy if the scratch is gone).
- Scratch (may be wiped): `/private/tmp/claude-501/-Users-apple-Personal-MArc/77deb0da-8950-4039-9159-d14524519f6f/scratchpad/`
  — `lead/real.cjs` (drive the real app; pass `colorScheme: null` to Playwright's electron.launch
  or it forces light mode), `lead/recap.cjs` (web-mode review captures).

## DONE and verified

- All seven surfaces redesigned by agents (Foundations, Controls, Sidebar, Command bar/menus/
  toasts, Settings, Start page + first run, Page area + little window). Stylesheet is one file
  per surface under `src/renderer/styles/`.
- Electron 38 → 45.5.0 (Chromium 156); lockfile synced (`npm install` done).
- Pages see a plain Chrome UA (checked in the real app: `Chrome/156…`, no "Electron").
- Update check: `src/shared/updates.ts`, `src/main/updates.ts`, `src/renderer/updateRuntime.ts`,
  Help → Check for Updates…, Settings → Updates group, command bar "Check for Updates".
- First run (3 steps, new profiles only; tests pass `firstrun=0`, `KITE_FIRST_RUN=1` forces it).
- Sidebar icon plates use a main-process icon fetch (`icon:pixels` IPC).
- Split View reuses an already-open Today tab instead of duplicating it.
- Cookie notices hidden by default for new profiles.
- Finish-review fixes: string = first-run progress; no spinners in the chrome (`.row-pending`);
  no stray "H" in the contour SVG; clock no longer repeats the date; drawn chevron on disclosures;
  cert errors: "Go back" primary, or "Close tab" when there is no history; hint "Drag a tab here
  to pin it"; dark accent calmed to `#e27aa8` (contrast checked on shell/card/surface-3).
- README.md, LAUNCH.md (new "Calm Air redesign" section), FEATURES.md updated.
- Last full results: typecheck clean · 388 unit · 336/336 UI (web) · real app 46/48 (the 2 are
  the known video app-switch tests that always fail in this IDE terminal; one routing test is
  flaky under suite load, passes 3/3 alone). impeccable detector: no findings.

## Appearance fix: DONE (26 Nov, ~09:40)

Settings agent finished the review's material fix: Color = Calm Air + 9 muted hues + "Custom…";
Background = None / Picture… / Gradient…; patterns under More options; same component in the Space
editor, Customize and first run; kite glyph `--ink-2`. Its checks: typecheck clean, 388 unit,
93/93 in specs 04/14/20/28/29/31/32/33. Captures: `.impeccable/review/desktop-settings-appearance-{light,dark}.png`.

## Since then (~09:50)

- Full checks after the Appearance fix: typecheck clean, 388 unit, UI 336/337 (01-tabs:204 load flake,
  passes 3/3 alone), build OK, real app 46/48 (known 2).
- Review evidence recaptured on the current build (`.impeccable/review/`: desktop-start-dark.png,
  small-error-dark.png, desktop-loading-string-dark.jpg, appearance light+dark).
- Verdict pass requested from the finish reviewer (id `a05ce55bc489a96e0`). Next: on "ship", step 3
  (DESIGN.md) and step 4 (final report) below; on "fix", apply and re-request.

## Finished

- Finish review: verdict **ship** (Appearance fix resolved; minor items resolved). Follow-up regression
  (two "More options" labels) fixed: "Patterns" and "More layout options".
- DESIGN.md + `.impeccable/design.json` written from the built system.
- Final: typecheck clean, 388 unit, 336/337 UI (one load flake, passes alone), real app 46/48 (known 2).
- Upgrade worktree removed; dev server stopped. Nothing committed.

## (old) TO DO to finish

1. After the Appearance work: `npm run typecheck`, `npx vitest run`,
   `npx playwright test -c playwright.web.config.ts --output=<scratch dir>`, `npm run build`,
   `env -u ELECTRON_RUN_AS_NODE npx playwright test -c playwright.electron.config.ts`.
2. Recapture `.impeccable/review/desktop-start-dark.jpg` and `small-error-dark.png` on the current
   build (they predate the "H" removal), then send the finish reviewer (id `a05ce55bc489a96e0`, or a
   fresh agent using `~/.claude/skills/impeccable/reference/degraded/finish-reviewer.md`) the new
   evidence for a verdict pass on: Appearance fix + the minor fixes above.
3. On "ship": write DESIGN.md + `.impeccable/design.json` with the impeccable documenter
   (`~/.claude/skills/impeccable/reference/degraded/documenter.md` + `reference/document.md`; there
   is no existing DESIGN.md, so no overwrite question).
4. Final report to the owner: before/after, what to provide — Apple Developer ID (signing,
   notarization, in-place updates, website notifications on Electron 42+), decision on DRM/Widevine
   (castlabs Electron fork + free EVS account), impeccable v4.11.0 available (`npx impeccable update`,
   in a later session). Unverified: cookie-notice list did not hide The Verge's notice in a 60 s test;
   starter Favorites' real icons in the first run; Windows/Linux builds.
5. Clean up when done: remove worktree `.claude/worktrees/agent-a17607a1375035bda`
   (`git worktree remove`), stray `vite.config.ts.timestamp-*.mjs` files (pre-existing, owner's),
   stop the dev server on :5174, delete the memory note `kite-redesign-handoff.md`.

## Not started (bigger features, for the owner to decide)

Private windows, multiple windows, tab hover previews, passwords/passkeys, import from
Chrome/Safari, DRM video, signed builds with in-place auto-update.
