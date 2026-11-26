import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, RotateCcw, Upload, Download, AlertTriangle, ShieldCheck, Trash2, ChevronRight, Palette, Settings2, SlidersHorizontal } from 'lucide-react';
import type { AppInfo, SitePermission } from '@shared/ipc';
import type { UpdateInfo } from '@shared/updates';
import { AdBlockPage } from './AdBlock';
import { ARCHIVE_CHOICES, SEARCH_ENGINES, SHORTCUT_LABELS, DEFAULT_SHORTCUTS, createInitialState } from '@shared/defaults';
import { clearHistory, exportBackup, readBackup, resetAppearance, resetShortcuts, setShortcut, shortcutConflict, updateSettings, LIMITS, type BackupInfo } from '@shared/settings';
import { CORNERS, DENSITIES, MARGINS, TEXT_SIZES, cornerOf, marginOf, textSizeOf } from '@shared/customize';
import { formatShortcut, shortcutFromEvent } from '@shared/shortcuts';
import type { Settings as S } from '@shared/types';
import { activeSpace } from '@shared/tree';
import { act, getS, setUi, toast, useKite } from '../store';
import { bridge, isMac } from '../platform';
import { Page, Segmented, Group, Row, SwitchRow, SearchField, Slider } from './Sheet';
import { KiteLogo } from './KiteLogo';
import { ThemeControls } from './ThemeEditor';
import { actions, sleepOtherTabs, switchSpaceCmd } from '../commands';
import { playSound } from '../sound';
import { checkForUpdateNow, openUpdate } from '../updateRuntime';

type Section = 'search' | 'links' | 'tabs' | 'motion' | 'updates' | 'spaces' | 'layout' | 'adblock' | 'security' | 'keys' | 'extensions' | 'data' | 'about';
type Tab = 'general' | 'appearance' | 'privacy' | 'shortcuts' | 'advanced';
interface SectionDef {
  id: Section;
  /** Read out for the section; also what the search box matches first. */
  label: string;
  /** Extra words the search box matches (what lives in the section). */
  words: string;
}

const SECTIONS: SectionDef[] = [
  { id: 'search', label: 'Search', words: 'search engine google duckduckgo kagi bing brave custom address bar' },
  { id: 'links', label: 'Links from other apps', words: 'link routing default browser links other apps mail slack rules little window' },
  { id: 'tabs', label: 'Tabs, Peek and video', words: 'archive tabs little window memory sleep awake tidy titles pinned peek shift click video picture floating pop out' },
  { id: 'motion', label: 'Motion and sound', words: 'reduce motion animation feel calm smooth snappy bouncy springy spring speed sound sounds volume audio accessibility' },
  { id: 'updates', label: 'Updates', words: 'update updates version check new release download github' },
  { id: 'spaces', label: 'Look of this Space', words: 'space theme color colour swatch hue mode dark light auto appearance grain intensity background picture gradient pattern look preset name icon' },
  { id: 'layout', label: 'Layout', words: 'sidebar side left right width spacing density compact regular roomy gap page margin edge floating airy corner corners radius square soft round favorites columns address bar url close buttons hover text size font scale reset' },
  { id: 'adblock', label: 'Shields', words: 'shields ads ad block blocker adblock adguard ublock easylist filters lists trackers cookie notices banners popups annoyances social widgets malware phishing language exceptions allowlist invert custom lists user rules tracking parameters utm referrer referer search queries webrtc ip leak cookies lifetime fingerprinting amp redirects statistics update' },
  { id: 'security', label: 'Connection, downloads and your data', words: 'https secure connection gpc global privacy control do not track downloads save accelerate permissions camera microphone location notifications clear browsing data cache cookies history site data' },
  { id: 'keys', label: 'Keyboard shortcuts', words: 'shortcut shortcuts keys hotkey keyboard record' },
  { id: 'extensions', label: 'Extensions and Boosts', words: 'extensions chrome web store boosts restyle hide clutter css' },
  { id: 'data', label: 'Backup and import', words: 'import arc backup back up restore export reset erase start over data' },
  { id: 'about', label: 'About Kite', words: 'version about credits data folder license' },
];

/**
 * Settings is laid out like a Mac settings window: a row of tabs across the top, each one
 * page of groups in a single centered column. Everyday things first, rare and risky last.
 */
const TABS: { id: Tab; label: string; icon: React.ReactNode; sections: Section[] }[] = [
  { id: 'general', label: 'General', icon: <Settings2 size={16} />, sections: ['search', 'links', 'tabs', 'motion', 'updates'] },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={16} />, sections: ['spaces', 'layout'] },
  { id: 'privacy', label: 'Privacy', icon: <ShieldCheck size={16} />, sections: ['adblock', 'security'] },
  { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={16} />, sections: ['keys'] },
  { id: 'advanced', label: 'Advanced', icon: <SlidersHorizontal size={16} />, sections: ['extensions', 'data', 'about'] },
];
/** Older and looser names for a section, so every link into Settings still lands in the right place. */
const ALIASES: Record<string, Section> = { shields: 'adblock', routing: 'links', boosts: 'extensions', backup: 'data', colours: 'spaces', colors: 'spaces', background: 'spaces', theme: 'spaces', sound: 'motion', peek: 'tabs', video: 'tabs', update: 'updates', connection: 'security', permissions: 'security' };

