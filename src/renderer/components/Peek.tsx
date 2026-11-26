import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Columns2, Maximize2, X } from 'lucide-react';
import { hostOf } from '@shared/url';
import { getUi, setUi, toast, useKite } from '../store';
import { openUrl, openInSplit, setClosePeek } from '../commands';
import { PageThread, WebSurface } from './WebSurface';
import { setupPage } from '../pageSetup';
import { surface } from '../surfaces';
import { SiteIcon } from './SiteIcon';
import { partitionForSpace } from '@shared/profiles';
import { activeSpace } from '@shared/tree';

let peekSeq = 0;
setClosePeek(() => closePeek());
let lastClosed: { url: string; sourceTabId: string | null } | null = null;
/** The next close was made with the pointer, so the Peek goes with its short exit. Esc just removes it. */
let leaveSoftly = false;

export function closePeek(withUndo = true, byPointer = false) {
  const p = getUi().peek;
  if (!p) return;
  leaveSoftly = byPointer;
  setUi({ peek: null });
  if (withUndo) {
    lastClosed = { url: p.url, sourceTabId: p.sourceTabId };
    toast('Closed Peek', 'Reopen', () => lastClosed && setUi({ peek: { ...lastClosed } }));
  }
}

/** A floating preview of a link over the current page. */
export function Peek() {
  const peek = useKite((st) => st.ui.peek);
  const [key, setKey] = useState('');
  const [, redraw] = useState(0);
  const opened = useRef<string | null>(null);
  const last = useRef({ key: '', url: '' });
  // A Peek closed with the pointer stays drawn, as the same page, while its exit plays.
  const going = useRef<{ key: string; url: string } | null>(null);
  if (peek && key) {
    last.current = { key, url: peek.url };
    going.current = null;
  } else if (!peek && leaveSoftly && last.current.key) {
    going.current = last.current;
    last.current = { key: '', url: '' };
  }
  if (!peek) leaveSoftly = false;
  // Each new Peek gets a fresh page; navigating inside it keeps the same one.
  useEffect(() => {
    if (peek && opened.current === null) {
      opened.current = peek.url;
      setKey(`peek:${++peekSeq}`);
    }
    if (peek) return;
    opened.current = null;
    setKey('');
    if (!going.current) return;
    // The exit normally ends itself (animationend); this is for a window in the background.
    const t = setTimeout(() => {
      going.current = null;
      redraw((n) => n + 1);
    }, 600);
    return () => clearTimeout(t);
  }, [peek]);
  if (peek && key) return <PeekWindow key={key} id={key} url={peek.url} />;
  const gone = going.current;
  if (!gone) return null;
  return (
    <PeekWindow
      key={gone.key}
      id={gone.key}
      url={gone.url}
      onGone={() => {
        going.current = null;
        redraw((n) => n + 1);
      }}
    />
  );
}

/** "https://elsewhere.test/article?x" → the site, then the rest of the address after it. */
function addressParts(url: string): { host: string; rest: string } {
  const host = hostOf(url);
  const at = host ? url.indexOf(host) : -1;
  if (at < 0) return { host: url, rest: '' };
  const rest = url.slice(at + host.length).replace(/\/$/, '');
  return { host, rest };
}

/** One Peek. `onGone` is set while it plays its exit: it is still drawn, but no longer the Peek. */
function PeekWindow({ id, url, onGone }: { id: string; url: string; onGone?: () => void }) {
  const [initial] = useState(url);
  const [nav, setNav] = useState({ back: false, forward: false });
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  // A Peek uses the same logins as the Space it was opened in.
  const [partition] = useState(() => partitionForSpace(activeSpace(useKite.getState().s)));
  const live = !onGone;

  const expand = () => {
    const to = getUi().peek?.url ?? initial;
    setUi({ peek: null });
    openUrl(to, 'new');
  };
  const toSplit = () => {
    const to = getUi().peek?.url ?? initial;
    setUi({ peek: null });
    openInSplit(to);
  };
  const { host, rest } = addressParts(url);

  return (
    <div
      className="peek-scrim"
      data-testid={live ? 'peek' : undefined}
      data-leaving={live ? undefined : true}
      onMouseDown={(e) => live && e.target === e.currentTarget && closePeek(true, true)}
      onAnimationEnd={(e) => !live && e.target === e.currentTarget && onGone()}
    >
      <div className="peek" role="dialog" aria-label={title ? `Peek: ${title}` : 'Peek'}>
        <div className="peek-bar">
          {nav.back && (
            <button className="icon-btn" aria-label="Back" title="Back" onClick={() => surface(id)?.back()}>
              <ArrowLeft size={16} />
            </button>
          )}
          <SiteIcon url={url} title={title} size={16} />
          <span className="peek-title" data-testid={live ? 'peek-url' : undefined} title={title || undefined}>
            <b>{host}</b>{rest}
          </span>
          <span className="peek-actions">
            <button className="icon-btn" data-testid="peek-expand" aria-label="Open in a new tab" title="Open in a new tab" onClick={expand}>
              <Maximize2 size={16} />
            </button>
            <button className="icon-btn" data-testid="peek-split" aria-label="Open in Split View" title="Open in Split View" onClick={toSplit}>
              <Columns2 size={16} />
            </button>
            <button className="icon-btn" data-testid="peek-close" aria-label="Close Peek" title="Close (esc)" onClick={() => closePeek(true, true)}>
              <X size={16} />
            </button>
          </span>
        </div>
        <div className="peek-body">
          <PageThread loading={live && loading} />
          <WebSurface
            partition={partition}
            id={id}
            initialUrl={initial}
            visible
            onNavigate={(to) => setUi((u) => (u.peek ? { peek: { ...u.peek, url: to } } : {}))}
            onTitle={setTitle}
            onFavicon={() => undefined}
            onLoading={setLoading}
            onNav={(back, forward) => setNav({ back, forward })}
            onLink={(decision, to) => openUrl(to, decision === 'little' ? 'little' : 'new')}
            onOpen={(to, bg) => openUrl(to, bg ? 'background' : 'new')}
            onReady={(handle, to) => {
              setupPage(id, handle, to, true);
              handle.focus(); // so Esc and typing go to the Peek, not the page behind it
            }}
            onEscape={() => closePeek()}
          />
        </div>
      </div>
    </div>
  );
}
