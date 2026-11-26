// Settings → Privacy → Shields: everything Kite blocks, most important first.
// One switch and what it has done, the cookie-notice switch, the protections most people
// want, the filter lists by purpose, and the sites you have excepted. The rest (finer
// tracking protection, how lists behave, lists by address, your own rules) waits behind
// "Advanced". Modelled on a full-featured blocker's settings (see RESEARCH.md §9).
//
// Changes apply at once. The main process downloads what a change needs and
// rebuilds the filter off the main thread; the status line shows progress.

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronRight, Download, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import {
  COOKIE_MINUTES,
  FILTER_GROUPS,
  FILTER_LISTS,
  MAX_CUSTOM_LISTS,
  MAX_USER_RULES_CHARS,
  UPDATE_HOURS,
  listSources,
  listUrl,
  ruleLines,
  siteKey,
  type FilterGroupId,
  type Shields,
} from '@shared/shields';
import { updateSettings } from '@shared/settings';
import type { ListStatus, ShieldsStatus } from '@shared/ipc';
import { act, getS, toast, useKite } from '../store';
import { bridge } from '../platform';
import { Group, Row, SearchField, Segmented, SwitchRow, Toggle } from './Sheet';

/** The list behind "Hide cookie notices". */
const COOKIE_LIST = 'adguard-cookies';

const setSh = (p: Partial<Shields>) => act((d) => updateSettings(d, { shields: { ...d.settings.shields, ...p } }));

/** The Shields status from the main process, kept current. */
function useShieldsStatus(): ShieldsStatus | null {
  const [status, setStatus] = useState<ShieldsStatus | null>(null);
  useEffect(() => {
    void bridge.shieldsStatus().then(setStatus);
    return bridge.onShieldsStatus(setStatus);
  }, []);
  return status;
}

const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtNum = (n: number) => n.toLocaleString();

const warning = (text: React.ReactNode) => <span className="warn"><AlertTriangle size={12} /> {text}</span>;

function listLine(st: ListStatus | undefined, on: boolean): React.ReactNode {
  if (!on) return null;
  if (!st) return 'Waiting to download';
  if (st.error && !st.updatedAt) return warning(st.error);
  return (
    <>
      {st.rules ? `${fmtNum(st.rules)} rules` : 'Downloading…'}
      {st.updatedAt ? `, updated ${fmtDate(st.updatedAt)}` : ''}
      {st.error && <> {warning('The last update failed')}</>}
    </>
  );
}

const withList = (lists: string[], id: string, on: boolean) => (on ? [...new Set([...lists, id])] : lists.filter((x) => x !== id));

export function AdBlockPage() {
  const sh = useKite((x) => x.s.settings.shields);
  const status = useShieldsStatus();
  const off = !sh.enabled;
  return (
    <div data-testid="adblock-page">
      <Lead sh={sh} status={status} />
      <Protection sh={sh} off={off} />
      <Filters sh={sh} status={status} off={off} />
      <Exceptions sh={sh} off={off} />
      <details className="disclosure set-more">
        <summary data-testid="shields-advanced">Advanced</summary>
        <MoreProtection sh={sh} off={off} />
        <ListOptions sh={sh} status={status} off={off} />
        <CustomLists sh={sh} status={status} off={off} />
        <UserRules sh={sh} status={status} off={off} />
      </details>
    </div>
  );
}

function Lead({ sh, status }: { sh: Shields; status: ShieldsStatus | null }) {
  return (
    <Group title="Shields" desc="Kite’s ad and tracker blocker. Its lists are plain downloads: nothing about you or your browsing leaves this computer.">
      <SwitchRow
        title="Block ads and trackers"
        desc={sh.enabled ? 'Ads, trackers and harmful sites are stopped before they load, on every site except the ones you list below.' : 'Off. Ads and trackers load on every site.'}
        checked={sh.enabled}
        onChange={(v) => setSh({ enabled: v })}
        testId="shields-enabled"
        label="Shields"
      />
      {status?.blocked && (
        <Row title={<span data-testid="shields-total"><span className="adb-count">{fmtNum(status.blocked.total)}</span> blocked</span>} desc={`Since ${new Date(status.blocked.since).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`}>
          <button className="btn" data-testid="shields-clear-stats" onClick={() => { bridge.clearShieldsStats(); toast('Count reset'); }}>Reset count</button>
        </Row>
      )}
      <SwitchRow
        title="Hide cookie notices"
        desc="Hides the “accept cookies” banners most sites show. If a page then won’t scroll, turn Shields off for that site from the address bar."
        checked={sh.lists.includes(COOKIE_LIST)}
        onChange={(v) => setSh({ lists: withList(getS().settings.shields.lists, COOKIE_LIST, v) })}
        testId="shields-cookie-notices"
        off={!sh.enabled}
      />
    </Group>
  );
}

