import { ArrowLeft, ArrowRight, Info, RotateCw, PanelLeft, Plus, Search, ShieldCheck, SlidersHorizontal, Archive, Wand2 } from 'lucide-react';
import { boostsFor } from '@shared/boosts';
import * as ops from '@shared/ops';
import { displayUrl, hostOf, isNewTabUrl } from '@shared/url';
import { activeSpace } from '@shared/tree';
import { ARCHIVE_CHOICES } from '@shared/defaults';
import type { Item } from '@shared/types';
import { act, setUi, useKite } from '../store';
import { actions, focusStartPage, selectItem } from '../commands';
import { desktopChrome, isMac } from '../platform';
import { ItemRow } from './ItemRow';
import { Favorites } from './Favorites';
import { SpaceBar, SpaceHeader, useSpaceSwipe } from './Spaces';
import { useEffect, useRef, useState } from 'react';
import { useFlip } from '../flip';
import { formatShortcut } from '@shared/shortcuts';
import { openMenu } from './ContextMenu';
import { DropZone } from '../dnd';
import { SecurityIcon, SiteInfo, useSecurity } from './SiteInfo';
import { DownloadsButton } from './Downloads';

/** A tab still showing the start page: opened by "New Tab" and not used yet. */
const isBlankTab = (it: Item | undefined) => it?.kind === 'tab' && isNewTabUrl(it.url);

/**
 * The one-line hints in the empty Pinned and Today areas show until that area has been
 * used once, and never again. That memory is about this person's first minutes, not about
 * their tabs, so it is kept beside the saved state rather than in it.
 */
const TAUGHT_KEY = 'kite-taught';

