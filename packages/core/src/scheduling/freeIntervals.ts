/**
 * Free-time computation (§6.3).
 *
 * "Availability windows minus (prayer blocks ∪ existing agendas including buffer ∪ external busy)"
 * — plus the parts of disqualifying time blocks, which are per-task and therefore resolved here
 * rather than in the generic interval maths.
 *
 * Everything in this file is pure, so both the client (§6, "jalankan di klien") and a function
 * can call it with identical results.
 */

import type {
  Agenda,
  AvailabilityWindow,
  ISODateTime,
  ResolvedTimeBlock,
  Task,
  TimeZone,
} from '../types.js';
import type { Interval } from '../time/interval.js';
import { longEnough, makeInterval, normalize, subtract } from '../time/interval.js';
import type { PrayerBlock } from '../prayer/blocks.js';
import { expandAvailability, type Horizon } from './availability.js';
import { reservedSpans } from './reserved.js';
import { filterMismatches } from '../rules/timeBlockFilter.js';

export interface FreeIntervalsInput {
  horizon: Horizon;
  timezone: TimeZone;
  windows: AvailabilityWindow[];
  prayerBlocks: PrayerBlock[];
  timeBlocks: ResolvedTimeBlock[];
  existingAgendas: Agenda[];
  externalBusy: Interval[];
  /** The task being placed; decides which time blocks disqualify a region (§4.7, §6.5). */
  task: Pick<Task, 'id' | 'categoryId' | 'priority'>;
  tagIds: string[];
  /** When rescheduling, the agenda being moved must not block itself. */
  excludeAgendaId?: string;
  /** Nothing before this instant is offered. Defaults to `horizon.from`. */
  now?: ISODateTime;
}

/** Time blocks whose filter this task fails — binding disqualifications for the engine. */
export function disqualifyingBlocks(input: FreeIntervalsInput): ResolvedTimeBlock[] {
  const subject = { task: input.task, tagIds: input.tagIds };
  return input.timeBlocks.filter((block) => filterMismatches(block.filter, subject).length > 0);
}

/** Time blocks this task *is* welcome in — these attract the scorer (§6.5, "+besar"). */
export function preferredBlocks(input: FreeIntervalsInput): ResolvedTimeBlock[] {
  const subject = { task: input.task, tagIds: input.tagIds };
  return input.timeBlocks.filter((block) => filterMismatches(block.filter, subject).length === 0);
}

export function freeIntervals(input: FreeIntervalsInput): Interval[] {
  const floor = input.now && input.now > input.horizon.from ? input.now : input.horizon.from;
  if (floor >= input.horizon.to) return [];

  const available = expandAvailability(
    input.windows,
    { from: floor, to: input.horizon.to },
    input.timezone,
  );

  const cuts = normalize([
    ...input.prayerBlocks.map(({ startAt, endAt }) => ({ startAt, endAt })),
    ...reservedSpans(input.existingAgendas, { excludeAgendaId: input.excludeAgendaId }),
    ...input.externalBusy,
    ...disqualifyingBlocks(input).map(({ startAt, endAt }) => ({ startAt, endAt })),
  ]);

  return subtract(available, cuts);
}

/** Free intervals that can actually hold `minutes` of reserved time. */
export function usableIntervals(input: FreeIntervalsInput, minutes: number): Interval[] {
  return longEnough(freeIntervals(input), minutes);
}

/**
 * Candidate start times inside the free intervals, snapped to `stepMin`.
 *
 * Snapping keeps the suggestions human ("09:00", not "09:03") and bounds the search: the brief
 * caps the engine at a greedy scan, not a solver (§6).
 */
export function candidateSlots(
  intervals: Interval[],
  durationMinutes: number,
  stepMin = 15,
  limit = 500,
): Interval[] {
  const slots: Interval[] = [];
  const step = stepMin * 60_000;
  const length = durationMinutes * 60_000;

  for (const interval of intervals) {
    const start = new Date(interval.startAt).getTime();
    const end = new Date(interval.endAt).getTime();
    let cursor = Math.ceil(start / step) * step;
    // Never miss a slot that only fits flush against the start of the interval.
    if (cursor > start && cursor + length > end && start + length <= end) cursor = start;
    while (cursor + length <= end) {
      slots.push(makeInterval(new Date(cursor), new Date(cursor + length)));
      if (slots.length >= limit) return slots;
      cursor += step;
    }
  }
  return slots;
}
