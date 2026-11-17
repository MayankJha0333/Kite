// History: every page you visited, newest first, grouped by day. Search it, open
// a page again, forget one entry, or clear a stretch of time.

import { useMemo, useState } from 'react';
import { History, Search, Trash2, X, ExternalLink } from 'lucide-react';
import { clearHistorySince, countHistory, deleteHistoryEntry, groupHistory } from '@shared/history';
import { displayUrl } from '@shared/url';
import { HOUR, DAY } from '@shared/defaults';
import { act, setUi, toast, useKite } from '../store';
import { openUrl, undoable } from '../commands';
import { now } from '../platform';
import { Sheet } from './Sheet';
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
      subtitle="Pages you've visited, newest first. Nothing here leaves this computer."
      testId="history-page"
      wide
      footer={
        <>
          <span className="muted" data-testid="history-count">{total} page{total === 1 ? '' : 's'}{q ? ' match' : ''}</span>
          <span className="spacer" />
          {history.length > 0 &&
            (clearing ? (
              <span className="inline-form" data-testid="history-clear-choices">
                <span className="muted">Clear:</span>
                {CLEAR_CHOICES.map((c) => (
                  <button key={c.label} className={`btn small${c.ms === null ? ' danger-solid' : ''}`} data-testid={`history-clear-${c.ms ?? 'all'}`} onClick={() => clear(c.ms)}>
                    {c.label}
                  </button>
                ))}
                <button className="btn small ghost" onClick={() => setClearing(false)}>Cancel</button>
              </span>
            ) : (
              <button className="btn small danger" data-testid="history-clear" onClick={() => setClearing(true)}>
                <Trash2 size={13} /> Clear history…
              </button>
            ))}
        </>
      }
    >
      <div className="search-box">
        <Search size={15} />
        <input autoFocus placeholder="Search history" aria-label="Search history" value={q} data-testid="history-search" onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
        {q && (
          <button className="icon-btn tiny" aria-label="Clear search" onClick={() => setQ('')}><X size={13} /></button>
        )}
      </div>
      {groups.length === 0 && (
        <div className="empty-list" data-testid="history-empty">
          <span className="empty-state-icon"><History size={20} /></span>
          <span className="empty-state-title">{q ? 'Nothing matches' : 'No history yet'}</span>
          <span className="empty-state-text">{q ? 'Try another word, or part of the address.' : 'Pages you visit show up here, so you can find them again.'}</span>
        </div>
      )}
      {groups.map((g) => (
        <div key={g.day} className="arch-group" data-testid="history-group">
          <h3 className="arch-day">{g.label}</h3>
          {g.items.map((h) => (
            <div key={h.url} className="arch-row hist-row" data-testid="history-row" data-url={h.url}>
              <button
                className="arch-main"
                data-testid="history-open"
                title={`${h.url}\nOpen in a new tab (⌘-click: in the background)`}
                onClick={(e) => {
                  openUrl(h.url, e.metaKey || e.ctrlKey ? 'background' : 'new');
                  if (!(e.metaKey || e.ctrlKey)) setUi({ panel: null });
                }}
              >
                <SiteIcon url={h.url} title={h.title} size={16} />
                <span className="arch-text">
                  <span className="arch-title">{h.title || displayUrl(h.url)}</span>
                  <span className="arch-meta">
                    {displayUrl(h.url)} · {timeOf(h.lastVisitAt)}{h.visits > 1 ? ` · ${h.visits} visits` : ''}
                  </span>
                </span>
                <ExternalLink size={14} className="arch-restore-icon" />
              </button>
              <button className="icon-btn" aria-label="Remove from history" title="Remove from history" data-testid="history-delete" onClick={() => act((d) => deleteHistoryEntry(d, h.url))}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ))}
      {shown < total && (
        <div className="settings-actions">
          <button className="btn small" data-testid="history-more" onClick={() => setLimit((n) => n + PAGE)}>
            Show more ({total - shown} left)
          </button>
        </div>
      )}
    </Sheet>
  );
}
