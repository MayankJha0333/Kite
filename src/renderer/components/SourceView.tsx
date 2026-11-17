// "View Page Source": the HTML of a web page as the server sent it, with line numbers.
// Lives at kite://source/<url>, so it is a tab like any other (webviews refuse view-source:).

import { useEffect, useMemo, useState } from 'react';
import { Code2, RotateCw, Copy, WrapText } from 'lucide-react';
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
        <Code2 size={15} className="muted" />
        <span className="source-title">
          Source of <b>{displayUrl(url)}</b>
          {data && <span className="muted"> · {lines.length.toLocaleString()} lines · {data.status}{data.contentType ? ` · ${data.contentType.split(';')[0]}` : ''}</span>}
        </span>
        <span className="spacer" />
        <button className="btn small ghost" data-on={wrap || undefined} title="Wrap long lines" onClick={() => setWrap((w) => !w)}><WrapText size={13} /> Wrap</button>
        <button className="btn small ghost" title="Copy the source" disabled={!data} onClick={async () => { try { await navigator.clipboard.writeText(data!.text); toast('Source copied'); } catch { toast('Couldn’t copy'); } }}><Copy size={13} /> Copy</button>
        <button className="btn small ghost" title="Fetch again" onClick={() => { cache.delete(url); setSeq((n) => n + 1); }}><RotateCw size={13} /> Reload</button>
      </header>
      {error && (
        <div className="empty-list" role="alert" data-testid="source-error">
          <span className="empty-state-title">Couldn’t show the source</span>
          <span className="empty-state-text">{error}</span>
        </div>
      )}
      {!error && !data && <div className="source-wait muted">Fetching…</div>}
      {data && (
        <div className="source-scroll">
          {data.truncated && <p className="source-note">This page is larger than 4 MB; only the first part is shown.</p>}
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
