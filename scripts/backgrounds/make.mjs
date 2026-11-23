// Kite's built-in theme pictures: original scenes drawn as SVG from a fixed seed, then
// rendered by Chromium to JPEG. Nothing is downloaded and every picture is Kite's own.
//
//   node scripts/backgrounds/make.mjs            → src/renderer/assets/backgrounds/<id>.jpg (+ -thumb.jpg)
//   node scripts/backgrounds/make.mjs dawn       → just one
//
// The catalogue (names, tone, the two theme colours) lives in src/shared/backdrops.ts;
// the ids here must match it.

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../src/renderer/assets/backgrounds');
const W = 1600;
const H = 1000;

// ---- small tools ------------------------------------------------------------------

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

/** 1-D value noise with smooth steps, summed over octaves: 0…1. */
function noise1d(rand) {
  const lattice = Array.from({ length: 512 }, rand);
  const at = (x) => {
    const i = Math.floor(x);
    const f = x - i;
    const s = f * f * (3 - 2 * f);
    const a = lattice[((i % 512) + 512) % 512];
    const b = lattice[(((i + 1) % 512) + 512) % 512];
    return a + (b - a) * s;
  };
  return (x, octaves = 5) => {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += at(x * freq + o * 37.1) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  };
}

const hex = (c) => c.replace('#', '');
function mix(a, b, t) {
  const p = (h) => [0, 2, 4].map((i) => parseInt(hex(h).slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

const r1 = (n) => Math.round(n * 10) / 10;

/** A mountain range: broad peaks with a little rock detail, filled down to the bottom. */
function ridge(rand, { base, height, scale, sharp = 1.6, octaves = 4, step = 5 }) {
  const n = noise1d(rand);
  const off = rand() * 100;
  const pts = [];
  for (let x = -20; x <= W + 20; x += step) {
    // Broad shape from a slow noise, peaks sharpened by a power; detail from a faster one.
    const broad = Math.pow(n(off + x / scale, 2), sharp);
    const detail = n(off * 2 + x / (scale / 5), octaves) - 0.5;
    pts.push(`${x},${r1(base - (broad * 1.35 + detail * 0.12) * height)}`);
  }
  return `M-20,${H + 20} L${pts.join(' L')} L${W + 20},${H + 20} Z`;
}

/** A tree line: a soft hill with pines standing on it. */
function pines(rand, { base, hill, scale, tree, spacing }) {
  const n = noise1d(rand);
  const off = rand() * 100;
  const ground = (x) => base - n(off + x / scale, 2) * hill;
  const pts = [];
  for (let x = -20; x <= W + 20; x += 8) pts.push(`${x},${r1(ground(x))}`);
  let d = `M-20,${H + 20} L${pts.join(' L')} L${W + 20},${H + 20} Z`;
  for (let x = -10; x < W + 10; x += spacing * (0.6 + rand() * 0.8)) {
    const h = tree * (0.55 + rand() * 0.6);
    const w = h * (0.16 + rand() * 0.06);
    const y = ground(x) + 4;
    // Three tiers, like a fir.
    d += ` M${r1(x - w)},${r1(y)} L${r1(x - w * 0.35)},${r1(y - h * 0.42)} L${r1(x - w * 0.7)},${r1(y - h * 0.42)} L${r1(x - w * 0.2)},${r1(y - h * 0.72)} L${r1(x - w * 0.45)},${r1(y - h * 0.72)} L${r1(x)},${r1(y - h)} L${r1(x + w * 0.45)},${r1(y - h * 0.72)} L${r1(x + w * 0.2)},${r1(y - h * 0.72)} L${r1(x + w * 0.7)},${r1(y - h * 0.42)} L${r1(x + w * 0.35)},${r1(y - h * 0.42)} L${r1(x + w)},${r1(y)} Z`;
  }
  return d;
}

/** Rolling hills or dunes: a smooth line from the left edge to the right. */
function rolling(rand, { base, height, scale, octaves = 3, step = 8 }) {
  const n = noise1d(rand);
  const off = rand() * 100;
  const pts = [];
  for (let x = -20; x <= W + 20; x += step) pts.push(`${x},${r1(base - n(off + x / scale, octaves) * height)}`);
  return `M-20,${H + 20} L${pts.join(' L')} L${W + 20},${H + 20} Z`;
}

const defsGrain = `
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch"/>
    <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.55 0"/>
  </filter>`;
const grain = (o = 0.08) => `<rect width="${W}" height="${H}" filter="url(#grain)" opacity="${o}" style="mix-blend-mode:overlay"/>`;

function sky(id, stops) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
}

function glow(id, color, opacity = 1) {
  return `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="0.35" stop-color="${color}" stop-opacity="${opacity * 0.45}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
}

/** A band of mist that thickens toward the bottom, laid over a layer's foot. */
function mist(i, y, color, depth, strength) {
  return {
    def: `<linearGradient id="mist${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0"/><stop offset="1" stop-color="${color}" stop-opacity="${strength}"/></linearGradient>`,
    el: `<rect x="0" y="${y - depth}" width="${W}" height="${depth}" fill="url(#mist${i})"/><rect x="0" y="${y}" width="${W}" height="${H - y}" fill="${color}" opacity="${strength}"/>`,
  };
}

/** Layered mountains, far to near: each lighter and hazier with distance. */
function mountains(rand, { layers, far, near, haze, mistColor = haze, mistStrength = 0.45, top = 640, bottom = 940, sharp = 1.7 }) {
  const defs = [];
  const els = [];
  for (let i = 0; i < layers; i++) {
    const t = layers === 1 ? 1 : i / (layers - 1);
    const base = top + (bottom - top) * t;
    const height = 190 - t * 70 + rand() * 30;
    const color = mix(mix(far, near, Math.pow(t, 0.8)), haze, (1 - t) * 0.35);
    els.push(`<path d="${ridge(rand, { base, height, scale: 520 - t * 220, sharp: sharp + t * 0.2 })}" fill="${color}"/>`);
    if (i < layers - 1) {
      const m = mist(i, base + 40, mistColor, 160, mistStrength * (1 - t * 0.5));
      defs.push(m.def);
      els.push(m.el);
    }
  }
  return { defs: defs.join(''), els: els.join('') };
}

function stars(rand, count, maxY, color = '#ffffff') {
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = rand() * W;
    const y = Math.pow(rand(), 1.4) * maxY;
    const r = rand() < 0.04 ? 1.6 + rand() : 0.4 + rand() * 0.8;
    out += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${color}" opacity="${r1(0.25 + rand() * 0.7)}"/>`;
  }
  return out;
}

function svg(defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"><defs>${defsGrain}${defs}</defs>${body}</svg>`;
}

// ---- the scenes ----------------------------------------------------------------------

const SCENES = {
  /** Pastel peaks at sunrise. */
  dawn() {
    const rand = rng(11);
    const m = mountains(rand, { layers: 4, far: '#cdb9e3', near: '#5f4b8b', haze: '#f6d6d0', top: 650, bottom: 950 });
    return svg(
      sky('s', [[0, '#a9c4f0'], [0.45, '#f3d2dc'], [0.72, '#ffe0c2'], [1, '#ffd9b0']]) + glow('sun', '#fff2d6') + m.defs,
      `<rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="1060" cy="520" r="420" fill="url(#sun)"/><circle cx="1060" cy="520" r="54" fill="#fff6e4" opacity="0.95"/>${m.els}${grain(0.07)}`,
    );
  },

  /** Warm dunes under a pale sky. */
  dunes() {
    const rand = rng(23);
    const layers = [
      { base: 640, height: 90, scale: 420, a: '#f2c79a', b: '#d9935f' },
      { base: 730, height: 120, scale: 340, a: '#eab07a', b: '#c4703f' },
      { base: 830, height: 140, scale: 300, a: '#de9862', b: '#a65430' },
      { base: 950, height: 160, scale: 260, a: '#c98050', b: '#8a3f22' },
    ];
    const defs = layers.map((l, i) => `<linearGradient id="d${i}" x1="0" y1="0" x2="1" y2="0.3"><stop offset="0" stop-color="${l.a}"/><stop offset="0.55" stop-color="${mix(l.a, l.b, 0.4)}"/><stop offset="1" stop-color="${l.b}"/></linearGradient>`).join('');
    const els = layers.map((l, i) => `<path d="${rolling(rand, { base: l.base, height: l.height, scale: l.scale })}" fill="url(#d${i})"/>`).join('');
    return svg(
      sky('s', [[0, '#9fc3e6'], [0.5, '#f4dcc4'], [1, '#f8cfa4']]) + glow('sun', '#fff1d2') + defs,
      `<rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="420" cy="470" r="380" fill="url(#sun)"/><circle cx="420" cy="470" r="46" fill="#fff4e0"/>${els}${grain(0.08)}`,
    );
  },

  /** Green hills and soft clouds. */
  meadow() {
    const rand = rng(31);
    const hills = [
      { base: 600, height: 110, scale: 380, c: '#b9d7a8' },
      { base: 680, height: 120, scale: 320, c: '#94c283' },
      { base: 780, height: 130, scale: 300, c: '#6fa762' },
      { base: 900, height: 150, scale: 260, c: '#4d8a4a' },
    ];
    let els = '';
    let defs = '';
    hills.forEach((h, i) => {
      els += `<path d="${rolling(rand, { base: h.base, height: h.height, scale: h.scale })}" fill="${h.c}"/>`;
      if (i < hills.length - 1) {
        const m = mist(i, h.base + 30, '#eaf3f2', 120, 0.35);
        defs += m.def;
        els += m.el;
      }
    });
    let clouds = '';
    for (let i = 0; i < 7; i++) clouds += `<ellipse cx="${r1(rand() * W)}" cy="${r1(120 + rand() * 260)}" rx="${r1(160 + rand() * 220)}" ry="${r1(26 + rand() * 30)}" fill="#ffffff" opacity="${r1(0.5 + rand() * 0.35)}"/>`;
    return svg(
      sky('s', [[0, '#8fbbe8'], [0.6, '#d7e9f3'], [1, '#f1f4e6']]) + `<filter id="soft"><feGaussianBlur stdDeviation="22"/></filter>` + defs,
      `<rect width="${W}" height="${H}" fill="url(#s)"/><g filter="url(#soft)">${clouds}</g>${els}${grain(0.07)}`,
    );
  },

  /** Abstract: a pale blush and lilac haze. */
  haze() {
    return abstract(41, '#f5efe9', ['#f9c9d4', '#cdbaf3', '#bfe3f2', '#fde3c3', '#e9d4f7']);
  },

  /** Abstract: deep pink into violet. */
  bloom() {
    return abstract(53, '#2a1240', ['#ff7aa8', '#8a4fff', '#ff9a6b', '#5b2bd6', '#ffc2d6'], 0.85);
  },

  /** Green aurora over dark peaks. */
  aurora() {
    const rand = rng(61);
    const m = mountains(rand, { layers: 3, far: '#1b3646', near: '#05121a', haze: '#123040', mistColor: '#0d2533', mistStrength: 0.5, top: 720, bottom: 950, sharp: 1.9 });
    const ribbon = (d, w, o) => `<path d="${d}" fill="none" stroke="url(#au)" stroke-width="${w}" stroke-linecap="round" opacity="${o}"/>`;
    return svg(
      sky('s', [[0, '#040a18'], [0.55, '#0b2433'], [1, '#12394a']]) +
        `<linearGradient id="au" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3cf2b4" stop-opacity="0"/><stop offset="0.25" stop-color="#3cf2b4"/><stop offset="0.6" stop-color="#4fd6e8"/><stop offset="0.85" stop-color="#9c7dff"/><stop offset="1" stop-color="#9c7dff" stop-opacity="0"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="38"/></filter><filter id="blur2"><feGaussianBlur stdDeviation="12"/></filter>` +
        m.defs,
      `<rect width="${W}" height="${H}" fill="url(#s)"/>${stars(rand, 420, 620)}<g filter="url(#blur)">${ribbon('M-100,420 C300,180 700,520 1100,260 S1600,300 1800,160', 170, 0.75)}${ribbon('M-100,520 C400,330 900,600 1300,380 S1700,420 1800,330', 110, 0.5)}</g><g filter="url(#blur2)">${ribbon('M-100,430 C300,190 700,530 1100,270 S1600,310 1800,170', 26, 0.55)}</g>${m.els}${grain(0.09)}`,
    );
  },

  /** Violet ridges after sunset. */
  dusk() {
    const rand = rng(71);
    const m = mountains(rand, { layers: 4, far: '#8a5fa8', near: '#1d1233', haze: '#e78d8a', mistColor: '#b86e95', mistStrength: 0.35, top: 680, bottom: 950 });
    return svg(
      sky('s', [[0, '#1c1640'], [0.4, '#5b3a7c'], [0.68, '#d9768a'], [0.85, '#ffb18a'], [1, '#ffc79a']]) + glow('sun', '#ffcf9e') + m.defs,
      `<rect width="${W}" height="${H}" fill="url(#s)"/>${stars(rand, 120, 260, '#ffe8f0')}<circle cx="780" cy="640" r="460" fill="url(#sun)"/>${m.els}${grain(0.08)}`,
    );
  },

  /** A moonlit sea. */
  ocean() {
    const rand = rng(83);
    const horizon = 660;
    let streaks = '';
    for (let i = 0; i < 46; i++) {
      const y = horizon + 8 + Math.pow(i / 46, 1.6) * (H - horizon);
      const w = 30 + (i / 46) * 360 * (0.5 + rand());
      streaks += `<rect x="${r1(1080 - w / 2 + (rand() - 0.5) * 40)}" y="${r1(y)}" width="${r1(w)}" height="${r1(1.5 + i * 0.12)}" rx="2" fill="#d8ecff" opacity="${r1(0.15 + rand() * 0.35 * (1 - i / 60))}"/>`;
    }
    const far = `<path d="${ridge(rand, { base: horizon, height: 46, scale: 200, sharp: 1.2 })}" fill="#0c2a4a" opacity="0.9"/>`;
    return svg(
      sky('s', [[0, '#061226'], [0.5, '#0f2f57'], [0.6, '#2b5a88'], [1, '#2b5a88']]) +
        sky('sea', [[0, '#123a63'], [1, '#04101f']]) +
        glow('moon', '#d8ecff', 0.9) + `<filter id="sblur" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="14 3"/></filter>`,
      `<rect width="${W}" height="${H}" fill="url(#s)"/>${stars(rand, 260, 520)}<circle cx="1080" cy="300" r="300" fill="url(#moon)"/><circle cx="1080" cy="300" r="38" fill="#eef6ff"/>${far}<rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="url(#sea)"/><g filter="url(#sblur)" opacity="0.9">${streaks}</g><g opacity="0.22">${streaks}</g>${grain(0.09)}`,
    );
  },

  /** Misty pine ridges. */
  forest() {
    const rand = rng(97);
    const defs = [];
    const els = [];
    const layers = 5;
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1);
      const base = 600 + t * 360;
      const color = mix(mix('#7d9a92', '#061410', Math.pow(t, 0.75)), '#b7cbc4', (1 - t) * 0.3);
      els.push(`<path d="${pines(rand, { base, hill: 70 - t * 20, scale: 420 - t * 120, tree: 70 + t * 120, spacing: 24 + t * 30 })}" fill="${color}"/>`);
      if (i < layers - 1) {
        const m = mist(i, base + 20, '#a8bfb7', 140, 0.5 * (1 - t * 0.45));
        defs.push(m.def);
        els.push(m.el);
      }
    }
    return svg(
      sky('s', [[0, '#5f7f86'], [0.55, '#a9c0bb'], [1, '#d4e0da']]) + glow('sun', '#f6f1df', 0.8) + defs.join(''),
      `<rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="1180" cy="330" r="360" fill="url(#sun)"/>${els.join('')}${grain(0.09)}`,
    );
  },

  /** Ember sky over dark hills. */
  ember() {
    const rand = rng(109);
    const m = mountains(rand, { layers: 3, far: '#7a2a24', near: '#120606', haze: '#ff8a4c', mistColor: '#c0442c', mistStrength: 0.35, top: 720, bottom: 950, sharp: 1.4 });
    return svg(
      sky('s', [[0, '#1a0a12'], [0.4, '#5c1a24'], [0.7, '#e2553a'], [0.88, '#ffa25a'], [1, '#ffc27a']]) + glow('sun', '#ffb36b') + m.defs,
      `<rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="520" cy="660" r="520" fill="url(#sun)"/><circle cx="520" cy="660" r="70" fill="#ffd9a0" opacity="0.9"/>${m.els}${grain(0.09)}`,
    );
  },

  /** A clear night: stars and the Milky Way over a dark range. */
  night() {
    const rand = rng(127);
    const m = mountains(rand, { layers: 3, far: '#1c2540', near: '#04060c', haze: '#1c2740', mistColor: '#141c30', mistStrength: 0.5, top: 740, bottom: 960, sharp: 2 });
    let band = '';
    for (let i = 0; i < 900; i++) {
      const t = rand();
      const x = -100 + t * 1800;
      const y = 120 + t * 420 + (rand() - 0.5) * 160 * (0.6 + rand());
      band += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(0.3 + rand() * 0.9)}" fill="#ffffff" opacity="${r1(0.2 + rand() * 0.6)}"/>`;
    }
    return svg(
      sky('s', [[0, '#03050c'], [0.6, '#0b1326'], [1, '#18243d']]) + `<linearGradient id="mw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7f8cff" stop-opacity="0"/><stop offset="0.5" stop-color="#c9b8ff" stop-opacity="0.35"/><stop offset="1" stop-color="#7fd3ff" stop-opacity="0"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="60"/></filter>` + m.defs,
      `<rect width="${W}" height="${H}" fill="url(#s)"/><path d="M-100,90 L1800,560 L1800,760 L-100,300 Z" fill="url(#mw)" filter="url(#blur)"/>${stars(rand, 500, 760)}${band}${m.els}${grain(0.1)}`,
    );
  },
};

