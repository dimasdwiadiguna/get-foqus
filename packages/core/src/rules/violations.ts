/**
 * Constraint checking — the one place that decides what "this slot is illegal" means.
 *
 * D6 is the reason this returns a *list of named violations* instead of a boolean:
 *  - **Manual placement is advisory.** The UI shows every violation by name and lets the user
 *    override with a confirmation (§5.5). It must never say "tidak bisa" generically.
 *  - **Smart allocation is binding.** `allocate()` calls the same detector and discards any
 *    slot that produces a *binding* violation (§5.4).
 *
 * One detector, two policies — never two validation paths.
 */

import type {
  Agenda,
  Conflict,
  ConflictKind,
  ISODateTime,
  Priority,
  ResolvedTimeBlock,
  Task,
  TimeZone,
} from '../types.js';
import type { Interval } from '../time/interval.js';
import { intersection, normalize, overlaps } from '../time/interval.js';
import type { PrayerBlock } from '../prayer/blocks.js';
import { reservedSpan, reservedSpans } from '../scheduling/reserved.js';
import { describeMismatch, filterMismatches } from './timeBlockFilter.js';
import { DAY_NAMES, formatDateShort, formatTimeRange } from '../format/id.js';
import { dayOfWeekForDateKey, localDateKey, localTimeOn } from '../time/timezone.js';
import type { AvailabilityWindow } from '../types.js';
import type { UnfinishedDependency } from './dependency.js';

export interface ViolationContext {
  timezone: TimeZone;
  windows: AvailabilityWindow[];
  prayerBlocks: PrayerBlock[];
  timeBlocks: ResolvedTimeBlock[];
  existingAgendas: Agenda[];
  /** taskId → title, so an overlap message can name the agenda it collides with. */
  taskTitles: Record<string, string>;
  externalBusy: Interval[];
  unfinishedDependencies?: UnfinishedDependency[];
}

export interface Placement {
  /** The visible span of the agenda — buffers are applied by the detector. */
  interval: Interval;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  task: Pick<Task, 'id' | 'categoryId' | 'priority' | 'dueDate'>;
  tagIds: string[];
  /** Set when moving an existing agenda so it does not collide with itself. */
  excludeAgendaId?: string;
}

/**
 * Violations that `allocate()` is forbidden to produce (§5.4).
 * `past_due` and `unfinished_dependency` are deliberately absent: the engine may fall back to a
 * post-deadline slot when there is no alternative (§6.5), and an unfinished dependency never
 * blocks (D5).
 */
export const BINDING_KINDS: ReadonlySet<ConflictKind> = new Set<ConflictKind>([
  'outside_availability',
  'prayer_block',
  'time_block_filter',
  'agenda_overlap',
  'external_busy',
]);

export function isBinding(conflict: Conflict): boolean {
  return BINDING_KINDS.has(conflict.kind);
}

/** Every violation a placement commits, each with a message that names the specific thing. */
export function detectViolations(placement: Placement, context: ViolationContext): Conflict[] {
  const conflicts: Conflict[] = [];
  const span = reservedSpan({
    startAt: placement.interval.startAt,
    endAt: placement.interval.endAt,
    bufferBeforeMin: placement.bufferBeforeMin,
    bufferAfterMin: placement.bufferAfterMin,
  });

  conflicts.push(...availabilityConflicts(placement.interval, context));
  conflicts.push(...prayerConflicts(placement.interval, context));
  conflicts.push(...timeBlockConflicts(placement, context));
  conflicts.push(...agendaConflicts(placement, span, context));
  conflicts.push(...externalBusyConflicts(placement.interval, context));
  conflicts.push(...dueDateConflicts(placement, context));
  conflicts.push(...dependencyConflicts(context));

  return conflicts;
}

function availabilityConflicts(interval: Interval, context: ViolationContext): Conflict[] {
  const { timezone, windows } = context;
  const active = windows.filter((window) => !window.deletedAt);
  const start = new Date(interval.startAt).getTime();
  const end = new Date(interval.endAt).getTime();

  // Walk the local days the placement touches and check it is fully inside some window.
  const dateKeys = new Set([
    localDateKey(interval.startAt, timezone),
    localDateKey(new Date(end - 1).toISOString(), timezone),
  ]);
  const covered: Interval[] = [];
  for (const dateKey of dateKeys) {
    const dayOfWeek = dayOfWeekForDateKey(dateKey);
    for (const window of active) {
      if (window.dayOfWeek !== dayOfWeek) continue;
      const windowStart = localTimeOn(dateKey, window.startTime, timezone);
      const windowEnd = localTimeOn(dateKey, window.endTime, timezone);
      covered.push({
        startAt: windowStart.toISOString(),
        endAt: (windowEnd.getTime() > windowStart.getTime()
          ? windowEnd
          : localTimeOn(dateKey, '24:00', timezone)
        ).toISOString(),
      });
    }
  }

  const merged = normalize(covered);
  const fullyInside = merged.some(
    (window) =>
      new Date(window.startAt).getTime() <= start && end <= new Date(window.endAt).getTime(),
  );
  if (fullyInside) return [];

  const dateKey = localDateKey(interval.startAt, timezone);
  const dayName = DAY_NAMES[dayOfWeekForDateKey(dateKey)];
  const dayWindows = active.filter((window) => window.dayOfWeek === dayOfWeekForDateKey(dateKey));
  const description =
    dayWindows.length > 0
      ? dayWindows.map((window) => `${window.startTime}–${window.endTime}`).join(', ')
      : 'tidak ada jam tersedia';
  return [
    {
      kind: 'outside_availability',
      message: `Di luar jam ${dayName} ${description}`,
    },
  ];
}

