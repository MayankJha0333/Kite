import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Puzzle, Route, RotateCcw, Upload, Download, Wand2, AlertTriangle, PanelLeft, PanelRight, ShieldCheck, Trash2, Search, ChevronRight, X, Plus, FolderOpen, Copy, Palette, Settings2, SlidersHorizontal } from 'lucide-react';
import { listSources } from '@shared/shields';
import type { AppInfo, SitePermission } from '@shared/ipc';
import { AdBlockPage, useShieldsStatus } from './AdBlock';
import { ARCHIVE_CHOICES, SEARCH_ENGINES, SHORTCUT_LABELS, DEFAULT_SHORTCUTS, createInitialState } from '@shared/defaults';
import { clearHistory, exportBackup, readBackup, resetAppearance, resetShortcuts, setShortcut, shortcutConflict, updateSettings, LIMITS, type BackupInfo } from '@shared/settings';
import { formatShortcut, shortcutFromEvent } from '@shared/shortcuts';
import type { ID, Settings as S } from '@shared/types';
import { activeSpace } from '@shared/tree';
import { act, getS, setUi, toast, useKite } from '../store';
import { bridge, isMac } from '../platform';
import { Page, Segmented, Group, Row, SwitchRow } from './Sheet';
import { KiteLogo } from './KiteLogo';
import { EMOJIS } from './Spaces';
import { ThemeControls } from './ThemeEditor';
import { backdropUrl } from '../backdrops';
import { createSpace, deleteSpace, updateSpace } from '@shared/spaces';
import { actions, sleepOtherTabs, switchSpaceCmd, undoable } from '../commands';
import { now } from '../platform';
import { playSound } from '../sound';

type Section = 'spaces' | 'layout' | 'motion' | 'tabs' | 'links' | 'adblock' | 'privacy' | 'extensions' | 'keys' | 'data' | 'about';
type Tab = 'general' | 'appearance' | 'links' | 'privacy' | 'shortcuts' | 'advanced';
interface SectionDef {
  id: Section;
  label: string;
  /** One line under the section title. */
  desc: string;
  /** Extra words the search box matches (what lives in the section). */
  words: string;
}

const SECTIONS: SectionDef[] = [
  { id: 'spaces', label: 'Spaces', desc: 'Name, icon and theme of each Space', words: 'space name icon emoji theme colour color swatch wheel hue mode dark light appearance grain intensity strength logins accounts separate isolated archive delete background' },
  { id: 'layout', label: 'Layout', desc: 'Sidebar, spacing, corners, text size and Favorites', words: 'sidebar side left right width spacing density compact roomy gap margin corner radius roundness favorites columns address bar url close buttons hover text size font scale reset' },
  { id: 'motion', label: 'Motion & Sound', desc: 'Animations, their speed, and interface sounds', words: 'reduce motion animation feel smooth snappy bouncy springy spring speed sound sounds volume audio accessibility' },
  { id: 'tabs', label: 'Tabs', desc: 'Archiving, memory, Peek and videos', words: 'archive tabs little window memory sleep awake tidy titles pinned peek shift click video picture floating pop out' },
  { id: 'links', label: 'Search & Links', desc: 'Your search engine, and where links from other apps open', words: 'search engine google duckduckgo kagi bing custom routing default browser links other apps air traffic rules' },
  { id: 'adblock', label: 'Ad blocking', desc: 'Ads, trackers, filter lists, your rules and tracking protection', words: 'shields ads ad block blocker adblock adguard ublock easylist filters lists trackers cookie notices banners popups annoyances social widgets malware phishing language allowlist exceptions invert custom lists user rules tracking parameters utm referrer referer search queries webrtc ip leak cookies lifetime statistics update' },
  { id: 'privacy', label: 'Privacy & Security', desc: 'Connection, permissions, downloads and your data', words: 'https gpc global privacy control do not track downloads permissions camera microphone location notifications clear data cache cookies history' },
  { id: 'extensions', label: 'Extensions & Boosts', desc: 'Add features to Kite, and restyle the sites you use', words: 'extensions chrome web store boosts restyle hide clutter css' },
  { id: 'keys', label: 'Keyboard', desc: 'Every shortcut, ready to change', words: 'shortcut keys hotkey keyboard' },
  { id: 'data', label: 'Backup & Import', desc: 'Import from Arc, back up, restore or start over', words: 'import arc backup restore export reset erase start over data' },
  { id: 'about', label: 'About Kite', desc: 'Version and credits', words: 'version about credits' },
];

/**
 * Settings is laid out like Arc's: a row of tabs across the top, each holding one or more
 * sections in a single centred column. General first, rare and risky things last.
 */
