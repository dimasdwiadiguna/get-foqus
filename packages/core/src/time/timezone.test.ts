import { describe, expect, it } from 'vitest';
import {
  addLocalDays,
  dayOfWeekForDateKey,
  isoWeekOf,
  localClockTime,
  localDateKey,
  localDateKeysBetween,
  localTimeOn,
  zonedParts,
  zonedTimeToUtc,
} from './timezone.js';

const JKT = 'Asia/Jakarta'; // UTC+7, no DST
const NYC = 'America/New_York'; // has DST — guards the two-pass offset resolution

describe('zonedParts', () => {
  it('reads wall-clock fields in the user timezone, not UTC', () => {
    const parts = zonedParts('2026-08-24T22:30:00.000Z', JKT);
    expect(parts).toMatchObject({
      year: 2026,
      month: 8,
      day: 25,
      hour: 5,
      minute: 30,
      dayOfWeek: 2,
    });
  });
});

describe('local day boundaries', () => {
  it('assigns a late-UTC instant to the next local day (BRIEF §5.9)', () => {
    // 23:00 UTC is already 06:00 the next morning in Jakarta.
    expect(localDateKey('2026-08-24T23:00:00.000Z', JKT)).toBe('2026-08-25');
    expect(localDateKey('2026-08-24T23:00:00.000Z', 'UTC')).toBe('2026-08-24');
  });

  it('round-trips a local wall-clock time through UTC', () => {
    const instant = localTimeOn('2026-08-25', '09:00', JKT);
    expect(instant.toISOString()).toBe('2026-08-25T02:00:00.000Z');
    expect(localClockTime(instant, JKT)).toBe('09:00');
  });

  it('treats 24:00 as midnight at the start of the following day', () => {
    expect(localTimeOn('2026-08-25', '24:00', JKT).toISOString()).toBe(
      localTimeOn('2026-08-26', '00:00', JKT).toISOString(),
    );
  });
});

describe('DST correctness', () => {
  it('resolves a wall-clock time on both sides of a US DST transition', () => {
    // 2026-03-08 02:00 local is when New York springs forward.
    expect(zonedTimeToUtc({ year: 2026, month: 3, day: 7, hour: 12 }, NYC).toISOString()).toBe(
      '2026-03-07T17:00:00.000Z',
    );
    expect(zonedTimeToUtc({ year: 2026, month: 3, day: 9, hour: 12 }, NYC).toISOString()).toBe(
      '2026-03-09T16:00:00.000Z',
    );
  });
});

describe('calendar arithmetic', () => {
  it('adds days across a month boundary', () => {
    expect(addLocalDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addLocalDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('maps date keys to the AvailabilityWindow day numbering', () => {
    expect(dayOfWeekForDateKey('2026-08-25')).toBe(2); // Tuesday
    expect(dayOfWeekForDateKey('2026-08-30')).toBe(0); // Sunday
  });

  it('enumerates every local day a range touches', () => {
    expect(
      localDateKeysBetween('2026-08-24T23:00:00.000Z', '2026-08-26T05:00:00.000Z', JKT),
    ).toEqual(['2026-08-25', '2026-08-26']);
  });

  it('computes the ISO week key used by WeeklyPlan', () => {
    expect(isoWeekOf('2026-08-25T02:00:00.000Z', JKT)).toBe('2026-W35');
  });
});
