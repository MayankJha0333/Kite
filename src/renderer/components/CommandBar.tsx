import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppWindow, Archive, ArrowLeft, ArrowRight, Camera, Clock, Code, Columns2, Command, Copy, Download, Folder, Globe, Import, Keyboard, Moon, PanelLeft, Pencil, PictureInPicture2, Pin,
  Plus, Printer, Puzzle, RefreshCw, RotateCw, Save, Search, Settings, Shield, SlidersHorizontal, Star, StickyNote, Trash2, Undo2, Volume2, VolumeX, Waypoints, X, Zap, ZoomIn, ZoomOut,
  type LucideIcon,
} from 'lucide-react';
import { ACTION_CATALOG, matchRanges, suggest, type Suggestion } from '@shared/commandbar';
import { formatShortcut } from '@shared/shortcuts';
import { displayUrl } from '@shared/url';
import { getS, setUi, useKite } from '../store';
import { actions, openUrl, preconnectSoon, selectItem, switchSpaceCmd } from '../commands';
import { isMac } from '../platform';
import { SiteIcon } from './SiteIcon';

export function CommandBar() {
  const cb = useKite((st) => st.ui.commandBar);
  if (!cb) return null;
  return <CommandBarInner key={`${cb.mode}:${cb.initial}:${cb.target ?? ''}`} mode={cb.mode} initial={cb.initial} target={cb.target} />;
}

