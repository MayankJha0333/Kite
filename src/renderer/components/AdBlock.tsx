// Settings → Ad blocking: everything Shields does, in one place.
// Modelled on a full-featured blocker's settings (see RESEARCH.md §9): general
// switches and statistics, filter lists by group, your own lists and rules, the
// allowlist (optionally inverted), and tracking protection.
//
// Changes apply at once. The main process downloads what a change needs and
// rebuilds the filter off the main thread; the status line shows progress.

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronRight, Download, ExternalLink, Plus, RefreshCw, Search, Trash2, Upload } from 'lucide-react';
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
import { Group, Row, Segmented, SwitchRow, Toggle } from './Sheet';

const setSh = (p: Partial<Shields>) => act((d) => updateSettings(d, { shields: { ...d.settings.shields, ...p } }));

/** The Shields status from the main process, kept current. */
export function useShieldsStatus(): ShieldsStatus | null {
  const [status, setStatus] = useState<ShieldsStatus | null>(null);
  useEffect(() => {
    void bridge.shieldsStatus().then(setStatus);
    return bridge.onShieldsStatus(setStatus);
  }, []);
  return status;
}

const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtNum = (n: number) => n.toLocaleString();

function listLine(st: ListStatus | undefined, on: boolean): React.ReactNode {
  if (!on) return null;
  if (!st) return <span className="muted">Waiting to download</span>;
  if (st.error && !st.updatedAt) return <span className="key-warn"><AlertTriangle size={11} /> {st.error}</span>;
  return (
    <span className="muted">
      {st.rules ? `${fmtNum(st.rules)} rules` : 'Downloading…'}
      {st.updatedAt ? ` · updated ${fmtDate(st.updatedAt)}` : ''}
      {st.error && <span className="key-warn"> · <AlertTriangle size={11} /> update failed</span>}
    </span>
  );
}

export function AdBlockPage() {
  const sh = useKite((x) => x.s.settings.shields);
  const status = useShieldsStatus();
  const off = !sh.enabled;
  return (
    <div className="adblock" data-testid="adblock-page">
      <GeneralGroup sh={sh} status={status} />
      <FiltersGroup sh={sh} status={status} off={off} />
      <CustomLists sh={sh} status={status} off={off} />
      <UserRules sh={sh} status={status} off={off} />
      <Allowlist sh={sh} off={off} />
      <TrackingGroup sh={sh} off={off} />
    </div>
  );
}

function GeneralGroup({ sh, status }: { sh: Shields; status: ShieldsStatus | null }) {
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
  const langs = status?.languages?.length ? status.languages.map((l) => new Intl.DisplayNames(undefined, { type: 'language' }).of(l) ?? l).join(', ') : '';
  return (
    <Group title="Ad blocking" desc="Kite blocks ads, trackers and malicious sites before they load. Lists are plain downloads: nothing about you or your browsing leaves this computer.">
      <SwitchRow title={<b>Block ads and trackers</b>} checked={sh.enabled} onChange={(v) => setSh({ enabled: v })} testId="shields-enabled" label="Shields" />
      {status?.blocked && (
        <Row title={<span className="adb-stat" data-testid="shields-total"><b>{fmtNum(status.blocked.total)}</b> blocked</span>} desc={`Since ${new Date(status.blocked.since).toLocaleDateString()}`}>
          <button className="btn small ghost" data-testid="shields-clear-stats" onClick={() => { bridge.clearShieldsStats(); toast('Statistics cleared'); }}>Clear</button>
        </Row>
      )}
      <Row title="Filter lists" desc={sh.enabled && status?.scriptlets === false && status.source === 'full' ? 'Page fixes are waiting for their library to download' : undefined}>
        <span className="shields-status-wrap">
          <span className="muted shields-status" data-testid="shields-status">
            {progress}
            {status?.error && <span className="key-warn"> <AlertTriangle size={12} /> {status.error}</span>}
          </span>
          {sh.enabled && (
            <button className="btn small ghost" data-testid="shields-refresh" disabled={status?.updating || status?.building} onClick={() => void bridge.refreshShields()}>
              <RefreshCw size={12} /> Update now
            </button>
          )}
        </span>
      </Row>
      <SwitchRow title="Hide leftovers and fix pages" desc="Hides empty ad boxes, and runs the lists’ fixes for sites that fight ad blockers" checked={sh.cosmetic} onChange={(v) => setSh({ cosmetic: v })} testId="shields-cosmetic" label="Hide leftovers" off={!sh.enabled} sub />
      <SwitchRow title="Block search ads and self-promotion" desc="Ads in search results, and sites advertising their own things" checked={sh.searchAds} onChange={(v) => setSh({ searchAds: v })} testId="shields-search-ads" off={!sh.enabled} sub />
      <SwitchRow title="Use lists for my languages" desc={langs ? `Turns on the right language lists automatically. Now: ${langs}` : 'Turns on the right language lists automatically'} checked={sh.autoLanguage} onChange={(v) => setSh({ autoLanguage: v })} testId="shields-auto-lang" off={!sh.enabled} sub />
      <Row title="Update lists" desc="How often Kite fetches new versions" off={!sh.enabled}>
        <Segmented
          testId="shields-update"
          value={String(sh.updateHours)}
          onChange={(v) => setSh({ updateHours: Number(v) })}
          options={UPDATE_HOURS.map((h) => ({ value: String(h), label: h === 0 ? 'By hand' : h < 24 ? `${h} h` : `${h / 24} d` }))}
        />
      </Row>
    </Group>
  );
}

