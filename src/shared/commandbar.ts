// What the command bar suggests for what you type.

import type { AppState, ID } from './types';
import { SEARCH_ENGINES } from './defaults';
import { activeItemId, displayTitle } from './ops';
import { flatVisible, ownerSplit, locate } from './tree';
import { hostOf, isNewTabUrl, looksLikeUrl, normalizeInput } from './url';

export interface ActionDef {
  id: string;
  title: string;
  keywords?: string;
}

/** Actions you can run by name from the command bar. */
export const ACTION_CATALOG: ActionDef[] = [
  { id: 'newNote', title: 'New Note', keywords: 'write text document' },
  { id: 'newFolder', title: 'New Folder', keywords: 'group' },
  { id: 'newSpace', title: 'New Space', keywords: 'workspace profile' },
  { id: 'newSplit', title: 'Add Split View', keywords: 'side by side pane' },
  { id: 'littleWindow', title: 'New Little Window', keywords: 'mini small popup' },
  { id: 'togglePin', title: 'Pin / Unpin Tab', keywords: 'keep' },
  { id: 'duplicateTab', title: 'Duplicate Tab', keywords: 'copy clone again' },
  { id: 'addFavorite', title: 'Add Tab to Favorites', keywords: 'favourite star' },
  { id: 'removeFavorite', title: 'Remove Tab from Favorites', keywords: 'favourite unstar' },
  { id: 'copyUrl', title: 'Copy URL', keywords: 'link clipboard' },
  { id: 'copyMarkdown', title: 'Copy URL as Markdown', keywords: 'link clipboard md title' },
  { id: 'sleepOthers', title: 'Put Other Tabs to Sleep', keywords: 'memory ram unload discard free speed' },
  { id: 'muteAll', title: 'Mute All Tabs', keywords: 'sound audio silence quiet' },
  { id: 'unmuteAll', title: 'Unmute All Tabs', keywords: 'sound audio' },
  { id: 'closeTab', title: 'Close Tab', keywords: 'remove' },
  { id: 'reopenClosed', title: 'Reopen Closed Tab', keywords: 'undo restore' },
  { id: 'back', title: 'Go Back', keywords: 'previous page' },
  { id: 'forward', title: 'Go Forward', keywords: 'next page' },
  { id: 'nextTab', title: 'Next Tab', keywords: 'switch cycle' },
  { id: 'prevTab', title: 'Previous Tab', keywords: 'switch cycle' },
  { id: 'nextSpace', title: 'Next Space', keywords: 'switch' },
  { id: 'prevSpace', title: 'Previous Space', keywords: 'switch' },
  { id: 'renameSpace', title: 'Rename This Space', keywords: 'name title' },
  { id: 'editSpace', title: 'Edit This Space', keywords: 'icon emoji color theme look' },
  { id: 'clearToday', title: 'Clear Unpinned Tabs', keywords: 'archive tidy clean' },
  { id: 'archivePage', title: 'Open Archive', keywords: 'old tabs' },
  { id: 'historyPage', title: 'History', keywords: 'visited pages sites recent browsing' },
  { id: 'print', title: 'Print Page', keywords: 'printer pdf' },
  { id: 'savePage', title: 'Save Page As…', keywords: 'download html file offline' },
  { id: 'viewSource', title: 'View Page Source', keywords: 'html code developer' },
  { id: 'zoomIn', title: 'Zoom In', keywords: 'bigger larger text' },
  { id: 'zoomOut', title: 'Zoom Out', keywords: 'smaller text' },
  { id: 'zoomReset', title: 'Reset Zoom', keywords: 'actual size 100%' },
  { id: 'toggleSidebar', title: 'Show / Hide Sidebar', keywords: 'focus' },
  { id: 'collapseFolders', title: 'Collapse All Folders', keywords: '' },
  { id: 'expandFolders', title: 'Expand All Folders', keywords: '' },
  { id: 'settings', title: 'Settings', keywords: 'preferences options open' },
  { id: 'shortcutsPanel', title: 'Keyboard Shortcuts', keywords: 'keys hotkeys' },
  { id: 'boostEditor', title: 'Boost This Site', keywords: 'css style customize zap' },
  { id: 'boostsPanel', title: 'Manage Boosts', keywords: 'css style' },
  { id: 'routingPanel', title: 'Link Routing', keywords: 'air traffic route rules' },
  { id: 'routeSiteHere', title: 'Always Open This Site in This Space', keywords: 'link routing rule air traffic' },
  { id: 'downloadsPanel', title: 'Downloads', keywords: 'files saved video image media save' },
  { id: 'extensionsPanel', title: 'Extensions', keywords: 'chrome addons plugins web store' },
  { id: 'privacyPanel', title: 'Privacy & Security', keywords: 'shields ads blocker cookies permissions https clear data' },
  { id: 'toggleShields', title: 'Turn Shields On / Off', keywords: 'ad blocker ads trackers adblock' },
  { id: 'siteInfo', title: 'About This Site', keywords: 'security lock certificate permissions cookies' },
  { id: 'importArc', title: 'Import from Arc', keywords: 'migrate spaces tabs' },
  { id: 'customize', title: 'Customize Kite', keywords: 'look layout theme appearance sidebar density corners margin motion personalise personalize preset' },
  { id: 'welcome', title: 'Welcome to Kite', keywords: 'tour setup start onboarding theme preset first' },
  { id: 'toggleTheme', title: 'Toggle Light / Dark', keywords: 'theme appearance night' },
  { id: 'findInPage', title: 'Find in Page', keywords: 'search' },
  { id: 'reload', title: 'Reload Page', keywords: 'refresh' },
  { id: 'hardReload', title: 'Force Refresh the Page', keywords: 'reload cache hard' },
  { id: 'stopLoading', title: 'Stop Loading', keywords: 'cancel' },
  { id: 'renameCurrent', title: 'Rename Current Item', keywords: 'tab folder note title' },
  { id: 'resetToHome', title: 'Reset Tab to Original URL', keywords: 'pinned home back' },
  { id: 'setHomeHere', title: 'Make This Page the Pinned Page', keywords: 'home original url keep' },
  { id: 'resetSpaceTabs', title: 'Reset All Tabs in This Space', keywords: 'pinned home back every' },
  { id: 'togglePinnedSection', title: 'Collapse / Expand Pinned Section', keywords: 'fold hide pinned tabs' },
  { id: 'clearCookiesRefresh', title: 'Clear Cookies and Refresh', keywords: 'site data sign out reload' },
  { id: 'clearCacheRefresh', title: 'Clear Cache and Refresh', keywords: 'stale reload hard' },
  { id: 'capture', title: 'Capture', keywords: 'screenshot snap image picture' },
  { id: 'captureFull', title: 'Capture Full Page', keywords: 'screenshot whole scroll image' },
  { id: 'setDefaultBrowser', title: 'Set as Default Browser', keywords: 'links open with kite' },
  { id: 'checkUpdates', title: 'Check for Updates', keywords: 'version new release upgrade' },
  { id: 'unsplit', title: 'Separate Split View', keywords: 'unsplit' },
  { id: 'flipSplit', title: 'Flip Split View', keywords: 'stack vertical horizontal side by side rows columns' },
  { id: 'popOutVideo', title: 'Pop Out Video', keywords: 'picture in picture pip floating player' },
  { id: 'toggleMute', title: 'Mute / Unmute Tab', keywords: 'sound audio silence' },
];

