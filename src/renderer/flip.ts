// The sidebar is a physical list: when a row changes place (pinned, unpinned, moved,
// dropped, or the rows above it close), it glides there instead of teleporting.
//
// FLIP over the Web Animations API: measure where every `[data-flip]` element sat
// before React committed, measure again after, and animate the difference away.
// A row mid-flight is measured where it *is* on screen, so a second change carries
// on from the current position (interruptible, no jump). Nothing here runs under
// Reduce Motion or while a drag is in progress (drag draws its own ghost).

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useKite } from './store';

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

function reduceMotion(): boolean {
  if (useKite.getState().s.settings.reduceMotion) return true;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** How fast the user asked animations to run (Settings → Motion). */
function speed(): number {
  return 1 / (useKite.getState().s.settings.motionSpeed || 1);
}

/**
 * Keep the `[data-flip]` elements under `root` in motion across re-renders.
 * `resetKey` changing (another Space) measures afresh without animating anything:
 * that change already has its own transition.
 */
export function useFlip(root: RefObject<HTMLElement | null>, resetKey: unknown) {
  const last = useRef<Map<string, { left: number; top: number }>>(new Map());
  const lastKey = useRef(resetKey);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const next = new Map<string, { left: number; top: number }>();
    const nodes = el.querySelectorAll<HTMLElement>('[data-flip]');
    // Positions are taken inside the list, so the list itself moving (the address bar
    // appearing above it, the window resizing) is not mistaken for every row moving.
    const origin = el.getBoundingClientRect();
    // Mid-drag the list is rearranged for the pointer (drop zones open, the dragged row
    // is a ghost): nothing measured then is a real resting place, so it is neither
    // animated nor remembered. After the drop, rows glide from where they were before it.
    if (document.body.classList.contains('dragging')) return;
    const fresh = lastKey.current !== resetKey || last.current.size === 0;
    lastKey.current = resetKey;
    const still = reduceMotion();
    const k = speed();
    nodes.forEach((node) => {
      const key = node.dataset.flip!;
      const r = node.getBoundingClientRect();
      const rect = { left: r.left - origin.left, top: r.top - origin.top };
      next.set(key, rect);
      if (fresh || still) return;
      const before = last.current.get(key);
      if (!before) {
        // A row that just appeared slides in from the side of the list it belongs to.
        node.animate([{ opacity: 0, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 160 * k, easing: EASE });
        return;
      }
      const dx = before.left - rect.left;
      const dy = before.top - rect.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      // Replace any glide still playing: the new one starts from where the row is now.
      node.getAnimations().forEach((a) => a.id === 'flip' && a.cancel());
      const a = node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 240 * k, easing: EASE });
      a.id = 'flip';
    });
    last.current = next;
  });
}
