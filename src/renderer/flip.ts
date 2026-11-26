// The sidebar is a physical list: when a row changes place (pinned, unpinned, moved,
// dropped, or the rows above it close), it glides there instead of teleporting.
//
// FLIP over the Web Animations API: remember where every `[data-flip]` element rests,
// look again after React commits, and animate the difference away. A row that moves
// again mid-flight carries on from where it is on screen (interruptible, no jump).
// Nothing here runs under Reduce Motion or while a drag is in progress (drag draws its
// own ghost).
//
// Two kinds of movement, timed differently:
// - a reorder (the same rows in a new order: pinning, unpinning, a drop) travels across
//   the list, easing both ways;
// - making or closing room (a tab closed, a folder opened) answers at once and lands
//   softly, like everything else that responds to the pointer.
// A row that is new fades in only when the pointer made it; from the keyboard it is
// simply there.

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useKite } from './store';

// The same curves and times as --ease-in-out / --t-move and --ease-out / --t-pop in
// foundations.css (the Web Animations API cannot read them from there).
const TRAVEL = { easing: 'cubic-bezier(0.77, 0, 0.175, 1)', ms: 280 };
const SETTLE = { easing: 'cubic-bezier(0.23, 1, 0.32, 1)', ms: 180 };
const ENTER_MS = 160;

/** Whether the last thing the user did was with the pointer (not a key). */
let byPointer = false;
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => (byPointer = true), true);
  window.addEventListener('keydown', () => (byPointer = false), true);
}

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
/** Where an element is laid out inside `root`, ignoring any transform on it or around it and how far the list is scrolled. */
function placeIn(root: HTMLElement, node: HTMLElement): { left: number; top: number } {
  let left = 0;
  let top = 0;
  for (let n: HTMLElement | null = node; n && n !== root; n = n.offsetParent as HTMLElement | null) {
    left += n.offsetLeft;
    top += n.offsetTop;
  }
  return { left, top };
}

/** How far a glide in flight currently holds the element from its resting place. */
function inFlight(node: HTMLElement): { x: number; y: number } {
  if (!node.getAnimations().some((a) => a.id === 'flip')) return { x: 0, y: 0 };
  const t = getComputedStyle(node).transform;
  if (!t || t === 'none') return { x: 0, y: 0 };
  const m = new DOMMatrixReadOnly(t);
  return { x: m.m41, y: m.m42 };
}

export function useFlip(root: RefObject<HTMLElement | null>, resetKey: unknown) {
  const last = useRef<Map<string, { left: number; top: number }>>(new Map());
  const lastKey = useRef(resetKey);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const next = new Map<string, { left: number; top: number }>();
    const nodes = el.querySelectorAll<HTMLElement>('[data-flip]');
    // Mid-drag the list is rearranged for the pointer (drop zones open, the dragged row
    // is a ghost): nothing measured then is a real resting place, so it is neither
    // animated nor remembered. After the drop, rows glide from where they were before it.
    if (document.body.classList.contains('dragging')) return;
    const fresh = lastKey.current !== resetKey || last.current.size === 0;
    lastKey.current = resetKey;
    const still = reduceMotion();
    const k = speed();
    // The same rows as before, only rearranged? Then this is a reorder.
    const reorder = nodes.length === last.current.size && [...nodes].every((n) => last.current.has(n.dataset.flip!));
    const glide = reorder ? TRAVEL : SETTLE;
    nodes.forEach((node) => {
      const key = node.dataset.flip!;
      // Resting places are compared, inside the list (root is their offset parent: see
      // .sb-scroll). So the list moving, scrolling, or sliding in with its Space is not
      // mistaken for every row moving, and a render that changes nothing leaves a glide
      // in flight alone.
      const at = placeIn(el, node);
      next.set(key, at);
      if (fresh || still) return;
      const before = last.current.get(key);
      if (!before) {
        // A row the pointer just made settles in; one made from the keyboard is simply there.
        if (byPointer) node.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: ENTER_MS * k, easing: SETTLE.easing });
        return;
      }
      if (Math.abs(before.left - at.left) < 1 && Math.abs(before.top - at.top) < 1) return;
      // Replace any glide still playing: the new one starts from where the row is on
      // screen right now, so a second change carries on without a jump.
      const held = inFlight(node);
      const dx = before.left + held.x - at.left;
      const dy = before.top + held.y - at.top;
      node.getAnimations().forEach((a) => a.id === 'flip' && a.cancel());
      const a = node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: glide.ms * k, easing: glide.easing });
      a.id = 'flip';
    });
    last.current = next;
  });
}
