/**
 * Turns the stored availability windows (`dayOfWeek` + `HH:mm`, §4.6) into concrete UTC
 * intervals across a horizon. Day-of-week and day boundaries are resolved in the user's
 * timezone, per §5.9.
 */

import type { AvailabilityWindow, ISODateTime, TimeZone } from '../types.js';
import type { Interval } from '../time/interval.js';
import { intersectAll, makeInterval, normalize } from '../time/interval.js';
import {
  addLocalDays,
  dayOfWeekForDateKey,
  localDateKeysBetween,
  localTimeOn,
} from '../time/timezone.js';

export interface Horizon {
  from: ISODateTime;
  to: ISODateTime;
}

/**
 * Expands availability windows over `horizon`.
 *
 * A window whose `endTime` is not after its `startTime` is read as crossing midnight
 * (e.g. `22:00`–`02:00`) and is emitted as two pieces; the merge in `normalize` then
 * stitches it to the neighbouring day if they are contiguous.
 */
export function expandAvailability(
  windows: AvailabilityWindow[],
  horizon: Horizon,
  timezone: TimeZone,
): Interval[] {
  const active = windows.filter((window) => !window.deletedAt);
  const dateKeys = localDateKeysBetween(horizon.from, horizon.to, timezone);
  const intervals: Interval[] = [];

  for (const dateKey of dateKeys) {
    const dayOfWeek = dayOfWeekForDateKey(dateKey);
    for (const window of active) {
      if (window.dayOfWeek !== dayOfWeek) continue;
      const start = localTimeOn(dateKey, window.startTime, timezone);
      const end = localTimeOn(dateKey, window.endTime, timezone);
      if (end.getTime() > start.getTime()) {
        intervals.push(makeInterval(start, end));
      } else {
        // Crosses local midnight: run to the end of this day, then resume on the next one.
        const midnight = localTimeOn(dateKey, '24:00', timezone);
        intervals.push(makeInterval(start, midnight));
        intervals.push(
          makeInterval(midnight, localTimeOn(addLocalDays(dateKey, 1), window.endTime, timezone)),
        );
      }
    }
  }

  return intersectAll(normalize(intervals), [makeInterval(horizon.from, horizon.to)]);
}

/** The gaps inside the horizon where the user is *not* available — used to dim the calendar. */
export function unavailableIntervals(
  windows: AvailabilityWindow[],
  horizon: Horizon,
  timezone: TimeZone,
): Interval[] {
  const available = expandAvailability(windows, horizon, timezone);
  const whole = [makeInterval(horizon.from, horizon.to)];
  const result: Interval[] = [];
  let cursor = new Date(horizon.from).getTime();
  for (const interval of available) {
    const start = new Date(interval.startAt).getTime();
    if (start > cursor) result.push(makeInterval(new Date(cursor), new Date(start)));
    cursor = Math.max(cursor, new Date(interval.endAt).getTime());
  }
  const end = new Date(horizon.to).getTime();
  if (cursor < end) result.push(makeInterval(new Date(cursor), new Date(end)));
  return available.length === 0 ? whole : result;
}

/** The window a given instant falls in, if any — used to phrase §5.5 violation messages. */
export function windowCovering(
  instant: ISODateTime,
  windows: AvailabilityWindow[],
  timezone: TimeZone,
): AvailabilityWindow | null {
  const dateKeys = localDateKeysBetween(instant, instant, timezone);
  const dateKey = dateKeys[0];
  if (!dateKey) return null;
  const dayOfWeek = dayOfWeekForDateKey(dateKey);
  const t = new Date(instant).getTime();
  for (const window of windows) {
    if (window.deletedAt || window.dayOfWeek !== dayOfWeek) continue;
    const start = localTimeOn(dateKey, window.startTime, timezone).getTime();
    const end = localTimeOn(dateKey, window.endTime, timezone).getTime();
    if (start <= t && t < end) return window;
  }
  return null;
}