function Protection({ sh, off }: { sh: Shields; off: boolean }) {
  return (
    <Group title="Tracking protection" desc="What sites can learn about you beyond the ads they show.">
      <SwitchRow title="Block fingerprinting" desc="Sites can’t recognize this computer by its screen, graphics card or sound hardware. Pages keep working." checked={sh.fingerprinting} onChange={(v) => setSh({ fingerprinting: v })} testId="shields-fingerprinting" off={off} />
      <SwitchRow title="Block cross-site cookies" desc="Other sites embedded in a page can’t read or set cookies. If a sign-in box inside a page stops working, add that site to the exceptions below." checked={sh.crossSiteCookies} onChange={(v) => setSh({ crossSiteCookies: v })} testId="shields-cross-site-cookies" off={off} />
      <SwitchRow title="Skip tracking redirects" desc="Links that pass through Google, Facebook, Reddit and others to record your click open the real page directly." checked={sh.debounce} onChange={(v) => setSh({ debounce: v })} testId="shields-debounce" off={off} />
      <SwitchRow title="Remove tracking from links" desc="Takes utm_source, fbclid, gclid and hundreds more off an address before the page loads." checked={sh.stripParams} onChange={(v) => setSh({ stripParams: v })} testId="shields-strip" off={off} />
    </Group>
  );
}

function Filters({ sh, status, off }: { sh: Shields; status: ShieldsStatus | null; off: boolean }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<FilterGroupId>>(new Set());
  const auto = useMemo(() => new Set(listSources({ ...sh, lists: [] }, status?.languages ?? []).map((s) => s.id)), [sh, status?.languages]);
  const q = query.trim().toLowerCase();
  const toggle = (id: string, on: boolean) => setSh({ lists: withList(getS().settings.shields.lists, id, on) });
  const progress = !status
    ? ''
    : status.building
      ? 'Preparing the filter…'
      : status.updating
        ? 'Downloading filter lists…'
        : status.source === 'full'
          ? `${fmtNum(status.rules ?? 0)} rules in use${status.updatedAt ? `, updated ${fmtDate(status.updatedAt)}` : ''}`
          : sh.enabled
            ? 'Using the small list built into Kite until the full lists download'
            : 'Off';
  const groups = FILTER_GROUPS.map((g) => ({ g, lists: FILTER_LISTS.filter((l) => l.group === g.id && !l.hidden && (!q || `${l.name} ${l.desc}`.toLowerCase().includes(q))) })).filter((x) => x.lists.length);
  return (
    <Group title="Filter lists" desc="What Shields blocks, by purpose. Open a group to turn its lists on or off.">
      <Row
        title={
          <span className="shields-status" data-testid="shields-status">
            {progress}
            {status?.error && warning(status.error)}
          </span>
        }
        desc={sh.enabled && status?.scriptlets === false && status.source === 'full' ? 'Page fixes are waiting for their library to download.' : undefined}
      >
        {sh.enabled && (
          <button className="btn" data-testid="shields-refresh" disabled={status?.updating || status?.building} onClick={() => void bridge.refreshShields()}>
            <RefreshCw size={14} /> Update now
          </button>
        )}
      </Row>
      <div className="adb-search">
        <SearchField value={query} onChange={setQuery} placeholder="Search lists" label="Search filter lists" testId="shields-list-search" />
      </div>
      {groups.length === 0 && <p className="muted set-empty">No list matches “{query.trim()}”.</p>}
      {groups.map(({ g, lists }) => {
        const onCount = lists.filter((l) => sh.lists.includes(l.id) || (sh.autoLanguage && auto.has(l.id))).length;
        const isOpen = !!q || open.has(g.id);
        return (
          <div className="adb-group" key={g.id} data-off={off || undefined} data-testid={`shields-group-${g.id}`}>
            <button className="set-row adb-group-head" aria-expanded={isOpen} onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}>
              <span className="set-row-text">
                <span className="set-row-title">{g.name}</span>
                <span className="set-row-desc">{g.desc}</span>
              </span>
              <span className="set-value">{onCount} of {lists.length} on</span>
              <ChevronRight size={16} className="adb-chev" aria-hidden="true" />
            </button>
            {isOpen &&
              lists.map((l) => {
                const viaLang = sh.autoLanguage && auto.has(l.id) && !sh.lists.includes(l.id);
                const on = sh.lists.includes(l.id) || viaLang;
                const line = listLine(status?.lists?.[l.id], on);
                return (
                  <label className="set-row set-switch adb-list" data-sub key={l.id}>
                    <span className="set-row-text">
                      <span className="set-row-title">{l.name}{viaLang && <> <span className="chip">your language</span></>}</span>
                      <span className="set-row-desc">{l.desc}</span>
                      <span className="set-row-desc adb-meta" data-testid={`shields-list-meta-${l.id}`}>{line}</span>
                    </span>
                    <Toggle checked={on} onChange={(v) => (viaLang && !v ? toast('Turn off “Use lists for my languages” under Advanced to switch this one off') : toggle(l.id, v))} testId={`shields-list-${l.id}`} label={l.name} />
                  </label>
                );
              })}
          </div>
        );
      })}
    </Group>
  );
}

