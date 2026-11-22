// Which icon a site has. Pages report their favicon as they load; open tabs keep it and
// history remembers it, so anywhere that shows a site (search suggestions, the home page
// tiles, the command bar, History) can show the real icon instead of a letter.

import type { AppState, HistoryEntry, Item } from './types';
import { hostOf } from './url';

export type FaviconIndex = Map<string, string>;

/** host → favicon, from open tabs first (freshest) and then history. */
export function faviconIndex(items: Record<string, Item>, history: HistoryEntry[]): FaviconIndex {
  const m: FaviconIndex = new Map();
  for (const h of history) {
    if (!h.favicon) continue;
    const host = hostOf(h.url);
    if (host && !m.has(host)) m.set(host, h.favicon);
  }
  for (const it of Object.values(items)) {
    if (it.kind !== 'tab' || !it.favicon) continue;
    const host = hostOf(it.url);
    if (host) m.set(host, it.favicon);
  }
  return m;
}

let cache: { items: Record<string, Item>; history: HistoryEntry[]; index: FaviconIndex } | null = null;

/** The index for a state, rebuilt only when tabs or history change. */
export function faviconIndexOf(s: Pick<AppState, 'items' | 'history'>): FaviconIndex {
  if (!cache || cache.items !== s.items || cache.history !== s.history) cache = { items: s.items, history: s.history, index: faviconIndex(s.items, s.history) };
  return cache.index;
}

/** The icon known for a page's site, if any. */
export function knownFavicon(s: Pick<AppState, 'items' | 'history'>, url: string): string | undefined {
  const host = hostOf(url);
  return host ? faviconIndexOf(s).get(host) : undefined;
}
