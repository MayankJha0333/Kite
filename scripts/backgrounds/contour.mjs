// Kite's contour field: the isobars of a calm pressure field, like a weather chart on a
// still day. It lies behind the start page and the large empty states (see .contour-field
// in src/renderer/styles/foundations.css). Drawn from a fixed seed, so it is the same
// picture every time; nothing is downloaded.
//
//   node scripts/backgrounds/contour.mjs      → src/renderer/assets/contour-field.svg
//
// How it is made: a smooth pressure field (two broad highs, two lows off the sheet, and a
// slow drift across it) is sampled on a grid; marching squares finds where it crosses each
// 4 hPa level; the crossings are joined into lines, thinned and drawn as smooth curves.
// Three lines carry their pressure and the stronger high carries an "H", in single-stroke
// chart lettering drawn here as paths, so the file needs no font and looks the same
// everywhere. Lines only, no fills, and every stroke stays one pixel however large the sheet
// is shown: the stylesheet uses the file as a mask and paints the lines in the theme's ink.
// The lines are a little fainter than the lettering, so the figures can still be read.

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../src/renderer/assets/contour-field.svg');
const W = 1600;
const H = 1000;
const SEED = 1018;
/** Grid spacing the field is sampled at. */
const STEP = 8;
/** Pressure between neighbouring lines, in hPa (weather charts use 4). */
const INTERVAL = 4;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- the pressure field -----------------------------------------------------------

const rand = rng(SEED);
/** A value within ±spread of v. */
const near = (v, spread) => v + (rand() * 2 - 1) * spread;

/** A broad high or low: where it is, how far it reaches along and across its axis, its tilt, and its strength in hPa. */
const centre = (x, y, rx, ry, tilt, hpa) => ({ x: near(x, 30), y: near(y, 24), rx: near(rx, 24), ry: near(ry, 18), tilt: near(tilt, 0.08), hpa });

// A still day: a wide high right of the middle, a weaker one low on the left, and the
// edges of two lows that stay off the sheet. Wide and few, so the lines run far apart.
const CENTRES = [
  centre(1090, 400, 560, 360, -0.32, 19),
  centre(250, 850, 440, 300, 0.42, 9.5),
  centre(-260, -140, 720, 560, 0.3, -17),
  centre(1900, 1240, 640, 520, -0.2, -13),
];
const BASE = 1012.6;

function pressure(x, y) {
  // A slow drift across the sheet keeps the lines from closing into rings everywhere.
  let p = BASE + ((x - W / 2) / W) * 2.2 - ((y - H / 2) / H) * 1.4;
  for (const c of CENTRES) {
    const dx = x - c.x;
    const dy = y - c.y;
    const u = (dx * Math.cos(c.tilt) + dy * Math.sin(c.tilt)) / c.rx;
    const v = (-dx * Math.sin(c.tilt) + dy * Math.cos(c.tilt)) / c.ry;
    p += c.hpa * Math.exp(-(u * u + v * v) / 2);
  }
  return p;
}

// ---- marching squares ---------------------------------------------------------------

// The grid runs a little past the sheet, so lines leave it cleanly instead of stopping at the edge.
const PAD = STEP * 4;
const COLS = Math.ceil((W + PAD * 2) / STEP) + 1;
const ROWS = Math.ceil((H + PAD * 2) / STEP) + 1;
const gx = (i) => i * STEP - PAD;
const gy = (j) => j * STEP - PAD;
const grid = new Float64Array(COLS * ROWS);
for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) grid[j * COLS + i] = pressure(gx(i), gy(j));

