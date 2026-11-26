import { useEffect, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, ArrowRight, Check } from 'lucide-react';
import { addRoute, deleteRoute, MATCH_LABELS, moveRoute, routeFor, updateRoute } from '@shared/routing';
import type { RouteMatchType, RouteTarget } from '@shared/types';
import { act, setUi, toast, useKite } from '../store';
import { bridge } from '../platform';
import { Sheet, Field, Segmented, Toggle } from './Sheet';

function targetValue(t: RouteTarget) {
  return t.type === 'space' ? `space:${t.spaceId}` : t.type;
}

function parseTarget(v: string): RouteTarget {
  if (v.startsWith('space:')) return { type: 'space', spaceId: v.slice(6) };
  return v === 'little' ? { type: 'little' } : { type: 'active' };
}

export function RoutingPanel() {
  const routes = useKite((st) => st.s.routes);
  const spaces = useKite((st) => st.s.spaces);
  const fallback = useKite((st) => st.s.settings.externalLinksTarget);
  const s = useKite((st) => st.s);
  const [test, setTest] = useState('');
  const [isDefault, setIsDefault] = useState<boolean | null>(null);
  useEffect(() => {
    void bridge.isDefaultBrowser().then(setIsDefault);
  }, []);

  const testResult = (() => {
    if (!test.trim()) return null;
    const url = /^[a-z]+:\/\//i.test(test) ? test : `https://${test}`;
    const { target, rule } = routeFor(s, url);
    const where = target.type === 'little' ? 'a little window' : target.type === 'active' ? 'the current Space' : (() => {
      const sp = spaces.find((x) => x.id === (target as { spaceId: string }).spaceId);
      return sp ? `${sp.icon} ${sp.name}` : 'the current Space';
    })();
    return { where, rule };
  })();

  return (
    <Sheet
      size="large"
      title="Link routing"
      subtitle="Choose where links from other apps, such as Mail, Slack or Notes, open in Kite."
      testId="routing-panel"
      footer={
        <>
          {isDefault ? (
            <span className="field-inline">
              <Check size={14} aria-hidden="true" /> Kite is your default browser
            </span>
          ) : (
            <button
              className="btn"
              data-testid="make-default"
              onClick={async () => {
                const ok = await bridge.setDefaultBrowser();
                setIsDefault(ok);
                toast(ok ? 'Kite is now your default browser' : 'Your system wants to confirm the change. Look for its question, or open System Settings.');
              }}
            >
              Make Kite the default browser
            </button>
          )}
          <span className="spacer" />
          <button className="btn primary" onClick={() => setUi({ panel: null })}>Done</button>
        </>
      }
    >
      <Field label="Links that match no rule open in">
        <Segmented
          testId="route-fallback"
          label="Links that match no rule open in"
          value={fallback}
          onChange={(v) => act((d) => void (d.settings.externalLinksTarget = v))}
          options={[
            { value: 'little', label: 'A little window' },
            { value: 'active', label: 'The current Space' },
          ]}
        />
      </Field>

      <section className="list-group routes" data-testid="route-list">
        <header className="list-head">
          <h3 className="section-label">Rules</h3>
          <span className="muted">Checked top to bottom. The first match wins.</span>
        </header>
        {routes.length === 0 && (
          <div className="empty">
            <p>No rules yet. Add one to send, say, every spotify.com link to the Space you keep music in.</p>
          </div>
        )}
        {routes.map((r, i) => (
          <div key={r.id} className="route-row" data-testid="route-row" data-enabled={r.enabled || undefined}>
            <select className="select" aria-label="How to match" value={r.matchType} data-testid="route-match" onChange={(e) => act((d) => updateRoute(d, r.id, { matchType: e.target.value as RouteMatchType }))}>
              {Object.entries(MATCH_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input className="input" aria-label="What to match" placeholder={r.matchType === 'host' ? 'spotify.com' : r.matchType === 'contains' ? 'meet.google' : 'github.com/my-team'} value={r.value} data-testid="route-value" onChange={(e) => act((d) => updateRoute(d, r.id, { value: e.target.value }))} />
            <ArrowRight size={14} className="route-arrow" aria-label="opens in" />
            <select className="select" aria-label="Where it opens" value={targetValue(r.target)} data-testid="route-target" onChange={(e) => act((d) => updateRoute(d, r.id, { target: parseTarget(e.target.value) }))}>
              {spaces.map((sp) => (
                <option key={sp.id} value={`space:${sp.id}`}>{sp.icon} {sp.name}</option>
              ))}
              <option value="little">Little window</option>
              <option value="active">Current Space</option>
            </select>
            <Toggle checked={r.enabled} onChange={(v) => act((d) => updateRoute(d, r.id, { enabled: v }))} label="Rule on" testId="route-enabled" />
            <span className="route-btns">
              <button className="icon-btn small" aria-label="Move up" title="Move up" disabled={i === 0} onClick={() => act((d) => moveRoute(d, r.id, -1))}><ArrowUp size={14} /></button>
              <button className="icon-btn small" aria-label="Move down" title="Move down" disabled={i === routes.length - 1} onClick={() => act((d) => moveRoute(d, r.id, 1))}><ArrowDown size={14} /></button>
              <button className="icon-btn small" aria-label="Delete rule" title="Delete rule" data-testid="route-delete" onClick={() => act((d) => deleteRoute(d, r.id))}><Trash2 size={14} /></button>
            </span>
          </div>
        ))}
        <div className="route-add">
          <button className="btn small" data-testid="route-add" onClick={() => act((d) => void addRoute(d))}>
            <Plus size={12} /> Add rule
          </button>
        </div>
      </section>

      <Field label="Try a link">
        <input className="input" placeholder="Paste a link to see where it would open" value={test} data-testid="route-test" onChange={(e) => setTest(e.target.value)} />
        {testResult && (
          <span className="route-result" role="status" data-testid="route-result">
            Opens in <b>{testResult.where}</b> {testResult.rule ? `(rule: ${MATCH_LABELS[testResult.rule.matchType].toLowerCase()} “${testResult.rule.value}”)` : '(no rule matched)'}
          </span>
        )}
      </Field>
    </Sheet>
  );
}
