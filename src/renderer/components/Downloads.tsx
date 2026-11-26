// The Downloads panel: what is downloading (progress, pause, cancel), what has
// finished, and the videos and sounds on the current page that can be saved.

import { useEffect, useState } from 'react';
import { Download, FileDown, Film, FolderOpen, Image, MoreHorizontal, Music, Pause, Play, RotateCw, X, AlertTriangle, Radio, Zap } from 'lucide-react';
import * as ops from '@shared/ops';
import { DOWNLOAD_FILTERS, downloadCounts, filterDownloads, formatBytes, needsCancelConfirm, progressOf, timeLeft, type DownloadEntry, type DownloadFilter, type HlsVariant, type MediaItem } from '@shared/downloads';
import { bridge } from '../platform';
import { toast, useKite, type ContextMenuItem } from '../store';
import { openMenu } from './ContextMenu';
import { surface } from '../surfaces';
import { activeSpace } from '@shared/tree';
import { partitionForSpace } from '@shared/profiles';
import { Segmented, Sheet } from './Sheet';

const ICON = { file: FileDown, image: Image, video: Film, audio: Music } as const;

function statusText(d: DownloadEntry): string {
  if (d.state === 'completed') return `${formatBytes(d.received)} · ${d.site}`;
  if (d.state === 'cancelled') return 'Cancelled';
  if (d.state === 'failed') return d.error || 'Failed';
  const size = d.total ? `${formatBytes(d.received)} of ${formatBytes(d.total)}` : formatBytes(d.received);
  if (d.state === 'paused') return `Paused · ${size}`;
  const lanes = d.accelerated && d.parts ? d.parts.filter((p) => p.done < p.end - p.start + 1).length : 0;
  return [size, d.speed ? `${formatBytes(d.speed)}/s` : '', timeLeft(d), lanes ? `${lanes} connection${lanes === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
}

async function run(action: Parameters<typeof bridge.downloadAction>[0], id?: string) {
  const problem = await bridge.downloadAction(action, id);
  if (problem) toast(problem);
}

/** What you can do with one download, for the “More” button and right-click. */
function fileMenu(d: DownloadEntry): ContextMenuItem[] {
  const live = d.state === 'progressing' || d.state === 'paused';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(d.url);
      toast('Download link copied');
    } catch {
      toast('Kite couldn’t copy the link.');
    }
  };
  const again = async () => {
    const problem = d.partition ? await bridge.downloadLink(d.url, d.partition) : await bridge.downloadAction('retry', d.id);
    toast(problem ?? 'Download started');
  };
  const items: ContextMenuItem[] = [];
  if (d.state === 'completed') {
    items.push({ label: 'Open', onSelect: () => void run('open', d.id) });
    items.push({ label: 'Show in Folder', onSelect: () => void run('reveal', d.id) });
  }
  if (/^https?:/i.test(d.url)) items.push({ label: 'Copy Download Link', onSelect: () => void copy() });
  if (!live && /^https?:/i.test(d.url)) items.push({ label: 'Download Again', onSelect: () => void again() });
  if (!live) items.push({ label: '', separator: true }, { label: 'Remove from List', onSelect: () => void run('remove', d.id) });
  if (d.state === 'completed') items.push({ label: 'Move to Trash', danger: true, onSelect: () => void run('trash', d.id) });
  return items;
}

function Row({ d }: { d: DownloadEntry }) {
  const Icon = ICON[d.kind] ?? FileDown;
  const p = progressOf(d);
  const live = d.state === 'progressing' || d.state === 'paused';
  // Cancelling deletes what was saved so far, so it is asked once in the row itself.
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!live) setAsking(false);
  }, [live]);
  const cancel = () => (needsCancelConfirm(d) ? setAsking(true) : void run('cancel', d.id));
  const menu = fileMenu(d);
  if (asking && live) {
    return (
      <div className="list-row dl-row dl-confirm" data-state={d.state} data-testid={`download-${d.id}`} role="alertdialog" aria-label={`Cancel ${d.name}?`}>
        <div className="list-row-main">
          <AlertTriangle size={16} />
          <span className="list-row-text">
            <span className="list-row-title">Cancel this download?</span>
            <span className="dl-ask" data-testid="download-cancel-ask">The {formatBytes(d.received)} already saved of {d.name} will be deleted.</span>
          </span>
        </div>
        <div className="dl-answers">
          <button className="btn small" autoFocus data-testid="download-cancel-keep" onClick={() => setAsking(false)}>Keep downloading</button>
          {d.state === 'progressing' && d.resumable && <button className="btn small" data-testid="download-cancel-pause" onClick={() => { setAsking(false); void run('pause', d.id); }}>Pause instead</button>}
          <button className="btn small danger" data-testid="download-cancel-yes" onClick={() => { setAsking(false); void run('cancel', d.id); }}>Cancel download</button>
        </div>
      </div>
    );
  }
  return (
    <div className="list-row dl-row" data-state={d.state} data-testid={`download-${d.id}`} onContextMenu={(e) => menu.length > 0 && openMenu(e, menu)}>
      <div className="list-row-main">
        <Icon size={16} />
        <span className="list-row-text">
          <button className="list-row-title dl-name" title={d.state === 'completed' ? `Open ${d.path || d.name}` : d.path || d.url} disabled={d.state !== 'completed'} onClick={() => void run('open', d.id)}>{d.name}</button>
          <span className="list-row-meta dl-status" data-testid="download-status">
            {d.state === 'failed' && <AlertTriangle size={12} aria-hidden="true" />}
            {d.accelerated && <span className="dl-fast" title="Downloaded over several connections at once"><Zap size={12} aria-hidden="true" /> Fast ·</span>} {statusText(d)}
          </span>
        </span>
      </div>
      {/* While it is in flight the row's buttons stay in view; a finished one shows them on hover. */}
      <div className="list-row-actions" data-shown={live || undefined}>
        {d.state === 'progressing' && d.resumable && <button className="icon-btn small" aria-label="Pause" title="Pause" data-testid="download-pause" onClick={() => void run('pause', d.id)}><Pause size={14} /></button>}
        {d.state === 'paused' && d.resumable && <button className="icon-btn small" aria-label="Resume" title="Resume" data-testid="download-resume" onClick={() => void run('resume', d.id)}><Play size={14} /></button>}
        {live && <button className="icon-btn small" aria-label="Cancel" title="Cancel" data-testid="download-cancel" onClick={cancel}><X size={14} /></button>}
        {(d.state === 'failed' || d.state === 'cancelled') && <button className="icon-btn small" aria-label="Try again" title={d.accelerated && d.state === 'failed' ? 'Try again, from where it stopped' : 'Download again'} data-testid="download-retry" onClick={() => void run('retry', d.id)}><RotateCw size={14} /></button>}
        {d.state === 'completed' && <button className="icon-btn small" aria-label="Show in folder" title="Show in folder" data-testid="download-reveal" onClick={() => void run('reveal', d.id)}><FolderOpen size={14} /></button>}
        {!live && <button className="icon-btn small" aria-label="Remove from list" title="Remove from list (keeps the file)" data-testid="download-remove" onClick={() => void run('remove', d.id)}><X size={14} /></button>}
        {menu.length > 0 && <button className="icon-btn small" aria-label={`More actions for ${d.name}`} title="More" aria-haspopup="menu" data-testid="download-more" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); openMenu({ clientX: r.left, clientY: r.bottom + 4, preventDefault: () => e.preventDefault(), stopPropagation: () => e.stopPropagation() }, menu); }}><MoreHorizontal size={14} /></button>}
      </div>
      {live && (
        // The string: how far along it is, or just that it is moving when the size is unknown.
        <span className="dl-string" role="progressbar" aria-label={`${d.name}: progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p === null ? undefined : Math.round(p * 100)}>
          {p === null ? <span className="thread" data-busy={d.state === 'progressing' || undefined} /> : <span className="thread" style={{ ['--p' as string]: p }} />}
        </span>
      )}
      {live && d.accelerated && d.parts && d.total > 0 && (
        // A quieter line under it: where each connection has got to in its own stretch of the file.
        <span className="dl-parts" data-testid="download-parts" aria-hidden="true">
          {d.parts.map((x, i) => (
            <i key={i} style={{ left: `${(x.start / d.total) * 100}%`, width: `${(Math.min(x.done, x.end - x.start + 1) / d.total) * 100}%` }} />
          ))}
        </span>
      )}
    </div>
  );
}

