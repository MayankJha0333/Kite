// "View Page Source": the HTML of a web page as the server sent it, with line numbers.
// Lives at kite://source/<url>, so it is a tab like any other (webviews refuse view-source:).

import { useEffect, useMemo, useState } from 'react';
import { RotateCw, Copy, WrapText } from 'lucide-react';
import { bridge } from '../platform';
import { toast } from '../store';
import { displayUrl } from '@shared/url';

type Fetched = { text: string; status: number; contentType: string; truncated: boolean };
/** Sources already fetched this session (a tab shows the same source again instantly). */
const cache = new Map<string, Fetched>();

export function SourceView({ url, partition }: { url: string; partition: string }) {
  const [data, setData] = useState<Fetched | null>(cache.get(url) ?? null);
  const [error, setError] = useState('');
  const [wrap, setWrap] = useState(false);
  const [seq, setSeq] = useState(0);

  useEffect(() => {
    let live = true;
    if (seq === 0 && cache.has(url)) return;
    setError('');
    setData(null);
    void bridge.pageSource(url, partition).then((r) => {
      if (!live) return;
      if (r.error || !r.value) return setError(r.error ?? 'Couldn’t fetch the page.');
      cache.set(url, r.value);
      setData(r.value);
    });
    return () => {
      live = false;
    };
  }, [url, partition, seq]);

  const lines = useMemo(() => (data ? data.text.replace(/\r\n?/g, '\n').split('\n') : []), [data]);

  return (
    <div className="source" data-testid="source-view" data-wrap={wrap || undefined}>
      <header className="source-head">
        <span className="source-title">
          Source of <b>{displayUrl(url)}</b>
          {data && <> · {lines.length.toLocaleString()} lines · {data.status}{data.contentType ? ` · ${data.contentType.split(';')[0]}` : ''}</>}
        </span>
        <span className="source-actions">
          <button className="icon-btn" aria-pressed={wrap} aria-label="Wrap long lines" title="Wrap long lines" onClick={() => setWrap((w) => !w)}><WrapText size={16} /></button>
          <button className="icon-btn" aria-label="Copy the source" title="Copy the source" disabled={!data} onClick={async () => { try { await navigator.clipboard.writeText(data!.text); toast('Source copied'); } catch { toast('Couldn’t copy'); } }}><Copy size={16} /></button>
          <button className="icon-btn" aria-label="Fetch the source again" title="Fetch the source again" onClick={() => { cache.delete(url); setSeq((n) => n + 1); }}><RotateCw size={16} /></button>
        </span>
      </header>
      {error && (
        <div className="empty" data-field role="alert" data-testid="source-error">
          <div className="contour-field" aria-hidden="true" />
          <p>Kite couldn’t fetch this page’s source: {error}</p>
          <button className="btn" onClick={() => { cache.delete(url); setSeq((n) => n + 1); }}>Try again</button>
        </div>
      )}
      {!error && !data && <div className="source-wait muted">Fetching the source…</div>}
      {data?.truncated && <p className="notice">This page is larger than 4 MB; only the first part is shown.</p>}
      {data && (
        <div className="source-scroll">
          <table className="source-table" data-testid="source-text">
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="source-ln">{i + 1}</td>
                  <td className="source-code">{l || ' '}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
