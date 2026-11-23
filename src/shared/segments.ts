// Accelerated downloads, the IDM way: a file is fetched over several connections at
// once, each asking the server for its own byte range. When a connection finishes its
// range it takes over half of the largest range still left ("dynamic segmentation"),
// so every connection stays busy until the end. Pure and tested; main/segmented.ts
// does the network and file work.

export interface Part {
  /** First byte of the range. */
  start: number;
  /** Last byte of the range (inclusive). Can shrink when another connection takes over its tail. */
  end: number;
  /** Bytes already written from `start`. */
  done: number;
}

/** Below this, splitting a range costs more than it saves. */
export const MIN_PART = 512 * 1024;
/** Files smaller than this are left to a single connection. */
export const ACCELERATE_MIN = 2 * 1024 * 1024;
export const DEFAULT_CONNECTIONS = 8;
export const MAX_CONNECTIONS = 16;

export const partLength = (p: Part) => p.end - p.start + 1;
export const partLeft = (p: Part) => Math.max(0, partLength(p) - p.done);
export const receivedOf = (parts: readonly Part[]) => parts.reduce((n, p) => n + Math.min(p.done, partLength(p)), 0);
export const isComplete = (parts: readonly Part[]) => parts.every((p) => partLeft(p) === 0);

/** Split `total` bytes into up to `connections` ranges of at least `minPart` bytes. */
export function planParts(total: number, connections: number, minPart = MIN_PART): Part[] {
  if (!(total > 0)) return [];
  const n = Math.max(1, Math.min(Math.floor(connections) || 1, Math.floor(total / minPart) || 1));
  const size = Math.ceil(total / n);
  const parts: Part[] = [];
  for (let start = 0; start < total; start += size) parts.push({ start, end: Math.min(total, start + size) - 1, done: 0 });
  return parts;
}

/**
 * Give a free connection work: halve the largest range still being downloaded and return
 * its back half as a new range (the original keeps the front). Null when nothing is
 * worth splitting.
 */
export function splitLargest(parts: Part[], minPart = MIN_PART): Part | null {
  let best: Part | null = null;
  for (const p of parts) if (!best || partLeft(p) > partLeft(best)) best = p;
  if (!best || partLeft(best) < minPart * 2) return null;
  const from = best.start + best.done;
  const mid = from + Math.floor(partLeft(best) / 2);
  const back: Part = { start: mid, end: best.end, done: 0 };
  best.end = mid - 1;
  return back;
}

/** The Range header for what is left of a part. */
export const rangeHeader = (p: Part) => `bytes=${p.start + p.done}-${p.end}`;

/** "bytes 0-0/1234" → { start, end, total }; total is null when the server says "*". */
export function parseContentRange(h: string | null | undefined): { start: number; end: number; total: number | null } | null {
  const m = /^\s*bytes\s+(\d+)-(\d+)\/(\d+|\*)\s*$/i.exec(h ?? '');
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (end < start) return null;
  return { start, end, total: m[3] === '*' ? null : Number(m[3]) };
}

/** Parts as saved with a download (to resume it later, even after Kite restarts): only valid, in-order ranges. */
export function sanitizeParts(raw: unknown, total: number): Part[] | undefined {
  if (!Array.isArray(raw) || !(total > 0)) return undefined;
  const parts = raw
    .filter((p): p is Part => !!p && typeof p === 'object' && [p.start, p.end, p.done].every((v) => Number.isInteger(v) && v >= 0))
    .map((p) => ({ start: p.start, end: Math.min(p.end, total - 1), done: Math.min(p.done, p.end - p.start + 1) }))
    .filter((p) => p.end >= p.start)
    .sort((a, b) => a.start - b.start);
  if (!parts.length) return undefined;
  // Ranges must not overlap and must cover the whole file.
  let next = 0;
  for (const p of parts) {
    if (p.start !== next) return undefined;
    next = p.end + 1;
  }
  return next === total ? parts : undefined;
}

/** Bytes per second, smoothed: the last second counts most, so the number doesn't jump about. */
export function smoothSpeed(previous: number, bytes: number, ms: number): number {
  if (!(ms > 0)) return previous;
  const now = (bytes * 1000) / ms;
  return previous > 0 ? previous * 0.6 + now * 0.4 : now;
}
