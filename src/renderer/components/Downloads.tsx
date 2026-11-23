// The Downloads panel: what is downloading (progress, pause, cancel), what has
// finished, and the videos and sounds on the current page that can be saved.

import { useEffect, useState } from 'react';
import { Download, FileDown, Film, FolderOpen, Image, Link2, Music, Pause, Play, RotateCw, Trash2, X, AlertTriangle, Radio, Zap } from 'lucide-react';
import * as ops from '@shared/ops';
import { formatBytes, progressOf, timeLeft, type DownloadEntry, type HlsVariant, type MediaItem } from '@shared/downloads';
import { bridge } from '../platform';
import { toast, useKite } from '../store';
import { surface } from '../surfaces';
import { activeSpace } from '@shared/tree';
import { partitionForSpace } from '@shared/profiles';
import { Sheet } from './Sheet';

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

function Row({ d }: { d: DownloadEntry }) {
  const Icon = ICON[d.kind] ?? FileDown;
  const p = progressOf(d);
  const live = d.state === 'progressing' || d.state === 'paused';
  return (
    <div className="dl-row" data-state={d.state} data-testid={`download-${d.id}`}>
      <span className="dl-icon">
        <Icon size={17} />
        {d.accelerated && <Zap size={10} className="dl-fast" aria-label="Accelerated" />}
      </span>
      <div className="dl-main">
        <button className="dl-name" title={d.path || d.url} disabled={d.state !== 'completed'} onClick={() => void run('open', d.id)}>{d.name}</button>
        <span className="dl-status" data-testid="download-status">{d.state === 'failed' && <AlertTriangle size={11} />} {statusText(d)}</span>
        {live && d.accelerated && d.parts && d.total > 0 ? (
          // IDM's segmented bar: each connection's range fills in its own place.
          <span className="dl-bar dl-bar-parts" data-testid="download-parts" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p === null ? undefined : Math.round(p * 100)}>
            {d.parts.map((x, i) => (
              <i key={i} data-part style={{ left: `${(x.start / d.total) * 100}%`, width: `${(Math.min(x.done, x.end - x.start + 1) / d.total) * 100}%` }} />
            ))}
          </span>
        ) : (
          live && (
            <span className="dl-bar" data-unknown={p === null || undefined} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p === null ? undefined : Math.round(p * 100)}>
              <i style={p === null ? undefined : { transform: `scaleX(${p})` }} />
            </span>
          )
        )}
      </div>
      <div className="dl-actions">
        {d.state === 'progressing' && d.resumable && <button className="icon-btn" aria-label="Pause" title="Pause" data-testid="download-pause" onClick={() => void run('pause', d.id)}><Pause size={14} /></button>}
        {d.state === 'paused' && d.resumable && <button className="icon-btn" aria-label="Resume" title="Resume" data-testid="download-resume" onClick={() => void run('resume', d.id)}><Play size={14} /></button>}
        {live && <button className="icon-btn" aria-label="Cancel" title="Cancel" data-testid="download-cancel" onClick={() => void run('cancel', d.id)}><X size={14} /></button>}
        {(d.state === 'failed' || d.state === 'cancelled') && <button className="icon-btn" aria-label="Try again" title={d.accelerated && d.state === 'failed' ? 'Try again, from where it stopped' : 'Download again'} data-testid="download-retry" onClick={() => void run('retry', d.id)}><RotateCw size={14} /></button>}
        {d.state === 'completed' && <button className="icon-btn" aria-label="Show in folder" title="Show in folder" data-testid="download-reveal" onClick={() => void run('reveal', d.id)}><FolderOpen size={14} /></button>}
        {!live && <button className="icon-btn" aria-label="Remove from list" title="Remove from list (keeps the file)" data-testid="download-remove" onClick={() => void run('remove', d.id)}><Trash2 size={14} /></button>}
      </div>
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
    <section className="dl-media" data-testid="page-media">
      <header className="dl-sec-head">
        <h3 className="look-h">On this page</h3>
        <button className="btn small ghost" data-testid="media-rescan" onClick={scan}><RotateCw size={12} /> Look again</button>
      </header>
      {items && items.length === 0 && (
        <p className="muted dl-empty">No downloadable video or audio found yet. Start playing it, then press “Look again”. To save a picture, right-click it and choose “Save Image”.</p>
      )}
      {items?.map((m) => {
        const v = variants[m.url];
        return (
          <div className="dl-row" key={m.url} data-testid="media-item">
            <span className="dl-icon">{m.kind === 'stream' ? <Radio size={17} /> : m.kind === 'audio' ? <Music size={17} /> : <Film size={17} />}</span>
            <div className="dl-main">
              <span className="dl-name" title={m.url}>{m.label}</span>
              <span className="dl-status">{m.kind === 'stream' ? 'Stream (HLS)' : m.mime || m.kind}{m.size ? ` · ${formatBytes(m.size)}` : ''}</span>
              {typeof v === 'string' && <span className="dl-status" data-state="failed"><AlertTriangle size={11} /> {v}</span>}
              {Array.isArray(v) && (
                <span className="dl-qualities" data-testid="media-qualities">
                  {(v.length ? v : [{ url: m.url, label: 'Download', height: 0, bandwidth: 0 }]).map((q) => (
                    <button key={q.url} className="btn small" onClick={() => { bridge.downloadHls(id, q.url, title); toast(`Downloading the video${q.height ? ` in ${q.label}` : ''}`); }}>{q.label}</button>
                  ))}
                </span>
              )}
            </div>
            <div className="dl-actions">
              {m.kind === 'stream' ? (
                !Array.isArray(v) && (
                  <button className="btn small" data-testid="media-quality" onClick={async () => { const r = await bridge.hlsVariants(id, m.url); setVariants((x) => ({ ...x, [m.url]: r.error ?? r.value ?? [] })); }}>
                    Choose quality
                  </button>
                )
              ) : (
                <button className="btn small" data-testid="media-download" onClick={() => { bridge.downloadMedia(id, m.url); toast('Download started'); }}>
                  <Download size={13} /> Download
                </button>
              )}
            </div>
          </div>
        );
      })}
      <p className="muted dl-note">Copy-protected (DRM) video, and sites that assemble video in the page itself such as YouTube and Netflix, can’t be saved.</p>
    </section>
  );
}

