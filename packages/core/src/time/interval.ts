/**
 * Interval arithmetic — the primitive the whole scheduling engine is built on.
 *
 * BRIEF §6.3 describes free time as "availability windows minus (prayer blocks ∪ existing
 * agendas including buffer ∪ external busy)". That sentence is literally `subtract` below,
 * so it is worth having exactly one tested implementation of it.
 *
 * Convention: intervals are half-open `[startAt, endAt)`. Two intervals that merely touch
 * (one ends exactly where the next begins) do **not** overlap — otherwise a back-to-back
 * agenda would forever read as a conflict.
 */

import type { ISODateTime } from '../types.js';

export interface Interval {
  startAt: ISODateTime;
  endAt: ISODateTime;
}

/** Same shape as `Interval` but carrying whatever the caller wants to trace back to. */
export interface LabeledInterval<T> extends Interval {
  label: T;
}

const ms = (value: ISODateTime): number => new Date(value).getTime();

export function durationMin(interval: Interval): number {
  return (ms(interval.endAt) - ms(interval.startAt)) / 60_000;
}

export function isEmpty(interval: Interval): boolean {
  return ms(interval.endAt) <= ms(interval.startAt);
}

export function overlaps(a: Interval, b: Interval): boolean {
  return ms(a.startAt) < ms(b.endAt) && ms(b.startAt) < ms(a.endAt);
}

export function contains(outer: Interval, inner: Interval): boolean {
  return ms(outer.startAt) <= ms(inner.startAt) && ms(inner.endAt) <= ms(outer.endAt);
}

export function containsInstant(interval: Interval, instant: ISODateTime): boolean {
  const t = ms(instant);
  return ms(interval.startAt) <= t && t < ms(interval.endAt);
}

export function intersection(a: Interval, b: Interval): Interval | null {
  const start = Math.max(ms(a.startAt), ms(b.startAt));
  const end = Math.min(ms(a.endAt), ms(b.endAt));
  if (end <= start) return null;
  return { startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString() };
}

/** Sorts by start, then merges anything that overlaps or touches. Drops empty intervals. */
export function normalize(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((interval) => !isEmpty(interval))
    .map((interval) => ({ start: ms(interval.startAt), end: ms(interval.endAt) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: { start: number; end: number }[] = [];
  for (const current of sorted) {
    const last = merged[merged.length - 1];
    if (last && current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  return merged.map((interval) => ({
    startAt: new Date(interval.start).toISOString(),
    endAt: new Date(interval.end).toISOString(),
  }));
}

/** `base` minus `cuts`. Both sides are normalized first, so callers can pass raw lists. */
export function subtract(base: Interval[], cuts: Interval[]): Interval[] {
  const blocked = normalize(cuts);
  const result: Interval[] = [];

  for (const window of normalize(base)) {
    let cursor = ms(window.startAt);
    const windowEnd = ms(window.endAt);

    for (const cut of blocked) {
      const cutStart = ms(cut.startAt);
      const cutEnd = ms(cut.endAt);
      if (cutEnd <= cursor) continue;
      if (cutStart >= windowEnd) break;
      if (cutStart > cursor) {
        result.push({
          startAt: new Date(cursor).toISOString(),
          endAt: new Date(Math.min(cutStart, windowEnd)).toISOString(),
        });
      }
      cursor = Math.max(cursor, cutEnd);
      if (cursor >= windowEnd) break;
    }

    if (cursor < windowEnd) {
      result.push({
        startAt: new Date(cursor).toISOString(),
        endAt: new Date(windowEnd).toISOString(),
      });
    }
  }

  return result;
}

/** Intervals in `base` that also fall inside `mask` — the dual of `subtract`. */
export function intersectAll(base: Interval[], mask: Interval[]): Interval[] {
  const result: Interval[] = [];
  for (const a of normalize(base)) {
    for (const b of normalize(mask)) {
      const hit = intersection(a, b);
      if (hit) result.push(hit);
    }
  }
  return normalize(result);
}

/** Free intervals long enough to hold `minutes`. */
export function longEnough(intervals: Interval[], minutes: number): Interval[] {
  return intervals.filter((interval) => durationMin(interval) >= minutes - 1e-9);
}

export function makeInterval(startAt: Date | ISODateTime, endAt: Date | ISODateTime): Interval {
  return {
    startAt: startAt instanceof Date ? startAt.toISOString() : startAt,
    endAt: endAt instanceof Date ? endAt.toISOString() : endAt,
  };
}

export function totalMinutes(intervals: Interval[]): number {
  return normalize(intervals).reduce((sum, interval) => sum + durationMin(interval), 0);
}
