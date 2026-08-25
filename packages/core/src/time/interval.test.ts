import { describe, expect, it } from 'vitest';
import {
  durationMin,
  intersectAll,
  intersection,
  longEnough,
  normalize,
  overlaps,
  subtract,
  totalMinutes,
} from './interval.js';

const iv = (start: string, end: string) => ({
  startAt: `2026-08-25T${start}:00.000Z`,
  endAt: `2026-08-25T${end}:00.000Z`,
});

describe('overlaps', () => {
  it('treats back-to-back intervals as non-overlapping', () => {
    expect(overlaps(iv('09:00', '10:00'), iv('10:00', '11:00'))).toBe(false);
  });

  it('detects genuine overlap in both directions', () => {
    expect(overlaps(iv('09:00', '10:30'), iv('10:00', '11:00'))).toBe(true);
    expect(overlaps(iv('10:00', '11:00'), iv('09:00', '10:30'))).toBe(true);
  });
});

describe('normalize', () => {
  it('sorts, merges overlapping and touching intervals, and drops empty ones', () => {
    const result = normalize([
      iv('10:00', '11:00'),
      iv('09:00', '09:30'),
      iv('09:30', '10:30'),
      iv('12:00', '12:00'),
    ]);
    expect(result).toEqual([iv('09:00', '11:00')]);
  });
});

describe('subtract', () => {
  it('carves a cut out of the middle of a window', () => {
    expect(subtract([iv('08:00', '17:00')], [iv('12:00', '13:00')])).toEqual([
      iv('08:00', '12:00'),
      iv('13:00', '17:00'),
    ]);
  });

  it('handles cuts that overhang both edges', () => {
    expect(subtract([iv('08:00', '17:00')], [iv('07:00', '09:00'), iv('16:00', '20:00')])).toEqual([
      iv('09:00', '16:00'),
    ]);
  });

  it('returns nothing when the cut swallows the window', () => {
    expect(subtract([iv('08:00', '17:00')], [iv('06:00', '20:00')])).toEqual([]);
  });

  it('ignores cuts that only touch the boundary', () => {
    expect(subtract([iv('08:00', '17:00')], [iv('17:00', '18:00')])).toEqual([
      iv('08:00', '17:00'),
    ]);
  });

  it('is unaffected by the order of the cuts', () => {
    const cuts = [iv('15:00', '16:00'), iv('09:00', '10:00'), iv('12:00', '12:30')];
    expect(subtract([iv('08:00', '17:00')], cuts)).toEqual(
      subtract([iv('08:00', '17:00')], [...cuts].reverse()),
    );
  });
});

describe('intersection helpers', () => {
  it('returns null when there is no overlap', () => {
    expect(intersection(iv('08:00', '09:00'), iv('09:00', '10:00'))).toBeNull();
  });

  it('intersects a list against a mask', () => {
    expect(
      intersectAll([iv('08:00', '17:00')], [iv('09:00', '10:00'), iv('16:00', '20:00')]),
    ).toEqual([iv('09:00', '10:00'), iv('16:00', '17:00')]);
  });
});

describe('measurements', () => {
  it('measures duration and totals in minutes', () => {
    expect(durationMin(iv('09:00', '10:40'))).toBe(100);
    expect(totalMinutes([iv('09:00', '10:00'), iv('09:30', '11:00')])).toBe(120);
  });

  it('filters intervals by minimum length', () => {
    expect(longEnough([iv('09:00', '09:20'), iv('10:00', '12:00')], 60)).toEqual([
      iv('10:00', '12:00'),
    ]);
  });
});
