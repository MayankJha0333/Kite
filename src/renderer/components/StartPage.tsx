// The home page: what a new tab shows (and what Kite shows with nothing open).
//
// Top to bottom: a quiet greeting, the search box (with the engine you search with,
// switchable in place), your shortcuts (Favorites, plus the sites you visit most) and
// the widgets you've placed. A "+" in the corner adds widgets and shortcuts and sets
// the scene behind it all. Everything is saved with the rest of Kite's data.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, CornerDownLeft, Plus } from 'lucide-react';
import { formatShortcut } from '@shared/shortcuts';
import type { HistoryEntry, ID, Item } from '@shared/types';
import * as ops from '@shared/ops';
import { displayUrl, hostOf, isNewTabUrl, normalizeInput } from '@shared/url';
import { SEARCH_ENGINES } from '@shared/defaults';
import { updateSettings } from '@shared/settings';
import { WIDGET_KINDS, addWidget } from '@shared/home';
import { BACKDROPS, backdropById, backdropPatch } from '@shared/backdrops';
import { setSpaceTheme } from '@shared/spaces';
import { activeSpace } from '@shared/tree';
import { backdropUrl } from '../backdrops';
import { useImageUrl } from '../images';
import { gradientLuma, gradientPatch, starterGradient } from '@shared/spaceTheme';
import { act, setUi, toast, useKite, type ContextMenuItem } from '../store';
import { navigateTab, openUrl, preconnectSoon, selectItem, undoable } from '../commands';
import { isMac, now } from '../platform';
import { KiteLogo } from './KiteLogo';
import { SiteIcon } from './SiteIcon';
import { openMenu } from './ContextMenu';
import { WidgetLayer, measureArea } from './home/WidgetLayer';

const MAX_TILES = 8;
const MAX_SUGGESTIONS = 6;

type TabItem = Extract<Item, { kind: 'tab' }>;

/** Names people actually call popular sites (the address alone gets these wrong). */
const KNOWN: Record<string, string> = {
  'mail.google.com': 'Gmail', 'docs.google.com': 'Docs', 'drive.google.com': 'Drive', 'calendar.google.com': 'Calendar', 'meet.google.com': 'Meet', 'maps.google.com': 'Maps',
  'news.ycombinator.com': 'Hacker News', 'youtube.com': 'YouTube', 'github.com': 'GitHub', 'gitlab.com': 'GitLab', 'linkedin.com': 'LinkedIn', 'x.com': 'X',
  'twitter.com': 'X', 'chatgpt.com': 'ChatGPT', 'claude.ai': 'Claude', 'figma.com': 'Figma', 'notion.so': 'Notion', 'web.whatsapp.com': 'WhatsApp',
  'en.wikipedia.org': 'Wikipedia', 'stackoverflow.com': 'Stack Overflow', 'reddit.com': 'Reddit', 'netflix.com': 'Netflix', 'amazon.com': 'Amazon', 'amazon.in': 'Amazon',
};