const TABS: { id: Tab; label: string; icon: React.ReactNode; sections: Section[] }[] = [
  { id: 'general', label: 'General', icon: <Settings2 size={18} />, sections: ['tabs', 'motion'] },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={18} />, sections: ['spaces', 'layout'] },
  { id: 'links', label: 'Links', icon: <Route size={18} />, sections: ['links'] },
  { id: 'privacy', label: 'Privacy', icon: <ShieldCheck size={18} />, sections: ['adblock', 'privacy'] },
  { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={18} />, sections: ['keys'] },
  { id: 'advanced', label: 'Advanced', icon: <SlidersHorizontal size={18} />, sections: ['extensions', 'data', 'about'] },
];
/** Says who a section changes: just this Space, or every Space. */
const SCOPES: Partial<Record<Section, string>> = { spaces: 'This Space', layout: 'All Spaces' };
/** Old links into Settings still land somewhere sensible. */
const ALIASES: Record<string, Section> = { shields: 'adblock', search: 'links', routing: 'links', boosts: 'extensions', backup: 'data', colours: 'spaces', background: 'spaces', theme: 'spaces' };

const tabOf = (s: Section): Tab => TABS.find((t) => t.sections.includes(s))!.id;
const sectionDef = (id: Section) => SECTIONS.find((x) => x.id === id)!;

/** Where a link into Settings lands: a tab, and the section in it to bring into view (null = the top). */
export function resolveSettings(arg: string | undefined): { tab: Tab; section: Section | null } {
  if (arg && TABS.some((t) => t.id === arg) && !SECTIONS.some((x) => x.id === arg)) return { tab: arg as Tab, section: null };
  const sec = arg && SECTIONS.some((x) => x.id === arg) ? (arg as Section) : arg ? ALIASES[arg] : undefined;
  if (!sec) return { tab: 'general', section: null };
  const tab = tabOf(sec);
  return { tab, section: TABS.find((t) => t.id === tab)!.sections[0] === sec ? null : sec };
}

/** Sections whose name, description or contents match what you typed. */
export function matchSections(query: string): Section[] {
  const q = query.trim().toLowerCase();
  if (!q) return SECTIONS.map((x) => x.id);
  const parts = q.split(/\s+/);
  return SECTIONS.filter((x) => {
    const hay = `${x.label} ${x.desc} ${x.words}`.toLowerCase();
    return parts.every((p) => hay.includes(p));
  }).map((x) => x.id);
}

