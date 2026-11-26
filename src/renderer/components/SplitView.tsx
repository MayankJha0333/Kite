import { X, ArrowLeftRight, Rows2, Columns2, SquareArrowOutUpRight } from 'lucide-react';
import type { ID, Item, SplitItem } from '@shared/types';
import { displayTitle } from '@shared/ops';
import { moveDivider, movePane, resetSizes, separatePane, setOrientation } from '@shared/split';
import { act, useKite } from '../store';
import { closeItemCmd, selectItem } from '../commands';
import { now } from '../platform';

type Rect = { left: number; top: number; width: number; height: number };

/** Where each pane of a split view sits, in percent of the page card. */
export function splitRects(split: SplitItem): Record<ID, Rect> {
  const out: Record<ID, Rect> = {};
  let pos = 0;
  split.panes.forEach((id, i) => {
    const size = (split.sizes[i] ?? 1 / split.panes.length) * 100;
    out[id] = split.orientation === 'row' ? { left: pos, top: 0, width: size, height: 100 } : { left: 0, top: pos, width: 100, height: size };
    pos += size;
  });
  return out;
}

/**
 * CSS position for a pane. The panes share the page card edge to edge; every pane but the
 * first gives up one pixel at its leading edge, and that pixel is the divider's hairline.
 */
export function paneStyle(r: Rect): React.CSSProperties {
  const x = r.left > 0 ? 1 : 0;
  const y = r.top > 0 ? 1 : 0;
  return {
    left: `calc(${r.left}% + ${x}px)`,
    top: `calc(${r.top}% + ${y}px)`,
    width: `calc(${r.width}% - ${x}px)`,
    height: `calc(${r.height}% - ${y}px)`,
  };
}

/** Half of the divider's grab area, in px (the hairline is drawn down its middle). */
const DIVIDER_REACH = 4;

export function SplitChrome({ split }: { split: SplitItem }) {
  const rects = splitRects(split);
  const items = useKite((st) => st.s.items);
  const vertical = split.orientation === 'column';
  return (
    <div className="split-chrome" data-testid="split-chrome" data-orientation={split.orientation}>
      {split.panes.map((id, i) => {
        const r = rects[id];
        const tab = items[id];
        if (!tab || tab.kind !== 'tab') return null;
        const name = displayTitle(tab);
        return (
          <div key={id} className="pane-frame" data-focused={split.focused === i || undefined} data-testid={`pane-${i}`} style={paneStyle(r)}>
            {/* The pane's only standing chrome: a grip at its top edge. Its actions come out while the pointer or the keyboard is on it. */}
            <div className="pane-handle" data-testid={`pane-handle-${i}`} title={name} onMouseDown={() => selectItem(id)} onDoubleClick={() => act((d) => resetSizes(d, split.id))}>
              <span className="pane-grip" />
              <div className="pane-actions" role="toolbar" aria-label={`Pane ${i + 1}: ${name}`}>
                <button className="icon-btn" title="Swap with the next pane" aria-label="Swap with the next pane" data-testid={`pane-swap-${i}`} onClick={() => act((d) => movePane(d, split.id, i, (i + 1) % split.panes.length))}>
                  <ArrowLeftRight size={16} />
                </button>
                <button
                  className="icon-btn"
                  title={vertical ? 'Place side by side' : 'Stack top and bottom'}
                  aria-label={vertical ? 'Place side by side' : 'Stack top and bottom'}
                  data-testid={`pane-flip-${i}`}
                  onClick={() => act((d) => setOrientation(d, split.id, vertical ? 'row' : 'column'))}
                >
                  {vertical ? <Columns2 size={16} /> : <Rows2 size={16} />}
                </button>
                <button className="icon-btn" title="Separate into its own tab" aria-label="Separate into its own tab" data-testid={`pane-separate-${i}`} onClick={() => act((d) => separatePane(d, split.id, id, now()))}>
                  <SquareArrowOutUpRight size={16} />
                </button>
                <button className="icon-btn" title="Close pane" aria-label="Close pane" data-testid={`pane-close-${i}`} onClick={() => closeItemCmd(id)}>
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
      {split.panes.slice(0, -1).map((id, i) => {
        const r = rects[id];
        const at = vertical ? r.top + r.height : r.left + r.width;
        const edge = `calc(${at}% - ${DIVIDER_REACH}px)`;
        return (
          <div
            key={`div-${i}`}
            className="split-divider"
            data-testid={`divider-${i}`}
            role="separator"
            aria-orientation={vertical ? 'horizontal' : 'vertical'}
            style={vertical ? { top: edge } : { left: edge }}
            onDoubleClick={() => act((d) => resetSizes(d, split.id))}
            onPointerDown={(e) => {
              e.preventDefault();
              const card = (e.currentTarget.closest('.card') as HTMLElement).getBoundingClientRect();
              document.body.classList.add('resizing');
              if (vertical) document.body.classList.add('resizing-v');
              // The panes follow the pointer directly: a resize is never animated.
              const move = (ev: PointerEvent) => {
                const frac = vertical ? (ev.clientY - card.top) / card.height : (ev.clientX - card.left) / card.width;
                act((d) => moveDivider(d, split.id, i, frac));
              };
              const up = () => {
                document.body.classList.remove('resizing', 'resizing-v');
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
              };
              window.addEventListener('pointermove', move);
              window.addEventListener('pointerup', up);
            }}
          />
        );
      })}
    </div>
  );
}

export function splitTitle(split: SplitItem, items: Record<ID, Item>): string {
  return split.panes
    .map((p) => items[p])
    .filter(Boolean)
    .map((t) => displayTitle(t))
    .join(' | ');
}