/** Every line of one pressure level, as lists of points; `closed` when it comes back to its start. */
function isobars(level) {
  // Each crossing sits on a grid edge. Edges are numbered so two cells sharing one agree on it.
  const hEdge = (i, j) => j * COLS + i; // from node (i, j) to (i + 1, j)
  const vEdge = (i, j) => COLS * ROWS + j * COLS + i; // from node (i, j) to (i, j + 1)
  const points = new Map();
  const cross = (id, x0, y0, v0, x1, y1, v1) => {
    if (!points.has(id)) {
      const t = (level - v0) / (v1 - v0);
      points.set(id, [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
    return id;
  };
  const links = new Map();
  const link = (a, b) => {
    for (const [p, q] of [[a, b], [b, a]]) {
      if (!links.has(p)) links.set(p, []);
      links.get(p).push(q);
    }
  };
  for (let j = 0; j < ROWS - 1; j++) {
    for (let i = 0; i < COLS - 1; i++) {
      const a = grid[j * COLS + i];
      const b = grid[j * COLS + i + 1];
      const c = grid[(j + 1) * COLS + i + 1];
      const d = grid[(j + 1) * COLS + i];
      const kind = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
      if (kind === 0 || kind === 15) continue;
      const top = () => cross(hEdge(i, j), gx(i), gy(j), a, gx(i + 1), gy(j), b);
      const right = () => cross(vEdge(i + 1, j), gx(i + 1), gy(j), b, gx(i + 1), gy(j + 1), c);
      const bottom = () => cross(hEdge(i, j + 1), gx(i), gy(j + 1), d, gx(i + 1), gy(j + 1), c);
      const left = () => cross(vEdge(i, j), gx(i), gy(j), a, gx(i), gy(j + 1), d);
      // A saddle (opposite corners high) is settled by the pressure in the middle of the cell.
      const high = (a + b + c + d) / 4 > level;
      switch (kind) {
        case 1: case 14: link(left(), bottom()); break;
        case 2: case 13: link(bottom(), right()); break;
        case 3: case 12: link(left(), right()); break;
        case 4: case 11: link(top(), right()); break;
        case 6: case 9: link(top(), bottom()); break;
        case 7: case 8: link(left(), top()); break;
        case 5: if (high) { link(left(), top()); link(bottom(), right()); } else { link(left(), bottom()); link(top(), right()); } break;
        case 10: if (high) { link(left(), bottom()); link(top(), right()); } else { link(left(), top()); link(bottom(), right()); } break;
      }
    }
  }
  // Walk the links into whole lines: open ones from their loose ends first, then the rings.
  const used = new Set();
  const lines = [];
  const walk = (start) => {
    const ids = [start];
    used.add(start);
    let at = start;
    for (;;) {
      const next = links.get(at).find((n) => !used.has(n));
      if (next === undefined) break;
      used.add(next);
      ids.push(next);
      at = next;
    }
    return ids;
  };
  for (const [id, to] of links) if (to.length === 1 && !used.has(id)) lines.push({ closed: false, pts: walk(id).map((n) => points.get(n)) });
  for (const id of links.keys()) if (!used.has(id)) lines.push({ closed: true, pts: walk(id).map((n) => points.get(n)) });
  return lines;
}

// ---- drawing ------------------------------------------------------------------------

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const length = (pts) => pts.reduce((sum, p, i) => (i ? sum + dist(pts[i - 1], p) : 0), 0);

/** Fewer points, evenly spaced about `gap` apart: the curve drawn through them is then smooth, not stepped by the grid. */
function thin(pts, gap, closed) {
  const total = length(closed ? [...pts, pts[0]] : pts);
  const n = Math.max(closed ? 6 : 2, Math.round(total / gap));
  const src = closed ? [...pts, pts[0]] : pts;
  const out = [];
  let seg = 0;
  let before = 0;
  for (let k = 0; k < (closed ? n : n + 1); k++) {
    const want = (total * k) / n;
    while (seg < src.length - 2 && before + dist(src[seg], src[seg + 1]) < want) before += dist(src[seg], src[++seg]);
    const d = dist(src[seg], src[seg + 1]) || 1;
    const t = Math.min(1, (want - before) / d);
    out.push([src[seg][0] + (src[seg + 1][0] - src[seg][0]) * t, src[seg][1] + (src[seg + 1][1] - src[seg][1]) * t]);
  }
  return out;
}

const n1 = (v) => (Math.round(v * 10) / 10).toString();

/** A smooth curve through the points (Catmull-Rom, written as cubic Béziers). */
function curve(pts, closed) {
  const at = (i) => (closed ? pts[(i + pts.length) % pts.length] : pts[Math.max(0, Math.min(pts.length - 1, i))]);
  let d = `M${n1(pts[0][0])} ${n1(pts[0][1])}`;
  const last = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < last; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += `C${n1(p1[0] + (p2[0] - p0[0]) / 6)} ${n1(p1[1] + (p2[1] - p0[1]) / 6)} ${n1(p2[0] - (p3[0] - p1[0]) / 6)} ${n1(p2[1] - (p3[1] - p1[1]) / 6)} ${n1(p2[0])} ${n1(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}

// Chart lettering: one stroke per figure, in a box 6 wide and 10 tall, the weight of the lines.
const GLYPH = {
  0: 'M3 0C1.2 0 .3 1.9 .3 5S1.2 10 3 10 5.7 8.1 5.7 5 4.8 0 3 0Z',
  1: 'M1.2 2 3.4 0V10',
  2: 'M.5 2.6C.5 1 1.6 0 3.1 0 4.6 0 5.6 1 5.6 2.5 5.6 4.3 4.2 5.5 .4 10H5.8',
  4: 'M4.4 10V0L.2 7H5.9',
  6: 'M5.3 1.4C4.8 .5 4.1 0 3.2 0 1.3 0 .3 2 .3 5.6 .3 8.5 1.3 10 3.1 10 4.7 10 5.7 8.8 5.7 7.1 5.7 5.4 4.7 4.3 3.2 4.3 1.8 4.3 .7 5.2 .4 6.6',
  8: 'M3 4.6C1.7 4.6 .8 3.7 .8 2.4 .8 1 1.7 0 3 0S5.2 1 5.2 2.4C5.2 3.7 4.3 4.6 3 4.6 1.4 4.6 .3 5.7 .3 7.3 .3 8.9 1.4 10 3 10S5.7 8.9 5.7 7.3C5.7 5.7 4.6 4.6 3 4.6Z',
  H: 'M.4 0V10M5.6 0V10M.4 5H5.6',
};
const ADVANCE = 8.4;

/** Text set at (x, y), centred, turned to `angle` degrees and scaled; as SVG path elements. */
function lettering(text, x, y, angle, scale) {
  const w = text.length * ADVANCE - (ADVANCE - 6);
  return [...text]
    .map((ch, i) => `<path transform="translate(${n1(x)} ${n1(y)}) rotate(${n1(angle)}) scale(${scale}) translate(${n1(i * ADVANCE - w / 2)} -5)" d="${GLYPH[ch]}"/>`)
    .join('');
}

/**
 * Where a line can carry its pressure: the place nearest `near` where it does not run too
 * steeply (so the figures still read left to right). Returns the point, the slope there, and the line
 * with a gap cut for the figures.
 */
function labelled(pts, closed, near, gap) {
  let best = -1;
  let bestScore = Infinity;
  for (let i = 2; i < pts.length - 2; i++) {
    const [x, y] = pts[i];
    if (x < 90 || x > W - 90 || y < 60 || y > H - 60) continue;
    const slope = Math.abs(Math.atan2(pts[i + 1][1] - pts[i - 1][1], pts[i + 1][0] - pts[i - 1][0]));
    const lean = Math.min(slope, Math.PI - slope);
    if (lean > 0.75) continue;
    const score = dist(pts[i], near) + lean * 260;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  if (best < 0) return null;
  let angle = (Math.atan2(pts[best + 1][1] - pts[best - 1][1], pts[best + 1][0] - pts[best - 1][0]) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  // Cut the line open around the figures: walk out from the spot until half the gap is covered each way.
  let lo = best;
  let hi = best;
  for (let d = 0; lo > 0 && d < gap / 2; lo--) d += dist(pts[lo], pts[lo - 1]);
  for (let d = 0; hi < pts.length - 1 && d < gap / 2; hi++) d += dist(pts[hi], pts[hi + 1]);
  const pieces = closed ? [[...pts.slice(hi), ...pts.slice(0, lo + 1)]] : [pts.slice(0, lo + 1), pts.slice(hi)];
  return { at: pts[best], angle, pieces: pieces.filter((p) => p.length > 2) };
}

// ---- compose ------------------------------------------------------------------------

let lo = Infinity;
let hi = -Infinity;
let peak = [0, 0];
for (let j = 0; j < ROWS; j++) {
  for (let i = 0; i < COLS; i++) {
    const v = grid[j * COLS + i];
    const inside = gx(i) >= 0 && gx(i) <= W && gy(j) >= 0 && gy(j) <= H;
    if (v < lo) lo = v;
    if (v > hi) {
      hi = v;
      if (inside) peak = [gx(i), gy(j)];
    }
  }
}

// Which lines carry their pressure, and roughly where: spread over the sheet, clear of the
// middle (the start page's greeting and search field lie there).
const LABELS = [
  { level: 1024, near: [1180, 610] },
  { level: 1016, near: [200, 520] },
  { level: 1020, near: [330, 690] },
];
const LETTER = 1.05;

const paths = [];
const marks = [];
let count = 0;
for (let level = Math.ceil(lo / INTERVAL) * INTERVAL; level <= hi; level += INTERVAL) {
  for (const line of isobars(level)) {
    // A ring too small to read as a line is a speck: leave it out.
    if (length(line.pts) < 220) continue;
    const pts = thin(line.pts, 36, line.closed);
    const want = LABELS.find((l) => l.level === level && !l.done);
    const fine = want ? thin(line.pts, 10, line.closed) : null;
    const cut = fine ? labelled(fine, line.closed, want.near, String(level).length * ADVANCE * LETTER + 14) : null;
    if (cut) {
      want.done = true;
      for (const piece of cut.pieces) paths.push(`<path d="${curve(thin(piece, 36, false), false)}"/>`);
      marks.push(lettering(String(level), cut.at[0], cut.at[1], cut.angle, LETTER));
    } else {
      paths.push(`<path d="${curve(pts, line.closed)}"/>`);
    }
    count++;
  }
}
// No "H" at the peak: alone beside a headline it reads as a stray letter, not a chart mark.

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round">
<!-- Kite's contour field. Made by scripts/backgrounds/contour.mjs; do not edit by hand. -->
<style>path{vector-effect:non-scaling-stroke}</style>
<g stroke-width="1" stroke-opacity=".72">${paths.join('')}</g>
<g stroke-width="1">${marks.join('')}</g>
</svg>
`;
writeFileSync(OUT, svg);
console.log(`contour-field.svg: ${count} lines from ${Math.ceil(lo / INTERVAL) * INTERVAL} to ${Math.floor(hi / INTERVAL) * INTERVAL} hPa, high of ${hi.toFixed(1)} at ${peak}, ${(svg.length / 1024).toFixed(1)} KB`);
