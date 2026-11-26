// ../../../../../../../../Users/apple/Personal/MArc/src/shared/designTokens.ts
var GRAY = [
  ["#fcfcfc", "#161616"],
  ["#f8f8f8", "#1c1c1c"],
  ["#f3f3f3", "#232323"],
  ["#ededed", "#282828"],
  ["#e8e8e8", "#2e2e2e"],
  ["#e2e2e2", "#343434"],
  ["#dbdbdb", "#3e3e3e"],
  ["#c7c7c7", "#505050"],
  ["#8f8f8f", "#707070"],
  ["#858585", "#7e7e7e"],
  ["#6f6f6f", "#a0a0a0"],
  ["#171717", "#ededed"]
];
var GRAY_ALPHA = [
  [0.012, 0],
  [0.027, 0.026],
  [0.047, 0.056],
  [0.071, 0.077],
  [0.09, 0.103],
  [0.114, 0.129],
  [0.141, 0.172],
  [0.22, 0.249],
  [0.439, 0.386],
  [0.478, 0.446],
  [0.565, 0.592],
  [0.91, 0.923]
];
var INDIGO = [
  ["#ffffff", "#141421"],
  ["#f7f8ff", "#16162e"],
  ["#f0f0ff", "#191a40"],
  ["#e8e9ff", "#1c1d4f"],
  ["#d9dafc", "#1f215c"],
  ["#c8cafa", "#22246e"],
  ["#aeb0f5", "#272a8a"],
  ["#8e91f0", "#2e32b2"],
  ["#3138f9", "#3239fa"],
  ["#393ecc", "#5458e8"],
  ["#3438b2", "#8589ff"],
  ["#101245", "#edeefc"]
];
var SWATCHES = {
  pastel: ["#fdfbfa", "#fbeaf3", "#ecd2ea", "#f7cdd2", "#fae1d5", "#fef9e7", "#e4fcec", "#e0f2fb", "#c5c6e2"],
  muted: ["#4b3b58", "#623856", "#854444", "#a77048", "#d1b46a", "#cdcca8", "#84a885", "#34604b", "#2d4468"],
  grey: ["#ffffff", "#e6e6e6", "#cccccc", "#b2b2b2", "#808080", "#666666", "#333333", "#1a1a1a", "#000000"]
};
function scaleVars(dark) {
  const i = dark ? 1 : 0;
  const ink = dark ? "255,255,255" : "0,0,0";
  const out = {};
  GRAY.forEach((p, n) => out[`--gray-${n + 1}`] = p[i]);
  GRAY_ALPHA.forEach((p, n) => out[`--gray-a${n + 1}`] = `rgba(${ink},${p[i]})`);
  INDIGO.forEach((p, n) => out[`--indigo-${n + 1}`] = p[i]);
  return out;
}
var SPRINGS = {
  /** Panels, the sidebar, popups arriving. */
  default: { response: 0.38, damping: 0.86 },
  /** Settling back after a press: a small, quick bounce. */
  press: { response: 0.3, damping: 0.58 },
  /** Hover cards and small things that pop. */
  pop: { response: 0.32, damping: 0.7 }
};
function springAt({ response, damping }, t) {
  const w0 = 2 * Math.PI / Math.max(0.01, response);
  const z = Math.max(0.01, damping);
  if (z >= 1) {
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  }
  const wd = w0 * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + z * w0 / wd * Math.sin(wd * t));
}
function springDuration(s2) {
  const w0 = 2 * Math.PI / Math.max(0.01, s2.response);
  const decay = Math.min(1, Math.max(0.01, s2.damping)) * w0;
  const t = Math.log(250) / decay + (s2.damping >= 1 ? 1.2 / w0 : 0);
  return Math.round(t * 1e3);
}
function springEasing(s2, samples = 32) {
  const total = springDuration(s2) / 1e3;
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const v = i === samples ? 1 : springAt(s2, total * i / samples);
    pts.push(String(Math.round(v * 1e4) / 1e4));
  }
  return `linear(${pts.join(", ")})`;
}
function hslToHex(h, s2, l) {
  const hue = (h % 360 + 360) % 360;
  const sat = Math.max(0, Math.min(1, s2));
  const lig = Math.max(0, Math.min(1, l));
  const k = (n) => (n + hue / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("")}`;
}
function hexToHsl(hex) {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16) || 0;
  const r = (n >> 16 & 255) / 255;
  const g = (n >> 8 & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s2 = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s2, l];
}

// stub:stub-backdrops
var backdropUrl = (id, thumb) => `/assets/${id}${thumb ? "-thumb" : ""}.jpg`;

// ../../../../../../../../Users/apple/Personal/MArc/src/shared/backdrops.ts
var BACKDROPS = [
  { id: "dawn", name: "Dawn", tone: "light", colors: ["#e9d6ee", "#6b55a0"] },
  { id: "dunes", name: "Dunes", tone: "light", colors: ["#f4dcc4", "#c4703f"] },
  { id: "meadow", name: "Meadow", tone: "light", colors: ["#d7e9f3", "#4d8a4a"] },
  { id: "forest", name: "Forest", tone: "light", colors: ["#c3d3cd", "#2f5e50"] },
  { id: "haze", name: "Haze", tone: "light", colors: ["#f3e6f2", "#9a7fd6"] },
  { id: "bloom", name: "Bloom", tone: "dark", colors: ["#8a4fff", "#ff7aa8"] },
  { id: "aurora", name: "Aurora", tone: "dark", colors: ["#1b3646", "#3cf2b4"] },
  { id: "dusk", name: "Dusk", tone: "dark", colors: ["#5b3a7c", "#ff9f8a"] },
  { id: "ocean", name: "Ocean", tone: "dark", colors: ["#0f2f57", "#7fb7ff"] },
  { id: "ember", name: "Ember", tone: "dark", colors: ["#5c1a24", "#ff8a4c"] },
  { id: "night", name: "Night", tone: "dark", colors: ["#0b1326", "#9c8cff"] }
];
var isBackdrop = (v) => typeof v === "string" && BACKDROPS.some((b) => b.id === v);

// ../../../../../../../../Users/apple/Personal/MArc/src/shared/spaceTheme.ts
var SWATCH_ROWS = [
  { id: "pastel", name: "Pastel", colors: SWATCHES.pastel },
  { id: "muted", name: "Muted", colors: SWATCHES.muted },
  { id: "grey", name: "Grey", colors: SWATCHES.grey }
];
var MODES = ["light", "dark", "system"];
var DEFAULT_GRADIENT = { colors: ["#3b39a6", "#6b3fc4", "#16627c"], angle: 160 };
var DEFAULT_THEME = { colors: ["#7b82a8", "#8f8cff"], mode: "dark", intensity: 0.2, grain: false };
var PATTERNS = [
  { id: "glow", name: "Glow" },
  { id: "dots", name: "Dots" },
  { id: "grid", name: "Grid" },
  { id: "lines", name: "Lines" },
  { id: "rings", name: "Rings" }
];
var isPattern = (v) => typeof v === "string" && PATTERNS.some((p) => p.id === v);
var DEFAULT_PATTERN_STRENGTH = 0.5;
var THEME_PRESETS = [
  { id: "quiet", name: "Quiet", mode: "dark", base: "#7b82a8", intensity: 0.2, accent: "#8f8cff" },
  { id: "tide", name: "Indigo Tide", mode: "dark", intensity: 0.65, gradient: { colors: [...DEFAULT_GRADIENT.colors], angle: DEFAULT_GRADIENT.angle }, accent: "#8f8cff", pattern: "glow" },
  { id: "ember", name: "Ember", mode: "dark", intensity: 0.65, gradient: { colors: ["#6a2b7a", "#b0456a", "#c8642f"], angle: 160 }, accent: "#ffb38a", pattern: "glow" },
  { id: "forest", name: "Forest", mode: "dark", intensity: 0.65, gradient: { colors: ["#1f6b5c", "#2f8a5a", "#5a9a3a"], angle: 160 }, accent: "#8fe0a8", pattern: "glow" },
  { id: "rosewood", name: "Rosewood", mode: "dark", intensity: 0.65, gradient: { colors: ["#6a2a7a", "#a83a8a", "#c8446f"], angle: 160 }, accent: "#ff9ec4", pattern: "glow" },
  { id: "graphite", name: "Graphite", mode: "dark", intensity: 0.65, gradient: { colors: ["#4a4d57", "#5c606b", "#73788a"], angle: 160 }, accent: "#d5d8e0", pattern: "dots" },
  { id: "dawn", name: "Dawn", mode: "light", intensity: 0.65, gradient: { colors: ["#f6c9b0", "#e3c4ea", "#b9d4f5"], angle: 160 }, accent: "#4b3fd6", pattern: "glow" }
];
function presetPatch(id) {
  const p = THEME_PRESETS.find((x) => x.id === id);
  if (!p) return {};
  const rest = { backdrop: void 0, photo: void 0, mode: p.mode, intensity: p.intensity, pattern: p.pattern, ...p.pattern ? {} : { patternStrength: void 0 } };
  if (!p.gradient) return { ...rest, gradient: void 0, colors: [p.base ?? p.accent, p.accent] };
  return { ...rest, gradient: { colors: [...p.gradient.colors], angle: p.gradient.angle }, colors: [p.gradient.colors[0], p.accent] };
}
var isHex = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
var clamp01 = (v, fallback) => typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
var isPhotoId = (v) => typeof v === "string" && /^img-[a-z0-9-]{4,40}$/.test(v);
function sanitizeGradient(g) {
  const o = g;
  if (!o || !Array.isArray(o.colors)) return void 0;
  const colors = o.colors.filter(isHex).slice(0, 4).map((c) => c.toLowerCase());
  if (colors.length < 2) return void 0;
  const a = typeof o.angle === "number" && Number.isFinite(o.angle) ? Math.round(o.angle) : 160;
  return { colors, angle: (a % 360 + 360) % 360 };
}
function sanitizeTheme(t, fallback) {
  if (!t || typeof t !== "object") t = fallback;
  const colors = Array.isArray(t?.colors) && t.colors.length === 2 && t.colors.every(isHex) ? [t.colors[0].toLowerCase(), t.colors[1].toLowerCase()] : fallback.colors;
  const photo = t?.photo && isPhotoId(t.photo.id) ? { id: t.photo.id, tone: t.photo.tone === "light" ? "light" : "dark" } : void 0;
  const backdrop = !photo && isBackdrop(t?.backdrop) ? t.backdrop : void 0;
  const gradient = !photo && !backdrop ? sanitizeGradient(t?.gradient) : void 0;
  return {
    colors,
    mode: MODES.includes(t?.mode) ? t.mode : fallback.mode,
    intensity: clamp01(t?.intensity, fallback.intensity),
    grain: typeof t?.grain === "boolean" ? t.grain : fallback.grain,
    ...photo ? { photo } : {},
    ...backdrop ? { backdrop } : {},
    ...gradient ? { gradient } : {},
    ...isPattern(t?.pattern) ? { pattern: t.pattern } : {},
    ...isPattern(t?.pattern) && typeof t?.patternStrength === "number" && Number.isFinite(t.patternStrength) ? { patternStrength: clamp01(t.patternStrength, DEFAULT_PATTERN_STRENGTH) } : {}
  };
}
var SPACE_HUES = [0, -70, 95, 150, -130, 40, 200];
function defaultTheme(index = 0) {
  const turn = SPACE_HUES[index % SPACE_HUES.length];
  const base = { ...DEFAULT_THEME, colors: [...DEFAULT_THEME.colors] };
  if (!turn) return base;
  const rotate = (hex) => {
    const [h, s2, l] = hexToHsl(hex);
    return hslToHex(h + turn, s2, l);
  };
  return { ...base, colors: [rotate(base.colors[0]), rotate(base.colors[1])] };
}

// ../../../../../../../../Users/apple/Personal/MArc/src/renderer/theme.ts
function hexToRgb(hex) {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [128, 128, 128];
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
var toHex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("")}`;
function mix(a, b, t) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
function luminance(hex) {
  const ch = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (l1 + 0.05) / (l2 + 0.05);
}
function resolveDark(theme, systemDark) {
  return theme.mode === "dark" || theme.mode === "system" && systemDark;
}
var FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Figtree', ui-sans-serif, system-ui, sans-serif";
var FEEL = {
  smooth: { ease: "cubic-bezier(0.32, 0.72, 0, 1)", ms: 300 },
  snappy: { ease: "cubic-bezier(0.2, 0, 0, 1)", ms: 130 },
  bouncy: { ease: "cubic-bezier(0.34, 1.45, 0.64, 1)", ms: 320 },
  // A real spring (response + damping), drawn as a CSS linear() curve.
  spring: { ease: springEasing(SPRINGS.default), ms: springDuration(SPRINGS.default) }
};
var PRESS = { ease: springEasing(SPRINGS.press), ms: springDuration(SPRINGS.press) };
var ROW = { compact: 30, comfortable: 36, roomy: 42 };
var rgba = (hex, a) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.round(Math.max(0, Math.min(1, a)) * 1e3) / 1e3})`;
};
var TONE = {
  light: { base: "#f4f1ec", card: "#ffffff", ink: "#1e1c1a", tint: [0.18, 0.62] },
  dark: { base: "#16171c", card: "#1f2027", ink: "#f1efea", tint: [0.12, 0.38] }
};
var BORDER = 0.35;
var SHADOW = 0.5;
var EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
var DUR = 220;
function patternCss(pattern, dark, strength = DEFAULT_PATTERN_STRENGTH) {
  if (!pattern) return { image: "none", size: "auto" };
  const k = Math.max(0, Math.min(1, strength)) * 2;
  const c = (a) => `rgba(${dark ? "255,255,255" : "40,30,20"},${Math.round(Math.min(0.6, a * k) * 1e3) / 1e3})`;
  switch (pattern) {
    case "glow":
      return { image: `radial-gradient(60% 50% at 16% 0%, ${c(0.11)}, transparent 70%), radial-gradient(50% 45% at 100% 100%, ${c(0.08)}, transparent 70%)`, size: "auto, auto" };
    case "dots":
      return { image: `radial-gradient(${c(0.16)} 1px, transparent 1.5px)`, size: "18px 18px" };
    case "grid":
      return { image: `linear-gradient(${c(0.07)} 1px, transparent 1px), linear-gradient(90deg, ${c(0.07)} 1px, transparent 1px)`, size: "28px 28px, 28px 28px" };
    case "lines":
      return { image: `repeating-linear-gradient(135deg, ${c(0.06)} 0 1px, transparent 1px 12px)`, size: "auto" };
    case "rings":
      return { image: `repeating-radial-gradient(circle at 18% 0%, ${c(0.07)} 0 1px, transparent 1px 34px)`, size: "auto" };
  }
}
function rowSurfaces(dark) {
  return {
    "--hover": dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.42)",
    "--active": dark ? "rgba(255,255,255,.13)" : "rgba(255,255,255,.78)",
    "--active-shadow": dark ? "0 1px 0 rgba(255,255,255,.06) inset, 0 2px 10px rgba(0,0,0,.25)" : "0 1px 2px rgba(60,40,20,.08), 0 2px 10px rgba(60,40,20,.06)"
  };
}
function themeVars(theme, settings, systemDark, opts = {}) {
  const dark = resolveDark(theme, systemDark);
  const tone = dark ? TONE.dark : TONE.light;
  const base = tone.base;
  const t = Math.max(0, Math.min(1, theme.intensity));
  const k = tone.tint[0] + t * (tone.tint[1] - tone.tint[0]);
  const paint = (c) => mix(base, c, k);
  const g = theme.gradient;
  const stops = g ? g.colors.map(paint) : null;
  const a = stops ? stops[0] : paint(theme.colors[0]);
  const b = stops ? stops[stops.length - 1] : paint(theme.colors[1]);
  const chromeMid = stops ? stops.reduce((acc, c, i) => mix(acc, c, 1 / (i + 1))) : mix(a, b, 0.5);
  const ink = tone.ink;
  let accent = theme.colors[1];
  for (let i = 0; i < 8 && contrast(accent, chromeMid) < 3; i++) accent = mix(accent, ink, 0.18);
  const lineA = dark ? 0.02 + BORDER * 0.2 : 0.02 + BORDER * 0.2286;
  const lineRgb = dark ? "255,255,255" : "40,30,20";
  const ringA = 0.06 * (BORDER / 0.35);
  const depth = SHADOW / 0.5;
  const shadow = dark ? `0 0 0 1px rgba(255,255,255,${Math.min(0.2, ringA).toFixed(3)}), 0 1px 2px rgba(0,0,0,${Math.min(0.5, 0.3 * depth).toFixed(3)}), 0 14px 36px -8px rgba(0,0,0,${Math.min(0.8, 0.5 * depth).toFixed(3)})` : `0 0 0 1px rgba(60,40,20,${Math.min(0.2, ringA).toFixed(3)}), 0 1px 2px rgba(60,40,20,${Math.min(0.12, 0.05 * depth).toFixed(3)}), 0 14px 36px -8px rgba(60,40,20,${Math.min(0.32, 0.15 * depth).toFixed(3)})`;
  const overlayA = 0.94;
  const picture = theme.photo ? opts.photoUrl ?? void 0 : theme.backdrop ? backdropUrl(theme.backdrop) : void 0;
  const gradientCss = stops ? `linear-gradient(${g.angle}deg, ${stops.map((c, i) => `${c} ${Math.round(i / (stops.length - 1) * 100)}%`).join(", ")})` : null;
  const springy = settings.motionFeel === "spring";
  const pat = patternCss(theme.pattern, dark, theme.patternStrength);
  return {
    ...scaleVars(dark),
    "--chrome-a": a,
    "--chrome-b": b,
    "--chrome-mid": chromeMid,
    "--backdrop": picture ? `url("${picture}") center / cover no-repeat, ${chromeMid}` : gradientCss ?? `linear-gradient(165deg, ${a} 0%, ${chromeMid} 55%, ${b} 100%)`,
    // Over a picture the sidebar is frosted glass: the more intensity, the more picture shows.
    "--wash": dark ? `rgba(14,15,20,${(0.62 - t * 0.36).toFixed(3)})` : `rgba(255,255,255,${(0.66 - t * 0.38).toFixed(3)})`,
    "--ink": ink,
    // Readable greys: --ink-2 and --ink-3 both reach 4.5:1 (WCAG AA for text) on the
    // card and on the sidebar. --ink-4 is fainter and only for decoration (chevrons, arrows).
    "--ink-2": rgba(ink, dark ? 0.78 : 0.72),
    "--ink-3": rgba(ink, dark ? 0.6 : 0.62),
    "--ink-4": rgba(ink, dark ? 0.42 : 0.4),
    ...rowSurfaces(dark),
    "--line": `rgba(${lineRgb},${lineA.toFixed(3)})`,
    "--card": tone.card,
    "--overlay": dark ? rgba(mix(tone.card, "#000000", 0.15), overlayA - 0.02) : rgba(mix(tone.card, base, 0.3), overlayA),
    "--blur": "8px",
    "--scrim": dark ? "rgba(0,0,0,.45)" : "rgba(40,30,20,.22)",
    "--accent": accent,
    "--accent-ink": luminance(accent) > 0.45 ? "#1e1c1a" : "#ffffff",
    "--accent-soft": rgba(accent, dark ? 0.22 : 0.14),
    "--tint-1": theme.colors[0],
    "--tint-2": theme.colors[1],
    "--shadow": shadow,
    "--grain-opacity": theme.grain ? dark ? ".10" : ".16" : "0",
    "--pattern": pat.image,
    "--pattern-size": pat.size,
    "--font": FONT,
    "--scale": String(settings.fontScale),
    "--radius": `${settings.radius}px`,
    "--gap": `${settings.gap}px`,
    "--sidebar-w": `${settings.sidebarWidth}px`,
    "--row-h": `${ROW[settings.density]}px`,
    "--ease": FEEL[settings.motionFeel]?.ease ?? EASE,
    "--dur": `${Math.round((FEEL[settings.motionFeel]?.ms ?? DUR) / (settings.motionSpeed || 1))}ms`,
    "--speed": String(1 / (settings.motionSpeed || 1)),
    "--press-ease": springy ? PRESS.ease : "cubic-bezier(0.16, 1, 0.3, 1)",
    "--press-dur": `${Math.round((springy ? PRESS.ms : 160) / (settings.motionSpeed || 1))}ms`,
    colorScheme: dark ? "dark" : "light"
  };
}
function readability(theme, settings, systemDark) {
  const v = themeVars(theme, settings, systemDark);
  const chrome = v["--chrome-mid"];
  const text = contrast(v["--ink"], chrome);
  const accent = contrast(v["--accent"], chrome);
  return { text: Math.round(text * 10) / 10, accent: Math.round(accent * 10) / 10, ok: text >= 4.5 && accent >= 3 };
}

// ../../../../../../../../Users/apple/Personal/MArc/src/shared/shields.ts
var AG = "https://filters.adtidy.org/extension/ublock/filters";
var UBO = "https://ublockorigin.github.io/uAssets/filters";
var FILTER_LISTS = [
  { id: "adguard-base", group: "ads", name: "AdGuard Base", desc: "EasyList plus AdGuard\u2019s own English filter. The core list.", url: `${AG}/2.txt`, on: true },
  { id: "ubo", group: "ads", name: "uBlock filters", desc: "Fixes for sites that fight ad blockers, including video sites", url: `${UBO}/filters.txt`, on: true },
  { id: "ubo-unbreak", group: "ads", name: "uBlock unbreak", desc: "Undoes rules that break sites", url: `${UBO}/unbreak.txt`, on: true },
  { id: "ubo-quick", group: "ads", name: "uBlock quick fixes", desc: "Same-day fixes for new tricks", url: `${UBO}/quick-fixes.txt`, on: true },
  { id: "easylist", group: "ads", name: "EasyList", desc: "The classic list. Already inside AdGuard Base.", url: "https://easylist.to/easylist/easylist.txt", on: false },
  { id: "adguard-mobile", group: "ads", name: "AdGuard Mobile Ads", desc: "Ad networks used on phone-sized sites", url: `${AG}/11.txt`, on: false },
  { id: "easyprivacy", group: "privacy", name: "EasyPrivacy", desc: "Trackers and analytics that follow you between sites", url: "https://easylist.to/easylist/easyprivacy.txt", on: true },
  { id: "adguard-tracking", group: "privacy", name: "AdGuard Tracking Protection", desc: "The most thorough tracker list. Large.", url: `${AG}/3.txt`, on: false },
  { id: "ubo-privacy", group: "privacy", name: "uBlock privacy", desc: "Extra tracker rules from uBlock Origin", url: `${UBO}/privacy.txt`, on: false },
  { id: "adguard-url-tracking", group: "privacy", name: "AdGuard URL Tracking", desc: "Removes tracking parts from links (utm_, fbclid, gclid\u2026)", url: `${AG}/17.txt`, on: false, hidden: true },
  { id: "adguard-social", group: "social", name: "AdGuard Social Media", desc: "Like and Share buttons, embedded feeds", url: `${AG}/4.txt`, on: false },
  { id: "adguard-cookies", group: "annoyances", name: "Cookie notices", desc: "Hides cookie-consent banners", url: `${AG}/18.txt`, on: false },
  { id: "adguard-popups", group: "annoyances", name: "Pop-ups", desc: "Newsletter and sign-up pop-ups", url: `${AG}/19.txt`, on: false },
  { id: "adguard-app-banners", group: "annoyances", name: "Mobile app banners", desc: "\u201CGet our app\u201D banners", url: `${AG}/20.txt`, on: false },
  { id: "adguard-widgets", group: "annoyances", name: "Widgets", desc: "Chat bubbles and support widgets", url: `${AG}/22.txt`, on: false },
  { id: "adguard-other-annoyances", group: "annoyances", name: "Other annoyances", desc: "Everything else that gets in the way", url: `${AG}/21.txt`, on: false },
  { id: "ubo-badware", group: "security", name: "Badware risks", desc: "Sites known to push malware or scams", url: `${UBO}/badware.txt`, on: true },
  { id: "phishing", group: "security", name: "Phishing URL blocklist", desc: "Pages that steal passwords", url: "https://malware-filter.gitlab.io/malware-filter/phishing-filter.txt", on: false },
  { id: "urlhaus", group: "security", name: "Online malicious URLs", desc: "Addresses that spread malware right now. Large.", url: "https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-ag-online.txt", on: false },
  { id: "adguard-search-ads", group: "ads", name: "Allow search ads", desc: "Lets search results show their ads", url: `${AG}/10.txt`, on: false, hidden: true },
  { id: "adguard-de", group: "language", name: "German", desc: "AdGuard German + EasyList Germany", url: `${AG}/6.txt`, on: false, langs: ["de"] },
  { id: "adguard-fr", group: "language", name: "French", desc: "AdGuard French + Liste FR", url: `${AG}/16.txt`, on: false, langs: ["fr"] },
  { id: "adguard-es", group: "language", name: "Spanish & Portuguese", desc: "AdGuard Spanish/Portuguese", url: `${AG}/9.txt`, on: false, langs: ["es", "pt"] },
  { id: "adguard-nl", group: "language", name: "Dutch", desc: "AdGuard Dutch + EasyList Dutch", url: `${AG}/8.txt`, on: false, langs: ["nl"] },
  { id: "adguard-ru", group: "language", name: "Russian", desc: "AdGuard Russian", url: `${AG}/1.txt`, on: false, langs: ["ru"] },
  { id: "adguard-uk", group: "language", name: "Ukrainian", desc: "AdGuard Ukrainian", url: `${AG}/23.txt`, on: false, langs: ["uk"] },
  { id: "adguard-tr", group: "language", name: "Turkish", desc: "AdGuard Turkish", url: `${AG}/13.txt`, on: false, langs: ["tr"] },
  { id: "adguard-ja", group: "language", name: "Japanese", desc: "AdGuard Japanese", url: `${AG}/7.txt`, on: false, langs: ["ja"] },
  { id: "adguard-zh", group: "language", name: "Chinese", desc: "AdGuard Chinese + EasyList China", url: `${AG}/224.txt`, on: false, langs: ["zh"] }
];
function defaultShields() {
  return {
    enabled: true,
    lists: FILTER_LISTS.filter((l) => l.on).map((l) => l.id),
    autoLanguage: true,
    searchAds: true,
    cosmetic: true,
    custom: [],
    userRules: "",
    userRulesOn: true,
    allow: [],
    invert: false,
    only: [],
    stripParams: true,
    hideSearchQueries: true,
    hideReferrer: false,
    blockWebRTC: false,
    cookieMinutes: 0,
    fingerprinting: true,
    crossSiteCookies: true,
    debounce: true,
    deAmp: true,
    updateHours: 24
  };
}
var BUILTIN_FILTERS = [
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "adservice.google.com",
  "google-analytics.com",
  "googletagmanager.com",
  "googletagservices.com",
  "amazon-adsystem.com",
  "adnxs.com",
  "adsrvr.org",
  "criteo.com",
  "criteo.net",
  "taboola.com",
  "outbrain.com",
  "pubmatic.com",
  "rubiconproject.com",
  "openx.net",
  "casalemedia.com",
  "scorecardresearch.com",
  "quantserve.com",
  "moatads.com",
  "adform.net",
  "smartadserver.com",
  "bidswitch.net",
  "zedo.com",
  "advertising.com",
  "serving-sys.com",
  "media.net",
  "popads.net",
  "propellerads.com",
  "hotjar.com",
  "mixpanel.com",
  "segment.io",
  "fullstory.com",
  "mouseflow.com",
  "chartbeat.com",
  "newrelic.com",
  "nr-data.net",
  "bat.bing.com",
  "connect.facebook.net",
  "analytics.twitter.com",
  "ads-twitter.com",
  "analytics.tiktok.com",
  "ads.linkedin.com",
  "ads.yahoo.com",
  "yandex.ru/metrika",
  "mc.yandex.ru",
  "adroll.com",
  "teads.tv",
  "sharethrough.com",
  "3lift.com",
  "indexww.com",
  "lijit.com",
  "revcontent.com",
  "mgid.com",
  "exoclick.com",
  "adcolony.com",
  "branch.io",
  "amplitude.com",
  "clarity.ms"
].map((d) => `||${d}^$third-party`).concat(["##.adsbygoogle", "##ins.adsbygoogle", '##[id^="google_ads_iframe"]', '##[id^="div-gpt-ad"]', "##.ad-banner", "##.ad-container", '##a[href*="doubleclick.net"]']).join("\n");
var BUILTIN_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "dclid", "gbraid", "wbraid", "msclkid", "mc_eid", "yclid", "twclid", "igshid", "_hsenc", "_hsmi", "mkt_tok", "oly_anon_id", "oly_enc_id", "vero_id", "ttclid", "li_fat_id"].map((p) => `$removeparam=${p}`).join("\n");

// ../../../../../../../../Users/apple/Personal/MArc/src/shared/defaults.ts
var HOUR = 60 * 60 * 1e3;
var DAY = 24 * HOUR;
var ARCHIVE_CHOICES = [
  { label: "1 hour", ms: HOUR },
  { label: "6 hours", ms: 6 * HOUR },
  { label: "12 hours", ms: 12 * HOUR },
  { label: "24 hours", ms: DAY },
  { label: "7 days", ms: 7 * DAY },
  { label: "30 days", ms: 30 * DAY },
  { label: "Never", ms: null }
];
var DEFAULT_SHORTCUTS = {
  commandBar: "mod+t",
  editUrl: "mod+l",
  closeTab: "mod+w",
  reopenClosed: "mod+shift+t",
  togglePin: "mod+d",
  toggleSidebar: "mod+s",
  newNote: "mod+shift+o",
  newFolder: "mod+alt+f",
  newSplit: "mod+shift+=",
  copyUrl: "mod+shift+c",
  reload: "mod+r",
  back: "mod+[",
  forward: "mod+]",
  nextSpace: "mod+alt+arrowright",
  prevSpace: "mod+alt+arrowleft",
  nextTab: "ctrl+tab",
  prevTab: "ctrl+shift+tab",
  settings: "mod+,",
  archivePage: "mod+y",
  boostEditor: "mod+alt+b",
  littleWindow: "mod+alt+n",
  findInPage: "mod+f",
  zoomIn: "mod+=",
  zoomOut: "mod+-",
  popOutVideo: "mod+shift+p",
  downloadsPanel: "mod+shift+j",
  historyPage: "mod+shift+h",
  zoomReset: "mod+0",
  print: "mod+p",
  savePage: "mod+shift+s",
  hardReload: "mod+shift+r",
  stopLoading: "",
  renameCurrent: "",
  resetToHome: "",
  resetSpaceTabs: "",
  togglePinnedSection: "",
  clearCookiesRefresh: "",
  clearCacheRefresh: "",
  capture: "mod+shift+2",
  captureFull: "mod+shift+1"
};
var SEARCH_ENGINES = [
  { label: "Google", template: "https://www.google.com/search?q=%s" },
  { label: "DuckDuckGo", template: "https://duckduckgo.com/?q=%s" },
  { label: "Bing", template: "https://www.bing.com/search?q=%s" },
  { label: "Brave Search", template: "https://search.brave.com/search?q=%s" },
  { label: "Kagi", template: "https://kagi.com/search?q=%s" }
];
function defaultSettings() {
  return {
    sidebarSide: "left",
    sidebarWidth: 264,
    sidebarCollapsed: false,
    density: "comfortable",
    fontScale: 1,
    radius: 12,
    gap: 8,
    showUrlBar: true,
    showTabCloseOnHover: true,
    favoritesColumns: 4,
    awakeTabs: 10,
    archiveAfterMs: 12 * HOUR,
    littleArchiveAfterMs: 12 * HOUR,
    searchEngine: SEARCH_ENGINES[0].template,
    peekOnExternalLinksFromPinned: true,
    peekOnShiftClick: true,
    externalLinksTarget: "little",
    littleHotkey: "mod+alt+n",
    boostsEnabled: true,
    autoPip: true,
    autoPipOnAppSwitch: true,
    shortcuts: { ...DEFAULT_SHORTCUTS },
    reduceMotion: false,
    tidyTitles: true,
    sounds: true,
    soundVolume: 0.4,
    motionSpeed: 1,
    motionFeel: "style",
    themeVersion: 2,
    shields: defaultShields(),
    httpsOnly: true,
    sendGpc: true,
    askWhereToSave: false,
    downloadConnections: 8
  };
}

// entry.ts
var s = defaultSettings();
var pick = (v) => Object.fromEntries(Object.entries(v).filter(([k]) => !/^--(gray|indigo)-/.test(k)));
console.log("SETTINGS", JSON.stringify({ density: s.density, fontScale: s.fontScale, radius: s.radius, gap: s.gap, sidebarWidth: s.sidebarWidth, sidebarSide: s.sidebarSide, motionFeel: s.motionFeel, motionSpeed: s.motionSpeed, reduceMotion: s.reduceMotion, sounds: s.sounds, soundVolume: s.soundVolume, favoritesColumns: s.favoritesColumns, showUrlBar: s.showUrlBar }));
for (const mode of ["dark", "light"]) {
  const t = { ...DEFAULT_THEME, mode };
  const v = themeVars(t, s, false);
  console.log("\n== DEFAULT (Quiet)", mode);
  for (const [k, val] of Object.entries(pick(v))) console.log(`${k}: ${val.length > 150 ? val.slice(0, 150) + "\u2026" : val}`);
  const cm = v["--chrome-mid"];
  const blend = (fg, a, bg) => {
    const h = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
    const f = h(fg), b = h(bg);
    return "#" + f.map((c, i) => Math.round(c * a + b[i] * (1 - a)).toString(16).padStart(2, "0")).join("");
  };
  const al = (s2) => Number(s2.match(/,([\d.]+)\)$/)[1]);
  for (const k of ["--ink-2", "--ink-3", "--ink-4"]) {
    const a = al(v[k]);
    console.log(`  contrast ${k} on chrome-mid: ${contrast(blend(v["--ink"], a, cm), cm).toFixed(2)}  on card: ${contrast(blend(v["--ink"], a, v["--card"]), v["--card"]).toFixed(2)}`);
  }
  console.log("  contrast ink/chrome-mid", contrast(v["--ink"], cm).toFixed(2), "ink/card", contrast(v["--ink"], v["--card"]).toFixed(2), "accent/chrome-mid", contrast(v["--accent"], cm).toFixed(2), "accent/card", contrast(v["--accent"], v["--card"]).toFixed(2), "accent-ink/accent", contrast(v["--accent-ink"], v["--accent"]).toFixed(2));
  console.log("  readability", JSON.stringify(readability(t, s, false)));
}
console.log("\nFEEL", JSON.stringify(Object.fromEntries(Object.entries(FEEL).map(([k, v]) => [k, { ms: v.ms, ease: v.ease.slice(0, 60) }]))));
console.log("SPRINGS ms", JSON.stringify(Object.fromEntries(Object.entries(SPRINGS).map(([k, v]) => [k, springDuration(v)]))));
for (const p of THEME_PRESETS) {
  const t = sanitizeTheme({ ...DEFAULT_THEME, ...presetPatch(p.id) }, DEFAULT_THEME);
  const v = themeVars(t, s, false);
  console.log("PRESET", p.id, p.mode, "a", v["--chrome-a"], "mid", v["--chrome-mid"], "b", v["--chrome-b"], "accent", v["--accent"], "accent-ink", v["--accent-ink"], "text", readability(t, s, false).text, "acc", readability(t, s, false).accent);
}
for (let i = 0; i < 7; i++) {
  const t = defaultTheme(i);
  const v = themeVars(t, s, false);
  console.log("SPACE", i, t.colors.join(","), "mid", v["--chrome-mid"], "accent", v["--accent"]);
}