function Exceptions({ sh, off }: { sh: Shields; off: boolean }) {
  const [site, setSite] = useState('');
  const key = sh.invert ? 'only' : 'allow';
  const list = sh[key];
  const add = () => {
    const k = siteKey(site);
    if (!k) return toast('Type a site like example.com');
    setSh({ [key]: [...list.filter((x) => x !== k), k].sort() } as Partial<Shields>);
    setSite('');
  };
  return (
    <Group
      title={sh.invert ? 'Sites where Shields are on' : 'Exceptions'}
      desc={sh.invert ? 'Turned around: Kite blocks only on these sites and leaves every other site alone.' : 'Sites where nothing is blocked. Use this when blocking breaks a site you trust. Subdomains are included.'}
    >
      <div className="set-row" data-stack data-off={off || undefined}>
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input className="input" aria-label="Site to add" placeholder="example.com" value={site} data-testid="shields-allow-input" onChange={(e) => setSite(e.target.value)} />
          <button className="btn" data-testid="shields-allow-add">Add</button>
        </form>
        <span className="chip-list" data-testid="shields-allow-list">
          {list.map((a) => (
            <span className="chip" key={a}>{a} <button aria-label={`Remove ${a}`} onClick={(e) => { e.preventDefault(); setSh({ [key]: list.filter((x) => x !== a) } as Partial<Shields>); }}>×</button></span>
          ))}
          {list.length === 0 && <span className="muted">{sh.invert ? 'No sites yet: nothing is blocked anywhere.' : 'None yet.'}</span>}
        </span>
      </div>
      <SwitchRow title="Block only on the sites I list" desc="Turns the list around: Shields work on these sites and nowhere else." checked={sh.invert} onChange={(v) => setSh({ invert: v })} testId="shields-invert" off={off} />
      {sh.invert && <div className="set-row"><span className="warn" data-testid="shields-invert-note"><AlertTriangle size={12} /> Ads and trackers are only blocked on the sites above.</span></div>}
    </Group>
  );
}

const cookieLabel = (m: number) => (m === 0 ? 'Off' : m < 1440 ? `${m / 60} h` : m < 10080 ? `${m / 1440} d` : '1 wk');