/** Videos and sounds the current page has loaded. */
function PageMedia() {
  const tab = useKite((st) => ops.activeTab(st.s));
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [variants, setVariants] = useState<Record<string, HlsVariant[] | string>>({});
  const wcId = tab ? surface(tab.id)?.webContentsId() ?? null : null;
  const scan = () => {
    if (!tab) return setItems([]);
    // In the plain-browser test mode there is no real page id; the stub answers anyway.
    void bridge.pageMedia(wcId ?? -1).then(setItems);
  };
  useEffect(scan, [tab?.id, tab?.url]);
  if (!tab) return null;
  const id = wcId ?? -1;
  const title = ops.displayTitle(tab);
  return (
    <section className="list-group" data-testid="page-media">
      <header className="list-head">
        <h3 className="section-label">On this page</h3>
        <button className="btn small ghost" data-testid="media-rescan" onClick={scan}><RotateCw size={12} /> Look again</button>
      </header>
      {items && items.length === 0 && <p className="muted dl-note">No downloadable video or audio on this page yet. Start playing it, then look again. To save a picture, right-click it and choose Save Image.</p>}
      {items?.map((m) => {
        const v = variants[m.url];
        const MediaIcon = m.kind === 'stream' ? Radio : m.kind === 'audio' ? Music : Film;
        return (
          <div className="list-row dl-row" key={m.url} data-testid="media-item">
            <div className="list-row-main">
              <MediaIcon size={16} />
              <span className="list-row-text">
                <span className="list-row-title" title={m.url}>{m.label}</span>
                <span className="list-row-meta">{m.kind === 'stream' ? 'Stream (HLS)' : m.mime || m.kind}{m.size ? ` · ${formatBytes(m.size)}` : ''}</span>
              </span>
            </div>
            <div className="list-row-trailing">
              {m.kind === 'stream' ? (
                !Array.isArray(v) && (
                  <button className="btn small" data-testid="media-quality" onClick={async () => { const r = await bridge.hlsVariants(id, m.url); setVariants((x) => ({ ...x, [m.url]: r.error ?? r.value ?? [] })); }}>
                    Choose quality…
                  </button>
                )
              ) : (
                <button className="btn small" data-testid="media-download" onClick={() => { bridge.downloadMedia(id, m.url); toast('Download started'); }}>
                  <Download size={12} /> Download
                </button>
              )}
            </div>
            {typeof v === 'string' && <span className="warn dl-under" role="alert"><AlertTriangle size={12} /> {v}</span>}
            {Array.isArray(v) && (
              <span className="dl-answers" data-testid="media-qualities">
                {(v.length ? v : [{ url: m.url, label: 'Download', height: 0, bandwidth: 0 }]).map((q) => (
                  <button key={q.url} className="btn small" onClick={() => { bridge.downloadHls(id, q.url, title); toast(`Downloading the video${q.height ? ` in ${q.label}` : ''}`); }}>{q.label}</button>
                ))}
              </span>
            )}
          </div>
        );
      })}
      <details className="disclosure">
        <summary>Why can’t some videos be saved?</summary>
        <p className="muted">Copy-protected (DRM) video can’t be saved, and neither can video that a site assembles in the page itself, as YouTube and Netflix do.</p>
      </details>
    </section>
  );
}

