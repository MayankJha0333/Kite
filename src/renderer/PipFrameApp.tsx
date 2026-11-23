// Kite's floating video controls, laid out the way Arc's floating video is: round
// corner buttons (Close, Minimize) top-left, a "Back to Tab" pill top-right, play with
// 10-second skips whose arrows turn when pressed in the middle, and a scrubber bar with
// the time, a time label that follows the knob while you drag, and a speaker button.
// Small videos drop the skips, the total time and the pill's words (Arc's size classes).
// Drag the video to move it; drag an edge or corner to resize it.
// Mini: a compact card in the corner (the video keeps playing in its tab) with a
// snapshot of the video, play/pause, Show video, Close and a slim slider.

import { useEffect, useRef, useState } from 'react';
import { ArrowUpLeft, Maximize2, Minus, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX, X } from 'lucide-react';
import { formatTime } from '@shared/pip';
import { RESIZE_EDGES, type PipFrameState, type ResizeEdge } from '@shared/pipFrame';
import { bridge } from './platform';

const HIDE_AFTER_MS = 2200;
/** Below this width (or height) the controls switch to their compact layout. */
const COMPACT = { width: 340, height: 190 } as const;
const EMPTY: PipFrameState = { mode: 'full', t: 0, d: 0, paused: false, title: '', host: '' };