const tabOf = (s: Section): Tab => TABS.find((t) => t.sections.includes(s))!.id;
const sectionDef = (id: Section) => SECTIONS.find((x) => x.id === id)!;

/**
 * Where a link into Settings lands: a tab, and the section in it to bring into view (null =
 * the top). A tab's own name always means its top, so clicking "Privacy" never opens half
 * way down the page; only a link that names a section further down scrolls to it.
 */
export function resolveSettings(arg: string | undefined): { tab: Tab; section: Section | null } {
  if (!arg) return { tab: 'general', section: null };
  const named = TABS.find((t) => t.id === arg);
  if (named) return { tab: named.id, section: null };
  const sec = SECTIONS.some((x) => x.id === arg) ? (arg as Section) : ALIASES[arg];
  if (!sec) return { tab: 'general', section: null };
  const tab = tabOf(sec);
  return { tab, section: TABS.find((t) => t.id === tab)!.sections[0] === sec ? null : sec };
}

/** Sections whose name or contents match what you typed. */
export function matchSections(query: string): Section[] {
  const q = query.trim().toLowerCase();
  if (!q) return SECTIONS.map((x) => x.id);
  const parts = q.split(/\s+/);
  return SECTIONS.filter((x) => {
    const hay = `${x.label} ${x.words}`.toLowerCase();
    return parts.every((p) => hay.includes(p));
  }).map((x) => x.id);
}

const RENDER: Record<Section, () => React.ReactNode> = {
  search: () => <SearchEngine />,
  links: () => <Links />,
  tabs: () => <TabsSection />,
  motion: () => <MotionSound />,
  updates: () => <Updates />,
  spaces: () => <Look />,
  layout: () => <Layout />,
  adblock: () => <AdBlockPage />,
  security: () => <Security />,
  keys: () => <Keys />,
  extensions: () => <Extensions />,
  data: () => <Data />,
  about: () => <About />,
};