function FiltersGroup({ sh, status, off }: { sh: Shields; status: ShieldsStatus | null; off: boolean }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<FilterGroupId>>(new Set(['ads', 'privacy']));
  const auto = useMemo(() => new Set(listSources({ ...sh, lists: [] }, status?.languages ?? []).map((s) => s.id)), [sh, status?.languages]);
  const q = query.trim().toLowerCase();
  const toggle = (id: string, on: boolean) => setSh({ lists: on ? [...new Set([...getS().settings.shields.lists, id])] : getS().settings.shields.lists.filter((x) => x !== id) });
  return (
    <Group title="Filters" desc="Lists of what to block, grouped by what they’re for. Larger lists block more but take longer to update.">
      <div className="set-row adb-search">
        <Search size={14} className="muted" />
        <input className="input" aria-label="Search filter lists" placeholder="Search lists" value={query} data-testid="shields-list-search" onChange={(e) => setQuery(e.target.value)} />
      </div>
      {FILTER_GROUPS.map((g) => {
        const lists = FILTER_LISTS.filter((l) => l.group === g.id && !l.hidden && (!q || `${l.name} ${l.desc}`.toLowerCase().includes(q)));
        if (!lists.length) return null;
        const onCount = lists.filter((l) => sh.lists.includes(l.id) || (sh.autoLanguage && auto.has(l.id))).length;
        const isOpen = !!q || open.has(g.id);
        return (
          <div className="adb-group" key={g.id} data-off={off || undefined} data-testid={`shields-group-${g.id}`}>
            <button className="set-row adb-group-head" aria-expanded={isOpen} onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}>
              <span className="set-row-text">
                <span className="set-row-title">{g.name} <span className="set-row-value">{onCount} of {lists.length} on</span></span>
                <span className="set-row-desc">{g.desc}</span>
              </span>
              <ChevronRight size={15} className="adb-chev" />
            </button>
            {isOpen &&
              lists.map((l) => {
                const viaLang = sh.autoLanguage && auto.has(l.id) && !sh.lists.includes(l.id);
                const on = sh.lists.includes(l.id) || viaLang;
                return (
                  <label className="set-row set-switch adb-list" data-sub data-off={off || undefined} key={l.id}>
                    <span className="set-row-text">
                      <span className="set-row-title">{l.name}{viaLang && <span className="adb-tag">your language</span>}</span>
                      <span className="set-row-desc">{l.desc}</span>
                      <span className="set-row-desc adb-meta" data-testid={`shields-list-meta-${l.id}`}>{listLine(status?.lists?.[l.id], on)}</span>
                    </span>
                    <Toggle checked={on} onChange={(v) => (viaLang && !v ? toast('Turn off “Use lists for my languages” to switch this one off') : toggle(l.id, v))} testId={`shields-list-${l.id}`} label={l.name} />
                  </label>
                );
              })}
          </div>
        );
      })}
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
    <Group title="Your lists" desc="Add any filter list by its address (AdBlock, uBlock or AdGuard syntax).">
      <div className="set-row" data-stack data-off={off || undefined}>
        <form className="inline-form adb-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input className="input" aria-label="Filter list address" placeholder="https://example.com/list.txt" value={url} data-testid="shields-custom-url" onChange={(e) => setUrl(e.target.value)} />
          <input className="input adb-name" aria-label="Filter list name" placeholder="Name (optional)" value={name} data-testid="shields-custom-name" onChange={(e) => setName(e.target.value)} />
          <button className="btn" data-testid="shields-custom-add"><Plus size={13} /> Add</button>
        </form>
      </div>
      {sh.custom.length === 0 && <div className="set-row"><span className="muted set-empty">No lists added yet.</span></div>}
      {sh.custom.map((c) => (
        <div className="set-row adb-list" data-sub data-off={off || undefined} key={c.id} data-testid="shields-custom-row">
          <span className="set-row-text">
            <span className="set-row-title">{status?.lists?.[c.id]?.title ?? c.name}</span>
            <span className="set-row-desc adb-url">{c.url}</span>
            <span className="set-row-desc adb-meta">{listLine(status?.lists?.[c.id], c.on)}</span>
          </span>
          <span className="set-row-control adb-actions">
            <button className="icon-btn tiny" aria-label={`Remove ${c.name}`} title="Remove" onClick={() => setSh({ custom: sh.custom.filter((x) => x.id !== c.id) })}><Trash2 size={13} /></button>
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
    <Group title="Your rules" desc="Block, unblock or hide anything with one line each. Same syntax as the lists.">
      <SwitchRow title="Use my rules" checked={sh.userRulesOn} onChange={(v) => setSh({ userRulesOn: v })} testId="shields-user-on" off={off} />
      <div className="set-row" data-stack data-off={off || !sh.userRulesOn || undefined}>
        <textarea
          className="input adb-rules"
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
            {!dirty && invalid.length > 0 && <span className="key-warn"> · <AlertTriangle size={11} /> {invalid.length} not understood: <code>{invalid.slice(0, 3).join('  ')}</code></span>}
          </span>
          <span className="spacer" />
          <input ref={file} type="file" accept=".txt,text/plain" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const add = (await f.text()).replace(/\r\n?/g, '\n').trim();
            setText((t) => (t.trim() ? `${t.trimEnd()}\n${add}` : add));
            toast('Rules added below. Press Save to use them.');
          }} />
          <button className="btn small ghost" onClick={() => file.current?.click()}><Upload size={12} /> Import</button>
          <button className="btn small ghost" disabled={!saved.trim()} onClick={() => void bridge.exportFile('kite-rules.txt', saved)}><Download size={12} /> Export</button>
          <button className="btn small primary" data-testid="shields-user-save" disabled={!dirty} onClick={save}>Save</button>
        </span>
      </div>
    </Group>
  );
}

