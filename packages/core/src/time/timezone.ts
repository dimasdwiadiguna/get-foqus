/**
 * Timezone helpers.
 *
 * BRIEF §5.9: every calendar-shaped rule (day boundary, day of week, availability windows)
 * is evaluated in the *user's* timezone, never in UTC. Storage stays UTC; only the reasoning
 * about "which day is this" happens in local time.
 *
 * Implemented on `Intl.DateTimeFormat` rather than a date library — it is the only
 * IANA-correct source available in both Node and the browser without adding a dependency.
 */

import type { ClockTime, DayOfWeek, ISODate, ISODateTime, TimeZone } from '../types.js';

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  second: number;
  dayOfWeek: DayOfWeek;
}

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

const formatterCache = new Map<TimeZone, Intl.DateTimeFormat>();

function formatterFor(timezone: TimeZone): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatterCache.set(timezone, formatter);
  }
  return formatter;
}

const WEEKDAY_INDEX: Record<string, DayOfWeek> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Breaks a UTC instant into the wall-clock fields a user in `timezone` would read. */
export function zonedParts(instant: ISODateTime | Date, timezone: TimeZone): ZonedParts {
  const date = instant instanceof Date ? instant : new Date(instant);
  const parts = formatterFor(timezone).formatToParts(date);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') lookup[part.type] = part.value;
  }
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    second: Number(lookup.second),
    dayOfWeek: WEEKDAY_INDEX[lookup.weekday ?? 'Sun'] ?? 0,
  };
}

/** Offset of `timezone` at a given instant, in milliseconds east of UTC. */
function offsetMsAt(utcMs: number, timezone: TimeZone): number {
  const p = zonedParts(new Date(utcMs), timezone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // `Date.UTC` clamps years 0-99 into the 1900s; irrelevant for FOQUS but cheap to note.
  return asIfUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * Converts a wall-clock moment in `timezone` to a UTC instant.
 *
 * Two passes: the first guess assumes the target offset, the second re-reads the offset at
 * the candidate instant. That second pass is what makes DST transitions land correctly —
 * Asia/Jakarta has no DST, but the user can change their timezone in settings (§4.10).
 */
export function zonedTimeToUtc(
  parts: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    second?: number;
  },
  timezone: TimeZone,
): Date {
  const wallMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  const firstOffset = offsetMsAt(wallMs, timezone);
  let utcMs = wallMs - firstOffset;
  const secondOffset = offsetMsAt(utcMs, timezone);
  if (secondOffset !== firstOffset) utcMs = wallMs - secondOffset;
  return new Date(utcMs);
}

/** `YYYY-MM-DD` of the instant as seen in the user's timezone. */
export function localDateKey(instant: ISODateTime | Date, timezone: TimeZone): ISODate {
  const p = zonedParts(instant, timezone);
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** `HH:mm` of the instant as seen in the user's timezone. */
export function localClockTime(instant: ISODateTime | Date, timezone: TimeZone): ClockTime {
  const p = zonedParts(instant, timezone);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

export function parseDateKey(dateKey: ISODate): { year: number; month: number; day: number } {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 };
}

export function parseClockTime(time: ClockTime): { hour: number; minute: number } {
  const [hour, minute] = time.split(':').map(Number);
  return { hour: hour ?? 0, minute: minute ?? 0 };
}

/** Minutes since local midnight, useful for comparing against availability windows. */
export function clockTimeToMinutes(time: ClockTime): number {
  const { hour, minute } = parseClockTime(time);
  return hour * 60 + minute;
}

/** Midnight at the start of `dateKey` in the user's timezone, as a UTC instant. */
export function startOfLocalDay(dateKey: ISODate, timezone: TimeZone): Date {
  return zonedTimeToUtc({ ...parseDateKey(dateKey), hour: 0, minute: 0, second: 0 }, timezone);
}

/** The instant a local `HH:mm` on `dateKey` corresponds to. `24:00` means end of day. */
export function localTimeOn(dateKey: ISODate, time: ClockTime, timezone: TimeZone): Date {
  const minutes = clockTimeToMinutes(time);
  if (minutes >= 24 * 60) {
    return new Date(startOfLocalDay(addLocalDays(dateKey, 1), timezone).getTime());
  }
  const { hour, minute } = parseClockTime(time);
  return zonedTimeToUtc({ ...parseDateKey(dateKey), hour, minute, second: 0 }, timezone);
}

/** Calendar-day arithmetic on a `YYYY-MM-DD` key — no timezone involved, so no DST trap. */
export function addLocalDays(dateKey: ISODate, days: number): ISODate {
  const { year, month, day } = parseDateKey(dateKey);
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * MS_PER_DAY);
  return `${String(shifted.getUTCFullYear()).padStart(4, '0')}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

/** Day of week (0 = Sunday) for a date key, matching `AvailabilityWindow.dayOfWeek`. */
export function dayOfWeekForDateKey(dateKey: ISODate): DayOfWeek {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() as DayOfWeek;
}

/** Every local date key touched by `[from, to)`, inclusive of the day `to` falls in. */
export function localDateKeysBetween(
  from: ISODateTime | Date,
  to: ISODateTime | Date,
  timezone: TimeZone,
): ISODate[] {
  const first = localDateKey(from, timezone);
  const last = localDateKey(to, timezone);
  const keys: ISODate[] = [];
  let cursor = first;
  // Guard against a runaway loop if the caller passes an inverted range.
  for (let i = 0; i < 800; i += 1) {
    keys.push(cursor);
    if (cursor >= last) break;
    cursor = addLocalDays(cursor, 1);
  }
  return keys;
}

/** ISO week identifier, e.g. `2026-W35` — the key used by `WeeklyPlan` (§4.9). */
export function isoWeekOf(instant: ISODateTime | Date, timezone: TimeZone): string {
  const p = zonedParts(instant, timezone);
  const utc = new Date(Date.UTC(p.year, p.month - 1, p.day));
  // ISO weeks run Monday-Sunday and are numbered by the Thursday they contain.
  const dayNumber = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - dayNumber + 3);
  const isoYear = utc.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week = 1 + Math.round((utc.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

export function addMinutes(instant: ISODateTime | Date, minutes: number): Date {
  const base = instant instanceof Date ? instant.getTime() : new Date(instant).getTime();
  return new Date(base + minutes * MS_PER_MINUTE);
}

export function toISO(date: Date): ISODateTime {
  return date.toISOString();
}
