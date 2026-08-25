import { describe, expect, it } from 'vitest';
import type { AvailabilityWindow, DayOfWeek } from '../types.js';
import { expandAvailability, unavailableIntervals, windowCovering } from './availability.js';

const JKT = 'Asia/Jakarta';

const win = (dayOfWeek: DayOfWeek, startTime: string, endTime: string): AvailabilityWindow => ({
  id: `w-${dayOfWeek}-${startTime}`,
  userId: 'u1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  dayOfWeek,
  startTime,
  endTime,
});

// FOQUS seed defaults (§4.6): weekdays 04:00-22:00, weekend 06:00-20:00.
const seedWindows: AvailabilityWindow[] = [
  ...([1, 2, 3, 4, 5] as DayOfWeek[]).map((d) => win(d, '04:00', '22:00')),
  ...([0, 6] as DayOfWeek[]).map((d) => win(d, '06:00', '20:00')),
];

describe('expandAvailability', () => {
  it('expands the seed windows for a single weekday in the user timezone', () => {
    // Tuesday 2026-08-25 in Jakarta = 2026-08-24T17:00Z .. 2026-08-25T15:00Z
    const intervals = expandAvailability(
      seedWindows,
      { from: '2026-08-24T17:00:00.000Z', to: '2026-08-25T17:00:00.000Z' },
      JKT,
    );
    expect(intervals).toEqual([
      { startAt: '2026-08-24T21:00:00.000Z', endAt: '2026-08-25T15:00:00.000Z' },
    ]);
  });

  it('uses the weekend window on Saturday', () => {
    const intervals = expandAvailability(
      seedWindows,
      { from: '2026-08-28T17:00:00.000Z', to: '2026-08-29T17:00:00.000Z' },
      JKT,
    );
    expect(intervals).toEqual([
      { startAt: '2026-08-28T23:00:00.000Z', endAt: '2026-08-29T13:00:00.000Z' },
    ]);
  });

  it('skips soft-deleted windows', () => {
    const deleted = seedWindows.map((w) => ({ ...w, deletedAt: '2026-02-01T00:00:00.000Z' }));
    expect(
      expandAvailability(
        deleted,
        { from: '2026-08-24T17:00:00.000Z', to: '2026-08-25T17:00:00.000Z' },
        JKT,
      ),
    ).toEqual([]);
  });

  it('handles a window that crosses local midnight', () => {
    const nightShift = [win(2, '22:00', '02:00')];
    const intervals = expandAvailability(
      nightShift,
      { from: '2026-08-24T00:00:00.000Z', to: '2026-08-26T00:00:00.000Z' },
      JKT,
    );
    // Tuesday 22:00 -> Wednesday 02:00 local, i.e. 15:00Z -> 19:00Z.
    expect(intervals).toEqual([
      { startAt: '2026-08-25T15:00:00.000Z', endAt: '2026-08-25T19:00:00.000Z' },
    ]);
  });
});

describe('unavailableIntervals', () => {
  it('returns the dimmed regions around the available window', () => {
    expect(
      unavailableIntervals(
        seedWindows,
        { from: '2026-08-24T17:00:00.000Z', to: '2026-08-25T17:00:00.000Z' },
        JKT,
      ),
    ).toEqual([
      { startAt: '2026-08-24T17:00:00.000Z', endAt: '2026-08-24T21:00:00.000Z' },
      { startAt: '2026-08-25T15:00:00.000Z', endAt: '2026-08-25T17:00:00.000Z' },
    ]);
  });
});

describe('windowCovering', () => {
  it('names the window an instant sits in, for a specific violation message', () => {
    const covering = windowCovering('2026-08-29T05:00:00.000Z', seedWindows, JKT);
    expect(covering).toMatchObject({ dayOfWeek: 6, startTime: '06:00', endTime: '20:00' });
  });

  it('returns null outside every window', () => {
    expect(windowCovering('2026-08-29T16:00:00.000Z', seedWindows, JKT)).toBeNull();
  });
});
