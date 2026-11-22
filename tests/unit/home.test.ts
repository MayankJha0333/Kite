import { describe, expect, it } from 'vitest';
import { addWidget, defaultHome, freeSpot, moveWidget, raiseWidget, removeWidget, resizeWidget, sanitizeHome, snapPosition, updateWidget, weatherText, WIDGET_PX, MAX_WIDGETS } from '@shared/home';
import { loadState } from '@shared/persistence';

const area = { w: 1000, h: 600 };

describe('home page state', () => {
  it('starts empty on the Space colours, and saved files are checked on load', () => {
    expect(defaultHome()).toEqual({ widgets: [], scene: 'space', showGreeting: true, showFrequent: true, showHints: true });
    expect(loadState(null).home).toEqual(defaultHome());
    const h = sanitizeHome({ widgets: [{ id: 'a', kind: 'clock', x: 20.4, y: -1, size: 'huge', data: { h24: true } }, { id: 'b', kind: 'nope' }, 'junk'], scene: 'mars', showFrequent: false });
    expect(h.widgets).toEqual([{ id: 'a', kind: 'clock', x: 20, y: 0, size: 'small', data: { h24: true } }]);
    expect(h.scene).toBe('space');
    expect(h.showFrequent).toBe(false);
  });

  it('new widgets take the first free spot, left to right then down, and never overlap', () => {
    const home = defaultHome();
    const a = addWidget(home, 'clock', area)!;
    const b = addWidget(home, 'note', area)!;
    expect(home.widgets.map((w) => w.id)).toEqual([a, b]);
    expect(home.widgets[0]).toMatchObject({ x: 0, y: 0, size: 'small' });
    const [w] = WIDGET_PX.small;
    expect(home.widgets[1].x).toBeGreaterThanOrEqual(w);
    expect(home.widgets[1].y).toBe(0);
    // A wide one that no longer fits on the first row goes to the next.
    addWidget(home, 'weather', area);
    addWidget(home, 'weather', area);
    const last = home.widgets[home.widgets.length - 1];
    expect(last.y).toBeGreaterThan(0);
    expect(freeSpot(home, 'large', area).y).toBeGreaterThan(0);
  });

  it('move snaps to the grid and keeps the widget inside; resize, raise, update and remove work', () => {
    const home = defaultHome();
    const id = addWidget(home, 'todo', area)!;
    const p = snapPosition(-50, 613, 'tall', area);
    expect(p).toEqual({ x: 0, y: 620 }); // snapped to the 20px grid; may extend the page downward
    expect(snapPosition(5000, 0, 'tall', area).x).toBe(760); // the last grid line that keeps it inside the right edge (1000 - 230 = 770 → 760)
    moveWidget(home, id, p.x, p.y);
    expect(home.widgets[0]).toMatchObject({ x: 0, y: 620 });
    resizeWidget(home, id, 'large');
    expect(home.widgets[0].size).toBe('large');
    updateWidget(home, id, { items: [{ id: '1', text: 'x', done: false }] });
    expect(home.widgets[0].data.items).toHaveLength(1);
    const other = addWidget(home, 'clock', area)!;
    raiseWidget(home, id);
    expect(home.widgets.map((w) => w.id)).toEqual([other, id]);
    removeWidget(home, id);
    expect(home.widgets.map((w) => w.id)).toEqual([other]);
  });

  it('stops at the widget limit', () => {
    const home = defaultHome();
    for (let i = 0; i < MAX_WIDGETS; i++) expect(addWidget(home, 'note', area)).not.toBeNull();
    expect(addWidget(home, 'note', area)).toBeNull();
  });

  it('reads the weather codes', () => {
    expect(weatherText(0)).toEqual({ label: 'Clear', icon: 'sun' });
    expect(weatherText(63).label).toBe('Rain');
    expect(weatherText(95).icon).toBe('storm');
  });
});
