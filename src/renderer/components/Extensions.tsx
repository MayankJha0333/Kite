// Chrome extensions: install, review what one asks for, turn on/off, remove.

import { useEffect, useState } from 'react';
import { AlertTriangle, FolderOpen, FileArchive, Puzzle, Settings2, Trash2, AppWindow, Info } from 'lucide-react';
import { ENGINE_SUPPORT, type ExtensionInfo, type ExtensionPreview } from '@shared/extensions';
import type { Result } from '@shared/ipc';
import { bridge } from '../platform';
import { toast } from '../store';
import { Sheet, Toggle } from './Sheet';

export function ExtensionsPanel() {
  const [list, setList] = useState<ExtensionInfo[]>([]);
  const [preview, setPreview] = useState<ExtensionPreview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [store, setStore] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    void bridge.extensions().then(setList);
    return bridge.onExtensions(setList);
  }, []);

  const offer = async (get: () => Promise<Result<ExtensionPreview | null>>) => {
    setBusy(true);
    setError('');
    const r = await get().catch((e: Error) => ({ error: e.message }) as Result<ExtensionPreview | null>);
    setBusy(false);
    if (r.error) return setError(r.error);
    if (r.value) setPreview(r.value);
  };
  const cancel = () => {
    if (preview) bridge.extensionCancel(preview.token);
    setPreview(null);
  };
  const install = async () => {
    if (!preview) return;
    setBusy(true);
    const r = await bridge.extensionConfirm(preview.token);
    setBusy(false);
    setPreview(null);
    if (r.error) return setError(r.error);
    setStore('');
    toast(`“${preview.name}” installed`);
  };

  return (
    <Sheet
      title="Extensions"
      subtitle="Chrome extensions that run inside Kite."
      testId="extensions"
      size="large"
      footer={
        preview && (
          <>
            <button className="btn" data-testid="ext-cancel" onClick={cancel}>Cancel</button>
            <button className="btn primary" data-testid="ext-install" disabled={busy} onClick={install}>Add extension</button>
          </>
        )
      }
    >
      {preview ? (
        // Nothing is installed until this is read and agreed to: what it can do, in full.
        <div className="ext-review" data-testid="ext-review">
          <h3 className="ext-ask">Add “{preview.name}”?</h3>
          <p className="muted">Version {preview.version} · Manifest V{preview.manifestVersion}{preview.description ? ` · ${preview.description}` : ''}</p>
          <div className="ext-cols">
            <div>
              <h4 className="section-label">It will be able to</h4>
              <ul data-testid="ext-access">
                {preview.access.length ? preview.access.map((a) => <li key={a}>{a}</li>) : <li>Nothing beyond its own pages</li>}
              </ul>
              {preview.sites.length > 0 && preview.sites[0] !== 'All websites' && <p className="muted ext-sites">On: {preview.sites.join(', ')}</p>}
            </div>
            {preview.limits.length > 0 && (
              <div>
                <h4 className="section-label">May not fully work in Kite</h4>
                <ul className="ext-limits" data-testid="ext-limits">{preview.limits.map((a) => <li key={a}>{a}</li>)}</ul>
              </div>
            )}
          </div>
          <p className="notice">Only add extensions you trust. One that can read every website can see what you type there, passwords included.</p>
        </div>
      ) : (
        <>
          <div className="ext-add">
            <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (store.trim()) void offer(() => bridge.extensionFromStore(store.trim())); }}>
              <input className="input" placeholder="Chrome Web Store link or extension ID" aria-label="Chrome Web Store link or extension ID" value={store} data-testid="ext-store-input" onChange={(e) => setStore(e.target.value)} />
              <button className="btn primary" disabled={busy || !store.trim()} data-testid="ext-store-add">{busy ? 'Getting…' : 'Add'}</button>
            </form>
            <div className="inline-form">
              <button className="btn small" disabled={busy} data-testid="ext-add-file" onClick={() => void offer(() => bridge.extensionPick('file'))}><FileArchive size={12} /> Add from a .crx or .zip file…</button>
              <button className="btn small" disabled={busy} data-testid="ext-add-folder" onClick={() => void offer(() => bridge.extensionPick('folder'))}><FolderOpen size={12} /> Add from an unpacked folder…</button>
            </div>
          </div>
          {error && <p className="notice danger" role="alert" data-testid="ext-error"><AlertTriangle size={14} aria-hidden="true" /> {error}</p>}

          {list.length === 0 && (
            <div className="empty" data-testid="ext-empty">
              <p>No extensions yet. Paste a Chrome Web Store link above to add one.</p>
            </div>
          )}
          {list.length > 0 && (
            <div className="list-group">
              {list.map((x) => (
                <div className="list-row ext-row" key={x.id} data-testid={`ext-${x.id}`} data-enabled={x.enabled || undefined}>
                  <div className="list-row-main">
                    <Puzzle size={16} />
                    <span className="list-row-text">
                      <span className="list-row-title">{x.name} <span className="muted">{x.version}</span></span>
                      <span className="list-row-meta">{x.description || (x.sites[0] === 'All websites' ? 'Runs on all websites' : `Runs on ${x.sites.length} site${x.sites.length === 1 ? '' : 's'}`)}</span>
                      {x.error && <span className="ext-problem" data-testid="ext-problem"><AlertTriangle size={12} aria-hidden="true" /> Couldn’t start: {x.error}</span>}
                      {!x.error && x.limits.length > 0 && <span className="ext-limit-note" title={x.limits.join('\n')}><Info size={12} aria-hidden="true" /> {x.limits.length} thing{x.limits.length === 1 ? '' : 's'} may not work in Kite</span>}
                    </span>
                  </div>
                  <div className="list-row-actions">
                    {x.enabled && x.hasPopup && <button className="icon-btn small" aria-label={`Open the popup of ${x.name}`} title="Open its popup" data-testid="ext-popup" onClick={() => void bridge.extensionOpen(x.id, 'popup')}><AppWindow size={14} /></button>}
                    {x.enabled && x.hasOptions && <button className="icon-btn small" aria-label={`Options for ${x.name}`} title="Its options" data-testid="ext-options" onClick={() => void bridge.extensionOpen(x.id, 'options')}><Settings2 size={14} /></button>}
                    <button className="icon-btn small" aria-label={`Remove ${x.name}`} title="Remove…" data-testid="ext-remove" onClick={() => setRemoving(x.id)}><Trash2 size={14} /></button>
                  </div>
                  <div className="list-row-trailing">
                    <Toggle checked={x.enabled} onChange={(v) => void bridge.extensionEnable(x.id, v)} testId="ext-toggle" label={`${x.name} on`} />
                  </div>
                  {removing === x.id && (
                    <div className="ext-confirm" role="alertdialog" aria-label={`Remove ${x.name}?`}>
                      <span className="muted">Remove “{x.name}” and everything it has saved?</span>
                      <button className="btn small" autoFocus onClick={() => setRemoving(null)}>Keep</button>
                      <button className="btn small danger" data-testid="ext-remove-confirm" onClick={async () => { await bridge.extensionRemove(x.id); setRemoving(null); toast(`“${x.name}” removed, with its data`); }}>Remove</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <details className="disclosure" data-testid="ext-support">
            <summary>What works, and what doesn’t</summary>
            <p className="muted">Kite is built on Electron, which runs part of Chrome’s extension system. Extensions that mostly change pages work well. Ones that need Chrome’s own toolbar and tab controls work partly or not at all.</p>
            <div className="ext-cols">
              <div><h4 className="section-label">Works</h4><ul>{ENGINE_SUPPORT.works.map((t) => <li key={t}>{t}</li>)}</ul></div>
              <div><h4 className="section-label">Doesn’t work</h4><ul className="ext-limits">{ENGINE_SUPPORT.missing.map((t) => <li key={t}>{t}</li>)}</ul></div>
            </div>
          </details>
        </>
      )}
    </Sheet>
  );
}
