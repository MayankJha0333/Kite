import { describe, expect, it } from 'vitest';
import { clearHistorySince, countHistory, deleteHistoryEntry, groupHistory, historyMatches } from '@shared/history';
import { createInitialState } from '@shared/defaults';
import { recordVisit } from '@shared/ops';
import type { HistoryEntry } from '@shared/types';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = new Date(2026, 10, 17, 21, 0).getTime();
const e = (url: string, title: string, ago: number, visits = 1): HistoryEntry => ({ url, title, visits, lastVisitAt: now - ago });

describe('history', () => {
  const entries = [e('https://a.com/x', 'Alpha', HOUR), e('https://b.com', 'Beta site', 2 * HOUR), e('https://c.com/docs', 'Gamma docs', DAY + HOUR), e('https://old.com', 'Old', 9 * DAY)];

  it('groups by day, newest first, with Today / Yesterday labels', () => {
    const g = groupHistory(entries, now);
    expect(g.map((x) => x.label)).toEqual(['Today', 'Yesterday', expect.stringMatching(/\w+/)]);
    expect(g[0].items.map((x) => x.url)).toEqual(['https://a.com/x', 'https://b.com']);
    expect(g[1].items[0].title).toBe('Gamma docs');
  });

  it('search matches every word against title or address', () => {
    expect(historyMatches(entries[2], 'gamma docs')).toBe(true);
    expect(historyMatches(entries[2], 'c.com docs')).toBe(true);
    expect(historyMatches(entries[2], 'gamma beta')).toBe(false);
    expect(groupHistory(entries, now, 'beta').flatMap((g) => g.items).map((x) => x.url)).toEqual(['https://b.com']);
    expect(countHistory(entries, 'com')).toBe(4);
  });

  it('a limit caps the entries after filtering', () => {
    const g = groupHistory(entries, now, '', 2);
    expect(g.flatMap((x) => x.items)).toHaveLength(2);
    expect(countHistory(entries)).toBe(4);
  });

  it('entries can be removed one by one or by time span', () => {
    const s = createInitialState();
    s.history = entries.map((x) => ({ ...x }));
    deleteHistoryEntry(s, 'https://b.com');
    expect(s.history.map((x) => x.url)).not.toContain('https://b.com');
    expect(clearHistorySince(s, now, DAY)).toBe(1); // only "Alpha" is from the last 24 hours
    expect(s.history.map((x) => x.url)).toEqual(['https://c.com/docs', 'https://old.com']);
    expect(clearHistorySince(s, now, null)).toBe(2);
    expect(s.history).toEqual([]);
  });

  it('visits are recorded only for web pages, and repeat visits count up', () => {
    const s = createInitialState();
    recordVisit(s, 'kite://newtab', 'New Tab', now);
    recordVisit(s, 'view-source:https://a.com', 'src', now);
    recordVisit(s, 'https://a.com', 'A', now - 10);
    recordVisit(s, 'https://a.com', 'A again', now);
    expect(s.history).toEqual([{ url: 'https://a.com', title: 'A again', visits: 2, lastVisitAt: now }]);
  });
});