/** What an empty command bar offers under the recent tabs: the four things a newcomer looks for. */
export const STARTER_ACTIONS = ['newSpace', 'newSplit', 'settings', 'customize'];

export type Suggestion =
  | { kind: 'open'; key: string; title: string; url: string }
  | { kind: 'search'; key: string; title: string; url: string; engine: string }
  | { kind: 'tab'; key: string; title: string; url: string; itemId: ID; spaceId: ID | null; spaceName: string }
  | { kind: 'note'; key: string; title: string; itemId: ID; spaceId: ID | null; spaceName: string }
  | { kind: 'history'; key: string; title: string; url: string }
  | { kind: 'action'; key: string; title: string; actionId: string }
  | { kind: 'space'; key: string; title: string; spaceId: ID; icon: string };

/** Sites that show the same title for many URLs: only one result per title+host. */
const DEDUPE_BY_TITLE: string[] = ['figma.com', 'notion.so', 'github.com', 'docs.google.com', 'maps.google.com', 'zoom.us', 'linear.app'];

/** The search engine's name for "Search Google for …": its label if it is one Kite knows, else its site name. */
export function searchEngineName(template: string): string {
  const known = SEARCH_ENGINES.find((e) => e.template === template);
  if (known) return known.label;
  const name = hostOf(template.replace('%s', 'x')).replace(/^(www|search)\./, '').split('.')[0];
  return name ? name[0].toUpperCase() + name.slice(1) : 'the web';
}