function MoreProtection({ sh, off }: { sh: Shields; off: boolean }) {
  return (
    <Group title="More tracking protection">
      <SwitchRow title="Open original pages instead of AMP" desc="Google AMP links open the publisher’s own page." checked={sh.deAmp} onChange={(v) => setSh({ deAmp: v })} testId="shields-deamp" off={off} />
      <SwitchRow title="Hide search queries" desc="Sites you open from search results don’t see what you searched for." checked={sh.hideSearchQueries} onChange={(v) => setSh({ hideSearchQueries: v })} testId="shields-hide-search" off={off} />
      <SwitchRow title="Hide where you came from" desc="Other sites only see their own address as the referrer. May break some image hosts." checked={sh.hideReferrer} onChange={(v) => setSh({ hideReferrer: v })} testId="shields-hide-referrer" off={off} />
      <SwitchRow title="Prevent IP leaks through WebRTC" desc="Video-call features can reveal your real IP address, even behind a VPN. May affect calls on some sites." checked={sh.blockWebRTC} onChange={(v) => setSh({ blockWebRTC: v })} testId="shields-webrtc" off={off} />
      <Row title="Limit third-party cookies" desc={sh.crossSiteCookies ? 'Not needed while cross-site cookies are blocked.' : 'Cookies set by other sites are deleted after this long.'} off={off || sh.crossSiteCookies}>
        <Segmented testId="shields-cookie-life" label="Third-party cookie lifetime" value={String(sh.cookieMinutes)} onChange={(v) => setSh({ cookieMinutes: Number(v) })} options={COOKIE_MINUTES.map((m) => ({ value: String(m), label: cookieLabel(m) }))} />
      </Row>
    </Group>
  );
}

function ListOptions({ sh, status, off }: { sh: Shields; status: ShieldsStatus | null; off: boolean }) {
  const langs = status?.languages?.length ? status.languages.map((l) => new Intl.DisplayNames(undefined, { type: 'language' }).of(l) ?? l).join(', ') : '';
  return (
    <Group title="How lists are used">
      <SwitchRow title="Hide leftovers and fix pages" desc="Hides the empty boxes ads leave behind, and applies the lists’ fixes for sites that fight ad blockers." checked={sh.cosmetic} onChange={(v) => setSh({ cosmetic: v })} testId="shields-cosmetic" label="Hide leftovers" off={off} />
      <SwitchRow title="Block search ads and self-promotion" desc="Ads in search results, and sites advertising their own things." checked={sh.searchAds} onChange={(v) => setSh({ searchAds: v })} testId="shields-search-ads" off={off} />
      <SwitchRow title="Use lists for my languages" desc={langs ? `Turns on the lists for the languages you read. Now: ${langs}.` : 'Turns on the lists for the languages you read.'} checked={sh.autoLanguage} onChange={(v) => setSh({ autoLanguage: v })} testId="shields-auto-lang" off={off} />
      <Row title="Update lists" desc="How often Kite fetches new versions." off={off}>
        <Segmented
          testId="shields-update"
          label="Update lists"
          value={String(sh.updateHours)}
          onChange={(v) => setSh({ updateHours: Number(v) })}
          options={UPDATE_HOURS.map((h) => ({ value: String(h), label: h === 0 ? 'By hand' : h < 24 ? `${h} h` : `${h / 24} d` }))}
        />
      </Row>
    </Group>
  );
}

