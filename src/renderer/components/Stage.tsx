import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ID, Item, SplitOrientation } from '@shared/types';
import * as ops from '@shared/ops';
import { act, markLoaded, setUi, toast, useKite } from '../store';
import { openUrl, splitWithCmd } from '../commands';
import { MAX_PANES, addToSplit, createSplit, movePane } from '@shared/split';
import { now } from '../platform';
import { PageThread, WebSurface } from './WebSurface';
import { setupPage, usePolicySync } from '../pageSetup';
import { FindBar } from './FindBar';
import { SplitChrome, splitRects, paneStyle } from './SplitView';
// Loaded on first use: the editor and Settings are large and most sessions never open them.
const NoteEditor = lazy(() => import('./NoteEditor').then((m) => ({ default: m.NoteEditor })));
const SettingsPanel = lazy(() => import('./Settings').then((m) => ({ default: m.SettingsPanel })));
import { Peek } from './Peek';
import { DropZone, onStageDrop, useDnd } from '../dnd';
import { partitionForTab } from '@shared/profiles';
import { LoadError } from './LoadError';
import { StartPage } from './StartPage';
import { isNewTabUrl, sourceTarget } from '@shared/url';
import { SourceView } from './SourceView';
import { PanelGuard } from './Panels';

type Rect = { left: number; top: number; width: number; height: number };
const FULL: Rect = { left: 0, top: 0, width: 100, height: 100 };

