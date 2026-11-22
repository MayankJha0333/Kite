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

describe('site icons', () => {
  it('a tab reporting its icon stamps it on the history of that site, and new visits inherit it', async () => {
    const { createInitialState } = await import('@shared/defaults');
    const { newTab, updateTab } = await import('@shared/ops');
    const { faviconIndex, knownFavicon } = await import('@shared/icons');
    const s = createInitialState();
    const id = newTab(s, { url: 'https://github.com/a', now: 1 });
    updateTab(s, id, { url: 'https://github.com/a', title: 'A' }, 2);
    recordVisit(s, 'https://github.com/a', 'A', 2);
    recordVisit(s, 'https://github.com/b', 'B', 3);
    updateTab(s, id, { favicon: 'data:icon' }, 4);
    expect(s.history.map((h) => h.favicon)).toEqual(['data:icon', 'data:icon']);
    recordVisit(s, 'https://github.com/c', 'C', 5);
    expect(s.history[0].favicon).toBe('data:icon');
    expect(faviconIndex(s.items, s.history).get('github.com')).toBe('data:icon');
    expect(knownFavicon(s, 'https://www.github.com/anything')).toBe('data:icon');
    expect(knownFavicon(s, 'https://other.com')).toBeUndefined();
  });

  it('an icon found for a site goes to its tabs and history entries that have none', async () => {
    const { createInitialState } = await import('@shared/defaults');
    const { newTab, rememberSiteIcon, recordVisit } = await import('@shared/ops');
    const s = createInitialState();
    const a = newTab(s, { url: 'https://stackoverflow.com/q/1', now: 1 });
    const b = newTab(s, { url: 'https://other.com', now: 2 });
    recordVisit(s, 'https://stackoverflow.com/', 'SO', 3);
    (s.items[a] as { favicon?: string }).favicon = 'data:own';
    rememberSiteIcon(s, 'https://stackoverflow.com/x', 'https://cdn/so.png');
    expect((s.items[a] as { favicon?: string }).favicon).toBe('data:own'); // a page's own icon is never replaced
    expect((s.items[b] as { favicon?: string }).favicon).toBeUndefined();
    expect(s.history[0].favicon).toBe('https://cdn/so.png');
  });
});

describe('iconFromHtml', () => {
  it('picks the declared icon, preferring SVG and larger sizes, and resolves it against the page', async () => {
    const { iconFromHtml } = await import('@shared/siteIcon');
    const html = `<html><head>
      <link rel="apple-touch-icon" sizes="180x180" href="/apple.png">
      <link rel="shortcut icon" href="/f.ico">
      <link rel="icon" type="image/png" sizes="32x32" href="/i32.png">
      <link rel='icon' sizes='192x192' href='https://cdn.example.net/i192.png?v=1&amp;x=2'>
      <link rel="stylesheet" href="/s.css"></head><body>`;
    expect(iconFromHtml(html, 'https://example.com/')).toBe('https://cdn.example.net/i192.png?v=1&x=2');
    expect(iconFromHtml('<link rel="icon" href="icon.svg">', 'https://example.com/a/')).toBe('https://example.com/a/icon.svg');
    expect(iconFromHtml('<link rel="icon" href="/i.svg"><link rel="icon" sizes="512x512" href="/i.png">', 'https://e.com/')).toBe('https://e.com/i.svg');
    expect(iconFromHtml('<link rel="stylesheet" href="/s.css">', 'https://example.com/')).toBeNull();
    expect(iconFromHtml('<link rel="icon" href="javascript:alert(1)">', 'https://example.com/')).toBeNull();
  });
});