function CustomLists({ sh, status, off }: { sh: Shields; status: ShieldsStatus | null; off: boolean }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const add = () => {
    const u = listUrl(url);
    if (!u) return toast('Type the full address of a filter list, starting with https://');
    if (sh.custom.some((c) => c.url === u)) return toast('That list is already added');
    if (sh.custom.length >= MAX_CUSTOM_LISTS) return toast(`You can add up to ${MAX_CUSTOM_LISTS} lists`);
    const id = `c-${Date.now().toString(36)}`;
    setSh({ custom: [...sh.custom, { id, url: u, name: name.trim() || new URL(u).hostname, on: true }] });
    setUrl('');
    setName('');
    toast('List added. Kite is downloading it now.');
  };
  return (
    <Group title="Lists by address" desc="Add any filter list by its address (AdBlock, uBlock or AdGuard syntax).">
      <div className="set-row" data-stack data-off={off || undefined}>
        <form className="inline-form adb-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input className="input" aria-label="Filter list address" placeholder="https://example.com/list.txt" value={url} data-testid="shields-custom-url" onChange={(e) => setUrl(e.target.value)} />
          <input className="input adb-name" aria-label="Filter list name" placeholder="Name (optional)" value={name} data-testid="shields-custom-name" onChange={(e) => setName(e.target.value)} />
          <button className="btn" data-testid="shields-custom-add"><Plus size={14} /> Add</button>
        </form>
      </div>
      {sh.custom.map((c) => (
        <div className="set-row" data-sub data-off={off || undefined} key={c.id} data-testid="shields-custom-row">
          <span className="set-row-text">
            <span className="set-row-title">{status?.lists?.[c.id]?.title ?? c.name}</span>
            <span className="set-row-desc adb-url">{c.url}</span>
            <span className="set-row-desc adb-meta">{listLine(status?.lists?.[c.id], c.on)}</span>
          </span>
          <span className="set-row-control">
            <button className="icon-btn small" aria-label={`Remove ${c.name}`} title="Remove" onClick={() => setSh({ custom: sh.custom.filter((x) => x.id !== c.id) })}><Trash2 size={14} /></button>
            <Toggle checked={c.on} onChange={(v) => setSh({ custom: sh.custom.map((x) => (x.id === c.id ? { ...x, on: v } : x)) })} label={c.name} />
          </span>
        </div>
      ))}
    </Group>
  );
}

const EXAMPLES = ['||ads.example.com^', 'example.com##.promo-banner', '@@||example.com^$document', 'example.com##+js(set-constant, adsAllowed, true)'];

function UserRules({ sh, status, off }: { sh: Shields; status: ShieldsStatus | null; off: boolean }) {
  const [text, setText] = useState(sh.userRules);
  const saved = sh.userRules;
  const dirty = text !== saved;
  useEffect(() => setText(saved), [saved]);
  const file = useRef<HTMLInputElement>(null);
  const save = () => {
    if (text.length > MAX_USER_RULES_CHARS) return toast('That’s too many rules for one list. Add them as a list instead.');
    setSh({ userRules: text });
    toast('Rules saved. Kite is applying them.');
  };
  const count = ruleLines(saved).length;
  const invalid = status?.userRules?.invalid ?? [];
  return (
    <Group title="Your rules" desc="Block, unblock or hide anything with one line each, in the same syntax as the lists.">
      <SwitchRow title="Use my rules" checked={sh.userRulesOn} onChange={(v) => setSh({ userRulesOn: v })} testId="shields-user-on" off={off} />
      <div className="set-row" data-stack data-off={off || !sh.userRulesOn || undefined}>
        <textarea
          className="input code adb-rules"
          aria-label="Your filter rules"
          spellCheck={false}
          placeholder={EXAMPLES.join('\n')}
          value={text}
          data-testid="shields-user-rules"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
              e.preventDefault();
              save();
            }
          }}
        />
        <span className="adb-rules-bar">
          <span className="muted" data-testid="shields-user-count">
            {dirty ? 'Not saved yet' : `${count} rule${count === 1 ? '' : 's'}`}
            {!dirty && invalid.length > 0 && <> {warning(<>{invalid.length} not understood: <code>{invalid.slice(0, 3).join('  ')}</code></>)}</>}
          </span>
          <span className="spacer" />
          <input ref={file} type="file" accept=".txt,text/plain" className="visually-hidden" tabIndex={-1} aria-hidden="true" onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const add = (await f.text()).replace(/\r\n?/g, '\n').trim();
            setText((t) => (t.trim() ? `${t.trimEnd()}\n${add}` : add));
            toast('Rules added below. Press Save to use them.');
          }} />
          <button className="btn small ghost" onClick={() => file.current?.click()}><Upload size={14} /> Import</button>
          <button className="btn small ghost" disabled={!saved.trim()} onClick={() => void bridge.exportFile('kite-rules.txt', saved)}><Download size={14} /> Export</button>
          <button className="btn small primary" data-testid="shields-user-save" disabled={!dirty} onClick={save}>Save</button>
        </span>
      </div>
    </Group>
  );
}