const RENDER: Record<Section, () => React.ReactNode> = {
  tabs: () => <TabsSection />,
  motion: () => <MotionPage />,
  spaces: () => <SpacesPage />,
  layout: () => <LayoutPage />,
  links: () => <SearchLinks />,
  adblock: () => <AdBlockPage />,
  privacy: () => <Privacy />,
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
  const shown = useMemo(() => matchSections(query), [query]);
  const tabs = TABS.filter((t) => t.sections.some((x) => shown.includes(x)));
  const def = TABS.find((t) => t.id === tab)!;
  const sections = def.sections.filter((x) => shown.includes(x));
  const body = useRef<HTMLDivElement>(null);
  // Searching jumps to the first tab that matches.
  useEffect(() => {
    if (tabs.length && !tabs.some((t) => t.id === tab)) setTab(tabs[0].id);
  }, [tabs, tab]);
  // A new tab starts at its top, or at the section a link asked for.
  useEffect(() => {
    const root = body.current;
    if (!root) return;
    const el = jumpTo ? root.querySelector<HTMLElement>(`[data-section="${jumpTo}"]`) : null;
    if (el) el.scrollIntoView({ block: 'start' });
    else root.scrollTop = 0;
  }, [tab, jumpTo]);
  // While searching, bring the first matching setting into view and mark it briefly.
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q || !body.current) return;
    const t = window.setTimeout(() => {
      const root = body.current;
      if (!root) return;
      const hit = Array.from(root.querySelectorAll<HTMLElement>('.set-row-title, .set-group-title, .field-label, .key-label')).find((el) => el.textContent?.toLowerCase().includes(q));
      const row = hit?.closest<HTMLElement>('.set-row, .set-group-head, .field, .key-row') ?? hit;
      if (!row) return;
      root.querySelectorAll('[data-hit]').forEach((el) => el.removeAttribute('data-hit'));
      row.scrollIntoView({ block: 'center', behavior: useKite.getState().s.settings.reduceMotion ? 'auto' : 'smooth' });
      row.setAttribute('data-hit', 'true');
    }, 180);
    return () => window.clearTimeout(t);
  }, [query, tab]);
  return (
    <Page title="Settings" testId="settings">
      <div className="settings">
        <header className="settings-bar">
          <h1 className="settings-title">Settings</h1>
          <div className="settings-tabs" role="tablist" aria-label="Settings">
            {tabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className="settings-tab" data-on={tab === t.id || undefined} data-testid={`settings-${t.id}`} onClick={() => setTab(t.id)}>
                <span className="settings-tab-icon">{t.icon}</span>
                <span className="settings-tab-label">{t.label}</span>
              </button>
            ))}
          </div>
          <label className="settings-search">
            <Search size={13} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search"
              aria-label="Search settings"
              value={query}
              data-testid="settings-search"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query) {
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                  setQuery('');
                }
              }}
            />
            {query && (
              <button className="settings-search-clear" aria-label="Clear search" onClick={() => setQuery('')}>
                <X size={12} />
              </button>
            )}
          </label>
        </header>
        <div className="settings-main" ref={body}>
          {tabs.length === 0 ? (
            <p className="settings-nomatch" data-testid="settings-nomatch">No settings match “{query.trim()}”.</p>
          ) : (
            <div className="settings-body" key={tab} role="tabpanel" aria-label={def.label}>
              {tab === 'general' && !query.trim() && <DefaultBrowserPrompt />}
              {sections.map((id) => {
                const d = sectionDef(id);
                return (
                  <section className="settings-section" key={id} data-section={id} aria-label={d.label}>
                    <header className="settings-section-head">
                      <h2 className="settings-section-title">
                        {d.label}
                        {SCOPES[id] && <span className="settings-scope" data-testid={`settings-scope-${id}`}>{SCOPES[id]}</span>}
                      </h2>
                      <p className="settings-section-desc">{d.desc}</p>
                    </header>
                    {RENDER[id]()}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

/** Arc's first line in General: a nudge to make the browser your default, gone once it is. */
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
      <KiteLogo size={22} />
      <span className="settings-banner-text">
        <b>Kite works best as your default browser</b>
        <span>Links from other apps open here, in the right Space.</span>
      </span>
      <button className="btn small primary" data-testid="settings-make-default" onClick={() => { actions.setDefaultBrowser?.(); setIsDefault(null); window.setTimeout(() => void bridge.isDefaultBrowser().then(setIsDefault), 600); }}>
        Make Default
      </button>
    </div>
  );
}

const set = (patch: Partial<S>) => act((d) => updateSettings(d, patch));

function Slider({ k, label, unit = 'px', step = 1, testId }: { k: keyof typeof LIMITS; label: string; unit?: string; step?: number; testId: string }) {
  const v = useKite((x) => x.s.settings[k] as number);
  const [lo, hi] = LIMITS[k];
  const shown = k === 'fontScale' ? `${Math.round(v * 100)}%` : `${v}${unit}`;
  const change = (n: number) => set({ [k]: n } as Partial<S>);
  return (
    <Row title={label} value={shown}>
      <input type="range" className="range" aria-label={label} min={lo} max={hi} step={step} value={v} data-testid={testId} onChange={(e) => change(Number(e.target.value))} />
    </Row>
  );
}

/** Everything about one Space in one place: who it is, how it looks, how it behaves. */
function SpacesPage() {
  const spaces = useKite((x) => x.s.spaces);
  const space = useKite((x) => activeSpace(x.s));
  const tabs = useKite((x) => (id: ID) => {
    const sp = x.s.spaces.find((y) => y.id === id);
    return sp ? sp.pinned.length + sp.today.length : 0;
  });
  const choose = (id: ID) => {
    if (id !== space.id) switchSpaceCmd(id);
  };
  return (
    <>
      <div className="space-picker" role="tablist" aria-label="Choose a Space to edit" data-testid="space-picker">
        {spaces.map((sp) => (
          <button key={sp.id} role="tab" aria-selected={sp.id === space.id} className="space-pick" data-on={sp.id === space.id || undefined} data-testid={`set-space-${sp.id}`} onClick={() => choose(sp.id)}>
            <span className="space-pick-sw" style={{ background: sp.theme.backdrop ? `center / cover url("${backdropUrl(sp.theme.backdrop, true)}")` : sp.theme.gradient ? `linear-gradient(${sp.theme.gradient.angle}deg, ${sp.theme.gradient.colors.join(', ')})` : `linear-gradient(135deg, ${sp.theme.colors[0]}, ${sp.theme.colors[1]})` }}>{sp.icon}</span>
            <span className="space-pick-text">
              <span className="space-pick-name">{sp.name}</span>
              <span className="space-pick-meta">{tabs(sp.id)} tab{tabs(sp.id) === 1 ? '' : 's'}</span>
            </span>
          </button>
        ))}
        <button className="space-pick add" data-testid="set-space-new" onClick={() => { const id = act((d) => createSpace(d, {})); switchSpaceCmd(id); }}>
          <span className="space-pick-sw"><Plus size={16} /></span>
          <span className="space-pick-text"><span className="space-pick-name">New Space</span></span>
        </button>
      </div>

      <Group title="Theme" desc={`How “${space.name}” paints the window. Changes apply as you make them.`}>
        <div className="set-theme">
          <ThemeControls key={space.id} spaceId={space.id} />
        </div>
      </Group>

      <Group title="Name & icon">
        <Row title="Name">
          <input key={space.id} className="input" aria-label="Space name" data-testid="set-space-name" defaultValue={space.name} onChange={(e) => act((d) => updateSpace(d, space.id, { name: e.target.value }))} />
        </Row>
        <Row title="Icon" desc="Pick one or type any emoji" stack>
          <div className="emoji-grid">
            {EMOJIS.map((e) => (
              <button key={e} className="emoji" aria-label={`Icon ${e}`} data-on={space.icon === e || undefined} onClick={() => act((d) => updateSpace(d, space.id, { icon: e }))}>
                {e}
              </button>
            ))}
            <input key={`i-${space.id}`} className="input emoji-input" aria-label="Your own icon" maxLength={4} placeholder="✎" data-testid="set-space-icon" onChange={(e) => e.target.value && act((d) => updateSpace(d, space.id, { icon: e.target.value }))} />
          </div>
        </Row>
      </Group>


      <Group title="Behaviour">
        <SwitchRow
          title="Separate logins"
          desc="Its own cookies, sign-ins and site data, so you can use a second account on the same sites. Favorites stay shared."
          checked={!!space.isolated}
          testId="set-space-isolated"
          onChange={(isolated) => {
            act((d) => updateSpace(d, space.id, { isolated }));
            toast(isolated ? `“${space.name}” now has its own logins and cookies. Its tabs reloaded.` : `“${space.name}” shares logins with your other Spaces again. Its tabs reloaded.`);
          }}
        />
        <Row title="Archive unused tabs after" desc="Overrides the setting in Tabs, for this Space only">
          <select
            className="input"
            aria-label="Archive unused tabs in this Space after"
            data-testid="set-space-archive"
            value={space.archiveAfterMs === undefined ? 'global' : String(space.archiveAfterMs)}
            onChange={(e) => act((d) => updateSpace(d, space.id, { archiveAfterMs: e.target.value === 'global' ? undefined : e.target.value === 'null' ? null : Number(e.target.value) }))}
          >
            <option value="global">Same as Tabs setting</option>
            {ARCHIVE_CHOICES.map((c) => <option key={c.label} value={String(c.ms)}>{c.label}</option>)}
          </select>
        </Row>
      </Group>

      {spaces.length > 1 && (
        <div className="danger-zone">
          <b>Delete “{space.name}”</b>
          <span className="muted">Its pinned tabs and folders move to the Archive. You can undo right after.</span>
          <button className="btn small danger" data-testid="set-space-delete" onClick={() => { const name = space.name; const id = space.id; undoable(`Deleted Space “${name}”`, (d) => void deleteSpace(d, id, now())); }}>
            <Trash2 size={13} /> Delete Space
          </button>
        </div>
      )}
    </>
  );
}

function LayoutPage() {
  const st = useKite((x) => x.s.settings);
  return (
    <>
      <Group title="Sidebar">
        <Row title="Side">
          <Segmented testId="set-side" value={st.sidebarSide} onChange={(v) => set({ sidebarSide: v })} options={[{ value: 'left', label: <><PanelLeft size={13} /> Left</> }, { value: 'right', label: <><PanelRight size={13} /> Right</> }]} />
        </Row>
        <Slider k="sidebarWidth" label="Width" testId="set-width" />
        <SwitchRow title="Address bar in the sidebar" checked={st.showUrlBar} onChange={(v) => set({ showUrlBar: v })} testId="set-urlbar" />
        <SwitchRow title="Close buttons on hover" desc="Otherwise only the selected tab shows one" checked={st.showTabCloseOnHover} onChange={(v) => set({ showTabCloseOnHover: v })} testId="set-closehover" />
      </Group>
      <Group title="Spacing & shape">
        <Row title="Row height" desc="How tall tabs and rows are">
          <Segmented testId="set-density" value={st.density} onChange={(v) => set({ density: v })} options={[{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }, { value: 'roomy', label: 'Roomy' }]} />
        </Row>
        <Slider k="gap" label="Space around the page" testId="set-gap" />
        <Slider k="radius" label="Corner roundness" testId="set-radius" />
      </Group>
      <Group title="Favorites">
        <Slider k="favoritesColumns" label="Favorites per row" unit="" testId="set-favcols" />
      </Group>
      <Group title="Text" desc="Kite's own text. Web pages keep their size.">
        <Slider k="fontScale" label="Text size" step={0.05} testId="set-scale" />
      </Group>
      <Group>
        <Row title="Reset layout" desc="Sidebar, spacing, text size, motion and sound back to their defaults">
          <button className="btn small" data-testid="set-reset-appearance" onClick={() => { act(resetAppearance); toast('Layout reset'); }}>
            <RotateCcw size={13} /> Reset
          </button>
        </Row>
      </Group>
    </>
  );
}

function MotionPage() {
  const st = useKite((x) => x.s.settings);
  return (
    <>
      <Group title="Motion" desc="How things move. Kite also follows your system's Reduce Motion setting.">
        <SwitchRow title="Reduce motion" desc="Turn off animations and transitions, including moving backgrounds" checked={st.reduceMotion} onChange={(v) => set({ reduceMotion: v })} testId="set-motion" />
        <Row title="Feel" off={st.reduceMotion}>
          <Segmented testId="set-feel" value={st.motionFeel} onChange={(v) => set({ motionFeel: v })} options={[{ value: 'style', label: 'From style' }, { value: 'smooth', label: 'Smooth' }, { value: 'snappy', label: 'Snappy' }, { value: 'bouncy', label: 'Bouncy' }, { value: 'spring', label: 'Springy' }]} />
        </Row>
        <Row title="Speed" value={st.motionSpeed === 1 ? 'Normal' : `${st.motionSpeed.toFixed(2).replace(/0$/, '')}× ${st.motionSpeed > 1 ? 'faster' : 'slower'}`} off={st.reduceMotion}>
          <input type="range" className="range" aria-label="Animation speed" min={LIMITS.motionSpeed[0]} max={LIMITS.motionSpeed[1]} step={0.25} value={st.motionSpeed} data-testid="set-speed" onChange={(e) => set({ motionSpeed: Number(e.target.value) })} />
        </Row>
      </Group>
      <Group title="Sound">
        <SwitchRow title="Interface sounds" desc="Soft sounds for tabs, Spaces and downloads" checked={st.sounds} onChange={(v) => set({ sounds: v })} testId="set-sounds" />
        <Row title="Volume" value={`${Math.round(st.soundVolume * 100)}%`} off={!st.sounds}>
          <span className="look-inline-range">
            <input type="range" className="range" aria-label="Volume" min={0} max={1} step={0.05} value={st.soundVolume} data-testid="set-volume" onChange={(e) => set({ soundVolume: Number(e.target.value) })} />
            <button className="btn small" data-testid="set-sound-test" onClick={(e) => { e.preventDefault(); playSound('done', true); }}>Play</button>
          </span>
        </Row>
      </Group>
    </>
  );
}

function archiveValue(ms: number | null) {
  return String(ms);
}

function TabsSection() {
  const st = useKite((x) => x.s.settings);
  return (
    <>
      <Group title="Tidying up" desc="Pinned tabs and Favorites are never archived.">
        <Row title="Archive unused tabs after">
          <select className="input" aria-label="Archive unused tabs after" value={archiveValue(st.archiveAfterMs)} data-testid="set-archive" onChange={(e) => set({ archiveAfterMs: e.target.value === 'null' ? null : Number(e.target.value) })}>
            {ARCHIVE_CHOICES.map((c) => <option key={c.label} value={archiveValue(c.ms)}>{c.label}</option>)}
          </select>
        </Row>
        <Row title="Close little windows after">
          <select className="input" aria-label="Close little windows after" value={archiveValue(st.littleArchiveAfterMs)} data-testid="set-little-archive" onChange={(e) => set({ littleArchiveAfterMs: e.target.value === 'null' ? null : Number(e.target.value) })}>
            {ARCHIVE_CHOICES.map((c) => <option key={c.label} value={archiveValue(c.ms)}>{c.label}</option>)}
          </select>
        </Row>
        <SwitchRow title="Tidy titles when pinning" desc="“Inbox – Gmail” becomes “Inbox”" checked={st.tidyTitles} onChange={(v) => set({ tidyTitles: v })} testId="set-tidy" />
      </Group>
      <Group title="Memory" desc="Older tabs sleep: their page unloads and reloads when you open them. Playing tabs never sleep.">
        <Row title="Tabs kept awake" value={`${st.awakeTabs} tabs`}>
          <input type="range" className="range" aria-label="Tabs kept awake" min={LIMITS.awakeTabs[0]} max={LIMITS.awakeTabs[1]} value={st.awakeTabs} data-testid="set-awake" onChange={(e) => set({ awakeTabs: Number(e.target.value) })} />
        </Row>
        <Row title="Free up memory now" desc="Puts every tab to sleep except the one you're on">
          <button className="btn small" data-testid="set-sleep-now" onClick={(e) => { e.preventDefault(); sleepOtherTabs(); }}>Sleep other tabs</button>
        </Row>
      </Group>
      <Group title="Peek" desc="A quick look at a link without leaving the page you are on.">
        <SwitchRow title="Peek from pinned tabs" desc="Links from pinned tabs to other sites open in Peek" checked={st.peekOnExternalLinksFromPinned} onChange={(v) => set({ peekOnExternalLinksFromPinned: v })} testId="set-peek-pinned" />
        <SwitchRow title="Shift-click to Peek" checked={st.peekOnShiftClick} onChange={(v) => set({ peekOnShiftClick: v })} testId="set-peek-shift" />
      </Group>
      <Group title="Videos" desc="The floating window can be moved and resized anywhere on screen.">
        <SwitchRow title="Pop out a playing video" desc="When you switch to another tab" checked={st.autoPip} onChange={(v) => set({ autoPip: v })} testId="set-autopip" />
        <SwitchRow title="Also when you switch apps" checked={st.autoPip && st.autoPipOnAppSwitch} onChange={(v) => set({ autoPipOnAppSwitch: v })} testId="set-autopip-app" off={!st.autoPip} />
      </Group>
    </>
  );
}

function SearchLinks() {
  const st = useKite((x) => x.s.settings);
  const routes = useKite((x) => x.s.routes.length);
  const custom = !SEARCH_ENGINES.some((e) => e.template === st.searchEngine);
  const [tpl, setTpl] = useState(custom ? st.searchEngine : '');
  // The box for your own engine shows only once you pick "Custom…".
  const [ownEngine, setOwnEngine] = useState(custom);
  return (
    <>
      <Group title="Search">
        <Row title="Search engine">
          <select
            className="input"
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
        <Row title="Your own search engine" desc="A full https:// address with %s where the words go" stack>
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); set({ searchEngine: tpl, searchEngineChosen: true }); toast(getS().settings.searchEngine === tpl ? 'Search engine saved' : 'Use a full https:// address with %s where the words go'); }}>
            <input className="input" aria-label="Custom search address" placeholder="https://example.com/search?q=%s" value={tpl} data-testid="set-engine-custom" onChange={(e) => setTpl(e.target.value)} />
            <button className="btn">Use</button>
          </form>
        </Row>
        )}
      </Group>
      <Group title="Links from other apps" desc="Choose which Space, or a little window, opens links you click in Mail, Slack and other apps.">
        <button className="set-link" data-testid="settings-open-routing" onClick={() => setUi({ panel: 'routing' })}>
          <span className="import-swatch"><Route size={16} /></span>
          <span className="set-row-text"><span className="set-row-title">Link Routing</span><span className="set-row-desc">{routes} rule{routes === 1 ? '' : 's'} · make Kite your default browser</span></span>
          <ChevronRight size={15} className="set-link-chevron" />
        </button>
      </Group>
    </>
  );
}

