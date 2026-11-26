// The "about this site" popover under the address bar: is the connection secure,
// what Shields blocked, what the site may use, and clearing its data.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Lock, LockOpen, ShieldAlert, ShieldCheck, ShieldOff, Globe, Laptop, ChevronRight, Minus, Plus } from 'lucide-react';
import * as ops from '@shared/ops';
import { SECURITY_TEXT, isAllowedSite, securityLevel, shieldsActive, siteKey, siteProtections, type SecurityLevel } from '@shared/shields';
import type { PageLog, SitePermission } from '@shared/ipc';
import { bridge } from '../platform';
import { setUi, toast, useKite } from '../store';
import { setShieldsForSite } from '../browserRuntime';
import { surface } from '../surfaces';
import { Toggle } from './Sheet';

export function SecurityIcon({ level, size = 12 }: { level: SecurityLevel; size?: number }) {
  if (level === 'secure') return <Lock size={size} className="url-lock" />;
  if (level === 'broken') return <ShieldAlert size={size} className="url-lock" />;
  if (level === 'insecure') return <LockOpen size={size} className="url-lock" />;
  if (level === 'local') return <Laptop size={size} className="url-lock" />;
  return <Globe size={size} className="url-lock" />;
}

/** What the address bar should say about the current tab. */
export function useSecurity(): { level: SecurityLevel; url: string; id: string | null } {
  const tab = useKite((st) => ops.activeTab(st.s));
  const err = useKite((st) => (tab ? st.ui.loadError[tab.id] : undefined));
  const cert = !!err && err.code <= -200 && err.code >= -299;
  return { level: tab ? securityLevel(tab.url, cert) : 'internal', url: tab?.url ?? '', id: tab?.id ?? null };
}

