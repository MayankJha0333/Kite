// Browsing history: the pages you visited, searchable and grouped by day.
// Recording happens in ops.ts (recordVisit); this file reads and prunes it.

import type { AppState, HistoryEntry } from './types';

export interface HistoryGroup {
  label: string;
  /** Start of that day, for stable keys. */
  day: number;
  items: HistoryEntry[];
}

export const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** The one day label, for History and the Archive: Today, Yesterday, then "Monday, November 23" (with the year once it is not this one). */
export function dayLabel(day: number, now: number): string {
  const today = startOfDay(now);
  if (day === today) return 'Today';
  if (day === startOfDay(today - 1)) return 'Yesterday';
  return new Date(day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: new Date(day).getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric' });
}

/** True when every word of the query appears in the title or address. */
export function historyMatches(h: HistoryEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${h.title} ${h.url}`.toLowerCase();
  return q.split(/\s+/).every((w) => hay.includes(w));
}

/**
 * History newest first, grouped by day. `limit` caps the number of entries
 * (the page shows more on demand), after filtering.
 */
export function groupHistory(entries: HistoryEntry[], now: number, query = '', limit = Infinity): HistoryGroup[] {
  const sorted = entries.filter((h) => historyMatches(h, query)).sort((a, b) => b.lastVisitAt - a.lastVisitAt).slice(0, limit);
  const groups: HistoryGroup[] = [];
  for (const h of sorted) {
    const day = startOfDay(h.lastVisitAt);
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.items.push(h);
    else groups.push({ label: dayLabel(day, now), day, items: [h] });
  }
  return groups;
}

/** How many entries match (for "n pages"). */
export function countHistory(entries: HistoryEntry[], query = ''): number {
  return entries.filter((h) => historyMatches(h, query)).length;
}

export function deleteHistoryEntry(s: AppState, url: string): void {
  s.history = s.history.filter((h) => h.url !== url);
}

/** Remove everything visited in the last `ms` milliseconds (null = everything). */
export function clearHistorySince(s: AppState, now: number, ms: number | null): number {
  const before = s.history.length;
  s.history = ms === null ? [] : s.history.filter((h) => h.lastVisitAt < now - ms);
  return before - s.history.length;
}