export function PipFrameApp() {
  const [st, setSt] = useState<PipFrameState>(EMPTY);
  const [awake, setAwake] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragging = useRef(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<'regular' | 'compact'>('regular');

  // Size class follows the window as you resize the video.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setSize(el.clientWidth < COMPACT.width || el.clientHeight < COMPACT.height ? 'compact' : 'regular');
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [st.mode]);

  useEffect(() => {
    document.documentElement.classList.add('pip-frame-doc');
    return bridge.onPipFrameState((v) => setSt(v));
  }, []);

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    bridge.pipFrameDrag('end');
  };
  const beginDrag = (e: React.PointerEvent<HTMLElement>, edge?: ResizeEdge) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    bridge.pipFrameDrag('start', edge);
  };

  // Controls show while the mouse moves over the video, and fade after a moment.
  const wake = () => {
    setAwake(true);
    if (sleepTimer.current) clearTimeout(sleepTimer.current);
    sleepTimer.current = setTimeout(() => setAwake(false), HIDE_AFTER_MS);
  };

  const media = (cmd: Parameters<typeof bridge.pipFrameMedia>[0]) => {
    bridge.pipFrameMedia(cmd);
    if (cmd.cmd === 'toggle') setSt((s) => ({ ...s, paused: !s.paused }));
    if (cmd.cmd === 'skip') setSt((s) => ({ ...s, t: Math.max(0, Math.min(s.d || Infinity, s.t + cmd.by)) }));
    if (cmd.cmd === 'seek') setSt((s) => ({ ...s, t: cmd.t }));
    if (cmd.cmd === 'mute') setSt((s) => ({ ...s, muted: !s.muted }));
  };

  const time = scrub ?? st.t;
  const shown = awake || st.paused || scrub !== null;
  const playLabel = st.paused ? 'Play' : 'Pause';
  const PlayIcon = st.paused ? Play : Pause;
  const muteLabel = st.muted ? 'Unmute' : 'Mute';

  if (st.mode === 'mini') {
    const pct = st.d > 0 ? Math.min(100, (time / st.d) * 100) : 0;
    return (
      <div className="pipm-wrap" data-testid="pip-frame" data-mode="mini">
        <div className="pipm" data-scrubbing={scrub !== null || undefined}>
          <div className="pipm-thumb" aria-hidden="true">
            {st.thumb ? <img src={st.thumb} alt="" draggable={false} /> : <div className="pipm-thumb-blank" />}
            {!st.paused && (
              <span className="pipm-eq">
                <i />
                <i />
                <i />
              </span>
            )}
          </div>
          <div className="pipm-text">
            <div className="pipm-title" title={st.title}>
              {st.title || st.host || 'Video'}
            </div>
            <div className="pipm-sub">
              <span data-testid="pip-time">{formatTime(time)}</span>
              {st.d > 0 && <span className="pipm-dim"> / {formatTime(st.d)}</span>}
              {st.host && <span className="pipm-dim"> · {st.host}</span>}
            </div>
          </div>
          <div className="pipm-actions">
            <button className="pipm-play" data-testid="pip-play" aria-label={playLabel} title={playLabel} onClick={() => media({ cmd: 'toggle' })}>
              <PlayIcon size={14} fill="currentColor" strokeWidth={0} />
            </button>
            <button className="pipm-btn" data-testid="pip-frame-show" aria-label="Show video" title="Show video" onClick={() => bridge.pipFrameAction('show')}>
              <Maximize2 size={14} />
            </button>
            <button className="pipm-btn" data-testid="pip-frame-close" aria-label="Close" title="Close" onClick={() => bridge.pipFrameAction('close')}>
              <X size={15} />
            </button>
          </div>
          {st.d > 0 && (
            <div className="pipm-progress">
              <Seek t={time} d={st.d} pct={pct} onScrub={setScrub} onSeek={(t) => media({ cmd: 'seek', t })} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={frameRef}
      className="pipd"
      data-testid="pip-frame"
      data-mode="full"
      data-size={size}
      data-shown={shown || undefined}
      data-rounded={st.rounded || undefined}
      onMouseMove={wake}
      onMouseLeave={() => setAwake(false)}
      onPointerDown={(e) => {
        // Drag anywhere that isn't a control: move the video.
        if ((e.target as HTMLElement).closest('button, input, .pipd-edge')) return;
        beginDrag(e);
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
    >
      <div className="pipd-ring" />

      {/* Top bar: round corner buttons on the left, the "Back to Tab" pill on the right. */}
      <div className="pipd-corner">
        <button className="pipd-round pipd-close" data-testid="pip-frame-close" aria-label="Close" title="Close" onClick={() => bridge.pipFrameAction('close')}>
          <X size={12} strokeWidth={2.6} />
        </button>
        <button className="pipd-round" data-testid="pip-frame-minimize" aria-label="Minimize to mini player" title="Minimize to mini player" onClick={() => bridge.pipFrameAction('minimize')}>
          <Minus size={12} strokeWidth={2.6} />
        </button>
      </div>
      <button className="pipd-back" data-testid="pip-frame-back" aria-label="Back to Tab" title="Back to Tab" onClick={() => bridge.pipFrameAction('back')}>
        <ArrowUpLeft size={13} strokeWidth={2.4} />
        <span className="pipd-back-label">Back to Tab</span>
      </button>

      <div className="pipd-center">
        {st.d > 0 && (
          <SkipButton by={-10} testId="pip-back10" label="Back 10 seconds" onSkip={() => media({ cmd: 'skip', by: -10 })} />
        )}
        <button className="pipd-play" data-testid="pip-play" aria-label={playLabel} title={playLabel} onClick={() => media({ cmd: 'toggle' })}>
          <PlayIcon size={22} fill="currentColor" strokeWidth={0} />
        </button>
        {st.d > 0 && <SkipButton by={10} testId="pip-fwd10" label="Forward 10 seconds" onSkip={() => media({ cmd: 'skip', by: 10 })} />}
      </div>

      <div className="pipd-bottom">
        <span className="pipd-time" data-testid="pip-time">
          {formatTime(time)}
        </span>
        {st.d > 0 ? (
          <>
            <Seek t={time} d={st.d} pct={Math.min(100, (time / st.d) * 100)} scrubbing={scrub !== null} onScrub={setScrub} onSeek={(t) => media({ cmd: 'seek', t })} />
            <span className="pipd-time pipd-total">{formatTime(st.d)}</span>
          </>
        ) : (
          <span className="pipd-live">Live</span>
        )}
        <button className="pipd-mute" data-testid="pip-mute" aria-label={muteLabel} title={muteLabel} aria-pressed={!!st.muted} onClick={() => media({ cmd: 'mute' })}>
          {st.muted ? <VolumeX size={14} strokeWidth={2.2} /> : <Volume2 size={14} strokeWidth={2.2} />}
        </button>
      </div>

      {/* Drag an edge or corner to resize (Chromium's own window doesn't take the mouse). */}
      {RESIZE_EDGES.map((edge) => (
        <div key={edge} className="pipd-edge" data-edge={edge} data-testid={`pip-edge-${edge}`} onPointerDown={(e) => beginDrag(e, edge)} />
      ))}
    </div>
  );
}

/** Skip 10 seconds: the arrow turns a little each time you press it. */
function SkipButton({ by, testId, label, onSkip }: { by: number; testId: string; label: string; onSkip: () => void }) {
  const [turns, setTurns] = useState(0);
  return (
    <button
      className="pipd-skip"
      data-testid={testId}
      aria-label={label}
      title={label}
      onClick={() => {
        setTurns((n) => n + 1);
        onSkip();
      }}
    >
      <span className="pipd-skip-arrow" key={turns} data-spin={turns > 0 ? (by < 0 ? 'back' : 'fwd') : undefined}>
        {by < 0 ? <RotateCcw size={18} strokeWidth={2} /> : <RotateCw size={18} strokeWidth={2} />}
      </span>
      <span className="pipd-skip-n">{Math.abs(by)}</span>
    </button>
  );
}

/** The slider: drag (or click) to jump to any moment — e.g. back to where you were. */
function Seek({ t, d, pct, scrubbing, onScrub, onSeek }: { t: number; d: number; pct: number; scrubbing?: boolean; onScrub: (t: number | null) => void; onSeek: (t: number) => void }) {
  const lastSent = useRef(0);
  const dragging = useRef(false);
  const end = (e: React.PointerEvent<HTMLInputElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    onSeek(Number(e.currentTarget.value));
    onScrub(null);
  };
  return (
    <div className="pipd-seek" data-scrubbing={scrubbing || undefined}>
      <div className="pipd-track">
        <div className="pipd-fill" style={{ width: `${Math.max(0, pct)}%` }} />
      </div>
      {/* While you drag, the time you'd land on rides above the knob. */}
      {scrubbing && (
        <span className="pipd-scrub-label" data-testid="pip-scrub-label" style={{ left: `${Math.max(0, Math.min(100, pct))}%` }}>
          {formatTime(t)}
        </span>
      )}
      <input
        type="range"
        min={0}
        max={Math.max(1, Math.floor(d))}
        step={1}
        value={Math.floor(t)}
        aria-label="Video position"
        aria-valuetext={`${formatTime(t)} of ${formatTime(d)}`}
        data-testid="pip-seek"
        onPointerDown={(e) => {
          e.stopPropagation();
          dragging.current = true;
        }}
        onChange={(e) => {
          const v = Number(e.target.value);
          onScrub(v);
          // While dragging, move the video along (a few times a second); keyboard changes apply at once.
          const now = Date.now();
          if (!dragging.current || now - lastSent.current > 120) {
            lastSent.current = now;
            onSeek(v);
          }
          if (!dragging.current) onScrub(null);
        }}
        onPointerUp={end}
        onPointerCancel={end}
      />
    </div>
  );
}