function Allowlist({ sh, off }: { sh: Shields; off: boolean }) {
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
      title={sh.invert ? 'Sites where ads are blocked' : 'Sites where nothing is blocked'}
      desc={sh.invert ? 'Inverted: Kite blocks only on these sites, and leaves every other site alone.' : 'Use this when blocking breaks a site you trust. Subdomains are included.'}
    >
      <SwitchRow title="Block only on the sites I list" desc="Turns the list around" checked={sh.invert} onChange={(v) => setSh({ invert: v })} testId="shields-invert" off={off} />
      {sh.invert && <div className="set-row adb-note" data-testid="shields-invert-note"><AlertTriangle size={13} /> Ads and trackers are only blocked on the sites below.</div>}
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
    </Group>
  );
}

const cookieLabel = (m: number) => (m === 0 ? 'Off' : m < 1440 ? `${m / 60} h` : m < 10080 ? `${m / 1440} d` : '1 wk');

function TrackingGroup({ sh, off }: { sh: Shields; off: boolean }) {
  const gpc = useKite((x) => x.s.settings.sendGpc);
  return (
    <Group title="Tracking protection" desc="Beyond blocking trackers: what sites can learn about you from links, referrers, cookies and your connection.">
      <SwitchRow title="Remove tracking parameters from links" desc="utm_source, fbclid, gclid and hundreds more, before the page loads" checked={sh.stripParams} onChange={(v) => setSh({ stripParams: v })} testId="shields-strip" off={off} />
      <SwitchRow title="Hide search queries" desc="Sites you open from search results don’t see what you searched for" checked={sh.hideSearchQueries} onChange={(v) => setSh({ hideSearchQueries: v })} testId="shields-hide-search" off={off} />
      <SwitchRow title="Hide where you came from" desc="Third parties only see their own address as the referrer. May break some image hosts." checked={sh.hideReferrer} onChange={(v) => setSh({ hideReferrer: v })} testId="shields-hide-referrer" off={off} />
      <SwitchRow title="Prevent IP leaks through WebRTC" desc="Video-call features can reveal your real IP address, even behind a VPN. May affect calls on some sites." checked={sh.blockWebRTC} onChange={(v) => setSh({ blockWebRTC: v })} testId="shields-webrtc" off={off} />
      <Row title="Limit third-party cookies" desc="Cookies set by other sites are deleted after this long" off={off}>
        <Segmented testId="shields-cookie-life" value={String(sh.cookieMinutes)} onChange={(v) => setSh({ cookieMinutes: Number(v) })} options={COOKIE_MINUTES.map((m) => ({ value: String(m), label: cookieLabel(m) }))} />
      </Row>
      <Row title="Ask sites not to track me" desc={gpc ? 'On: Global Privacy Control and Do Not Track are sent. Change it under Privacy & Security.' : 'Off. Turn on Global Privacy Control under Privacy & Security.'}>
        <ExternalLink size={14} className="muted" />
      </Row>
    </Group>
  );
}
