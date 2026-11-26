import { readFileSync, writeFileSync } from 'node:fs';
const rules = JSON.parse(readFileSync('rules.json', 'utf8'));
const decls = JSON.parse(readFileSync('decls.json', 'utf8'));
const cls = JSON.parse(readFileSync('classes4.json', 'utf8'));
const S = [
[1,52,'Reset/base: box-sizing, html/body/#root, body.resizing/dragging, button, kbd, .boot'],
[53,69,'App frame: .app root, [data-side=right]'],
[70,126,'Design tokens on .app (--r-*, --ease-*, --t-*, --elev-*), dark elevs, .grain, .pattern, .drag/.no-drag'],
[127,311,'Sidebar shell: .sidebar (+collapsed/peek), .edge-hotzone, .sb-top, .icon-btn (SHARED), .url-pill, .sb-scroll, .sb-section'],
[312,413,'Favorites grid/tiles'],
[414,463,'Space header'],
[464,888,'Rows: .row, drop indicators, folders, .drag-ghost badge, row parts, .rename, .site-icon (SHARED), list-end/drop-hint, .hint, .sb-divider/.sb-clear, .sb-footer, .space-bar/.space-dot, .sb-resizer'],
[889,984,'Stage + page card: .stage, drag strip, .card, .surface-slot/.surface, .load-bar'],
[985,1067,'Empty state (old): .empty*, kite-land'],
[1068,1084,'STRAGGLER: Reduce Motion (data-motion=reduced) global block'],
[1085,1113,'Find bar'],
[1114,1188,'Command bar shell: .cb-scrim, keyframes fade-in/fade-up/pop-in (SHARED), .cb, .cb-input-row, .cb-input'],
[1189,1358,'Menus + toasts: .menu*, .toasts/.toast, .spin, .kite-logo, .drag-ghost, body.dragging .surface, .space-more, .folder-row glyph'],
[1359,1417,'Spaces: .space-pane slide, .space-dot-wrap, .space-rename, .space-add'],
[1418,1491,'Sheets: .sheet-scrim, .sheet, head/title/sub/body/foot, .spacer'],
[1492,1534,'Welcome tour'],
[1535,1734,'FORM CONTROLS (SHARED): .btn(+primary/danger/small), .field*, .input, .segmented, .toggle, .range'],
[1735,1841,'New-Space sheet bits: .space-preview, .emoji*, .swatches/.swatch/.swatch-custom'],
[1842,1898,'Shared text bits: .link, .muted, .btn.danger-solid, .search-box, .empty-list'],
[1899,1976,'Archive/History list: .arch-*'],
[1977,2118,'Command bar results: .cb-badge, .cb-list, .cb-row*, .cb-foot …'],
[2119,2277,'Split view: .surface-slot[data-split], .split-chrome, .pane-*, .icon-btn.tiny (SHARED), .split-divider, body.resizing*, .card[data-split]'],
[2278,2358,'Peek: .peek-scrim, .peek, .peek-bar, .btn.ghost (SHARED), .peek-body'],
[2359,2459,'Little window'],
[2460,2592,'Boosts: .boost-*, .url-boost, .zap-*, .chip (SHARED), .warn, .inline-form (SHARED), .field-inline'],
[2593,2640,'Routing (Air Traffic Control)'],
[2641,2852,'Notes editor'],
[2853,2934,'Import from Arc'],
[2935,2975,'Kite page shell: .kite-page, page-in, .page-close, .app[data-page] overrides'],
[2976,3232,'Settings chrome: .settings, bar/tabs/search, main/body/section, intro, @container 920/760'],
[3233,3401,'Settings cards/rows: .set-group-*, .set-card, .set-row*, .set-link …'],
[3402,3516,'Settings misc: .shields-status-wrap, .keys/.key-*, .danger-zone, .about*'],
[3517,3543,'.sheet max-height (STRAGGLER) + @container 720 settings'],
[3544,3570,'Playing/muted indicator (.row-sound) + .field-inline[data-off]'],
[3571,3971,'Floating video controls: .pipd* (own window), reduced-motion media'],
[3972,4165,'Mini player: .pipm*, reduced-motion media'],
[4166,4185,'Sleeping tabs (.row[data-asleep])'],
[4186,4359,'MOTION: sheet-in, scrims, docked sheet (Customize), .cz-toggles, cb none, menu-in, toast-in, blur-in/rise-in, sidebar peek, press/hover transitions (.btn,.icon-btn,.space-dot,.set-link,.row,.fav), toggle, settings stagger, [data-off]'],
[4360,4449,'Address bar: .url-sec, .url-text/host/path, .url-shield'],
[4450,4542,'Site info popover'],
[4543,4607,'Load error page'],
[4608,4802,'Downloads'],
[4803,4914,'Extensions'],
[4915,4982,'Mixed: .shields-status, .chip-list, .perm-*, .space-isolated/.space-badge, reduced dl-bar'],
[4983,5020,'Audit fixes: global :focus-visible ring, .input focus, .sb-top-btns flex, @media 900, prefers-contrast'],
[5021,5109,'Details: svg.lucide stroke, ::selection, scrollbars, .range, prefers-reduced-motion, hit-flash, chip-list:empty, cb/find focus, settings button lit'],
[5110,5133,'DEAD keyframes bg-drift/swirl/spin/breathe/hue'],
[5134,5152,'.settings-scope chip'],
[5153,5240,'Settings → Spaces: .space-picker/.space-pick*, set-row emoji overrides'],
[5241,5556,'Start page: .start, greeting, search box, suggest list, sections, tiles, foot, .site-icon.newtab'],
[5557,5570,'STRAGGLER: toast leaving + toast-out'],
[5571,5587,'STRAGGLER: .cb-brand + brand-tilt'],
[5588,5609,'Empty states shared: .empty-state-*'],
[5610,5633,'STRAGGLER: sheet/kite-page leaving, fade-out, sheet-out'],
[5634,5683,'Brand chip (.start-brand,.cb-brand), tile names, start[data-tone] (1st copy)'],
[5684,5736,'Colour wheel (theme editor)'],
[5737,5874,'Settings → Ad blocking'],
[5875,5950,'Site popover: what was blocked (+ .adblock)'],
[5951,5968,'Find bar match count'],
[5969,5977,'Address bar zoom chip'],
[5978,5985,'History tweaks (.hist-row, .search-box .icon-btn.tiny)'],
[5986,6000,'About details'],
[6001,6066,'Crash screen (.app-crash*) + .lazy-wait'],
[6067,6134,'View Page Source'],
[6135,6157,'Guidelines pass: overscroll containment list, text-wrap balance list, menu origin'],
[6158,6238,'Home: scene bg, tone overrides (2nd copy), engine chip, add-shortcut tile, shortcut editor'],
[6239,6454,'Home widgets: .home-widgets, .widget*, .wg-*, .home-fab'],
[6455,6491,'Shared: .look-h, .look-inline-range'],
[6492,6543,'Theme editor: .theme-controls, .swatch-rows, .set-theme'],
[6544,6573,'STRAGGLER sidebar: .sb-pin-toggle'],
[6574,6585,'STRAGGLER sidebar: frosted sidebar over a picture'],
[6586,6639,'Theme editor: backdrop tiles'],
[6640,6650,'STRAGGLER sidebar: pin chevron over divider'],
[6651,6670,'STRAGGLER home: start-foot over a picture'],
[6671,6683,'.visually-hidden utility'],
[6684,6710,'Theme editor: upload tile'],
[6711,6785,'Theme editor: gradient editor'],
[6786,6841,'STRAGGLER downloads: segmented bar, bolt, add-URL field'],
];
// sanity: contiguous
for (let i = 1; i < S.length; i++) if (S[i][0] !== S[i - 1][1] + 1) console.log('GAP/OVERLAP at', S[i - 1], S[i]);
const short = (f) => f.replace('renderer/components/', '').replace('renderer/', '').replace('.tsx', '');
for (const [a, b, name] of S) {
  const rs = rules.filter((r) => r.line >= a && r.line <= b);
  const dn = decls.filter((d) => d.line >= a && d.line <= b).length;
  const files = new Map();
  const classesIn = new Set();
  for (const r of rs) for (const m of r.sel.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)) classesIn.add(m[1]);
  for (const c of classesIn) for (const f of (cls[c]?.attr ?? [])) files.set(short(f), (files.get(short(f)) ?? 0) + 1);
  const top = [...files.entries()].sort((x, y) => y[1] - x[1]).slice(0, 7).map(([f, n]) => `${f}(${n})`).join(', ');
  console.log(`${a}-${b} | ${name} | rules ${rs.length}, decls ${dn} | ${top}`);
}
writeFileSync('sections.json', JSON.stringify(S));