function readTaught(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(TAUGHT_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function useTaught(area: 'pinned' | 'today', used: boolean): boolean {
  const [taught, setTaught] = useState(() => !!readTaught()[area]);
  useEffect(() => {
    if (!used || taught) return;
    setTaught(true);
    try {
      localStorage.setItem(TAUGHT_KEY, JSON.stringify({ ...readTaught(), [area]: true }));
    } catch {
      /* no storage: the hint comes back next launch, nothing worse */
    }
  }, [used, taught, area]);
  return taught || used;
}

/** "after 12 hours", from the Space's own auto-archive time or the one in Settings; empty when tabs are never archived. */
function tidiesAfter(ms: number | null): string {
  if (ms === null) return '';
  const known = ARCHIVE_CHOICES.find((c) => c.ms === ms);
  if (known) return ` and tidy themselves after ${known.label}`;
  const hours = Math.max(1, Math.round(ms / 3_600_000));
  return ` and tidy themselves after ${hours} hour${hours === 1 ? '' : 's'}`;
}

export function Sidebar() {
  // With nothing open, the empty page's big search box is the one place to start:
  // the sidebar doesn't show a second, smaller one.
  const showUrl = useKite((st) => st.s.settings.showUrlBar && !!ops.activeItemId(st.s));
  const space = useKite((st) => activeSpace(st.s));
  const shortcuts = useKite((st) => st.s.settings.shortcuts);
  const width = useKite((st) => st.s.settings.sidebarWidth);
  // Room for the window buttons (macOS), which sit in the sidebar's corner on either side. None in full screen.
  const fullscreen = useKite((st) => st.ui.fullscreen);
  const needsLightsGap = desktopChrome && isMac && !fullscreen;
  const onWheel = useSpaceSwipe();
  const spaceIndex = useKite((st) => st.s.spaces.findIndex((x) => x.id === st.s.activeSpaceId));
  // Arc: a collapsed Pinned section still shows the pinned tab you are on (the folder it sits in, if any).
  const pinnedPeek = useKite((st) => {
    const sp = activeSpace(st.s);
    if (!sp.pinnedCollapsed) return null;
    const a = st.s.activeBySpace[sp.id];
    return a ? ops.pinnedRootOf(st.s, sp.id, a) : null;
  });
  // Rows glide to their new place when the tree changes (see flip.ts): render on every
  // change to items or Favorites, so the measurement runs after each commit.
  const items = useKite((st) => st.s.items);
  useKite((st) => st.s.favorites);
  const activeId = useKite((st) => st.s.activeBySpace[st.s.activeSpaceId] ?? null);
  // "New Tab" is one thing in the sidebar. The empty tab it opens has no row of its own in
  // Today: while it is the tab on screen, the "New Tab" row is the selected row, and a row
  // appears only once a page has loaded in it.
  const blankId = space.today.find((id) => isBlankTab(items[id])) ?? null;
  const onBlank = blankId !== null && activeId === blankId;
  const today = space.today.filter((id) => id !== blankId);
  const openNewTab = () => {
    if (blankId === null || onBlank) return actions.newTabPage();
    selectItem(blankId);
    requestAnimationFrame(focusStartPage);
  };
  const archiveAfter = useKite((st) => (space.archiveAfterMs === undefined ? st.s.settings.archiveAfterMs : space.archiveAfterMs));
  const pinnedTaught = useTaught('pinned', useKite((st) => st.s.spaces.some((sp) => sp.pinned.length > 0)));
  const todayTaught = useTaught('today', useKite((st) => st.s.history.length > 0 || st.s.archive.length > 0 || st.s.spaces.some((sp) => sp.today.some((id) => !isBlankTab(st.s.items[id])))));
  // The footer's sliders button is the front door to how Kite looks; it stays lit while
  // Customize, or the Settings it leads to, is open.
  const customizing = useKite((st) => st.ui.panel === 'customize');
  const inSettings = useKite((st) => st.ui.panel === 'settings' || st.ui.panel === 'shortcuts');
  const scroll = useRef<HTMLDivElement>(null);
  useFlip(scroll, space.id);
  const lastIndex = useRef(spaceIndex);
  const dir = spaceIndex === lastIndex.current ? 'none' : spaceIndex > lastIndex.current ? 'next' : 'prev';
  lastIndex.current = spaceIndex;

  return (
    <aside className="sidebar" data-testid="sidebar" aria-label="Sidebar" style={{ width }}>
      <div className="sb-top drag" data-lights={needsLightsGap || undefined}>
        <div className="sb-top-btns no-drag">
          <IconBtn label="Toggle sidebar" testId="btn-toggle-sidebar" onClick={actions.toggleSidebar}>
            <PanelLeft size={16} />
          </IconBtn>
          <NavButtons />
        </div>
      </div>

      {showUrl && <UrlPill />}
      <SiteInfo />

      <div className="sb-scroll" data-testid="sb-scroll" onWheel={onWheel} ref={scroll}>
        <Favorites />
        <div className="space-pane" key={space.id} data-dir={dir}>
        <SpaceHeader space={space} />

        <section className="sb-section" aria-label="Pinned" data-testid="pinned-list" role="tree" data-collapsed={space.pinnedCollapsed || undefined}>
          {!space.pinnedCollapsed && space.pinned.map((id) => <ItemRow key={id} id={id} list="pinned" depth={0} />)}
          {space.pinnedCollapsed && pinnedPeek && (
            <div className="folder-peek" data-testid="pinned-peek">
              <ItemRow id={pinnedPeek} list="pinned" depth={0} last />
            </div>
          )}
          {!space.pinnedCollapsed && (
            <DropZone zone={{ type: 'end', list: 'pinned', spaceId: space.id }} className="list-end" testId="pinned-end" data-empty={space.pinned.length === 0 || undefined}>
              {/* Never pinned anything: say how. After that an empty Pinned area takes no room, and a drop slot shows only mid-drag. */}
              {space.pinned.length === 0 && !pinnedTaught && <p className="hint" data-testid="hint-pinned">Drag a tab here to pin it</p>}
              {space.pinned.length === 0 && pinnedTaught && <span className="pin-slot">Drop here to pin</span>}
            </DropZone>
          )}
        </section>

        <div className="sb-head">
          <span className="section-label">Today</span>
          {today.length > 0 && (
            <button className="sb-clear" data-testid="btn-clear-today" onClick={() => actions.clearToday?.()} title="Archive all unpinned tabs">
              Clear
            </button>
          )}
        </div>

        <button className="row new-tab" data-testid="btn-new-tab" data-active={onBlank || undefined} aria-current={onBlank ? 'page' : undefined} title="New Tab" onClick={openNewTab}>
          <Plus size={16} className="row-glyph" />
          <span className="row-title">New Tab</span>
          <kbd>{formatShortcut(shortcuts.commandBar, isMac)}</kbd>
        </button>

        <section className="sb-section" aria-label="Today" data-testid="today-list" role="tree">
          {today.map((id) => (
            <ItemRow key={id} id={id} list="today" depth={0} />
          ))}
          {today.length === 0 && !todayTaught && <p className="hint" data-testid="hint-today">New tabs appear here{tidiesAfter(archiveAfter)}</p>}
          <DropZone zone={{ type: 'end', list: 'today', spaceId: space.id }} className="list-end grow" testId="today-end" />
        </section>
        </div>
      </div>

      <footer className="sb-footer">
        <IconBtn label="Archive" testId="btn-archive" onClick={() => actions.archivePage?.()}>
          <Archive size={16} />
        </IconBtn>
        <DownloadsButton onClick={actions.downloadsPanel} />
        <SpaceBar />
        <IconBtn label="Customize" testId="btn-settings" active={customizing || inSettings} onClick={() => (customizing ? setUi({ panel: null, panelArg: undefined }) : actions.customize())}>
          <SlidersHorizontal size={16} />
        </IconBtn>
      </footer>
      <SidebarResizer />
    </aside>
  );
}

function NavButtons() {
  const tab = useKite((st) => ops.activeTab(st.s));
  const nav = useKite((st) => (tab ? st.ui.nav[tab.id] : undefined));
  return (
    <>
      <IconBtn label="Back" testId="btn-back" disabled={!nav?.back} onClick={actions.back}>
        <ArrowLeft size={16} />
      </IconBtn>
      <IconBtn label="Forward" testId="btn-forward" disabled={!nav?.forward} onClick={actions.forward}>
        <ArrowRight size={16} />
      </IconBtn>
      <IconBtn label="Reload" testId="btn-reload" disabled={!tab} onClick={actions.reload}>
        <RotateCw size={16} />
      </IconBtn>
    </>
  );
}

function UrlPill() {
  // The start page has no address of its own: the pill reads like an empty address bar.
  const tab = useKite((st) => {
    const t = ops.activeTab(st.s);
    return t && !isNewTabUrl(t.url) ? t : null;
  });
  const boosted = useKite((st) => (tab ? boostsFor(st.s, tab.url).length > 0 : false));
  const { level } = useSecurity();
  const blocked = useKite((st) => (tab ? st.ui.blocked[tab.id] ?? 0 : 0));
  const zoom = useKite((st) => (tab ? st.ui.zoom[tab.id] ?? 100 : 100));
  // A secure page shows its address first and the way into its site controls at the end.
  // Anything less than secure keeps its warning up front.
  const warn = level === 'insecure' || level === 'broken';
  const siteButton = (
    <span
      className="url-sec"
      role="button"
      aria-label="About this site"
      title="About this site"
      data-level={level}
      data-side={warn ? 'start' : 'end'}
      data-testid="url-security"
      onClick={(e) => {
        e.stopPropagation();
        actions.siteInfo();
      }}
    >
      {warn ? <SecurityIcon level={level} /> : <Info size={14} className="url-lock" />}
    </span>
  );
  return (
    <button
      className="url-pill"
      data-testid="url-pill"
      onClick={actions.editUrl}
      onContextMenu={(e) => tab && openMenu(e, [{ label: 'Copy URL', onSelect: actions.copyUrl }])}
      title={tab?.url ?? 'Search or enter address'}
    >
      {!tab && <Search size={14} className="url-lock" />}
      {tab && warn && siteButton}
      <UrlText url={tab?.url ?? null} />
      {tab && blocked > 0 && (
        <span className="url-shield" role="button" aria-label={`${blocked} blocked on this page`} title={`${blocked} blocked on this page`} data-testid="url-blocked" onClick={(e) => { e.stopPropagation(); actions.siteInfo(); }}>
          <ShieldCheck size={12} />
          <span className="badge">{blocked > 99 ? '99+' : blocked}</span>
        </span>
      )}
      {tab && zoom !== 100 && (
        <span className="url-shield url-zoom" role="button" title="Zoomed · click for actual size" data-testid="url-zoom" onClick={(e) => { e.stopPropagation(); actions.zoomReset(); }}>
          <span className="badge">{zoom}%</span>
        </span>
      )}
      {boosted && (
        <span
          className="url-boost"
          role="button"
          aria-label="A Boost is changing this site"
          title="A Boost is changing this site"
          data-testid="url-boost"
          onClick={(e) => {
            e.stopPropagation();
            actions.boostEditor();
          }}
        >
          <Wand2 size={14} />
        </span>
      )}
      {tab && !warn && siteButton}
    </button>
  );
}

/** The site's domain reads first, as in Arc; the rest of the address trails off, quieter. */
function UrlText({ url }: { url: string | null }) {
  if (!url) return <span className="url-text">Search or enter address</span>;
  const full = displayUrl(url);
  const host = hostOf(url);
  const rest = host && full.startsWith(host) ? full.slice(host.length) : null;
  if (rest === null) return <span className="url-text">{full}</span>;
  return (
    <span className="url-text">
      <span className="url-host">{host}</span>
      {rest && <span className="url-path">{rest}</span>}
    </span>
  );
}

export function IconBtn({ label, onClick, children, testId, disabled, active }: { label: string; onClick?: () => void; children: React.ReactNode; testId?: string; disabled?: boolean; active?: boolean }) {
  return (
    <button className="icon-btn" aria-label={label} title={label} data-testid={testId} disabled={disabled} data-active={active || undefined} onClick={onClick}>
      {children}
    </button>
  );
}

/** Drag the sidebar's edge to resize it. */
function SidebarResizer() {
  const side = useKite((st) => st.s.settings.sidebarSide);
  return (
    <div
      className="sb-resizer"
      data-testid="sidebar-resizer"
      role="separator"
      aria-orientation="vertical"
      onPointerDown={(e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startW = useKite.getState().s.settings.sidebarWidth;
        document.body.classList.add('resizing');
        const move = (ev: PointerEvent) => {
          const dx = (ev.clientX - startX) * (side === 'left' ? 1 : -1);
          const w = Math.round(Math.max(200, Math.min(440, startW + dx)));
          act((d) => void (d.settings.sidebarWidth = w));
        };
        const up = () => {
          document.body.classList.remove('resizing');
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      }}
      onDoubleClick={() => act((d) => void (d.settings.sidebarWidth = 264))}
    />
  );
}

export { setUi };