/** IDM's "Add URL": paste a link, Kite downloads it with this Space's cookies. */
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
    <form className="dl-add" onSubmit={(e) => { e.preventDefault(); void go(); }}>
      <Link2 size={14} aria-hidden="true" />
      <input className="dl-add-input" placeholder="Paste a link to download" aria-label="Link to download" value={url} data-testid="download-link" onChange={(e) => setUrl(e.target.value)} />
      <button type="submit" className="btn small" disabled={!url.trim()} data-testid="download-link-go">Download</button>
    </form>
  );
}

export function DownloadsPanel() {
  const list = useKite((st) => st.ui.downloads);
  const hasPage = useKite((st) => !!ops.activeTab(st.s));
  const done = list.some((d) => d.state !== 'progressing' && d.state !== 'paused');
  return (
    <Sheet title="Downloads" subtitle="Files are saved to your Downloads folder" testId="downloads">
      <AddLink />
      <PageMedia />
      {(hasPage || done) && (
        <header className="dl-sec-head">
          <h3 className="look-h">{hasPage ? 'Recent' : ''}</h3>
          {done && <button className="btn small ghost" data-testid="downloads-clear" onClick={() => void run('clear')}>Clear finished</button>}
        </header>
      )}
      {list.length === 0 && <p className="muted dl-empty" data-testid="downloads-empty">Nothing downloaded yet.</p>}
      <div className="dl-list">{list.map((d) => <Row key={d.id} d={d} />)}</div>
    </Sheet>
  );
}

/** The sidebar button: a ring fills as downloads progress. */
export function DownloadsButton({ onClick }: { onClick: () => void }) {
  const list = useKite((st) => st.ui.downloads);
  const active = list.filter((d) => d.state === 'progressing');
  if (!list.length) return null;
  const known = active.filter((d) => d.total > 0);
  const p = known.length ? known.reduce((a, d) => a + d.received, 0) / known.reduce((a, d) => a + d.total, 0) : active.length ? 0.15 : 0;
  return (
    <button className="icon-btn dl-btn" aria-label="Downloads" title={active.length ? `${active.length} downloading` : 'Downloads'} data-testid="btn-downloads" data-active={active.length > 0 || undefined} onClick={onClick}>
      <Download size={16} />
      {active.length > 0 && (
        <svg className="dl-ring" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="14" pathLength="100" strokeDasharray={`${Math.max(4, Math.round(p * 100))} 100`} />
        </svg>
      )}
    </button>
  );
}