function prayerConflicts(interval: Interval, context: ViolationContext): Conflict[] {
  return context.prayerBlocks
    .filter((block) => overlaps(interval, block))
    .map((block) => ({
      kind: 'prayer_block' as const,
      message: `Menabrak blok ${block.displayName} ${formatTimeRange(block.startAt, block.endAt, context.timezone)}`,
    }));
}

function timeBlockConflicts(placement: Placement, context: ViolationContext): Conflict[] {
  const subject = { task: placement.task, tagIds: placement.tagIds };
  return context.timeBlocks
    .filter((block) => overlaps(placement.interval, block))
    .map((block) => ({ block, mismatches: filterMismatches(block.filter, subject) }))
    .filter(({ mismatches }) => mismatches.length > 0)
    .map(({ block, mismatches }) => ({
      kind: 'time_block_filter' as const,
      message: describeMismatch(block.title, mismatches),
    }));
}

function agendaConflicts(
  placement: Placement,
  span: Interval,
  context: ViolationContext,
): Conflict[] {
  const conflicts: Conflict[] = [];
  for (const agenda of context.existingAgendas) {
    if (agenda.deletedAt || agenda.status === 'skipped') continue;
    if (agenda.id === placement.excludeAgendaId) continue;
    const other = reservedSpan(agenda);
    if (!overlaps(span, other)) continue;
    const title = context.taskTitles[agenda.taskId] ?? 'agenda lain';
    conflicts.push({
      kind: 'agenda_overlap',
      message: `Bertabrakan dengan “${title}” ${formatTimeRange(agenda.startAt, agenda.endAt, context.timezone)}`,
    });
  }
  return conflicts;
}

function externalBusyConflicts(interval: Interval, context: ViolationContext): Conflict[] {
  return normalize(context.externalBusy)
    .filter((busy) => overlaps(interval, busy))
    .map((busy) => {
      const hit = intersection(interval, busy) ?? busy;
      return {
        kind: 'external_busy' as const,
        message: `Bentrok dengan acara Google Calendar ${formatTimeRange(hit.startAt, hit.endAt, context.timezone)}`,
      };
    });
}

function dueDateConflicts(placement: Placement, context: ViolationContext): Conflict[] {
  const dueDate = placement.task.dueDate;
  if (!dueDate) return [];
  const endDateKey = localDateKey(placement.interval.endAt, context.timezone);
  if (endDateKey <= dueDate) return [];
  return [
    {
      kind: 'past_due',
      message: `Lewat tenggat ${formatDateShort(dueDate)}`,
    },
  ];
}

function dependencyConflicts(context: ViolationContext): Conflict[] {
  const unfinished = context.unfinishedDependencies ?? [];
  if (unfinished.length === 0) return [];
  return unfinished.map((dependency) => ({
    kind: 'unfinished_dependency' as const,
    message: `Prasyarat belum selesai: “${dependency.title}”`,
  }));
}

/** True when a placement is legal for the *engine* (D6, §5.4). */
export function isAllowedForSmartAllocation(conflicts: Conflict[]): boolean {
  return !conflicts.some(isBinding);
}

/**
 * Manual placement is always permitted (§5.5) — this only tells the UI whether to show the
 * override sheet first, and what to put in it.
 */
export function requiresOverrideConfirmation(conflicts: Conflict[]): boolean {
  return conflicts.some(isBinding);
}

/** All the reserved spans a candidate must avoid, ready for `subtract()`. */
export function occupiedIntervals(context: ViolationContext, excludeAgendaId?: string): Interval[] {
  return normalize([
    ...reservedSpans(context.existingAgendas, { excludeAgendaId }),
    ...context.prayerBlocks.map(({ startAt, endAt }) => ({ startAt, endAt })),
    ...context.externalBusy,
  ]);
}

export function conflictMessages(conflicts: Conflict[]): string[] {
  return conflicts.map((conflict) => conflict.message);
}

export type { ISODateTime, Priority };
