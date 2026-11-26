import { useEffect, useRef, useState } from 'react';
import { X, Plus, Upload, Download, Crosshair, AlertTriangle } from 'lucide-react';
import { addZap, BOOST_FONTS, createBoost, deleteBoost, exportBoosts, importBoosts, removeZap, updateBoost, boostsFor } from '@shared/boosts';
import { zapPickerScript } from '@shared/zap';
import * as ops from '@shared/ops';
import { hostOf } from '@shared/url';
import type { ID } from '@shared/types';
import { act, getS, setUi, toast, useKite } from '../store';
import { bridge, now } from '../platform';
import { setBoostHook } from '../commands';
import { surface } from '../surfaces';
import { Sheet, Field, Toggle } from './Sheet';
import { SiteIcon } from './SiteIcon';

setBoostHook(() => boostThisSite());

/** ⌘⌥B: edit (or create) the Boost for the site you're on. */
export function boostThisSite() {
  const s = getS();
  const tab = ops.activeTab(s);
  const host = tab ? hostOf(tab.url) : '';
  if (!host) {
    setUi({ panel: 'boosts' });
    return;
  }
  const existing = s.boosts.find((b) => b.domain === host) ?? boostsFor({ boosts: s.boosts, settings: { ...s.settings, boostsEnabled: true } }, tab!.url)[0];
  const id = existing?.id ?? act((d) => createBoost(d, { domain: host, now: now() }));
  if (id) setUi({ panel: 'boost', panelArg: id });
}

/** Pick an element on the current page to hide. */
export async function zapElement(boostId: ID) {
  const tab = ops.activeTab(getS());
  const h = surface(tab?.id);
  if (!h) return toast('Open the site first, then choose what to hide.');
  setUi({ panel: null, zapping: true });
  h.focus();
  try {
    const sel = (await h.execHidden(zapPickerScript())) as string | null;
    if (sel && act((d) => addZap(d, boostId, sel, now()))) toast('Hidden. Remove it from the Boost to show it again.');
  } finally {
    setUi({ zapping: false, panel: 'boost', panelArg: boostId });
  }
}

export function ZapHint() {
  const on = useKite((st) => st.ui.zapping);
  if (!on) return null;
  return (
    <div className="zap-hint" role="status" data-testid="zap-hint">
      <Crosshair size={14} aria-hidden="true" /> Click anything on the page to hide it. <kbd className="kbd">esc</kbd> to stop
    </div>
  );
}

