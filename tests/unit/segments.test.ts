import { describe, expect, it } from 'vitest';
import { ACCELERATE_MIN, MIN_PART, isComplete, parseContentRange, partLeft, planParts, rangeHeader, receivedOf, sanitizeParts, smoothSpeed, splitLargest } from '@shared/segments';

const MB = 1024 * 1024;

describe('accelerated downloads (IDM-style segments)', () => {
  it('splits a file into ranges that cover it exactly, never smaller than the minimum', () => {
    const parts = planParts(10 * MB, 8);
    expect(parts).toHaveLength(8);
    expect(parts[0].start).toBe(0);
    expect(parts.at(-1)!.end).toBe(10 * MB - 1);
    for (let i = 1; i < parts.length; i++) expect(parts[i].start).toBe(parts[i - 1].end + 1);
    expect(planParts(MIN_PART * 3, 8)).toHaveLength(3);
    expect(planParts(100, 8)).toEqual([{ start: 0, end: 99, done: 0 }]);
    expect(planParts(0, 8)).toEqual([]);
    expect(ACCELERATE_MIN).toBeGreaterThan(MIN_PART);
  });

  it('a free connection takes the back half of the largest range left; tiny ranges are not split', () => {
    const parts = planParts(8 * MB, 2); // two 4 MB ranges
    parts[0].done = 4 * MB; // first finished
    parts[1].done = 1 * MB; // second has 3 MB left
    const back = splitLargest(parts)!;
    expect(back.start).toBe(4 * MB + 1 * MB + 1.5 * MB);
    expect(back.end).toBe(8 * MB - 1);
    expect(parts[1].end).toBe(back.start - 1);
    expect(partLeft(parts[1]) + partLeft(back)).toBe(3 * MB);
    const small = [{ start: 0, end: MIN_PART, done: 0 }];
    expect(splitLargest(small)).toBeNull();
  });

  it('counts received bytes, knows when it is done, and asks for what is left', () => {
    const parts = planParts(4 * MB, 4);
    parts[0].done = 100;
    expect(receivedOf(parts)).toBe(100);
    expect(rangeHeader(parts[0])).toBe(`bytes=100-${MB - 1}`);
    expect(isComplete(parts)).toBe(false);
    parts.forEach((p) => (p.done = p.end - p.start + 1));
    expect(isComplete(parts)).toBe(true);
    expect(receivedOf(parts)).toBe(4 * MB);
  });

  it('reads the server\'s range answer', () => {
    expect(parseContentRange('bytes 0-0/12345')).toEqual({ start: 0, end: 0, total: 12345 });
    expect(parseContentRange('bytes 10-19/*')).toEqual({ start: 10, end: 19, total: null });
    expect(parseContentRange('bytes 9-1/10')).toBeNull();
    expect(parseContentRange(null)).toBeNull();
  });

  it('saved ranges are only trusted when they cover the file exactly', () => {
    const parts = planParts(4 * MB, 4);
    parts[1].done = 5;
    expect(sanitizeParts(JSON.parse(JSON.stringify(parts)), 4 * MB)).toEqual(parts);
    expect(sanitizeParts(parts.slice(1), 4 * MB)).toBeUndefined(); // a gap at the start
    expect(sanitizeParts([{ start: 0, end: 10, done: -1 }], 11)).toBeUndefined();
    expect(sanitizeParts('junk', 10)).toBeUndefined();
  });

  it('smooths the speed so it doesn\'t jump about', () => {
    expect(smoothSpeed(0, 1000, 500)).toBe(2000);
    expect(smoothSpeed(2000, 0, 500)).toBe(1200);
    expect(smoothSpeed(500, 10, 0)).toBe(500);
  });
});