/** `loose` follows the match that put the row in the list; an address is only ever matched as typed. */
function Highlight({ text, query, loose = true }: { text: string; query: string; loose?: boolean }) {
  const ranges = matchRanges(query, text, loose);
  if (!ranges.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let i = 0;
  ranges.forEach(([a, b], k) => {
    if (a > i) parts.push(text.slice(i, a));
    parts.push(<mark key={k}>{text.slice(a, b)}</mark>);
    i = b;
  });
  parts.push(text.slice(i));
  return <>{parts}</>;
}

/** A glyph per action, so a list of actions can be told apart at a glance. Anything not named here gets the ⌘ sign. */
const ACTION_ICONS: Record<string, LucideIcon> = {
  newNote: StickyNote, newFolder: Folder, newSpace: Plus, newSplit: Columns2, unsplit: Columns2, flipSplit: Columns2, littleWindow: AppWindow,
  togglePin: Pin, duplicateTab: Copy, addFavorite: Star, removeFavorite: Star, copyUrl: Copy, copyMarkdown: Copy,
  sleepOthers: Moon, muteAll: VolumeX, unmuteAll: Volume2, toggleMute: VolumeX, closeTab: X, reopenClosed: Undo2,
  back: ArrowLeft, forward: ArrowRight, nextTab: ArrowRight, prevTab: ArrowLeft, nextSpace: ArrowRight, prevSpace: ArrowLeft,
  renameSpace: Pencil, editSpace: SlidersHorizontal, renameCurrent: Pencil, clearToday: Archive, archivePage: Archive, historyPage: Clock,
  print: Printer, savePage: Save, viewSource: Code, zoomIn: ZoomIn, zoomOut: ZoomOut, zoomReset: Search, toggleSidebar: PanelLeft,
  collapseFolders: Folder, expandFolders: Folder, settings: Settings, shortcutsPanel: Keyboard, boostEditor: Zap, boostsPanel: Zap,
  routingPanel: Waypoints, routeSiteHere: Waypoints, downloadsPanel: Download, extensionsPanel: Puzzle, privacyPanel: Shield, toggleShields: Shield,
  siteInfo: Shield, importArc: Import, customize: SlidersHorizontal, toggleTheme: Moon, findInPage: Search, reload: RotateCw, hardReload: RotateCw,
  stopLoading: X, resetToHome: Undo2, setHomeHere: Pin, resetSpaceTabs: Undo2, togglePinnedSection: Pin, clearCookiesRefresh: Trash2,
  clearCacheRefresh: Trash2, capture: Camera, captureFull: Camera, setDefaultBrowser: Globe, checkUpdates: RefreshCw, popOutVideo: PictureInPicture2,
};

/** What Tab writes into the box for a row: its address (the scheme is only kept when it is not https), or its name. */
function completion(r: Suggestion): string | null {
  if (r.kind === 'search') return null;
  if (r.kind === 'tab' || r.kind === 'history' || r.kind === 'open') return r.url.replace(/^https:\/\//i, '');
  return r.kind === 'space' ? r.title.replace(/^Go to /, '') : r.title;
}

function CommandBarInner({ mode, initial, target }: { mode: 'new' | 'edit'; initial: string; target?: 'split' }) {
  const [q, setQ] = useState(initial);
  // The selection is remembered by what is selected, not by its position, so it stays on the
  // same row when the list changes underneath it (a tab's title arriving, a page loading).
  const [selKey, setSelKey] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const s = useKite((st) => st.s);
  const touched = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  // A pane of a split view is filled with a page, never with an action.
  const available = useMemo(() => (target === 'split' ? [] : ACTION_CATALOG.filter((a) => a.id in actions)), [target]);
  // In edit mode, show suggestions only once the user starts typing.
  const results = useMemo(() => (mode === 'edit' && !touched.current ? [] : suggest(s, q, { actions: available })), [s, q, mode, available]);
  const sel = Math.max(0, selKey ? results.findIndex((r) => r.key === selKey) : 0);
  const typed = q.trim() !== '';

  const type = (text: string) => {
    touched.current = true;
    setQ(text);
    setSelKey(null);
  };
  const move = (by: 1 | -1) => {
    if (results.length) setSelKey(results[(sel + by + results.length) % results.length].key);
  };

  // Open the connection for what Enter would open, while the address is still being typed.
  useEffect(() => {
    const r = results[sel];
    preconnectSoon(r && (r.kind === 'open' || r.kind === 'history') ? r.url : q.trim() || null);
  }, [q, sel, results]);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // The first row takes its section label into view with it.
    if (sel === 0) list.scrollTop = 0;
    else list.querySelector(`[data-index="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const close = () => setUi({ commandBar: null });

  const run = (r: Suggestion | undefined, newTab = false) => {
    const where = target === 'split' ? 'split' : mode === 'edit' && !newTab ? 'current' : 'new';
    close();
    if (!r) {
      if (q.trim()) openUrl(q, where);
      return;
    }
    switch (r.kind) {
      case 'open':
      case 'search':
      case 'history':
        openUrl(r.url, where);
        break;
      case 'tab':
        if (target === 'split') openUrl(r.url, 'split');
        else selectItem(r.itemId);
        break;
      case 'note':
        selectItem(r.itemId);
        break;
      case 'action':
        actions[r.actionId]?.();
        break;
      case 'space':
        switchSpaceCmd(r.spaceId);
        break;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // While an input method is composing (Japanese, Chinese, accents), Enter, Esc and the
    // arrows belong to it: they pick a candidate, not a result.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      // As in Spotlight: the first Esc takes back what you typed, the second closes.
      if (mode === 'new' && touched.current && q) type('');
      else close();
    } else if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Tab') {
      // Tab stays in the bar; it completes the selected row into the box, ready to edit.
      e.preventDefault();
      const text = !e.shiftKey && results[sel] ? completion(results[sel]) : null;
      if (text && text !== q) type(text);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(results[sel], e.metaKey || e.ctrlKey);
    }
  };

  const ModeIcon = target === 'split' ? Columns2 : mode === 'edit' ? Globe : Search;

  return (
    <div className="cb-scrim" data-testid="command-bar" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="cb" role="dialog" aria-label="Command bar">
        <div className="cb-input-row">
          <ModeIcon size={16} className="cb-icon" aria-hidden="true" />
          <input
            ref={ref}
            className="cb-input"
            data-testid="cb-input"
            value={q}
            spellCheck={false}
            autoComplete="off"
            placeholder={target === 'split' ? 'Open beside this page' : mode === 'edit' ? 'Enter an address' : 'Search, enter an address, or run a command'}
            role="combobox"
            aria-label={target === 'split' ? 'Open in Split View' : 'Search, address or command'}
            aria-autocomplete="list"
            aria-expanded={results.length > 0}
            aria-controls="cb-list"
            aria-activedescendant={results[sel] ? `cb-${sel}` : undefined}
            onChange={(e) => type(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {target === 'split' && <span className="chip cb-badge">Split View</span>}
        </div>
        {results.length > 0 && (
          <div className="cb-list" id="cb-list" role="listbox" aria-label="Results" ref={listRef} data-testid="cb-results">
            {results.map((r, i) => {
              const on = i === sel;
              const isPage = r.kind === 'tab' || r.kind === 'note';
              // Nothing typed: the two halves of the list are named. Typed: the order speaks for itself.
              const label = typed || (i > 0 && (results[i - 1].kind === 'action') === (r.kind === 'action')) ? null : r.kind === 'action' ? 'Actions' : 'Recent tabs';
              const elsewhere = isPage && r.spaceId && r.spaceId !== s.activeSpaceId ? r.spaceName : null;
              // Only the selected row says what Enter does, and only where it is not "open".
              const hint = on && isPage && target !== 'split' ? (r.kind === 'tab' ? 'Switch to tab' : 'Switch to note') : null;
              const shortcut = r.kind === 'action' ? s.settings.shortcuts[r.actionId] : '';
              const ActionIcon = r.kind === 'action' ? (ACTION_ICONS[r.actionId] ?? Command) : null;
              return (
                <Fragment key={r.key}>
                  {label && (
                    <div className="section-label cb-label" role="presentation">
                      {label}
                    </div>
                  )}
                  <div
                    id={`cb-${i}`}
                    role="option"
                    aria-selected={on}
                    data-index={i}
                    data-kind={r.kind}
                    data-testid={`cb-result-${r.kind}`}
                    className="cb-row"
                    data-on={on || undefined}
                    onMouseMove={() => !on && setSelKey(r.key)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      run(r, e.metaKey || e.ctrlKey);
                    }}
                  >
                    <span className="cb-row-icon" aria-hidden="true">
                      {r.kind === 'tab' || r.kind === 'history' ? (
                        <SiteIcon url={r.url} title={r.title} favicon={r.kind === 'tab' ? (getS().items[r.itemId] as { favicon?: string })?.favicon : undefined} size={16} />
                      ) : r.kind === 'open' ? (
                        <Globe size={16} />
                      ) : r.kind === 'search' ? (
                        <Search size={16} />
                      ) : r.kind === 'note' ? (
                        <StickyNote size={16} />
                      ) : ActionIcon ? (
                        <ActionIcon size={16} />
                      ) : r.kind === 'space' ? (
                        <span className="cb-space-icon">{r.icon}</span>
                      ) : null}
                    </span>
                    <span className="cb-row-title">
                      {r.kind === 'search' ? <>Search {r.engine} for “{r.title}”</> : r.kind === 'open' ? <>Open {displayUrl(r.url)}</> : <Highlight text={r.title} query={q} />}
                    </span>
                    {(r.kind === 'tab' || r.kind === 'history') && (
                      <span className="cb-row-sub">
                        <Highlight text={displayUrl(r.url)} query={q} loose={false} />
                      </span>
                    )}
                    <span className="cb-row-meta">
                      {(hint || elsewhere) && <span>{[hint, elsewhere].filter(Boolean).join(' · ')}</span>}
                      {r.kind === 'history' && <Clock size={14} aria-label="From history" />}
                      {shortcut && <kbd>{formatShortcut(shortcut, isMac)}</kbd>}
                    </span>
                  </div>
                </Fragment>
              );
            })}
          </div>
        )}
        <div className="cb-foot" aria-hidden="true">
          <span><kbd className="kbd">↩</kbd> {target === 'split' ? 'Open beside' : 'Open'}</span>
          {target !== 'split' && <span><kbd className="kbd">{isMac ? '⌘↩' : 'Ctrl ↩'}</kbd> New tab</span>}
          <span><kbd className="kbd">esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