export function BoostEditor({ id }: { id: ID }) {
  const b = useKite((st) => st.s.boosts.find((x) => x.id === id));
  const [css, setCss] = useState(b?.css ?? '');
  const [js, setJs] = useState(b?.js ?? '');
  // Save typing shortly after it stops (CSS shows on the page right away).
  useEffect(() => {
    const t = setTimeout(() => b && css !== b.css && act((d) => updateBoost(d, id, { css }, now())), 250);
    return () => clearTimeout(t);
  }, [css]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => b && js !== b.js && act((d) => updateBoost(d, id, { js }, now())), 400);
    return () => clearTimeout(t);
  }, [js]); // eslint-disable-line react-hooks/exhaustive-deps
  // Closing the editor right after typing must not lose the last keystrokes.
  const latest = useRef({ css, js });
  latest.current = { css, js };
  useEffect(
    () => () => {
      const cur = getS().boosts.find((x) => x.id === id);
      if (!cur) return;
      const { css: c, js: j } = latest.current;
      if (c !== cur.css || j !== cur.js) act((d) => updateBoost(d, id, { css: c, js: j }, now()));
    },
    [id],
  );
  if (!b) return null;
  const set = (patch: Parameters<typeof updateBoost>[2]) => act((d) => updateBoost(d, id, patch, now()));
  return (
    <Sheet
      size="large"
      title={`Boost for ${b.domain}`}
      subtitle="Changes show on the page as you type. Only you see them."
      testId="boost-editor"
      footer={
        <>
          <button className="btn danger ghost" data-testid="boost-delete" onClick={() => { act((d) => deleteBoost(d, id)); setUi({ panel: 'boosts' }); toast(`Deleted the Boost for ${b.domain}`); }}>Delete Boost</button>
          <span className="spacer" />
          <button className="btn" onClick={() => setUi({ panel: 'boosts' })}>All Boosts</button>
          <button className="btn primary" data-testid="boost-done" onClick={() => setUi({ panel: null })}>Done</button>
        </>
      }
    >
      <div className="field-row">
        <Field label="Name">
          <input className="input" defaultValue={b.name} data-testid="boost-name" onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="On" inline>
          <Toggle checked={b.enabled} onChange={(enabled) => set({ enabled })} testId="boost-enabled" label="Boost on" />
        </Field>
      </div>

      <Field label="Hidden elements" hint="Ads, banners, sidebars: anything you click">
        <div className="zap-list" data-testid="zap-list">
          {b.zaps.map((z) => (
            <span key={z} className="chip" data-testid="zap-chip">
              <code title={z}>{z}</code>
              <button aria-label={`Show ${z} again`} title="Show again" onClick={(e) => { e.preventDefault(); act((d) => removeZap(d, id, z, now())); }}>
                <X size={12} />
              </button>
            </span>
          ))}
          <button className="btn small" data-testid="boost-zap" onClick={(e) => { e.preventDefault(); void zapElement(id); }}>
            <Crosshair size={12} /> Hide an element…
          </button>
        </div>
      </Field>

      <Field label="Font">
        <select className="select" value={b.font ?? ''} data-testid="boost-font" onChange={(e) => set({ font: e.target.value })}>
          {BOOST_FONTS.map((f) => (
            <option key={f.label} value={f.value}>{f.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Custom CSS">
        <textarea className="input code" spellCheck={false} placeholder={'body { background: #fffbe6; }\n.sidebar { display: none; }'} value={css} data-testid="boost-css" onChange={(e) => setCss(e.target.value)} />
      </Field>

      <Field label="Script" hint="Runs each time the page loads">
        <textarea className="input code" spellCheck={false} placeholder="document.title = 'Focus mode';" value={js} data-testid="boost-js" onChange={(e) => setJs(e.target.value)} />
        {js.trim() && (
          <span className="warn">
            <AlertTriangle size={12} /> A script can read everything on the page, so only use code you trust. Reload the page to run a change. Scripts are never exported.
          </span>
        )}
      </Field>
    </Sheet>
  );
}

export function BoostsList() {
  const boosts = useKite((st) => st.s.boosts);
  const enabled = useKite((st) => st.s.settings.boostsEnabled);
  const [domain, setDomain] = useState('');
  const [bad, setBad] = useState(false);
  return (
    <Sheet
      title="Boosts"
      subtitle="Restyle any site: hide clutter, change the font, add your own CSS."
      testId="boosts-list"
      footer={
        <>
          <span className="field-inline">
            <Toggle checked={enabled} onChange={(v) => act((d) => void (d.settings.boostsEnabled = v))} testId="boosts-master" label="Boosts on" /> Boosts on
          </span>
          <span className="spacer" />
          <label className="btn" title="Add the Boosts saved in a file">
            <Upload size={14} /> Import…
            <input
              type="file"
              accept=".json,application/json"
              className="visually-hidden"
              data-testid="boosts-import"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const text = await f.text();
                const added = act((d) => importBoosts(d, text, now()));
                toast(added ? `Imported ${added} Boost${added === 1 ? '' : 's'}` : 'That file has no Boosts in it. Choose a file exported from Kite.');
                e.target.value = '';
              }}
            />
          </label>
          <button className="btn" disabled={!boosts.length} title="Save your Boosts to a file (scripts are left out)" data-testid="boosts-export" onClick={async () => { if (await bridge.exportFile('kite-boosts.json', exportBoosts(boosts))) toast('Exported your Boosts (scripts are left out)'); }}>
            <Download size={14} /> Export…
          </button>
        </>
      }
    >
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          const id = act((d) => createBoost(d, { domain, now: now() }));
          if (!id) return setBad(true);
          setDomain('');
          setUi({ panel: 'boost', panelArg: id });
        }}
      >
        <input className="input" placeholder="A site to boost, like youtube.com" aria-label="Site to boost" aria-invalid={bad || undefined} aria-describedby={bad ? 'boost-new-problem' : undefined} value={domain} data-testid="boost-new-domain" onChange={(e) => { setDomain(e.target.value); setBad(false); }} />
        <button className="btn primary" data-testid="boost-new"><Plus size={14} /> Add Boost</button>
      </form>
      {bad && <p className="notice danger" role="alert" id="boost-new-problem">That is not a site address. Type one like news.example.com.</p>}
      {boosts.length === 0 && (
        <div className="empty">
          <p>No Boosts yet. Add a site above, or open one and press <span className="keys"><kbd className="kbd">⌘</kbd><kbd className="kbd">⌥</kbd><kbd className="kbd">B</kbd></span>.</p>
        </div>
      )}
      {boosts.length > 0 && (
        <div className="list-group">
          {boosts.map((b) => (
            <div key={b.id} className="list-row" data-testid="boost-row" data-domain={b.domain}>
              <button className="list-row-main" title="Edit this Boost" data-testid="boost-edit" onClick={() => setUi({ panel: 'boost', panelArg: b.id })}>
                <SiteIcon url={`https://${b.domain}`} title={b.domain} size={16} />
                <span className="list-row-text">
                  <span className="list-row-title">{b.name}</span>
                  <span className="list-row-meta">
                    {b.domain} · {[b.zaps.length && `${b.zaps.length} hidden`, b.css.trim() && 'CSS', b.font && 'font', b.js.trim() && 'script'].filter(Boolean).join(' · ') || 'nothing changed yet'}
                  </span>
                </span>
              </button>
              <span className="list-row-trailing">
                <Toggle checked={b.enabled} onChange={(v) => act((d) => updateBoost(d, b.id, { enabled: v }, now()))} testId={`boost-toggle-${b.domain}`} label={`${b.name} on`} />
              </span>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