function Extensions() {
  const boosts = useKite((x) => x.s.boosts.length);
  return (
    <>
      <Group title="Extensions" desc="Chrome extensions add features to Kite.">
        <button className="set-link" data-testid="settings-open-extensions" onClick={() => setUi({ panel: 'extensions' })}>
          <span className="import-swatch"><Puzzle size={16} /></span>
          <span className="set-row-text"><span className="set-row-title">Manage extensions</span><span className="set-row-desc">Add, turn off or remove extensions</span></span>
          <ChevronRight size={15} className="set-link-chevron" />
        </button>
      </Group>
      <Group title="Boosts" desc="Restyle the sites you use, or hide what you never read. Boosts stay on this computer.">
        <button className="set-link" data-testid="settings-open-boosts" onClick={() => setUi({ panel: 'boosts' })}>
          <span className="import-swatch"><Wand2 size={16} /></span>
          <span className="set-row-text"><span className="set-row-title">Your Boosts</span><span className="set-row-desc">{boosts} Boost{boosts === 1 ? '' : 's'}</span></span>
          <ChevronRight size={15} className="set-link-chevron" />
        </button>
      </Group>
    </>
  );
}


function Privacy() {
  const st = useKite((x) => x.s.settings);
  const historyCount = useKite((x) => x.s.history.length);
  const sh = st.shields;
  const status = useShieldsStatus();
  const [perms, setPerms] = useState<SitePermission[]>([]);
  const [what, setWhat] = useState({ cookies: true, cache: true, storage: true });
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    void bridge.permissions().then(setPerms);
    return bridge.onPermissions(setPerms);
  }, []);
  return (
    <>
      <Group title="Ad blocking" desc="Ads, trackers, filter lists, your own rules and tracking protection.">
        <button className="set-row set-link" data-testid="privacy-open-adblock" onClick={() => setUi({ panel: 'settings', panelArg: 'adblock' })}>
          <span className="set-row-text">
            <span className="set-row-title">{sh.enabled ? 'On' : 'Off'}{status?.blocked ? ` · ${status.blocked.total.toLocaleString()} blocked` : ''}</span>
            <span className="set-row-desc">{sh.enabled ? `${listSources(sh, status?.languages ?? []).length} filter lists${sh.allow.length ? `, ${sh.allow.length} site${sh.allow.length === 1 ? '' : 's'} allowed` : ''}` : 'Ads and trackers load on every site'}</span>
          </span>
          <ChevronRight size={15} className="set-link-chevron" />
        </button>
      </Group>

      <Group title="Connection">
        <SwitchRow title="HTTPS-only" desc="Always use a secure connection when a site offers one" checked={st.httpsOnly} onChange={(v) => set({ httpsOnly: v })} testId="set-https" />
        <SwitchRow title="Global Privacy Control" desc="Tell sites not to sell or share my data" checked={st.sendGpc} onChange={(v) => set({ sendGpc: v })} testId="set-gpc" />
      </Group>

      <Group title="Downloads" desc="Kite always asks before keeping a file that can run programs (apps, installers, scripts).">
        <SwitchRow title="Ask where to save each file" checked={st.askWhereToSave} onChange={(v) => set({ askWhereToSave: v })} testId="set-ask-save" label="Ask where to save" />
        <Row title="Accelerate downloads" desc="Big files come down over several connections at once, like a download manager. Paused ones carry on after Kite restarts.">
          <select className="input" aria-label="Connections per download" data-testid="set-download-connections" value={st.downloadConnections} onChange={(e) => set({ downloadConnections: Number(e.target.value) })}>
            <option value={1}>Off</option>
            <option value={4}>4 connections</option>
            <option value={8}>8 connections</option>
            <option value={16}>16 connections</option>
          </select>
        </Row>
      </Group>

      <Group title="Site permissions" desc="Sites must ask before using your camera, microphone, location or notifications. These are the answers you chose to remember.">
        <div className="perm-list" data-testid="perm-list">
          {perms.length === 0 && <span className="muted set-empty">Nothing remembered yet.</span>}
          {perms.map((p) => (
            <div className="perm-row" key={`${p.site}|${p.permission}`} data-allowed={p.allowed || undefined}>
              <b>{p.site}</b>
              <span>{p.allowed ? 'may' : 'may not'} {p.label}</span>
              <button className="icon-btn tiny" aria-label="Forget" title="Forget (the site will ask again)" onClick={() => bridge.forgetPermission(p.site, p.permission)}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
        {perms.length > 0 && (
          <Row title="Forget every answer">
            <button className="btn small" data-testid="perm-forget-all" onClick={() => bridge.forgetPermission()}>Forget all</button>
          </Row>
        )}
      </Group>

      <Group title="Clear browsing data" desc="Clears it in every Space.">
        <Row title="Browsing history" desc={`${historyCount} page${historyCount === 1 ? '' : 's'} · what the command bar and new tab page suggest from`}>
          <span className="inline-form">
            <button className="btn small" data-testid="set-open-history" onClick={() => setUi({ panel: 'history' })}>View</button>
            <button className="btn small" data-testid="set-clear-history" disabled={!historyCount} onClick={() => { act(clearHistory); toast('History cleared'); }}>
              Clear history
            </button>
          </span>
        </Row>
        <SwitchRow title="Cookies" desc="Signs you out of sites" checked={what.cookies} onChange={(v) => setWhat({ ...what, cookies: v })} testId="clear-cookies" />
        <SwitchRow title="Site data" desc="Data sites saved on this computer" checked={what.storage} onChange={(v) => setWhat({ ...what, storage: v })} testId="clear-storage" />
        <SwitchRow title="Cache" desc="Cached images and files" checked={what.cache} onChange={(v) => setWhat({ ...what, cache: v })} testId="clear-cache" />
        <Row title={confirm ? 'Clear the selected data in every Space?' : 'Clear now'}>
          {confirm ? (
            <span className="inline-form">
              <button className="btn small" onClick={() => setConfirm(false)}>Cancel</button>
              <button className="btn small danger-solid" data-testid="clear-data-confirm" onClick={async () => { await bridge.clearData(what); setConfirm(false); toast('Browsing data cleared in every Space'); }}>Clear in every Space</button>
            </span>
          ) : (
            <button className="btn small danger" data-testid="clear-data" disabled={!what.cookies && !what.cache && !what.storage} onClick={() => setConfirm(true)}>Clear…</button>
          )}
        </Row>
      </Group>
    </>
  );
}

function Recorder({ action }: { action: string }) {
  const combo = useKite((x) => x.s.settings.shortcuts[action] ?? '');
  const [rec, setRec] = useState(false);
  const [warn, setWarn] = useState('');
  return (
    <div className="key-row" data-testid={`key-${action}`}>
      <span className="key-label">{SHORTCUT_LABELS[action] ?? action}</span>
      <button
        className="key-btn"
        data-recording={rec ? 'true' : undefined}
        data-testid={`key-btn-${action}`}
        onClick={() => {
          setWarn('');
          setRec(true);
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
          if (other) setWarn(`Was used by “${SHORTCUT_LABELS[other] ?? other}” — that one now has no shortcut.`);
        }}
      >
        {rec ? 'Press keys…' : combo ? formatShortcut(combo, isMac) : <span className="muted">None</span>}
      </button>
      {combo !== (DEFAULT_SHORTCUTS[action] ?? '') && (
        <button className="icon-btn tiny" aria-label="Reset" title="Back to default" data-testid={`key-reset-${action}`} onClick={() => act((d) => resetShortcuts(d, action))}>
          <RotateCcw size={12} />
        </button>
      )}
      {warn && <span className="key-warn" data-testid="key-warn"><AlertTriangle size={12} /> {warn}</span>}
    </div>
  );
}

function Keys() {
  return (
    <>
      <p className="settings-intro">
        Click a shortcut, then press the new keys. <kbd>⌫</kbd> removes it, <kbd>esc</kbd> cancels. “{SHORTCUT_LABELS.littleWindow}” also works when Kite is in the background. {isMac ? '⌘1–⌘9 jump to tabs and ⌃1–⌃9 to Spaces.' : 'Ctrl+1–9 jump to tabs and Alt+1–9 to Spaces.'}
      </p>
      <Group>
        <div className="keys">
          {Object.keys(DEFAULT_SHORTCUTS).map((a) => (
            <Recorder key={a} action={a} />
          ))}
        </div>
      </Group>
      <div className="settings-actions">
        <button className="btn small" data-testid="keys-reset-all" onClick={() => { act((d) => resetShortcuts(d)); toast('Shortcuts reset'); }}>
          <RotateCcw size={13} /> Reset all shortcuts
        </button>
      </div>
    </>
  );
}


function Data() {
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState('');
  const [pending, setPending] = useState<BackupInfo | null>(null);
  return (
    <>
      <p className="settings-intro">
        Everything Kite knows lives in one file on this computer. No account, no server, nothing is sent anywhere.
      </p>
      <Group title="Bring things in">
        <button className="set-link" data-testid="settings-import-arc" onClick={() => setUi({ panel: 'import' })}>
          <span className="import-swatch"><Download size={16} /></span>
          <span className="set-row-text"><span className="set-row-title">Import from Arc</span><span className="set-row-desc">Bring your Spaces, pinned tabs, folders and Favorites</span></span>
          <ChevronRight size={15} className="set-link-chevron" />
        </button>
      </Group>
      <Group title="Backups" desc="A single file with all your Spaces, tabs, notes, Boosts and settings.">
      <Row title="Back up or restore">
      <div className="inline-form">
        <button className="btn" data-testid="backup-export" onClick={async () => { if (await bridge.exportFile(`kite-backup-${new Date().toISOString().slice(0, 10)}.json`, exportBackup(getS()))) toast('Backup saved'); }}>
          <Download size={14} /> Back up…
        </button>
        <label className="btn">
          <Upload size={14} /> Restore…
          <input
            type="file"
            accept=".json"
            hidden
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
      </div>
      </Row>
      </Group>
      {err && <div className="import-error" data-testid="backup-error"><AlertTriangle size={14} /> {err}</div>}
      {pending && (
        <div className="danger-zone" data-testid="backup-confirm">
          <b>Replace everything in Kite with this backup?</b>
          <span className="muted">
            It has {pending.spaces} Space{pending.spaces === 1 ? '' : 's'}, {pending.tabs} tab{pending.tabs === 1 ? '' : 's'}, {pending.notes} note{pending.notes === 1 ? '' : 's'} and {pending.boosts} Boost{pending.boosts === 1 ? '' : 's'}.
            {pending.scriptsRemoved > 0 && ` ${pending.scriptsRemoved} Boost script${pending.scriptsRemoved === 1 ? ' was' : 's were'} left out for safety.`} A daily copy of your current data stays in Kite’s backups folder.
          </span>
          <span className="inline-form">
            <button className="btn small" onClick={() => setPending(null)}>Cancel</button>
            <button
              className="btn small danger-solid"
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
      <div className="danger-zone">
        <b>Start over</b>
        <span className="muted">Removes all Spaces, tabs, notes, Boosts and settings from Kite.</span>
        {confirm ? (
          <span className="inline-form">
            <button className="btn small" onClick={() => setConfirm(false)}>Cancel</button>
            <button className="btn small danger-solid" data-testid="reset-all-confirm" onClick={() => { act((d) => Object.assign(d, createInitialState())); setConfirm(false); setUi({ panel: null, loaded: [] }); toast('Kite was reset'); }}>
              Yes, erase everything
            </button>
          </span>
        ) : (
          <button className="btn small danger" data-testid="reset-all" onClick={() => setConfirm(true)}>Reset Kite…</button>
        )}
      </div>
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
    <div className="about" data-testid="about">
      <span className="about-mark"><KiteLogo size={64} /></span>
      <h3>Kite</h3>
      <p className="muted" data-testid="about-version">Version {__KITE_VERSION__}</p>
      <p className="about-line">A calm, sidebar-first browser that works fully offline. No account, no server.</p>
      <p className="muted">Made by Mayank Jha · Built with Electron, React and TypeScript · MIT licence</p>
      <div className="inline-form about-actions">
        <button className="btn small" data-testid="about-shortcuts" onClick={() => setUi({ panel: 'shortcuts' })}><Keyboard size={13} /> Keyboard shortcuts</button>
        <button className="btn small" data-testid="about-data" onClick={() => bridge.revealData()}><FolderOpen size={13} /> Show data folder</button>
        <button className="btn small" data-testid="about-copy" onClick={async () => { try { await navigator.clipboard.writeText(details || `Kite ${__KITE_VERSION__}`); } catch { /* clipboard unavailable */ } toast('Version details copied'); }}><Copy size={13} /> Copy details</button>
      </div>
      {info && (
        <p className="muted about-details" data-testid="about-details">
          {details}
          <br />
          Data: <code>{info.dataDir}</code>
        </p>
      )}
    </div>
  );
}
