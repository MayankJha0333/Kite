// The home page: what a new tab shows (and what Kite shows with nothing open).
//
// One centered column, top to bottom: a quiet greeting, the search field (with the engine
// you search with, switchable in place), your Favorites, the sites you visit most if you
// ask for them, and the widgets you've placed. "Customize" in the corner (or a right-click
// on the page) adds widgets and shortcuts and sets the picture behind it all.
//
// It is simply there the moment a new tab opens: nothing on it animates in.

import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Plus, Search } from 'lucide-react';
import { formatShortcut } from '@shared/shortcuts';
import type { ID, Item } from '@shared/types';
import * as ops from '@shared/ops';
import { displayUrl, hostOf, isNewTabUrl, normalizeInput } from '@shared/url';
import { SEARCH_ENGINES } from '@shared/defaults';
import { updateSettings } from '@shared/settings';
import { BAR_HINT_USES, WIDGET_KINDS, addWidget, frequentSites } from '@shared/home';
import { BACKDROPS, backdropById, backdropPatch } from '@shared/backdrops';
import { setSpaceTheme } from '@shared/spaces';
import { activeSpace } from '@shared/tree';
import { backdropUrl } from '../backdrops';
import { useImageUrl } from '../images';
import { gradientLuma, gradientPatch, starterGradient } from '@shared/spaceTheme';
import { act, setUi, toast, useKite, type ContextMenuItem } from '../store';
import { navigateTab, openUrl, preconnectSoon, selectItem, undoable } from '../commands';
import { isMac, now } from '../platform';
import { SiteIcon } from './SiteIcon';
import { openMenu } from './ContextMenu';
import { WidgetLayer } from './home/WidgetLayer';

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
  // The field is focused the moment the page appears, so the caret is all it shows then.
  // The focus ring is for someone who came to it with the Tab key.
  const [ring, setRing] = useState(false);
  const tabbed = useRef(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => void (tabbed.current = e.key === 'Tab');
    const pointer = () => void (tabbed.current = false);
    window.addEventListener('keydown', key, true);
    window.addEventListener('pointerdown', pointer, true);
    return () => {
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('pointerdown', pointer, true);
    };
  }, []);

  // Ready to type the moment it appears, and when New Tab or the address bar is clicked again.
  useEffect(() => {
    // (Not from under the first run: while it is open the keyboard belongs to it.)
    const focus = () => useKite.getState().ui.panel !== 'welcome' && input.current?.focus();
    const t = window.setTimeout(focus, 0);
    window.addEventListener('kite:focus-start', focus);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('kite:focus-start', focus);
    };
  }, []);

  const favorites = useMemo(() => favIds.map((id) => items[id]).filter((it): it is TabItem => it?.kind === 'tab').slice(0, MAX_TILES * 2), [favIds, items]);
  const frequent = useMemo(() => (home.showFrequent ? frequentSites(history, new Set(favorites.map((f) => hostOf(f.url))), MAX_TILES) : []), [history, favorites, home.showFrequent]);
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

  /** Customize: widgets, shortcuts, the picture behind the page, what the page shows. */
  const customizeItems = (): ContextMenuItem[] => [
    {
      label: 'Add Widget',
      testId: 'home-add-widget',
      submenu: WIDGET_KINDS.map((k) => ({
        label: k.name,
        hint: k.blurb,
        testId: `home-widget-${k.id}`,
        onSelect: () => {
          const id = act((d) => addWidget(d.home, k.id));
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
        { label: 'Space Colors', hint: plain ? '✓' : undefined, testId: 'home-bg-none', onSelect: () => act((d) => setSpaceTheme(d, d.activeSpaceId, backdropPatch(null))) },
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

  const customize = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openMenu({ clientX: r.left, clientY: r.bottom + 4 }, customizeItems());
  };

  /** A right-click on the page itself (not on a tile, a widget or a field) opens the same menu. */
  const pageMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, textarea, a, .widget, .start-suggest, .shortcut-editor')) return;
    openMenu(e, customizeItems());
  };

  const pickEngine = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openMenu({ clientX: r.left, clientY: r.bottom + 4 }, [
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

  const barKeys = formatShortcut(sc.commandBar, isMac);

  return (
    <div className="start" data-testid={tabId ? 'start-page' : 'empty-state'} data-backdrop={bg ? bg.id : undefined} data-tone={tone} onContextMenu={pageMenu}>
      {/* The chart's contour lines on the plain page; a Space's picture or gradient takes their place. */}
      {bg ? <div className="start-bg" aria-hidden="true" data-testid="start-bg" style={{ backgroundImage: bg.image }} /> : <div className="contour-field" aria-hidden="true" />}
      <div className="start-scroll">
        <div className="start-top">
          <button className="btn small ghost start-customize" aria-haspopup="menu" title="Add a widget or shortcut, change the background" data-testid="home-customize" onClick={customize}>
            Customize
          </button>
        </div>
        <div className="start-inner">
          {home.showGreeting && (
            <header className="start-hello">
              <h1 className="start-greet">{greeting(today.getHours())}</h1>
              <p className="start-date">{today.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </header>
          )}

          <div className="start-box">
            <label className="start-search" data-ring={ring || undefined} data-testid={tabId ? undefined : 'empty-search'}>
              <Search size={16} className="start-search-icon" aria-hidden="true" />
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
                onFocus={() => setRing(tabbed.current)}
                onBlur={() => setRing(false)}
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
              {q && (
                <kbd className="kbd" aria-hidden="true">
                  <CornerDownLeft size={11} />
                </kbd>
              )}
              <button className="select start-engine" type="button" aria-haspopup="menu" title="Search engine" aria-label={`Search engine: ${engineName(engine)}`} data-testid="home-engine" onClick={pickEngine}>
                <SiteIcon url={engine.replace('%s', '')} title={engineName(engine)} size={14} />
                <span>{engineName(engine)}</span>
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

          <section className="start-sec" aria-label="Favorites">
            <h2 className="section-label">Favorites</h2>
            <div className="start-grid" data-testid="start-favorites">
              {favorites.map((f) => (
                <Tile key={f.id} url={f.url} title={f.customTitle ?? f.title} favicon={f.favicon} testId="start-favorite" onOpen={() => openFavorite(f.id)} onMenu={(e) => favoriteMenu(e, f)} />
              ))}
              <button className="start-tile start-tile-add" data-testid="start-add-shortcut" title="Add a site to Favorites" onClick={() => setEditing({ name: '', url: '' })}>
                <span className="start-tile-plate"><Plus size={16} /></span>
                <span className="start-tile-name">Add</span>
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
                onKeyDown={(e) => {
                  if (e.key !== 'Escape') return;
                  e.stopPropagation();
                  setEditing(null);
                }}
              >
                <input className="input" placeholder="Address, like example.com" aria-label="Address" autoFocus value={editing.url} data-testid="shortcut-url" onChange={(e) => setEditing({ ...editing, url: e.target.value })} />
                <input className="input" placeholder="Name (optional)" aria-label="Name" value={editing.name} data-testid="shortcut-name" onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
                <button className="btn primary" data-testid="shortcut-save" disabled={!editing.url.trim()}>{editing.id ? 'Save' : 'Add'}</button>
              </form>
            )}
            {/* A new person is reminded of the one habit until they have used it a few times. */}
            {home.barUses < BAR_HINT_USES && barKeys && (
              <p className="start-hint" data-testid="start-hint">Press {barKeys} anywhere to open a page or find a tab.</p>
            )}
          </section>
          {frequent.length > 0 && (
            <section className="start-sec" aria-label="Frequently visited">
              <h2 className="section-label">Frequently visited</h2>
              <div className="start-grid" data-testid="start-sites">
                {frequent.map((h) => (
                  <Tile key={h.url} url={h.url} title={h.title} favicon={h.favicon} testId="start-site" onOpen={() => go(h.url)} />
                ))}
              </div>
            </section>
          )}

          <WidgetLayer editable />
        </div>

        {home.showHints && (
          <footer className="start-foot">
            <span><kbd className="kbd">{formatShortcut(sc.newNote, isMac)}</kbd> New note</span>
            <span><kbd className="kbd">{formatShortcut(sc.toggleSidebar, isMac)}</kbd> Hide sidebar</span>
            <span><kbd className="kbd">{formatShortcut(sc.settings, isMac)}</kbd> Settings</span>
          </footer>
        )}
      </div>
    </div>
  );
}

/** A site as a tile: its icon on a small plate, its name underneath. */
function Tile({ url, title, favicon, testId, onOpen, onMenu }: { url: string; title?: string; favicon?: string; testId: string; onOpen: () => void; onMenu?: (e: React.MouseEvent) => void }) {
  const name = siteName(url, title);
  return (
    <button className="start-tile" data-testid={testId} title={`${name}\n${displayUrl(url)}`} onClick={onOpen} onPointerEnter={() => preconnectSoon(url)} onContextMenu={onMenu}>
      <span className="start-tile-plate">
        <SiteIcon url={url} favicon={favicon} title={title} size={28} />
      </span>
      <span className="start-tile-name">{name}</span>
    </button>
  );
}
