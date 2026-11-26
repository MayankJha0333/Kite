// The Archive: tabs that were cleared or went unused, newest first, grouped by day.
// Click one to bring it back; delete one, or clear the lot.

import { useMemo, useState } from 'react';
import { X, StickyNote } from 'lucide-react';
import { groupArchive, restoreArchived, deleteArchived, clearArchive, archiveAfterFor } from '@shared/archive';
import { ARCHIVE_CHOICES } from '@shared/defaults';
import { displayUrl } from '@shared/url';
import { act, setUi, useKite } from '../store';
import { selectItem } from '../commands';
import { now } from '../platform';
import { SearchField, Sheet } from './Sheet';
import { SiteIcon } from './SiteIcon';

/** "12 hours", for the sentences below; null when auto-archive is off for this Space. */
function afterText(ms: number | null): string | null {
  if (ms === null) return null;
  return ARCHIVE_CHOICES.find((x) => x.ms === ms)?.label ?? `${Math.round(ms / 60000)} minutes`;
}

const WHY = { auto: 'auto-archived', cleared: 'cleared', manual: 'archived' } as const;
const timeOf = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export function ArchivePage() {
  const archive = useKite((st) => st.s.archive);
  const after = useKite((st) => afterText(archiveAfterFor(st.s, st.s.activeSpaceId)));
  const spaces = useKite((st) => st.s.spaces);
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState(false);
  const groups = useMemo(() => groupArchive(archive, now(), q), [archive, q]);
  const spaceName = (id: string) => spaces.find((x) => x.id === id);

  return (
    <Sheet
      title="Archive"
      subtitle={
        <>
          {after ? `Unpinned tabs you haven’t used for ${after} move here by themselves.` : 'Auto-archive is off for this Space.'}{' '}
          <button className="link" data-testid="archive-settings" onClick={() => setUi({ panel: 'settings', panelArg: 'tabs' })}>Change</button>
        </>
      }
      testId="archive-page"
      size="large"
      footer={
        <>
          {archive.length > 0 &&
            (confirm ? (
              <span className="inline-form">
                <span className="muted">Delete everything in the Archive? This can’t be undone.</span>
                <button className="btn small danger" data-testid="archive-clear-confirm" onClick={() => { act(clearArchive); setConfirm(false); }}>Clear Archive</button>
                <button className="btn small ghost" onClick={() => setConfirm(false)}>Cancel</button>
              </span>
            ) : (
              <button className="btn danger ghost" data-testid="archive-clear" onClick={() => setConfirm(true)}>Clear Archive…</button>
            ))}
          <span className="spacer" />
          <span className="muted">{archive.length} {archive.length === 1 ? 'page' : 'pages'}</span>
        </>
      }
    >
      <SearchField autoFocus placeholder="Search the Archive" value={q} testId="archive-search" onChange={setQ} />
      {groups.length === 0 && (
        <div className="empty" data-field data-testid="archive-empty">
          <div className="contour-field" aria-hidden="true" />
          <p>{q ? `Nothing in the Archive matches “${q.trim()}”. Try another word, or part of the address.` : after ? `Tabs you clear, or haven’t used for ${after}, move here. Nothing yet.` : 'Tabs you clear from Today move here. Nothing yet.'}</p>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.label} className="list-group">
          <h3 className="section-label arch-day">{g.label}</h3>
          {g.items.map((e) => {
            const sp = spaceName(e.spaceId);
            return (
              <div key={e.id} className="list-row" data-testid="archive-row" data-title={e.title}>
                <button
                  className="list-row-main"
                  data-testid="archive-restore"
                  title="Bring back to Today"
                  onClick={() => {
                    const id = act((d) => restoreArchived(d, e.id, now()));
                    if (id) selectItem(id);
                    setUi({ panel: null });
                  }}
                >
                  {e.kind === 'note' ? <StickyNote size={16} /> : <SiteIcon url={e.url} title={e.title} size={16} />}
                  <span className="list-row-text">
                    <span className="list-row-title">{e.title || displayUrl(e.url)}</span>
                    <span className="list-row-meta">
                      {e.kind === 'note' ? 'Note' : displayUrl(e.url)} · {sp ? `${sp.icon} ${sp.name}` : 'Deleted Space'} · {WHY[e.reason] ?? 'archived'}
                    </span>
                  </span>
                  <span className="list-row-aside">{timeOf(e.archivedAt)}</span>
                </button>
                <span className="list-row-actions">
                  <button className="icon-btn small" aria-label="Delete from Archive" title="Delete from Archive" data-testid="archive-delete" onClick={() => act((d) => deleteArchived(d, e.id))}>
                    <X size={14} />
                  </button>
                </span>
              </div>
            );
          })}
        </section>
      ))}
    </Sheet>
  );
}