interface Match {
  score: number;
  ranges: [number, number][];
}

const SEPARATOR = /[^\p{L}\p{N}]/u;

/** A word starts at the beginning, after anything that isn't a letter or digit, and at a capital inside a word (the H of GitHub). */
function wordStart(text: string, i: number): boolean {
  if (i === 0) return true;
  if (SEPARATOR.test(text[i])) return false;
  if (SEPARATOR.test(text[i - 1])) return true;
  return text[i] !== text[i].toLowerCase() && text[i - 1] === text[i - 1].toLowerCase();
}

/** Where `q` occurs in `t` at the start of a word, from `from` on (-1 if nowhere). */
function atWordStart(text: string, t: string, q: string, from = 0): number {
  for (let i = t.indexOf(q, from); i >= 0; i = t.indexOf(q, i + 1)) if (wordStart(text, i)) return i;
  return -1;
}

/**
 * How `text` matches the query, or null.
 *
 * Whole > prefix > start of a word > every typed word found > inside a word. Past those,
 * only when `loose`: initials ("hn" for Hacker News), then letters in order with one or two
 * skipped ("gthub"), which needs four letters or more. Three scattered letters match half
 * of everything, so short queries have to be contiguous or sit on word starts.
 */
function match(query: string, text: string, loose: boolean): Match | null {
  const q = query.trim().toLowerCase();
  const t = text.toLowerCase();
  if (!q) return { score: 1, ranges: [] };
  // A few letters change length when lowercased; positions would no longer line up.
  if (!t || t.length !== text.length) return t === q ? { score: 100, ranges: [[0, text.length]] } : null;
  if (t === q) return { score: 100, ranges: [[0, t.length]] };
  if (t.startsWith(q)) return { score: 90 - Math.min(10, t.length / 20), ranges: [[0, q.length]] };
  const word = atWordStart(text, t, q);
  if (word >= 0) return { score: 70 - Math.min(10, word / 8), ranges: [[word, word + q.length]] };

  const words = q.split(/\s+/);
  if (words.length > 1) {
    const ranges: [number, number][] = [];
    for (const w of words) {
      const at = atWordStart(text, t, w) >= 0 ? atWordStart(text, t, w) : w.length >= 3 ? t.indexOf(w) : -1;
      if (at < 0) return null;
      ranges.push([at, at + w.length]);
    }
    return { score: 50, ranges: ranges.sort((a, b) => a[0] - b[0]) };
  }

  if (q.length >= 3) {
    const at = t.indexOf(q);
    if (at >= 0) return { score: 40 - Math.min(10, at / 8), ranges: [[at, at + q.length]] };
  }
  if (!loose || q.length < 2) return null;

  // Initials of words that follow one another.
  const starts: number[] = [];
  for (let i = 0; i < t.length; i++) if (wordStart(text, i)) starts.push(i);
  for (let s = 0; s + q.length <= starts.length; s++) {
    if ([...q].every((ch, k) => t[starts[s + k]] === ch)) return { score: 25, ranges: [...q].map((_, k) => [starts[s + k], starts[s + k] + 1] as [number, number]) };
  }

  // Letters in order from the start of a word, with at most a couple skipped in between.
  if (q.length < 4) return null;
  const allowed = Math.floor(q.length / 2);
  let found: Match | null = null;
  for (const s of starts) {
    if (t[s] !== q[0]) continue;
    const ranges: [number, number][] = [[s, s + 1]];
    let gaps = 0;
    let i = 1;
    for (let j = s + 1; j < t.length && i < q.length && gaps <= allowed; j++) {
      if (t[j] !== q[i]) {
        gaps++;
        continue;
      }
      const last = ranges[ranges.length - 1];
      if (last[1] === j) last[1] = j + 1;
      else ranges.push([j, j + 1]);
      i++;
    }
    if (i === q.length && gaps <= allowed && (!found || 20 - gaps * 3 > found.score)) found = { score: Math.max(1, 20 - gaps * 3), ranges };
  }
  return found;
}

