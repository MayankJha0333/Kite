// The home page's widget area: widgets sit where you drag them (snapped to a grid,
// kept inside the area, saved as fractions so they keep their place at any size).

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CalendarDays, Clock, CloudSun, ListChecks, MoreHorizontal, StickyNote, Timer } from 'lucide-react';
import { GRID, WIDGET_KINDS, WIDGET_PX, moveWidget, raiseWidget, removeWidget, resizeWidget, snapPosition, updateWidget, type Widget, type WidgetSize } from '@shared/home';
import { act, useKite, type ContextMenuItem } from '../../store';
import { openMenu } from '../ContextMenu';
import { CalendarWidget, ClockWidget, NoteWidget, TimerWidget, TodoWidget, WeatherWidget } from './widgets';

const ICON = { clock: Clock, weather: CloudSun, note: StickyNote, todo: ListChecks, calendar: CalendarDays, timer: Timer } as const;
const BODY = { clock: ClockWidget, weather: WeatherWidget, note: NoteWidget, todo: TodoWidget, calendar: CalendarWidget, timer: TimerWidget } as const;
const SIZE_LABEL: Record<WidgetSize, string> = { small: 'Small', wide: 'Wide', tall: 'Tall', large: 'Large' };

/** The widget area as it is on screen right now (for placing a new widget in a free spot). */
export function measureArea(): { w: number; h: number } {
  const el = document.querySelector<HTMLElement>('.surface-slot[data-visible] .home-widgets, .home-widgets');
  const r = el?.getBoundingClientRect();
  return { w: r?.width || 900, h: Math.max(r?.height || 0, 340) };
}

export function WidgetLayer({ editable }: { editable: boolean }) {
  const widgets = useKite((st) => st.s.home.widgets);
  const ref = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setArea({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!widgets.length) return <div className="home-widgets" ref={ref} data-testid="home-widgets" data-empty />;
  const bottom = Math.max(...widgets.map((w) => w.y + WIDGET_PX[w.size][1]));
  return (
    <div className="home-widgets" ref={ref} data-testid="home-widgets" style={{ minHeight: bottom + 24 }}>
      {widgets.map((w) => (
        <WidgetFrame key={w.id} widget={w} area={area} editable={editable} />
      ))}
    </div>
  );
}

function WidgetFrame({ widget, area, editable }: { widget: Widget; area: { w: number; h: number }; editable: boolean }) {
  const def = WIDGET_KINDS.find((k) => k.id === widget.kind)!;
  const Icon = ICON[widget.kind];
  const Body = BODY[widget.kind];
  const [w, h] = WIDGET_PX[widget.size];
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const el = useRef<HTMLDivElement>(null);
  // Keep a widget inside the area's width as the window shrinks; downward the page scrolls.
  const clampedLeft = area.w ? Math.max(0, Math.min(Math.max(0, area.w - w), widget.x)) : widget.x;
  const clampedTop = widget.y;

  const menu = (e: { clientX: number; clientY: number; preventDefault?: () => void; stopPropagation?: () => void }) => {
    const items: ContextMenuItem[] = [
      {
        label: 'Size',
        submenu: (Object.keys(SIZE_LABEL) as WidgetSize[]).map((s) => ({ label: SIZE_LABEL[s], hint: s === widget.size ? '✓' : undefined, testId: `widget-size-${s}`, onSelect: () => act((d) => resizeWidget(d.home, widget.id, s)) })),
      },
      { label: 'Bring to front', onSelect: () => act((d) => raiseWidget(d.home, widget.id)) },
      { separator: true, label: '' },
      { label: 'Remove widget', danger: true, testId: 'widget-remove', onSelect: () => act((d) => removeWidget(d.home, widget.id)) },
    ];
    openMenu(e, items);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editable || e.button !== 0 || (e.target as HTMLElement).closest('button, input, textarea, a')) return;
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
      const pos = snapPosition(clampedLeft + (ev.clientX - sx), clampedTop + (ev.clientY - sy), widget.size, area);
      act((d) => {
        moveWidget(d.home, widget.id, pos.x, pos.y);
        raiseWidget(d.home, widget.id);
      });
    };
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
  };

  // Drop the drag transform the moment the saved position lands, so there is no double move.
  useEffect(() => setDrag(null), [widget.x, widget.y]);

  return (
    <div
      ref={el}
      className="widget"
      data-kind={widget.kind}
      data-size={widget.size}
      data-dragging={drag ? true : undefined}
      data-testid={`widget-${widget.id}`}
      style={{ left: clampedLeft, top: clampedTop, width: w, height: h, transform: drag ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined }}
      onContextMenu={editable ? menu : undefined}
    >
      <div className="widget-head" onPointerDown={onPointerDown} title={editable ? 'Drag to move' : undefined}>
        <Icon size={13} className="widget-icon" aria-hidden="true" />
        <span className="widget-title">{def.name}</span>
        {editable && (
          <button className="icon-btn tiny widget-more" aria-label={`${def.name} widget options`} data-testid={`widget-menu-${widget.id}`} onClick={(e) => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); menu({ clientX: r.left, clientY: r.bottom + 4 }); }}>
            <MoreHorizontal size={14} />
          </button>
        )}
      </div>
      <div className="widget-body">
        <Body widget={widget} data={widget.data} set={(patch) => act((d) => updateWidget(d.home, widget.id, patch))} />
      </div>
    </div>
  );
}

export { GRID };