/** Soft colour fields: big blurred circles over a base, like Arc's own gradients. */
function abstract(seed, base, colors, strength = 0.9) {
  const rand = rng(seed);
  let blobs = '';
  for (let i = 0; i < 7; i++) {
    const c = colors[i % colors.length];
    blobs += `<circle cx="${r1(rand() * W)}" cy="${r1(rand() * H)}" r="${r1(260 + rand() * 360)}" fill="${c}" opacity="${r1(strength * (0.6 + rand() * 0.4))}"/>`;
  }
  return svg(`<filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="150"/></filter>`, `<rect width="${W}" height="${H}" fill="${base}"/><g filter="url(#blur)">${blobs}</g>${grain(0.1)}`);
}

// ---- render ---------------------------------------------------------------------------

const only = process.argv.slice(2);
const ids = only.length ? only : Object.keys(SCENES);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const id of ids) {
  if (!SCENES[id]) throw new Error(`No scene called ${id}`);
  const html = `<!doctype html><html><body style="margin:0;background:#000">${SCENES[id]()}</body></html>`;
  for (const [suffix, w, h, scale, quality] of [['', 1280, 800, 2, 84], ['-thumb', 320, 200, 1.25, 80]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    await page.setContent(html.replace('<svg ', `<svg style="display:block;width:${w}px;height:${h}px" `));
    await page.screenshot({ path: join(OUT, `${id}${suffix}.jpg`), type: 'jpeg', quality });
    await page.close();
  }
  console.log(`✓ ${id}`);
}
await browser.close();
