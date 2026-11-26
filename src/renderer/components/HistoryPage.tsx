// History: every page you visited, newest first, grouped by day. Search it, open
// a page again, forget one entry, or clear a stretch of time.

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { clearHistorySince, countHistory, deleteHistoryEntry, groupHistory } from '@shared/history';
import { displayUrl } from '@shared/url';
import { HOUR, DAY } from '@shared/defaults';
import { act, setUi, toast, useKite } from '../store';
import { openUrl, undoable } from '../commands';
import { now } from '../platform';
import { SearchField, Sheet } from './Sheet';
import { SiteIcon } from './SiteIcon';

const PAGE = 150;
const CLEAR_CHOICES: { label: string; ms: number | null }[] = [
  { label: 'Last hour', ms: HOUR },
  { label: 'Today', ms: DAY },
  { label: 'Last 7 days', ms: 7 * DAY },
  { label: 'Everything', ms: null },
];

const timeOf = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export function HistoryPage() {
  const history = useKite((st) => st.s.history);
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [clearing, setClearing] = useState(false);
  const total = useMemo(() => countHistory(history, q), [history, q]);
  const groups = useMemo(() => groupHistory(history, now(), q, limit), [history, q, limit]);
  const shown = groups.reduce((n, g) => n + g.items.length, 0);

  const clear = (ms: number | null) => {
    const label = CLEAR_CHOICES.find((c) => c.ms === ms)?.label.toLowerCase() ?? '';
    let n = 0;
    undoable(`Cleared history for ${label}`, (d) => void (n = clearHistorySince(d, now(), ms)));
    setClearing(false);
    if (!n) toast('Nothing to clear');
  };

  return (
    <Sheet
      title="History"
      subtitle="Pages you’ve visited, newest first. Nothing here leaves this computer."
      testId="history-page"
      size="large"
      footer={
        <>
          {history.length > 0 &&
            (clearing ? (
              <span className="inline-form" data-testid="history-clear-choices">
                <span className="muted">Clear</span>
                {CLEAR_CHOICES.map((c) => (
                  <button key={c.label} className={`btn small${c.ms === null ? ' danger' : ''}`} data-testid={`history-clear-${c.ms ?? 'all'}`} onClick={() => clear(c.ms)}>
                    {c.label}
                  </button>
                ))}
                <button className="btn small ghost" onClick={() => setClearing(false)}>Cancel</button>
              </span>
            ) : (
              <button className="btn danger ghost" data-testid="history-clear" onClick={() => setClearing(true)}>Clear history…</button>
            ))}
          <span className="spacer" />
          <span className="muted" data-testid="history-count">{q ? `${total} ${total === 1 ? 'page matches' : 'pages match'}` : `${total} ${total === 1 ? 'page' : 'pages'}`}</span>
        </>
      }
    >
      <SearchField autoFocus placeholder="Search history" value={q} testId="history-search" onChange={(v) => { setQ(v); setLimit(PAGE); }} />
      {groups.length === 0 && (
        <div className="empty" data-field data-testid="history-empty">
          <div className="contour-field" aria-hidden="true" />
          <p>{q ? `Nothing in your history matches “${q.trim()}”. Try another word, or part of the address.` : 'Pages you visit are listed here, newest first. Nothing yet.'}</p>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.day} className="list-group" data-testid="history-group">
          <h3 className="section-label arch-day">{g.label}</h3>
          {g.items.map((h) => (
            <div key={h.url} className="list-row" data-testid="history-row" data-url={h.url}>
              <button
                className="list-row-main"
                data-testid="history-open"
                title={`${h.url}\nOpen in a new tab (⌘-click: in the background)`}
                onClick={(e) => {
                  openUrl(h.url, e.metaKey || e.ctrlKey ? 'background' : 'new');
                  if (!(e.metaKey || e.ctrlKey)) setUi({ panel: null });
                }}
              >
                <SiteIcon url={h.url} title={h.title} size={16} />
                <span className="list-row-text">
                  <span className="list-row-title">{h.title || displayUrl(h.url)}</span>
                  <span className="list-row-meta">{displayUrl(h.url)}{h.visits > 1 ? ` · ${h.visits} visits` : ''}</span>
                </span>
                <span className="list-row-aside">{timeOf(h.lastVisitAt)}</span>
              </button>
              <span className="list-row-actions">
                <button className="icon-btn small" aria-label="Remove from history" title="Remove from history" data-testid="history-delete" onClick={() => act((d) => deleteHistoryEntry(d, h.url))}>
                  <X size={14} />
                </button>
              </span>
            </div>
          ))}
        </section>
      ))}
      {shown < total && (
        <div className="list-more">
          <button className="btn small" data-testid="history-more" onClick={() => setLimit((n) => n + PAGE)}>
            Show {Math.min(PAGE, total - shown)} more
          </button>
        </div>
      )}
    </Sheet>
  );
}