/** A short, human name for a site: a known name, its own short title, or its name from the address. */
export function siteName(url: string, title?: string): string {
  const host = hostOf(url).replace(/^www\./, '');
  if (KNOWN[host]) return KNOWN[host];
  const t = (title ?? '').trim();
  if (t && t.length <= 22 && !/[./:]/.test(t)) return t;
  const parts = host.split('.');
  const label = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || url;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function greeting(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Sites you visit most, skipping ones already in Favorites. */
function frequentSites(history: HistoryEntry[], skip: Set<string>): HistoryEntry[] {
  return [...history]
    .filter((h) => /^https?:/i.test(h.url) && !skip.has(hostOf(h.url)))
    .sort((a, b) => b.visits - a.visits || b.lastVisitAt - a.lastVisitAt)
    .filter((h, i, all) => all.findIndex((x) => hostOf(x.url) === hostOf(h.url)) === i)
    .slice(0, MAX_TILES);
}

const engineName = (template: string) => SEARCH_ENGINES.find((e) => e.template === template)?.label ?? (hostOf(template.replace('%s', 'x')).split('.')[0] || 'Custom');

export function StartPage({ tabId }: { tabId?: ID }) {
  const sc = useKite((st) => st.s.settings.shortcuts);
  const engine = useKite((st) => st.s.settings.searchEngine);
  const history = useKite((st) => st.s.history);
  const favIds = useKite((st) => st.s.favorites);
  const items = useKite((st) => st.s.items);
  const home = useKite((st) => st.s.home);
  const theme = useKite((st) => activeSpace(st.s).theme);
  const backdrop = theme.backdrop;
  const plain = !theme.backdrop && !theme.photo && !theme.gradient;
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(-1);
  const [editing, setEditing] = useState<null | { id?: ID; name: string; url: string }>(null);
  const input = useRef<HTMLInputElement>(null);
  const [today] = useState(() => new Date());

  // Ready to type the moment it appears, and when New Tab or the address bar is clicked again.
  useEffect(() => {
    const focus = () => input.current?.focus();
    const t = window.setTimeout(focus, 0);
    window.addEventListener('kite:focus-start', focus);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('kite:focus-start', focus);
    };
  }, []);

  const favorites = useMemo(() => favIds.map((id) => items[id]).filter((it): it is TabItem => it?.kind === 'tab').slice(0, MAX_TILES * 2), [favIds, items]);
  const frequent = useMemo(() => (home.showFrequent ? frequentSites(history, new Set(favorites.map((f) => hostOf(f.url)))) : []), [history, favorites, home.showFrequent]);
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return history.filter((h) => /^https?:/i.test(h.url) && (h.url.toLowerCase().includes(t) || h.title.toLowerCase().includes(t))).slice(0, MAX_SUGGESTIONS);
  }, [q, history]);

  /** Is this page a new tab that's still empty (vs. the window with nothing open)? */
  const emptyTab = () => {
    const tab = tabId ? useKite.getState().s.items[tabId] : null;
    return tab?.kind === 'tab' && isNewTabUrl(tab.url);
  };

  const go = (target: string) => {
    const t = target.trim();
    if (!t) return;
    if (tabId && emptyTab()) {
      const url = /^kite:/i.test(t) ? t : normalizeInput(t, useKite.getState().s.settings.searchEngine);
      if (url) navigateTab(tabId, url);
    } else openUrl(t, 'new');
    setQ('');
    setSel(-1);
  };

  /** A Favorite is a tab you keep: go to it, and drop the unused new tab. */
  const openFavorite = (id: ID) => {
    if (tabId && emptyTab()) act((d) => ops.closeItem(d, tabId, now()));
    selectItem(id);
  };

  const favoriteMenu = (e: React.MouseEvent, f: TabItem) => {
    openMenu(e, [
      { label: 'Open', onSelect: () => openFavorite(f.id) },
      { label: 'Open in New Tab', onSelect: () => openUrl(f.homeUrl ?? f.url, 'new') },
      { separator: true, label: '' },
      { label: 'Edit Shortcut…', testId: 'shortcut-edit', onSelect: () => setEditing({ id: f.id, name: f.customTitle ?? siteName(f.url, f.title), url: f.homeUrl ?? f.url }) },
      { label: 'Remove from Favorites', danger: true, testId: 'shortcut-remove', onSelect: () => undoable(`Removed “${siteName(f.url, f.customTitle ?? f.title)}” from Favorites`, (d) => void ops.removeFavorite(d, f.id)) },
    ]);
  };

  const saveShortcut = () => {
    if (!editing) return;
    const url = normalizeInput(editing.url, engine);
    if (!/^https?:\/\//i.test(url)) return toast('Type a web address, like example.com');
    const name = editing.name.trim();
    act((d) => {
      if (editing.id) {
        const t = d.items[editing.id];
        if (t?.kind === 'tab') {
          t.customTitle = name || undefined;
          if (url !== t.url) {
            t.url = url;
            t.homeUrl = url;
          }
        }
      } else {
        ops.newTab(d, { url, title: name || hostOf(url), now: now(), list: 'favorites', activate: false });
        const id = d.favorites[d.favorites.length - 1];
        const t = d.items[id];
        if (name && t?.kind === 'tab') t.customTitle = name;
      }
    });
    setEditing(null);
    toast(editing.id ? 'Shortcut updated' : 'Added to Favorites');
  };

  /** The "+" in the corner: widgets, shortcuts, the scene, what the page shows. */
  const customize = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const items: ContextMenuItem[] = [
      {
        label: 'Add Widget',
        testId: 'home-add-widget',
        submenu: WIDGET_KINDS.map((k) => ({
          label: k.name,
          hint: k.blurb,
          testId: `home-widget-${k.id}`,
          onSelect: () => {
            const id = act((d) => addWidget(d.home, k.id, measureArea()));
            if (!id) toast('That’s plenty of widgets for one page. Remove one to add another.');
          },
        })),
      },
      { label: 'Add Shortcut…', testId: 'home-add-shortcut', onSelect: () => setEditing({ name: '', url: '' }) },
      { separator: true, label: '' },
      {
        label: 'Background',
        testId: 'home-background',
        submenu: [
          { label: 'Space Colours', hint: plain ? '✓' : undefined, testId: 'home-bg-none', onSelect: () => act((d) => setSpaceTheme(d, d.activeSpaceId, backdropPatch(null))) },
          { label: 'Gradient', hint: theme.gradient ? '✓' : undefined, testId: 'home-bg-gradient', onSelect: () => act((d) => setSpaceTheme(d, d.activeSpaceId, gradientPatch(starterGradient(theme)))) },
          { separator: true, label: '' },
          ...BACKDROPS.map((b) => ({ label: b.name, hint: b.id === backdrop ? '✓' : undefined, testId: `home-bg-${b.id}`, onSelect: () => act((d) => setSpaceTheme(d, d.activeSpaceId, backdropPatch(b.id))) })),
          { separator: true, label: '' },
          { label: 'Edit Theme…', onSelect: () => setUi({ panel: 'settings', panelArg: 'spaces' }) },
        ],
      },
      { label: home.showGreeting ? 'Hide Greeting' : 'Show Greeting', onSelect: () => act((d) => void (d.home.showGreeting = !d.home.showGreeting)) },
      { label: home.showFrequent ? 'Hide Frequently Visited' : 'Show Frequently Visited', testId: 'home-toggle-frequent', onSelect: () => act((d) => void (d.home.showFrequent = !d.home.showFrequent)) },
      { label: home.showHints ? 'Hide Shortcut Hints' : 'Show Shortcut Hints', onSelect: () => act((d) => void (d.home.showHints = !d.home.showHints)) },
      { separator: true, label: '' },
      { label: 'Remove All Widgets', danger: true, disabled: !home.widgets.length, onSelect: () => undoable('Widgets removed', (d) => void (d.home.widgets = [])) },
    ];
    openMenu({ clientX: r.right - 240, clientY: r.top - 8 }, items);
  };

  const pickEngine = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openMenu({ clientX: r.left, clientY: r.bottom + 6 }, [
      ...SEARCH_ENGINES.map((en) => ({
        label: en.label,
        hint: en.template === engine ? '✓' : undefined,
        testId: `home-engine-${en.label}`,
        onSelect: () => {
          act((d) => updateSettings(d, { searchEngine: en.template, searchEngineChosen: true }));
          toast(`Searching with ${en.label}`);
          input.current?.focus();
        },
      })),
      { separator: true, label: '' },
      { label: 'Other search engine…', onSelect: () => setUi({ panel: 'settings', panelArg: 'links' }) },
    ]);
  };

  const hasTiles = favorites.length > 0 || frequent.length > 0;
  let tileIndex = 0;

  // The Space's background behind the whole page: a built-in picture, your own, or your gradient at full strength.
  const builtIn = backdropById(backdrop);
  const photoUrl = useImageUrl(theme.photo?.id);
  const bg = theme.photo
    ? photoUrl && { id: 'photo', tone: theme.photo.tone, image: `url("${photoUrl}")` }
    : builtIn
      ? { id: builtIn.id, tone: builtIn.tone, image: `url("${backdropUrl(builtIn.id)}")` }
      : theme.gradient
        ? { id: 'gradient', tone: gradientLuma(theme.gradient) < 0.42 ? ('dark' as const) : ('light' as const), image: `linear-gradient(${theme.gradient.angle}deg, ${theme.gradient.colors.join(', ')})` }
        : null;
  const tone = bg ? bg.tone : undefined;

  return (
    <>
    <div className="start" data-testid={tabId ? 'start-page' : 'empty-state'} data-backdrop={bg ? bg.id : undefined} data-tone={tone}>
      {bg && <div className="start-bg" aria-hidden="true" data-testid="start-bg" style={{ backgroundImage: bg.image }} />}
      <div className="start-inner">
        {home.showGreeting && (
          <header className="start-hello">
            <h1 className="start-greet">{greeting(today.getHours())}</h1>
            <p className="start-date">{today.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </header>
        )}

        <div className="start-box" data-open={matches.length > 0 || undefined}>
          <label className="start-search" data-testid={tabId ? undefined : 'empty-search'}>
            <span className="start-brand" aria-hidden="true">
              <KiteLogo size={22} />
            </span>
            <input
              ref={input}
              className="start-input"
              data-testid="start-input"
              placeholder="Search or enter address"
              aria-label="Search or enter address"
              autoComplete="off"
              spellCheck={false}
              value={q}
              role="combobox"
              aria-expanded={matches.length > 0}
              aria-controls="start-suggest"
              aria-activedescendant={sel >= 0 ? `start-sug-${sel}` : undefined}
              onChange={(e) => {
                setQ(e.target.value);
                setSel(-1);
                preconnectSoon(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' && matches.length) {
                  e.preventDefault();
                  setSel((i) => (i + 1) % matches.length);
                } else if (e.key === 'ArrowUp' && matches.length) {
                  e.preventDefault();
                  setSel((i) => (i <= 0 ? matches.length - 1 : i - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  go(sel >= 0 ? matches[sel].url : q);
                } else if (e.key === 'Escape' && q) {
                  e.stopPropagation();
                  setQ('');
                  setSel(-1);
                }
              }}
            />
            <kbd className="start-kbd" data-typing={q ? true : undefined}>
              {q ? <CornerDownLeft size={12} /> : formatShortcut(sc.commandBar, isMac)}
            </kbd>
            <button className="start-engine" type="button" title="Search engine" aria-label={`Search engine: ${engineName(engine)}`} data-testid="home-engine" onClick={pickEngine}>
              <SiteIcon url={engine.replace('%s', '')} title={engineName(engine)} size={14} />
              <span>{engineName(engine)}</span>
              <ChevronDown size={12} aria-hidden="true" />
            </button>
          </label>
          {matches.length > 0 && (
            <ul className="start-suggest" id="start-suggest" role="listbox" data-testid="start-suggest">
              {matches.map((h, i) => (
                <li key={h.url} id={`start-sug-${i}`} role="option" aria-selected={i === sel} data-on={i === sel || undefined} onMouseDown={(e) => { e.preventDefault(); go(h.url); }} onMouseEnter={() => setSel(i)}>
                  <SiteIcon url={h.url} title={h.title} size={16} />
                  <span className="start-sug-title">{siteName(h.url, h.title)}</span>
                  <span className="start-sug-url">{displayUrl(h.url)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Stays in place (just hidden) while suggestions show, so the page doesn't jump. */}
        <div className="start-sections" data-hidden={matches.length > 0 || undefined} aria-hidden={matches.length > 0 || undefined}>
          <section className="start-sec" aria-label="Favorites">
            {(favorites.length > 0 || frequent.length > 0) && <h2 className="start-sec-h">Favorites</h2>}
            <div className="start-grid" data-testid="start-favorites">
              {favorites.map((f) => (
                <Tile key={f.id} url={f.url} title={f.customTitle ?? f.title} favicon={f.favicon} index={tileIndex++} testId="start-favorite" onOpen={() => openFavorite(f.id)} onMenu={(e) => favoriteMenu(e, f)} />
              ))}
              <button className="start-tile start-tile-add" data-testid="start-add-shortcut" title="Add a shortcut" style={{ '--i': tileIndex } as React.CSSProperties} onClick={() => setEditing({ name: '', url: '' })}>
                <span className="start-tile-icon"><Plus size={22} /></span>
                <span className="start-tile-name">{favorites.length ? 'Add' : 'Add shortcut'}</span>
              </button>
            </div>
            {editing && (
              <form
                className="shortcut-editor"
                data-testid="shortcut-editor"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveShortcut();
                }}
              >
                <input className="input" placeholder="Address, e.g. example.com" aria-label="Address" autoFocus value={editing.url} data-testid="shortcut-url" onChange={(e) => setEditing({ ...editing, url: e.target.value })} />
                <input className="input" placeholder="Name (optional)" aria-label="Name" value={editing.name} data-testid="shortcut-name" onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <button type="button" className="btn small" onClick={() => setEditing(null)}>Cancel</button>
                <button className="btn small primary" data-testid="shortcut-save" disabled={!editing.url.trim()}>{editing.id ? 'Save' : 'Add'}</button>
              </form>
            )}
          </section>
          {hasTiles && frequent.length > 0 && (
            <section className="start-sec" aria-label="Frequently visited">
              <h2 className="start-sec-h">Frequently visited</h2>
              <div className="start-grid" data-testid="start-sites">
                {frequent.map((h) => (
                  <Tile key={h.url} url={h.url} title={h.title} index={tileIndex++} testId="start-site" onOpen={() => go(h.url)} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <WidgetLayer editable />

      {home.showHints && (
        <footer className="start-foot">
          <span><kbd>{formatShortcut(sc.newNote, isMac)}</kbd> New note</span>
          <span><kbd>{formatShortcut(sc.toggleSidebar, isMac)}</kbd> Hide sidebar</span>
          <span><kbd>{formatShortcut(sc.settings, isMac)}</kbd> Settings</span>
        </footer>
      )}

      <button className="home-fab" aria-label="Customize home page" title="Add a widget or shortcut, change the background" data-testid="home-customize" onClick={customize}>
        <Plus size={20} />
      </button>
    </div>
    </>
  );
}

/** A bookmark tile: the site's icon on a soft square, its name underneath. */
function Tile({ url, title, favicon, index, testId, onOpen, onMenu }: { url: string; title?: string; favicon?: string; index: number; testId: string; onOpen: () => void; onMenu?: (e: React.MouseEvent) => void }) {
  const name = siteName(url, title);
  return (
    <button className="start-tile" data-testid={testId} title={`${name}\n${displayUrl(url)}`} style={{ '--i': index } as React.CSSProperties} onClick={onOpen} onContextMenu={onMenu}>
      <span className="start-tile-icon">
        <SiteIcon url={url} favicon={favicon} title={title} size={26} />
      </span>
      <span className="start-tile-name">{name}</span>
    </button>
  );
}