export function Stage() {
  const activeId = useKite((st) => ops.activeItemId(st.s));
  const active = useKite((st) => (activeId ? st.s.items[activeId] : null));
  const loadedRaw = useKite((st) => st.ui.loaded);
  const items = useKite((st) => st.s.items);
  const loaded = useMemo(() => loadedRaw.filter((id) => items[id]?.kind === 'tab'), [loadedRaw, items]);
  // While Settings plays its exit animation it is still drawn (ui.leaving), then goes.
  const settingsPage = useKite((st) => {
    const p = st.ui.panel ?? st.ui.leaving?.panel ?? null;
    return p === 'settings' || p === 'shortcuts';
  });
  // Going to another tab (or a new one) leaves Settings, like leaving a page. Switching
  // Space keeps it open, so each Space can be styled from Settings.
  const spaceId = useKite((st) => st.s.activeSpaceId);
  const panel = useKite((st) => st.ui.panel);
  const last = useRef({ activeId, spaceId });
  useEffect(() => {
    const before = last.current;
    last.current = { activeId, spaceId };
    if (before.activeId === activeId || before.spaceId !== spaceId) return;
    // Only the panel that was open *in this render* counts: this effect can run a beat
    // late, after a ⌘, that just opened Settings, and must not close that one.
    if (panel === 'settings' || panel === 'shortcuts') setUi({ panel: null, panelArg: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, spaceId]);

  const rects = useMemo<Record<ID, Rect>>(() => {
    if (!active) return {};
    if (active.kind === 'tab') return { [active.id]: FULL };
    if (active.kind === 'split') return splitRects(active);
    return {};
  }, [active]);

  // Pages that should be on screen must be mounted even if not yet in the loaded list.
  const mounted = useMemo(() => Array.from(new Set([...loaded, ...Object.keys(rects)])).filter((id) => items[id]?.kind === 'tab'), [loaded, rects, items]);

  return (
    <main className="stage" data-testid="stage">
      <DropZone zone={{ type: 'stage' }} className="card" testId="page-card" data-split={active?.kind === 'split' || undefined}>
        {mounted.map((id) => (
          <SurfaceSlot key={id} id={id} rect={rects[id]} inSplit={active?.kind === 'split' && active.panes.includes(id)} focusedInSplit={active?.kind === 'split' && active.panes[active.focused] === id} />
        ))}
        {active?.kind === 'split' && <SplitChrome split={active} />}
        <DropHint active={active} />
        {active?.kind === 'note' && (
          <Suspense fallback={<div className="lazy-wait" aria-busy="true" />}>
            <NoteEditor key={active.id} note={active} />
          </Suspense>
        )}
        {!active && <StartPage />}
        <FindBar />
        {settingsPage && (
          <PanelGuard key="settings">
            <Suspense fallback={<div className="lazy-wait kite-page" aria-busy="true" />}>
              <SettingsPanel />
            </Suspense>
          </PanelGuard>
        )}
      </DropZone>
      <Peek />
    </main>
  );
}

/** Where a tab dragged over the page will land: which part of the card, and how the split is made. */
type Place = { rect: Rect; orientation: SplitOrientation; index: number };

/** The part of the page under the pointer (x, y from 0 to 1 across the card) that a dropped tab would take. */
function placeFor(active: Item | null, dragId: ID, x: number, y: number): Place | null {
  if (!active || active.id === dragId) return null;
  if (active.kind === 'tab') {
    // One page showing: the nearest edge decides. Left or right splits side by side, top or bottom stacks.
    const dx = x - 0.5;
    const dy = y - 0.5;
    const row = Math.abs(dx) >= Math.abs(dy);
    const first = row ? dx < 0 : dy < 0;
    const rect = row ? { left: first ? 0 : 50, top: 0, width: 50, height: 100 } : { left: 0, top: first ? 0 : 50, width: 100, height: 50 };
    return { rect, orientation: row ? 'row' : 'column', index: first ? 0 : 1 };
  }
  if (active.kind !== 'split' || active.panes.length >= MAX_PANES || active.panes.includes(dragId)) return null;
  // Already a split: the tab goes between the panes nearest the pointer, and every pane ends up the same size.
  const along = active.orientation === 'row' ? x : y;
  let start = 0;
  let index = 0;
  active.sizes.forEach((size) => {
    if (along > start + size / 2) index++;
    start += size;
  });
  const share = 100 / (active.panes.length + 1);
  const rect = active.orientation === 'row' ? { left: index * share, top: 0, width: share, height: 100 } : { left: 0, top: index * share, width: 100, height: share };
  return { rect, orientation: active.orientation, index };
}

/** What the hint is showing right now; the drop reads it (the drop itself arrives through dnd.tsx). */
let aim: Place | null = null;

/** A tab dropped on the page joins what is showing, in the place the hint showed. */
function dropOnPage(tabId: ID, place: Place | null) {
  const s = useKite.getState().s;
  if (s.items[tabId]?.kind !== 'tab') return;
  const activeId = ops.activeItemId(s);
  const active = activeId ? s.items[activeId] : null;
  if (!place || !active) return splitWithCmd(tabId);
  const done = act((d) => {
    if (active.kind === 'tab') {
      const splitId = createSplit(d, [active.id, tabId], now(), place.orientation);
      if (!splitId) return null;
      if (place.index === 0) movePane(d, splitId, 1, 0);
      ops.select(d, tabId, now());
      return splitId;
    }
    if (active.kind === 'split' && addToSplit(d, active.id, tabId, place.index)) {
      ops.select(d, tabId, now());
      return active.id;
    }
    return null;
  });
  if (!done) return toast('Can’t add that to a split view');
  const split = useKite.getState().s.items[done];
  if (split?.kind === 'split') split.panes.forEach(markLoaded);
}

/** While a tab is dragged over the page: a neutral wash over the part of the page it will take. */
function DropHint({ active }: { active: Item | null }) {
  const dragId = useDnd((st) => (st.target?.type === 'stage' ? st.dragging : null));
  const dragged = useKite((st) => (dragId ? st.s.items[dragId] : null));
  const [place, setPlace] = useState<Place | null>(null);
  const ref = useRef({ active, place });
  ref.current = { active, place };
  const on = dragged?.kind === 'tab';

  useEffect(() => {
    onStageDrop((id) => {
      const p = aim;
      aim = null;
      dropOnPage(id, p);
    });
  }, []);

  useEffect(() => {
    aim = null;
    setPlace(null);
    if (!on || !dragId) return;
    const move = (e: PointerEvent) => {
      const card = document.querySelector('.stage > .card')?.getBoundingClientRect();
      if (!card) return;
      const next = placeFor(ref.current.active, dragId, (e.clientX - card.left) / card.width, (e.clientY - card.top) / card.height);
      aim = next;
      const was = ref.current.place;
      if (next?.index !== was?.index || next?.orientation !== was?.orientation || !next !== !was) setPlace(next);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [on, dragId]);

  if (!on || !place) return null;
  const r = place.rect;
  return (
    <div className="drop-hint" data-testid="drop-hint" aria-hidden="true" style={{ left: `${r.left}%`, top: `${r.top}%`, width: `${r.width}%`, height: `${r.height}%` }}>
      <span>Open here</span>
    </div>
  );
}

function SurfaceSlot({ id, rect, focusedInSplit, inSplit }: { id: ID; rect?: Rect; focusedInSplit: boolean; inSplit: boolean }) {
  const item = useKite((st) => st.s.items[id]) as Extract<Item, { kind: 'tab' }>;
  usePolicySync(id, false);
  // A tab moved into (or out of) an isolated Space reloads with that Space's cookie jar.
  const partition = useKite((st) => partitionForTab(st.s, id));
  const error = useKite((st) => st.ui.loadError[id]);
  const loading = useKite((st) => !!st.ui.loading[id]);
  const visible = !!rect;
  const style = rect
    ? inSplit
      ? paneStyle(rect)
      : { left: `${rect.left}%`, top: `${rect.top}%`, width: `${rect.width}%`, height: `${rect.height}%` }
    : undefined;
  return (
    <div className="surface-slot" data-visible={visible || undefined} data-focused={focusedInSplit || undefined} data-split={inSplit || undefined} style={style} data-testid={`slot-${id}`}>
      {isNewTabUrl(item.url) ? (
        visible && <StartPage tabId={id} />
      ) : sourceTarget(item.url) ? (
        visible && <SourceView url={sourceTarget(item.url)!} partition={partition} />
      ) : (
        <>
          {/* Each page has its own string, so each pane of a Split View shows its own load. */}
          <PageThread loading={loading && visible} />
      <WebSurface
        key={partition}
        partition={partition}
        id={id}
        initialUrl={item.url}
        visible={visible}
        onFail={(err) => setUi((u) => (u.loadError[id] === err || (!err && !u.loadError[id]) ? {} : { loadError: { ...u.loadError, [id]: err ?? undefined } }))}
        onNavigate={(url) => act((d) => ops.updateTab(d, id, { url }, now()))}
        onTitle={(title) => act((d) => ops.updateTab(d, id, { title }, now()))}
        onFavicon={(favicon) => act((d) => ops.updateTab(d, id, { favicon }, now()))}
        onLoading={(l) => setUi((u) => ({ loading: { ...u.loading, [id]: l } }))}
        onNav={(back, forward) => setUi((u) => ({ nav: { ...u.nav, [id]: { back, forward } } }))}
        onLink={(decision, url) => openUrl(url, decision, { sourceTabId: id })}
        onOpen={(url, background) => /^https?:\/\//i.test(url) && openUrl(url, background ? 'background' : 'new')}
        onReady={(handle, url) => {
          setupPage(id, handle, url, false);
          if (useKite.getState().ui.muted[id]) handle.setMuted(true);
        }}
        onMedia={(playing) => setUi((u) => ({ playing: { ...u.playing, [id]: playing } }))}
        onFound={(active, total) => setUi({ findResult: { active, total } })}
        onZoom={(percent) => setUi((u) => ({ zoom: { ...u.zoom, [id]: percent } }))}
        onFocus={() => {
          const sp = ops.activeItemId(useKite.getState().s);
          const it = sp ? useKite.getState().s.items[sp] : null;
          if (it?.kind === 'split' && it.panes.includes(id) && it.panes[it.focused] !== id) act((d) => ops.select(d, id, now()));
        }}
      />
        </>
      )}
      {error && visible && <LoadError id={id} error={error} />}
    </div>
  );
}