export function SettingsPanel() {
  // The open tab lives in the app state, so other parts of Kite can link to a section.
  const target = useKite((x) => {
    // While leaving, keep showing the tab that was open (see Sheet.tsx).
    const panel = x.ui.panel ?? x.ui.leaving?.panel;
    return panel === 'shortcuts' ? 'shortcuts' : (x.ui.panel ? x.ui.panelArg : x.ui.leaving?.panelArg) ?? '';
  });
  const { tab, section: jumpTo } = resolveSettings(target || undefined);
  const setTab = (id: Tab) => setUi({ panel: 'settings', panelArg: id });
  const [query, setQuery] = useState('');
  const q = query.trim();
  const shown = useMemo(() => matchSections(query), [query]);
  const tabs = TABS.filter((t) => t.sections.some((x) => shown.includes(x)));
  const def = TABS.find((t) => t.id === tab)!;
  const sections = def.sections.filter((x) => shown.includes(x));
  const body = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  // How far down each tab was left, for as long as Settings stays open.
  const places = useRef<Partial<Record<Tab, number>>>({});
  // Searching jumps to the first tab that matches.
  useEffect(() => {
    if (tabs.length && !tabs.some((t) => t.id === tab)) setTab(tabs[0].id);
  }, [tabs, tab]);
  // A tab opens at its top the first time and where you left it after that; a link that
  // names a section brings that section into view instead.
  useLayoutEffect(() => {
    const root = body.current;
    if (!root) return;
    const el = jumpTo ? root.querySelector<HTMLElement>(`[data-section="${jumpTo}"]`) : null;
    if (el) el.scrollIntoView({ block: 'start' });
    else root.scrollTop = places.current[tab] ?? 0;
    strip.current?.querySelector('[data-on]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [tab, jumpTo]);
  // While searching, bring the first matching setting into view and mark it for a moment.
  useEffect(() => {
    const needle = q.toLowerCase();
    if (!needle || !body.current) return;
    const t = window.setTimeout(() => {
      const root = body.current;
      if (!root) return;
      const hit = Array.from(root.querySelectorAll<HTMLElement>('.set-row-title, .set-group-title, .key-label, .te-label')).find((el) => el.textContent?.toLowerCase().includes(needle));
      const row = hit?.closest<HTMLElement>('.set-row, .set-group-head, .key-row, .te-sec') ?? hit;
      if (!row) return;
      // A match behind a closed disclosure ("Patterns", "More layout options") opens what hides it.
      for (let d = row.closest('details'); d; d = d.parentElement?.closest('details') ?? null) d.open = true;
      root.querySelectorAll('[data-hit]').forEach((el) => el.removeAttribute('data-hit'));
      row.scrollIntoView({ block: 'center' });
      void row.offsetWidth; // so the mark plays again when the same row matches the next word
      row.setAttribute('data-hit', 'true');
    }, 180);
    return () => window.clearTimeout(t);
  }, [q, tab]);
  // The arrow keys move along the tabs, as in any tab bar.
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const by = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!by) return;
    e.preventDefault();
    const next = tabs[(i + by + tabs.length) % tabs.length];
    setTab(next.id);
    strip.current?.querySelector<HTMLElement>(`[data-testid="settings-${next.id}"]`)?.focus();
  };
  return (
    <Page title="Settings" testId="settings">
      <div className="settings">
        <header className="settings-bar">
          <div className="settings-tabs" role="tablist" aria-label="Settings" ref={strip}>
            {tabs.map((t, i) => (
              <button key={t.id} role="tab" id={`settings-tab-${t.id}`} aria-selected={tab === t.id} aria-controls="settings-panel" tabIndex={tab === t.id ? 0 : -1} className="settings-tab" data-on={tab === t.id || undefined} data-testid={`settings-${t.id}`} onClick={() => setTab(t.id)} onKeyDown={(e) => onTabKey(e, i)}>
                <span className="settings-tab-icon" aria-hidden="true">{t.icon}</span>
                <span className="settings-tab-label">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="settings-search">
            <SearchField value={query} onChange={setQuery} placeholder="Search" label="Search settings" testId="settings-search" />
          </div>
        </header>
        <div className="settings-main" ref={body} onScroll={(e) => void (places.current[tab] = e.currentTarget.scrollTop)}>
          {tabs.length === 0 ? (
            <div className="empty" data-testid="settings-nomatch">
              <p>No settings match “{q}”. Try another word, such as “sidebar” or “cookies”.</p>
              <button className="btn" onClick={() => setQuery('')}>Clear search</button>
            </div>
          ) : (
            <div className="settings-body" key={tab} id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${tab}`}>
              <h1 className="settings-page-title">{def.label}</h1>
              {tab === 'general' && !q && <DefaultBrowserPrompt />}
              {sections.map((id) => (
                <section className="settings-section" key={id} data-section={id} aria-label={sectionDef(id).label}>
                  {RENDER[id]()}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

/** The first line in General: a nudge to make Kite the default browser, gone once it is. */
function DefaultBrowserPrompt() {
  const [isDefault, setIsDefault] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void bridge.isDefaultBrowser().then((v) => live && setIsDefault(v)).catch(() => live && setIsDefault(true));
    return () => {
      live = false;
    };
  }, []);
  if (isDefault !== false) return null;
  return (
    <div className="settings-banner" data-testid="settings-default-browser">
      <KiteLogo size={24} />
      <span className="settings-banner-text">
        <b>Make Kite your default browser</b>
        <span>Links from Mail, Messages and other apps then open here, in the Space you choose.</span>
      </span>
      <button className="btn" data-testid="settings-make-default" onClick={() => { actions.setDefaultBrowser?.(); setIsDefault(null); window.setTimeout(() => void bridge.isDefaultBrowser().then(setIsDefault), 600); }}>
        Make default
      </button>
    </div>
  );
}

const set = (patch: Partial<S>) => act((d) => updateSettings(d, patch));
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** A setting on a scale: the slider, and what it is set to beside it. */
function SliderRow({ k, label, desc, shown, step = 1, testId, off }: { k: keyof typeof LIMITS; label: string; desc?: string; shown: (v: number) => string; step?: number; testId: string; off?: boolean }) {
  const v = useKite((x) => x.s.settings[k] as number);
  const [lo, hi] = LIMITS[k];
  return (
    <Row title={label} desc={desc} off={off}>
      <Slider label={label} min={lo} max={hi} step={step} value={v} testId={testId} onChange={(n) => set({ [k]: n } as Partial<S>)} />
      <span className="set-value">{shown(v)}</span>
    </Row>
  );
}

/** A row that opens another panel. */
function LinkRow({ title, desc, testId, onOpen }: { title: string; desc?: string; testId: string; onOpen: () => void }) {
  return (
    <button className="set-row set-link" data-testid={testId} onClick={onOpen}>
      <span className="set-row-text">
        <span className="set-row-title">{title}</span>
        {desc && <span className="set-row-desc">{desc}</span>}
      </span>
      <ChevronRight size={16} className="set-link-chevron" aria-hidden="true" />
    </button>
  );
}

// ---- General ------------------------------------------------------------------------

function SearchEngine() {
  const st = useKite((x) => x.s.settings);
  const custom = !SEARCH_ENGINES.some((e) => e.template === st.searchEngine);
  const [tpl, setTpl] = useState(custom ? st.searchEngine : '');
  // The box for your own engine shows only once you pick "Custom…".
  const [ownEngine, setOwnEngine] = useState(custom);
  return (
    <Group title="Search">
      <Row title="Search engine" desc="Where the words you type in the address bar are sent.">
        <select
          className="select"
          aria-label="Search engine"
          value={custom || ownEngine ? 'custom' : st.searchEngine}
          data-testid="set-engine"
          onChange={(e) => {
            const v = e.target.value;
            setOwnEngine(v === 'custom');
            if (v !== 'custom') set({ searchEngine: v, searchEngineChosen: true });
          }}
        >
          {SEARCH_ENGINES.map((e) => <option key={e.label} value={e.template}>{e.label}</option>)}
          <option value="custom">Custom…</option>
        </select>
      </Row>
      {ownEngine && (
        <Row title="Your own search engine" desc="A full https:// address with %s where the words go." stack>
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); set({ searchEngine: tpl, searchEngineChosen: true }); toast(getS().settings.searchEngine === tpl ? 'Search engine saved' : 'Use a full https:// address with %s where the words go'); }}>
            <input className="input" aria-label="Custom search address" placeholder="https://example.com/search?q=%s" value={tpl} data-testid="set-engine-custom" onChange={(e) => setTpl(e.target.value)} />
            <button className="btn">Use</button>
          </form>
        </Row>
      )}
    </Group>
  );
}

function Links() {
  const routes = useKite((x) => x.s.routes.length);
  return (
    <Group title="Links from other apps" desc="Which Space, or a Little window, opens the links you click in Mail, Slack and other apps.">
      <LinkRow title="Link routing" desc={routes ? `${plural(routes, 'rule')} decide where links open.` : 'Links open in the Space you are in. Add a rule to send some elsewhere.'} testId="settings-open-routing" onOpen={() => setUi({ panel: 'routing' })} />
    </Group>
  );
}

const archiveValue = (ms: number | null) => String(ms);

function TabsSection() {
  const st = useKite((x) => x.s.settings);
  return (
    <>
      <Group title="Tabs" desc="Pinned tabs and Favorites are never archived.">
        <Row title="Archive unused tabs after">
          <select className="select" aria-label="Archive unused tabs after" value={archiveValue(st.archiveAfterMs)} data-testid="set-archive" onChange={(e) => set({ archiveAfterMs: e.target.value === 'null' ? null : Number(e.target.value) })}>
            {ARCHIVE_CHOICES.map((c) => <option key={c.label} value={archiveValue(c.ms)}>{c.label}</option>)}
          </select>
        </Row>
        <Row title="Close Little windows after">
          <select className="select" aria-label="Close Little windows after" value={archiveValue(st.littleArchiveAfterMs)} data-testid="set-little-archive" onChange={(e) => set({ littleArchiveAfterMs: e.target.value === 'null' ? null : Number(e.target.value) })}>
            {ARCHIVE_CHOICES.map((c) => <option key={c.label} value={archiveValue(c.ms)}>{c.label}</option>)}
          </select>
        </Row>
        <SwitchRow title="Tidy titles when pinning" desc="“Inbox – Gmail” becomes “Inbox”." checked={st.tidyTitles} onChange={(v) => set({ tidyTitles: v })} testId="set-tidy" />
        <SliderRow k="awakeTabs" label="Tabs kept awake" desc="Older tabs sleep: their page unloads and comes back when you open them. Tabs that are playing never sleep." shown={(v) => `${v} tabs`} testId="set-awake" />
        <Row title="Free up memory now" desc="Puts every tab to sleep except the one you are on.">
          <button className="btn" data-testid="set-sleep-now" onClick={(e) => { e.preventDefault(); sleepOtherTabs(); }}>Sleep other tabs</button>
        </Row>
      </Group>
      <Group title="Peek and video">
        <SwitchRow title="Peek from pinned tabs" desc="A link from a pinned tab to another site opens as a quick look over the page." checked={st.peekOnExternalLinksFromPinned} onChange={(v) => set({ peekOnExternalLinksFromPinned: v })} testId="set-peek-pinned" />
        <SwitchRow title="Shift-click to Peek" desc="Hold Shift and click any link to look at it without leaving the page." checked={st.peekOnShiftClick} onChange={(v) => set({ peekOnShiftClick: v })} testId="set-peek-shift" />
        <SwitchRow title="Pop out a playing video" desc="When you switch tabs, the video keeps playing in a small window you can move anywhere." checked={st.autoPip} onChange={(v) => set({ autoPip: v })} testId="set-autopip" />
        <SwitchRow title="Also when you switch apps" checked={st.autoPip && st.autoPipOnAppSwitch} onChange={(v) => set({ autoPipOnAppSwitch: v })} testId="set-autopip-app" off={!st.autoPip} sub />
      </Group>
    </>
  );
}

const speedName = (v: number) => (v === 1 ? 'Normal' : `${v.toFixed(2).replace(/\.?0+$/, '')}×`);

function MotionSound() {
  const st = useKite((x) => x.s.settings);
  return (
    <Group title="Motion and sound">
      <SwitchRow title="Reduce motion" desc="Things fade instead of sliding. Kite also follows your Mac’s Reduce Motion setting." checked={st.reduceMotion} onChange={(v) => set({ reduceMotion: v })} testId="set-motion" />
      <Row title="Feel" desc="How sheets, panels and the sidebar move." off={st.reduceMotion}>
        <Segmented testId="set-feel" label="Feel" value={st.motionFeel} onChange={(v) => set({ motionFeel: v })} options={[{ value: 'style', label: 'Calm' }, { value: 'smooth', label: 'Smooth' }, { value: 'snappy', label: 'Snappy' }, { value: 'bouncy', label: 'Bouncy' }, { value: 'spring', label: 'Springy' }]} />
      </Row>
      <SliderRow k="motionSpeed" label="Speed" shown={speedName} step={0.25} testId="set-speed" off={st.reduceMotion} />
      <SwitchRow title="Interface sounds" desc="Soft sounds for tabs, Spaces and finished downloads." checked={st.sounds} onChange={(v) => set({ sounds: v })} testId="set-sounds" />
      <Row title="Volume" off={!st.sounds}>
        <Slider label="Volume" min={LIMITS.soundVolume[0]} max={LIMITS.soundVolume[1]} step={0.05} value={st.soundVolume} testId="set-volume" onChange={(v) => set({ soundVolume: v })} />
        <span className="set-value">{Math.round(st.soundVolume * 100)}%</span>
        <button className="btn" data-testid="set-sound-test" onClick={(e) => { e.preventDefault(); playSound('done', true); }}>Play</button>
      </Row>
    </Group>
  );
}

function Updates() {
  const on = useKite((x) => x.s.settings.checkForUpdates);
  const [version, setVersion] = useState(__KITE_VERSION__);
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<{ text: string; update: UpdateInfo | null } | null>(null);
  useEffect(() => {
    void bridge.appInfo().then((i) => setVersion(i.version)).catch(() => undefined);
  }, []);
  const check = async () => {
    setBusy(true);
    setFound(await checkForUpdateNow());
    setBusy(false);
  };
  return (
    <Group title="Updates">
      <SwitchRow title="Check for updates automatically" desc="Asks github.com once a day whether a newer Kite exists. Nothing about you or your browsing is sent." checked={on} onChange={(v) => set({ checkForUpdates: v })} testId="set-updates" />
      <Row title={`Kite ${version}`}>
        <span className="set-status" role="status" data-testid="update-status">{busy ? 'Checking…' : found?.text}</span>
        <button className="btn" data-testid="update-check" disabled={busy} onClick={() => void check()}>Check now</button>
        {found?.update && <button className="btn primary" data-testid="update-download" onClick={() => openUpdate(found.update!)}>Download</button>}
      </Row>
    </Group>
  );
}

// ---- Appearance ---------------------------------------------------------------------

/** Says who a group changes: just this Space, or every Space. */
const Scope = ({ id, children }: { id: Section; children: string }) => <span className="set-scope" data-testid={`settings-scope-${id}`}>{children}</span>;

function Look() {
  const spaces = useKite((x) => x.s.spaces);
  const space = useKite((x) => activeSpace(x.s));
  return (
    <Group
      title={<>Look <Scope id="spaces">This Space</Scope></>}
      desc={<>How “{space.name}” paints the window. Its name, icon and logins are in <button className="link" data-testid="set-space-edit" onClick={() => setUi({ panel: 'space', panelArg: space.id })}>Edit Space…</button></>}
    >
      {spaces.length > 1 && (
        <Row title="Space" desc="Each Space keeps its own look.">
          <select className="select" aria-label="Space to change" data-testid="set-space" value={space.id} onChange={(e) => switchSpaceCmd(e.target.value)}>
            {spaces.map((sp) => <option key={sp.id} value={sp.id}>{sp.icon} {sp.name}</option>)}
          </select>
        </Row>
      )}
      <ThemeControls key={space.id} spaceId={space.id} />
    </Group>
  );
}

function Layout() {
  const st = useKite((x) => x.s.settings);
  return (
    <>
      <Group title={<>Layout <Scope id="layout">All Spaces</Scope></>}>
        <Row title="Sidebar">
          <Segmented testId="set-side" label="Sidebar side" value={st.sidebarSide} onChange={(v) => set({ sidebarSide: v })} options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]} />
        </Row>
        <Row title="Density">
          <Segmented testId="set-density" label="Density" value={st.density} onChange={(v) => set({ density: v })} options={DENSITIES.map((x) => ({ value: x.id, label: x.name }))} />
        </Row>
        <Row title="Corners">
          <Segmented testId="set-corners" label="Corners" value={cornerOf(st.radius)} onChange={(id) => set({ radius: CORNERS.find((c) => c.id === id)!.radius })} options={CORNERS.map((x) => ({ value: x.id, label: x.name }))} />
        </Row>
        <Row title="Page margin">
          <Segmented testId="set-margin" label="Page margin" value={marginOf(st.gap)} onChange={(id) => set({ gap: MARGINS.find((m) => m.id === id)!.gap })} options={MARGINS.map((x) => ({ value: x.id, label: x.name }))} />
        </Row>
        <Row title="Text size" desc="Kite’s own text. Web pages keep their size.">
          <Segmented testId="set-scale" label="Text size" value={textSizeOf(st.fontScale)} onChange={(id) => set({ fontScale: TEXT_SIZES.find((t) => t.id === id)!.scale })} options={TEXT_SIZES.map((x) => ({ value: x.id, label: x.name }))} />
        </Row>
        <Row title="Reset layout" desc="Sidebar, density, corners, margin, text size, motion and sound go back to how Kite starts.">
          <button className="btn" data-testid="set-reset-appearance" onClick={() => { act(resetAppearance); toast('Layout reset'); }}>
            <RotateCcw size={14} /> Reset
          </button>
        </Row>
      </Group>
      <details className="disclosure set-more">
        <summary data-testid="layout-more">More layout options</summary>
        <Group>
          <SliderRow k="sidebarWidth" label="Sidebar width" shown={(v) => `${v} px`} testId="set-width" />
          <SliderRow k="favoritesColumns" label="Favorites per row" shown={(v) => String(v)} testId="set-favcols" />
          <SwitchRow title="Address bar in the sidebar" checked={st.showUrlBar} onChange={(v) => set({ showUrlBar: v })} testId="set-urlbar" />
          <SwitchRow title="Close buttons on hover" desc="Otherwise only the selected tab shows one." checked={st.showTabCloseOnHover} onChange={(v) => set({ showTabCloseOnHover: v })} testId="set-closehover" />
        </Group>
      </details>
    </>
  );
}

// ---- Privacy (under Shields) --------------------------------------------------------

function Security() {
  const st = useKite((x) => x.s.settings);
  const historyCount = useKite((x) => x.s.history.length);
  const [perms, setPerms] = useState<SitePermission[]>([]);
  const [what, setWhat] = useState({ cookies: true, cache: true, storage: true });
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    void bridge.permissions().then(setPerms);
    return bridge.onPermissions(setPerms);
  }, []);
  const tick = (key: keyof typeof what, title: string, desc: string) => (
    <label className="set-row set-check">
      <input type="checkbox" className="checkbox" checked={what[key]} data-testid={`clear-${key}`} onChange={(e) => setWhat({ ...what, [key]: e.target.checked })} />
      <span className="set-row-text">
        <span className="set-row-title">{title}</span>
        <span className="set-row-desc">{desc}</span>
      </span>
    </label>
  );
  return (
    <>
      <Group title="Connection">
        <SwitchRow title="HTTPS-only" desc="Opens the secure version of a site whenever it has one." checked={st.httpsOnly} onChange={(v) => set({ httpsOnly: v })} testId="set-https" />
        <SwitchRow title="Ask sites not to sell or share my data" desc="Sends the Global Privacy Control and Do Not Track signals with every page." checked={st.sendGpc} onChange={(v) => set({ sendGpc: v })} testId="set-gpc" />
      </Group>

      <Group title="Downloads" desc="Kite always asks before keeping a file that can run programs, such as apps, installers and scripts.">
        <SwitchRow title="Ask where to save each file" checked={st.askWhereToSave} onChange={(v) => set({ askWhereToSave: v })} testId="set-ask-save" label="Ask where to save" />
        <Row title="Faster downloads" desc="Large files come down over several connections at once. Paused ones carry on after Kite restarts.">
          <select className="select" aria-label="Connections per download" data-testid="set-download-connections" value={st.downloadConnections} onChange={(e) => set({ downloadConnections: Number(e.target.value) })}>
            <option value={1}>Off</option>
            <option value={4}>4 connections</option>
            <option value={8}>8 connections</option>
            <option value={16}>16 connections</option>
          </select>
        </Row>
      </Group>

      <Group title="Site permissions" desc="Sites must ask before using your camera, microphone, location or notifications. These are the answers you chose to remember.">
        <div className="perm-list" data-testid="perm-list">
          {perms.length === 0 && <p className="muted set-empty">Nothing remembered yet.</p>}
          {perms.map((p) => (
            <div className="perm-row" key={`${p.site}|${p.permission}`} data-allowed={p.allowed || undefined}>
              <b>{p.site}</b>
              <span>{p.allowed ? 'may' : 'may not'} {p.label}</span>
              <button className="icon-btn small" aria-label={`Forget the answer for ${p.site}`} title="Forget (the site will ask again)" onClick={() => bridge.forgetPermission(p.site, p.permission)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        {perms.length > 0 && (
          <Row title="Forget every answer" desc="Every site asks again.">
            <button className="btn" data-testid="perm-forget-all" onClick={() => bridge.forgetPermission()}>Forget all</button>
          </Row>
        )}
      </Group>

      <Group title="Browsing data" desc="Clearing applies to every Space.">
        <Row title="History" desc={`${plural(historyCount, 'page')}. The command bar and the start page suggest from it.`}>
          <button className="btn" data-testid="set-open-history" onClick={() => setUi({ panel: 'history' })}>View</button>
          <button className="btn" data-testid="set-clear-history" disabled={!historyCount} onClick={() => { act(clearHistory); toast('History cleared'); }}>Clear history</button>
        </Row>
        {tick('cookies', 'Cookies', 'Signs you out of sites.')}
        {tick('storage', 'Site data', 'What sites saved on this computer.')}
        {tick('cache', 'Cache', 'Copies of images and files kept to load pages faster.')}
        <Row title={confirm ? 'Clear the ticked data in every Space?' : 'Clear the ticked data'}>
          {confirm ? (
            <>
              <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
              <button className="btn danger" data-testid="clear-data-confirm" onClick={async () => { await bridge.clearData(what); setConfirm(false); toast('Browsing data cleared in every Space'); }}>Clear in every Space</button>
            </>
          ) : (
            <button className="btn danger" data-testid="clear-data" disabled={!what.cookies && !what.cache && !what.storage} onClick={() => setConfirm(true)}>Clear…</button>
          )}
        </Row>
      </Group>
    </>
  );
}

// ---- Shortcuts ----------------------------------------------------------------------

/** A shortcut as key caps: one per modifier, one for the key. */
function Caps({ combo }: { combo: string }) {
  const text = formatShortcut(combo, isMac);
  if (!text) return <span className="muted">None</span>;
  let keys: string[];
  if (isMac) {
    const mods = text.match(/^[⌃⌥⇧⌘]*/)![0];
    keys = [...mods, text.slice(mods.length)];
  } else {
    // "Ctrl++" is Ctrl and the plus key.
    keys = text.endsWith('++') ? [...text.slice(0, -2).split('+'), '+'] : text.split('+');
  }
  return (
    <span className="keys">
      {keys.filter(Boolean).map((k, i) => <kbd className="kbd" key={i}>{k}</kbd>)}
    </span>
  );
}

function Recorder({ action }: { action: string }) {
  const combo = useKite((x) => x.s.settings.shortcuts[action] ?? '');
  const [rec, setRec] = useState(false);
  // What taking these keys cost another action. It is about one shortcut, so it goes when the shortcut changes again.
  const [taken, setTaken] = useState<{ combo: string; text: string } | null>(null);
  const warn = taken && taken.combo === combo ? taken.text : '';
  const label = SHORTCUT_LABELS[action] ?? action;
  const changed = combo !== (DEFAULT_SHORTCUTS[action] ?? '');
  return (
    <div className="key-row" data-testid={`key-${action}`}>
      <span className="key-label">{label}</span>
      <span className="key-caps" data-testid={`key-caps-${action}`}><Caps combo={combo} /></span>
      <button
        className="btn small key-btn"
        aria-label={rec ? `Press the new keys for ${label}` : `Record a shortcut for ${label}`}
        data-recording={rec ? 'true' : undefined}
        data-testid={`key-btn-${action}`}
        onClick={() => {
          setTaken(null);
          setRec(!rec);
        }}
        onBlur={() => setRec(false)}
        onKeyDown={(e) => {
          if (!rec) return;
          e.preventDefault();
          e.stopPropagation();
          if (e.key === 'Escape') return setRec(false);
          if (e.key === 'Backspace' || e.key === 'Delete') {
            act((d) => void setShortcut(d, action, ''));
            return setRec(false);
          }
          const sc = shortcutFromEvent(e, isMac);
          if (!sc) return;
          const other = shortcutConflict(getS(), action, sc);
          act((d) => void setShortcut(d, action, sc));
          setRec(false);
          if (other) setTaken({ combo: sc, text: `${formatShortcut(sc, isMac)} belonged to “${SHORTCUT_LABELS[other] ?? other}”, which now has no shortcut.` });
        }}
      >
        {rec ? 'Press keys…' : 'Record'}
      </button>
      <button className="icon-btn small key-reset" aria-label={`Reset the shortcut for ${label}`} title="Back to the default" data-idle={!changed || undefined} tabIndex={changed ? undefined : -1} aria-hidden={!changed || undefined} data-testid={changed ? `key-reset-${action}` : undefined} onClick={() => act((d) => resetShortcuts(d, action))}>
        <RotateCcw size={14} />
      </button>
      {warn && <span className="warn key-warn" role="status" data-testid="key-warn"><AlertTriangle size={12} /> {warn}</span>}
    </div>
  );
}

function Keys() {
  const [query, setQuery] = useState('');
  const shortcuts = useKite((x) => x.s.settings.shortcuts);
  const q = query.trim().toLowerCase();
  const all = Object.keys(DEFAULT_SHORTCUTS);
  const shown = q ? all.filter((a) => `${SHORTCUT_LABELS[a] ?? a} ${formatShortcut(shortcuts[a] ?? '', isMac)}`.toLowerCase().includes(q)) : all;
  return (
    <>
      <p className="set-group-desc">
        Press Record, then the new keys. <kbd className="kbd">⌫</kbd> removes a shortcut and <kbd className="kbd">esc</kbd> cancels.
      </p>
      <div className="key-tools">
        <SearchField value={query} onChange={setQuery} placeholder="Search shortcuts" testId="keys-search" />
        <button className="btn" data-testid="keys-reset-all" onClick={() => { act((d) => resetShortcuts(d)); toast('Shortcuts reset'); }}>
          <RotateCcw size={14} /> Reset all
        </button>
      </div>
      {shown.length === 0 ? (
        <div className="empty" data-testid="keys-nomatch"><p>No shortcut matches “{query.trim()}”.</p></div>
      ) : (
        <div className="set-card key-list" data-testid="keys-list">
          {shown.map((a) => <Recorder key={a} action={a} />)}
        </div>
      )}
      <p className="muted set-note">
        “{SHORTCUT_LABELS.littleWindow}” also works while Kite is in the background. {isMac ? '⌘1–⌘9 jump to tabs and ⌃1–⌃9 to Spaces.' : 'Ctrl+1–9 jump to tabs and Alt+1–9 to Spaces.'}
      </p>
    </>
  );
}

// ---- Advanced -----------------------------------------------------------------------

function Extensions() {
  const boosts = useKite((x) => x.s.boosts.length);
  return (
    <Group title="Extensions and Boosts">
      <LinkRow title="Extensions" desc="Add, turn off or remove Chrome extensions." testId="settings-open-extensions" onOpen={() => setUi({ panel: 'extensions' })} />
      <LinkRow title="Boosts" desc={`${plural(boosts, 'Boost')}. Restyle the sites you use, or hide what you never read.`} testId="settings-open-boosts" onOpen={() => setUi({ panel: 'boosts' })} />
    </Group>
  );
}

function Data() {
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState('');
  const [pending, setPending] = useState<BackupInfo | null>(null);
  return (
    <>
      <Group title="Backup and import" desc="Everything Kite knows lives in one file on this computer. No account, no server, nothing sent anywhere.">
        <LinkRow title="Import from Arc" desc="Brings your Spaces, pinned tabs, folders and Favorites." testId="settings-import-arc" onOpen={() => setUi({ panel: 'import' })} />
        <Row title="Back up" desc="Saves one file with all your Spaces, tabs, notes, Boosts and settings.">
          <button className="btn" data-testid="backup-export" onClick={async () => { if (await bridge.exportFile(`kite-backup-${new Date().toISOString().slice(0, 10)}.json`, exportBackup(getS()))) toast('Backup saved'); }}>
            <Download size={14} /> Back up…
          </button>
        </Row>
        <Row title="Restore" desc="Replaces everything in Kite with a backup file. Kite shows what is in it first.">
          <label className="btn">
            <Upload size={14} /> Restore…
            <input
              type="file"
              accept=".json"
              className="visually-hidden"
              data-testid="backup-import"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  setPending(readBackup(await f.text()));
                  setErr('');
                } catch (x) {
                  setPending(null);
                  setErr((x as Error).message);
                }
              }}
            />
          </label>
        </Row>
        {pending && (
          <div className="set-row" data-testid="backup-confirm">
            <span className="set-row-text">
              <span className="set-row-title">Replace everything in Kite with this backup?</span>
              <span className="set-row-desc">
                It has {pending.spaces} Space{pending.spaces === 1 ? '' : 's'}, {pending.tabs} tab{pending.tabs === 1 ? '' : 's'}, {pending.notes} note{pending.notes === 1 ? '' : 's'} and {pending.boosts} Boost{pending.boosts === 1 ? '' : 's'}.
                {pending.scriptsRemoved > 0 && ` ${pending.scriptsRemoved} Boost script${pending.scriptsRemoved === 1 ? ' was' : 's were'} left out for safety.`} A daily copy of your current data stays in Kite’s backups folder.
              </span>
            </span>
            <span className="set-row-control">
              <button className="btn" onClick={() => setPending(null)}>Cancel</button>
              <button
                className="btn danger"
                data-testid="backup-restore-confirm"
                onClick={() => {
                  const before = getS();
                  act((d) => Object.assign(d, pending.state));
                  setPending(null);
                  setUi({ loaded: [] });
                  toast('Backup restored', 'Undo', () => act((d) => Object.assign(d, before)), 10_000);
                }}
              >
                Replace with backup
              </button>
            </span>
          </div>
        )}
      </Group>
      {err && <p className="notice danger set-note" role="alert" data-testid="backup-error"><AlertTriangle size={14} /> {err}</p>}
      <Group title="Start over">
        <Row title={confirm ? 'Erase everything in Kite?' : 'Reset Kite'} desc="Removes all Spaces, tabs, notes, Boosts and settings from this computer.">
          {confirm ? (
            <>
              <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
              <button className="btn danger" data-testid="reset-all-confirm" onClick={() => { act((d) => Object.assign(d, createInitialState())); setConfirm(false); setUi({ panel: null, loaded: [] }); toast('Kite was reset'); }}>
                Erase everything
              </button>
            </>
          ) : (
            <button className="btn danger" data-testid="reset-all" onClick={() => setConfirm(true)}>Reset Kite…</button>
          )}
        </Row>
      </Group>
    </>
  );
}

function About() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  useEffect(() => {
    void bridge.appInfo().then(setInfo).catch(() => undefined);
  }, []);
  const details = info ? [`Kite ${info.version}`, info.electron && `Electron ${info.electron}`, info.chromium && `Chromium ${info.chromium}`, `${info.platform} ${info.arch}`.trim()].filter(Boolean).join(' · ') : '';
  return (
    <>
      <Group title="About Kite" testId="about">
        <div className="set-row">
          <span className="about-id">
            <KiteLogo size={32} />
            <span className="set-row-text">
              <span className="set-row-title">Kite</span>
              <span className="set-row-desc" data-testid="about-version">Version {__KITE_VERSION__}</span>
            </span>
          </span>
          <span className="set-row-control">
            <button className="btn" data-testid="about-copy" onClick={async () => { try { await navigator.clipboard.writeText(details || `Kite ${__KITE_VERSION__}`); } catch { /* clipboard unavailable */ } toast('Version details copied'); }}>Copy details</button>
          </span>
        </div>
        {info && (
          <Row title="Data folder" desc={<span data-testid="about-details">{details}<br /><span className="about-path">{info.dataDir}</span></span>}>
            <button className="btn" data-testid="about-data" onClick={() => bridge.revealData()}>Show folder</button>
          </Row>
        )}
        <LinkRow title="Keyboard shortcuts" desc="Every shortcut, ready to change." testId="about-shortcuts" onOpen={() => setUi({ panel: 'shortcuts' })} />
      </Group>
      <p className="muted set-note">A calm, sidebar-first browser that works fully offline. Made by Mayank Jha with Electron, React and TypeScript. MIT license.</p>
    </>
  );
}
