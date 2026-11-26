// The home page's widget area. Widgets sit on the page's column grid (three cells across at
// full width, fewer in a narrow window) and never overlap: dropping one on another makes
// the other move over. Positions are saved as cells of the full-width grid (shared/home.ts).

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { CELL_H, CELL_W, COLS, GAP, PITCH_Y, WIDGET_KINDS, columnsFor, layoutWidgets, moveWidget, removeWidget, resizeWidget, updateWidget, type Placed, type Widget, type WidgetSize } from '@shared/home';
import { act, useKite, type ContextMenuItem } from '../../store';
import { openMenu } from '../ContextMenu';
import { CalendarWidget, ClockWidget, NoteWidget, TimerWidget, TodoWidget, WeatherWidget } from './widgets';

const BODY = { clock: ClockWidget, weather: WeatherWidget, note: NoteWidget, todo: TodoWidget, calendar: CalendarWidget, timer: TimerWidget } as const;
const SIZE_LABEL: Record<WidgetSize, string> = { small: 'Small', wide: 'Wide', tall: 'Tall', large: 'Large' };
const FULL_WIDTH = COLS * CELL_W + (COLS - 1) * GAP;

export function WidgetLayer({ editable }: { editable: boolean }) {
  const widgets = useKite((st) => st.s.home.widgets);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FULL_WIDTH);
  // Widgets already there when the page appears are simply there; one added afterwards settles in.
  const [onArrival] = useState(() => new Set(widgets.map((w) => w.id)));
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width || FULL_WIDTH);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!widgets.length) return <div className="home-widgets" ref={ref} data-testid="home-widgets" data-empty />;
  const cols = columnsFor(width);
  const cell = cols === COLS ? CELL_W : (width - (cols - 1) * GAP) / cols;
  const placed = layoutWidgets(widgets, cols);
  const rows = Math.max(...placed.map((p) => p.row + p.rows));
  return (
    <div className="home-widgets" ref={ref} data-testid="home-widgets" data-cols={cols} style={{ height: rows * PITCH_Y - GAP }}>
      {widgets.map((w) => (
        <WidgetFrame key={w.id} widget={w} at={placed.find((p) => p.id === w.id)!} cell={cell} movable={editable && cols === COLS} editable={editable} fresh={!onArrival.has(w.id)} />
      ))}
    </div>
  );
}

function WidgetFrame({ widget, at, cell, movable, editable, fresh }: { widget: Widget; at: Placed; cell: number; movable: boolean; editable: boolean; fresh: boolean }) {
  const def = WIDGET_KINDS.find((k) => k.id === widget.kind)!;
  const Body = BODY[widget.kind];
  const left = at.col * (cell + GAP);
  const top = at.row * PITCH_Y;
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const el = useRef<HTMLDivElement>(null);
  const set = (patch: Record<string, unknown>) => act((d) => updateWidget(d.home, widget.id, patch));

  const menu = (e: { clientX: number; clientY: number; preventDefault?: () => void; stopPropagation?: () => void }) => {
    const data = widget.data;
    // What a widget shows is chosen here, so the widget itself stays free of small switches.
    const own: ContextMenuItem[] =
      widget.kind === 'clock'
        ? [
            { label: 'Show Seconds', hint: data.seconds === true ? '✓' : undefined, testId: 'widget-clock-seconds', onSelect: () => set({ seconds: data.seconds !== true }) },
            { label: '24-Hour Time', hint: data.h24 === true ? '✓' : undefined, testId: 'widget-clock-24', onSelect: () => set({ h24: data.h24 !== true }) },
            { separator: true, label: '' },
          ]
        : widget.kind === 'weather' && data.place
          ? [
              { label: 'Change Place…', onSelect: () => set({ place: '' }) },
              { label: data.unit === 'f' ? 'Show Celsius' : 'Show Fahrenheit', onSelect: () => set({ unit: data.unit === 'f' ? 'c' : 'f' }) },
              { separator: true, label: '' },
            ]
          : [];
    const items: ContextMenuItem[] = [
      ...own,
      {
        label: 'Size',
        submenu: (Object.keys(SIZE_LABEL) as WidgetSize[]).map((s) => ({ label: SIZE_LABEL[s], hint: s === widget.size ? '✓' : undefined, testId: `widget-size-${s}`, onSelect: () => act((d) => resizeWidget(d.home, widget.id, s)) })),
      },
      { separator: true, label: '' },
      { label: 'Remove Widget', danger: true, testId: 'widget-remove', onSelect: () => act((d) => removeWidget(d.home, widget.id)) },
    ];
    openMenu(e, items);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!movable || e.button !== 0 || (e.target as HTMLElement).closest('button, input, textarea, a')) return;
    e.preventDefault();
    const node = el.current!;
    node.setPointerCapture(e.pointerId);
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      setDrag({ dx, dy });
    };
    const up = (ev: PointerEvent) => {
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
      setDrag(null);
      if (!moved) return;
      // It lands on the nearest cell; a widget already there moves over (shared/home.ts).
      act((d) => moveWidget(d.home, widget.id, Math.max(0, left + (ev.clientX - sx)), Math.max(0, top + (ev.clientY - sy))));
    };
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
  };

  // Let go of the drag offset the moment the saved place lands, so the widget travels once, from where it was dropped.
  useEffect(() => setDrag(null), [widget.x, widget.y]);

  return (
    <div
      ref={el}
      className="widget"
      data-kind={widget.kind}
      data-size={widget.size}
      data-dragging={drag ? true : undefined}
      data-new={fresh || undefined}
      data-testid={`widget-${widget.id}`}
      style={{ translate: `${left + (drag?.dx ?? 0)}px ${top + (drag?.dy ?? 0)}px`, width: at.cols * cell + (at.cols - 1) * GAP, height: at.rows * CELL_H + (at.rows - 1) * GAP }}
      onContextMenu={editable ? menu : undefined}
    >
      <div className="widget-head" data-movable={movable || undefined} onPointerDown={onPointerDown} title={movable ? 'Drag to move' : undefined}>
        <h3 className="section-label widget-title">{def.name}</h3>
        {editable && (
          <button className="icon-btn small widget-more" aria-label={`${def.name} widget options`} data-testid={`widget-menu-${widget.id}`} onClick={(e) => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); menu({ clientX: r.left, clientY: r.bottom + 4 }); }}>
            <MoreHorizontal size={14} />
          </button>
        )}
      </div>
      <div className="widget-body">
        <Body widget={widget} data={widget.data} set={set} />
      </div>
    </div>
  );
}