/** "use your camera or microphone" → "Use your camera or microphone" (a row label, not the end of a sentence). */
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function SiteInfo() {
  const open = useKite((st) => st.ui.siteInfo);
  const { level, url, id } = useSecurity();
  const shields = useKite((st) => st.s.settings.shields);
  const blocked = useKite((st) => (id ? st.ui.blocked[id] ?? 0 : 0));
  const zoom = useKite((st) => (id ? st.ui.zoom[id] ?? 100 : 100));
  const [perms, setPerms] = useState<SitePermission[]>([]);
  const [log, setLog] = useState<PageLog | null>(null);
  const [showLog, setShowLog] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const site = siteKey(url);
  const shown = open && !!id;

  // What was blocked on this page, by host (asked for when the popover opens).
  useEffect(() => {
    setLog(null);
    setShowLog(false);
    if (!open || !id) return;
    // The main process only answers for a page this window shows (an unknown id gets an empty log).
    void bridge.shieldsPageLog(surface(id)?.webContentsId() ?? -1).then(setLog);
  }, [open, id, blocked]);

  useEffect(() => {
    if (!open) return;
    void bridge.permissions().then(setPerms);
    const off = bridge.onPermissions(setPerms);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setUi({ siteInfo: false });
    window.addEventListener('keydown', key);
    return () => {
      off();
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  // It hangs under the address field it was opened from and grows from the button that
  // opened it. (Without a field to hang from, e.g. opened from the command bar with the
  // sidebar hidden, it keeps the corner the stylesheet gives it.)
  useLayoutEffect(() => {
    const el = box.current;
    const field = document.querySelector('[data-testid="url-pill"]')?.getBoundingClientRect();
    const parent = (el?.offsetParent as HTMLElement | null)?.getBoundingClientRect();
    if (!shown || !el || !field || !parent || !field.width) return;
    const trigger = document.querySelector('[data-testid="url-security"]')?.getBoundingClientRect() ?? field;
    const width = el.offsetWidth;
    const right = document.querySelector('.app')?.getAttribute('data-side') === 'right';
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, right ? field.right - width : field.left));
    el.style.left = `${left - parent.left}px`;
    el.style.right = 'auto';
    el.style.top = `${field.bottom + 6 - parent.top}px`;
    el.style.maxHeight = `${window.innerHeight - field.bottom - 14}px`;
    el.style.transformOrigin = `${trigger.left + trigger.width / 2 - left}px -6px`;
  }, [shown, id]);

  if (!open || !id) return null;
  const text = SECURITY_TEXT[level];
  const mine = perms.filter((p) => p.site === site || p.site === `www.${site}`);
  const on = shieldsActive(shields, url);
  const web = /^https?:/i.test(url);
  const page = surface(id);
  return (
    <>
      <div className="site-info-catcher" onMouseDown={() => setUi({ siteInfo: false })} />
      <div ref={box} className="site-info" role="dialog" aria-label="About this site" data-testid="site-info" data-level={level}>
        <section className="site-info-part">
          <div className="site-info-line site-info-conn">
            <SecurityIcon level={level} size={16} />
            <b data-testid="site-info-title">{text.title}</b>
          </div>
          <p className="muted">{site ? <>{site} · </> : null}{text.detail}</p>
        </section>

        {web && (
          <section className="site-info-part">
            <div className="site-info-line">
              {on ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
              <span className="site-info-text">
                <b>Shields</b>
                <span className="muted" data-testid="site-info-blocked">
                  {!shields.enabled ? 'Turned off in Settings' : isAllowedSite(shields, url) ? 'Off for this site' : `${blocked} ad${blocked === 1 ? '' : 's'} and tracker${blocked === 1 ? '' : 's'} blocked`}
                </span>
              </span>
              <Toggle checked={on} onChange={(v) => shields.enabled && setShieldsForSite(url, v)} testId="site-info-shields" label="Shields on this site" />
            </div>
            {on && log && log.hosts.length > 0 && (
              <>
                <button className="btn small ghost site-info-log-btn" aria-expanded={showLog} data-testid="site-info-log-toggle" onClick={() => setShowLog((v) => !v)}>
                  <ChevronRight size={14} /> What was blocked ({log.hosts.length} site{log.hosts.length === 1 ? '' : 's'})
                </button>
                {showLog && (
                  <ul className="site-info-hosts" data-testid="site-info-log">
                    {log.hosts.map((h) => (
                      <li key={h.host}><span>{h.host}</span><span>{h.count}</span></li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <details className="disclosure">
              <summary>Protections on this site</summary>
              <ul className="site-info-prot" aria-label="Protections on this site" data-testid="site-info-protections">
                {siteProtections(shields, url).map((p) => (
                  <li key={p.id} data-on={p.on || undefined} data-testid={`site-prot-${p.id}`}>
                    <span>{p.label}</span>
                    <span className="site-info-prot-state">{p.on ? 'On' : 'Off'}</span>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        )}

        {web && (
          <section className="site-info-part">
            <div className="site-info-row">
              <span>Zoom</span>
              <span className="site-info-zoom" role="group" aria-label="Zoom">
                <button className="icon-btn" aria-label="Zoom out" title="Zoom out (⌘−)" onClick={() => page?.zoom(-1)}><Minus size={16} /></button>
                <button className="btn small ghost site-info-zoom-value" data-testid="site-info-zoom" title="Actual size (⌘0)" aria-label={`Zoom ${zoom}%. Reset to actual size`} onClick={() => page?.zoom('reset')}>
                  {zoom}%
                </button>
                <button className="icon-btn" aria-label="Zoom in" title="Zoom in (⌘+)" onClick={() => page?.zoom(1)}><Plus size={16} /></button>
              </span>
            </div>
            {mine.map((p) => (
              <label className="site-info-row" key={p.permission} data-testid={`site-perm-${p.permission}`}>
                <span>{sentence(p.label)}</span>
                {/* Kite only remembers a yes or a no; the one thing to change here is to be asked again. */}
                <select className="select" value="kept" onChange={(e) => e.target.value === 'ask' && bridge.forgetPermission(p.site, p.permission)}>
                  <option value="kept">{p.allowed ? 'Allow' : 'Don’t allow'}</option>
                  <option value="ask">Ask next time</option>
                </select>
              </label>
            ))}
          </section>
        )}

        <section className="site-info-part site-info-foot">
          {web && (
            <button
              className="btn small danger ghost"
              data-testid="site-info-clear"
              onClick={async () => {
                await bridge.clearData({ cookies: true, storage: true, cache: false }, site);
                setUi({ siteInfo: false });
                surface(id)?.reload();
                toast(`Cookies and site data for ${site} erased`);
              }}
            >
              Clear cookies and site data
            </button>
          )}
          <button className="btn small ghost" data-testid="site-info-adblock" onClick={() => setUi({ siteInfo: false, panel: 'settings', panelArg: 'adblock' })}>
            Ad blocking settings
          </button>
          <button className="btn small ghost" data-testid="site-info-settings" onClick={() => setUi({ siteInfo: false, panel: 'settings', panelArg: 'privacy' })}>
            Privacy and security
          </button>
        </section>
      </div>
    </>
  );
}