/** Paste a link, and Kite downloads it with this Space's cookies. */
function AddLink() {
  const partition = useKite((st) => partitionForSpace(activeSpace(st.s)));
  const [url, setUrl] = useState('');
  const go = async () => {
    const v = url.trim();
    if (!v) return;
    const problem = await bridge.downloadLink(/^[a-z]+:\/\//i.test(v) ? v : `https://${v}`, partition);
    if (problem) return toast(problem);
    setUrl('');
    toast('Download started');
  };
  return (
    <form className="inline-form" onSubmit={(e) => { e.preventDefault(); void go(); }}>
      <input className="input" placeholder="Paste a link to download" aria-label="Link to download" value={url} data-testid="download-link" onChange={(e) => setUrl(e.target.value)} />
      <button type="submit" className="btn" disabled={!url.trim()} data-testid="download-link-go">Download</button>
    </form>
  );
}

/** Docked at the side and not modal: a download is something you glance at while you carry on. */
export function DownloadsPanel() {
  const list = useKite((st) => st.ui.downloads);
  const hasPage = useKite((st) => !!ops.activeTab(st.s));
  const done = list.some((d) => d.state !== 'progressing' && d.state !== 'paused');
  const [filter, setFilter] = useState<DownloadFilter>('all');
  const counts = downloadCounts(list);
  const shown = filterDownloads(list, filter);
  return (
    <Sheet title="Downloads" subtitle="Saved to your Downloads folder." testId="downloads" size="small" dock>
      <AddLink />
      <PageMedia />
      <section className="list-group">
        {(hasPage || done) && (
          <header className="list-head">
            <h3 className="section-label">{hasPage ? 'Recent' : ''}</h3>
            {done && <button className="btn small ghost" data-testid="downloads-clear" onClick={() => void run('clear')}>Clear finished</button>}
          </header>
        )}
        {list.length === 0 && (
          <div className="empty" data-field data-testid="downloads-empty">
            <div className="contour-field" aria-hidden="true" />
            <p>Files you download are listed here. Nothing yet.</p>
          </div>
        )}
        {list.length > 1 && (
          <Segmented
            testId="downloads-filter"
            label="Show"
            fill
            value={filter}
            onChange={setFilter}
            options={DOWNLOAD_FILTERS.map((f) => ({ value: f.id, label: <>{f.name}<span className="badge">{counts[f.id]}</span></> }))}
          />
        )}
        {list.length > 0 && shown.length === 0 && <p className="empty" data-testid="downloads-filter-empty"><span>No downloads here. <button className="link" onClick={() => setFilter('all')}>Show all</button></span></p>}
        <div className="dl-list">{shown.map((d) => <Row key={d.id} d={d} />)}</div>
      </section>
    </Sheet>
  );
}

/** The sidebar button. While something is downloading, the string under it shows how far along it all is. */
export function DownloadsButton({ onClick }: { onClick: () => void }) {
  const list = useKite((st) => st.ui.downloads);
  const active = list.filter((d) => d.state === 'progressing');
  if (!list.length) return null;
  const known = active.filter((d) => d.total > 0);
  const p = known.length ? known.reduce((a, d) => a + d.received, 0) / known.reduce((a, d) => a + d.total, 0) : null;
  return (
    <button className="icon-btn dl-btn" aria-label="Downloads" title={active.length ? `${active.length} downloading` : 'Downloads'} data-testid="btn-downloads" data-busy={active.length > 0 || undefined} onClick={onClick}>
      <Download size={16} />
      {active.length > 0 && (p === null ? <span className="thread" data-busy aria-hidden="true" /> : <span className="thread" style={{ ['--p' as string]: p }} aria-hidden="true" />)}
    </button>
  );
}