/** How well text matches the query, 0 = no match. `loose` also accepts initials and a skipped letter. */
export function matchScore(query: string, text: string, loose = true): number {
  return match(query, text, loose)?.score ?? 0;
}

/** Positions in `text` to set in bold for the query: the same letters matchScore counted. */
export function matchRanges(query: string, text: string, loose = true): [number, number][] {
  return match(query, text, loose)?.ranges ?? [];
}

/** A match good enough to act on without reading the rest: the whole text or its beginning. */
const STRONG = 80;
/** A match on a whole word (or on every typed word). */
const GOOD = 50;

const tier = (score: number) => (score >= STRONG ? 3 : score >= GOOD ? 2 : 1);

export interface SuggestOptions {
  limit?: number;
  /** Actions available right now (some depend on there being an open tab). */
  actions?: ActionDef[];
}

export function suggest(s: AppState, query: string, o: SuggestOptions = {}): Suggestion[] {
  const limit = o.limit ?? 8;
  const q = query.trim();
  const actions = o.actions ?? ACTION_CATALOG;
  const spaceName = (id: ID | null) => s.spaces.find((x) => x.id === id)?.name ?? 'Favorites';

  // What is on screen now is never offered: you are already there.
  const current = activeItemId(s);
  const here = new Set<ID>(current ? [current] : []);
  const shown = current ? s.items[current] : null;
  if (shown?.kind === 'split') for (const p of shown.panes) here.add(p);

  // Every other tab you could switch to (including ones inside split views).
  const tabs: (Extract<Suggestion, { kind: 'tab' }> & { kept: boolean })[] = [];
  const openUrls = new Set<string>();
  for (const it of Object.values(s.items)) {
    if (it.kind !== 'tab') continue;
    const loc = locate(s, it.id) ?? (ownerSplit(s, it.id) ? locate(s, ownerSplit(s, it.id)!.id) : null);
    if (!loc) continue;
    openUrls.add(it.url);
    if (here.has(it.id) || isNewTabUrl(it.url)) continue;
    tabs.push({ kind: 'tab', key: `tab:${it.id}`, title: displayTitle(it), url: it.url, itemId: it.id, spaceId: loc.spaceId, spaceName: spaceName(loc.spaceId), kept: loc.list !== 'today' });
  }
  const plain = ({ kept: _kept, ...t }: (typeof tabs)[number]): Suggestion => t;

  if (!q) {
    // Nothing typed: the tabs of this Space you used last, then a few things worth knowing about.
    const order = flatVisible(s, s.activeSpaceId, true);
    const recent = tabs
      .filter((t) => order.includes(t.itemId) || (ownerSplit(s, t.itemId) && order.includes(ownerSplit(s, t.itemId)!.id)))
      .sort((a, b) => (s.items[b.itemId] as { lastActiveAt: number }).lastActiveAt - (s.items[a.itemId] as { lastActiveAt: number }).lastActiveAt)
      .slice(0, 5)
      .map(plain);
    const starters = STARTER_ACTIONS.flatMap((id) => actions.filter((a) => a.id === id)).map((a): Suggestion => ({ kind: 'action', key: `act:${a.id}`, title: a.title, actionId: a.id }));
    return [...recent, ...starters];
  }

  // Open tabs first, then pinned tabs and Favorites, history, actions, Spaces — among matches
  // that are equally good. A better match always comes before a worse one.
  const scored: { sug: Suggestion; tier: number; rank: number; score: number }[] = [];
  const add = (sug: Suggestion, raw: number, rank: number, bonus = 0) => {
    if (raw > 0) scored.push({ sug, tier: tier(raw), rank, score: raw + bonus });
  };
  const seenTitleHost = new Set<string>();

  for (const t of tabs) {
    add(plain(t), Math.max(matchScore(q, t.title), matchScore(q, hostOf(t.url)), matchScore(q, t.url, false)), t.kept ? 1 : 0, t.spaceId === s.activeSpaceId ? 3 : 0);
  }
  for (const it of Object.values(s.items)) {
    if (it.kind !== 'note' || here.has(it.id)) continue;
    const loc = locate(s, it.id);
    if (!loc) continue;
    add({ kind: 'note', key: `note:${it.id}`, title: it.title, itemId: it.id, spaceId: loc.spaceId, spaceName: spaceName(loc.spaceId) }, matchScore(q, it.title), loc.list === 'today' ? 0 : 1);
  }
  for (const h of s.history.slice(0, 2000)) {
    if (openUrls.has(h.url)) continue;
    const host = hostOf(h.url);
    if (DEDUPE_BY_TITLE.some((d) => host === d || host.endsWith(`.${d}`))) {
      const key = `${h.title}|${host}`;
      if (seenTitleHost.has(key)) continue;
      seenTitleHost.add(key);
    }
    add({ kind: 'history', key: `hist:${h.url}`, title: h.title || h.url, url: h.url }, Math.max(matchScore(q, h.title), matchScore(q, host), matchScore(q, h.url, false)), 2, Math.min(10, Math.log2(1 + h.visits) * 2));
  }
  for (const a of actions) {
    // Keywords are other names for the action, so only a whole word of them counts.
    const byKeyword = matchScore(q, a.keywords ?? '', false);
    add({ kind: 'action', key: `act:${a.id}`, title: a.title, actionId: a.id }, Math.max(matchScore(q, a.title), byKeyword >= GOOD ? GOOD + 5 : 0), 3);
  }
  for (const sp of s.spaces) {
    if (sp.id === s.activeSpaceId) continue;
    add({ kind: 'space', key: `space:${sp.id}`, title: `Go to ${sp.name}`, spaceId: sp.id, icon: sp.icon }, matchScore(q, sp.name), 4);
  }
  scored.sort((a, b) => b.tier - a.tier || a.rank - b.rank || b.score - a.score);

  const out: Suggestion[] = [];
  const isUrl = looksLikeUrl(q);
  const engine = searchEngineName(s.settings.searchEngine);
  const searchUrl = normalizeInput(q, s.settings.searchEngine);
  const search: Suggestion = { kind: 'search', key: 'search', title: q, engine, url: isUrl ? normalizeInput(q.replace(/^\w+:\/\//, '').replace(/\./g, ' '), s.settings.searchEngine) : searchUrl };
  if (isUrl) out.push({ kind: 'open', key: 'open', title: q, url: normalizeInput(q, s.settings.searchEngine) });
  // Enter goes to the best match when it is plainly what was meant: something that starts
  // with what you typed, or an open tab with that word in its name. Otherwise Enter searches.
  const top = scored[0];
  const strongTop = top && (top.tier === 3 || (top.tier === 2 && (top.sug.kind === 'tab' || top.sug.kind === 'note')));
  if (strongTop && !isUrl) out.push(scored.shift()!.sug);
  if (!isUrl) out.push(search);
  // No kind may fill the list by itself: a hundred history hits must not push every action out.
  const room = [4, 3, 3, 3, 2];
  for (const x of scored) {
    if (out.length >= limit) break;
    if (room[x.rank] <= 0 || out.some((o2) => o2.key === x.sug.key)) continue;
    room[x.rank]--;
    out.push(x.sug);
  }
  if (isUrl && out.length < limit) out.push(search);
  return out.slice(0, limit);
}
