/**
 * `@foqus/core` — the domain. Pure, deterministic, zero React/DOM/DB (BRIEF §3).
 *
 * Every scheduling rule in FOQUS lives behind this barrel; UI and API call it and never
 * reimplement it.
 */

export * from './types.js';
export * from './defaults.js';

export { uuidv7, uuidv7Timestamp } from './id/uuidv7.js';

export type { Interval, LabeledInterval } from './time/interval.js';
export {
  contains,
  containsInstant,
  durationMin,
  intersectAll,
  intersection,
  isEmpty,
  longEnough,
  makeInterval,
  normalize,
  overlaps,
  subtract,
  totalMinutes,
} from './time/interval.js';

export type { ZonedParts } from './time/timezone.js';
export {
  addLocalDays,
  addMinutes,
  clockTimeToMinutes,
  dayOfWeekForDateKey,
  isoWeekOf,
  localClockTime,
  localDateKey,
  localDateKeysBetween,
  localTimeOn,
  parseClockTime,
  parseDateKey,
  startOfLocalDay,
  toISO,
  zonedParts,
  zonedTimeToUtc,
} from './time/timezone.js';

export {
  DAY_NAMES,
  MONTH_NAMES_LONG,
  MONTH_NAMES_SHORT,
  formatDateLong,
  formatDateShort,
  formatDuration,
  formatRelativeDay,
  formatTime,
  formatTimeRange,
  joinList,
} from './format/id.js';

export type { PrayerBlock } from './prayer/blocks.js';
export {
  DEFAULT_PRAYER_SETTINGS,
  KEMENAG_METHOD,
  PRAYER_LABELS,
  PRAYER_ORDER,
  blockForPrayer,
  defaultPrayerSettings,
  derivePrayerBlocks,
  prayerIntervals,
} from './prayer/blocks.js';

export type { DependencyEdge, UnfinishedDependency } from './rules/dependency.js';
export {
  MAX_TASK_DEPTH,
  canAddDependency,
  canNestUnder,
  findCycle,
  taskDepth,
  toEdges,
  topologicalOrder,
  unfinishedDependencies,
} from './rules/dependency.js';

export type { FilterMismatch, FilterSubject } from './rules/timeBlockFilter.js';
export { describeMismatch, filterMismatches, passesFilter } from './rules/timeBlockFilter.js';

export type { Placement, ViolationContext } from './rules/violations.js';
export {
  BINDING_KINDS,
  conflictMessages,
  detectViolations,
  isAllowedForSmartAllocation,
  isBinding,
  occupiedIntervals,
  requiresOverrideConfirmation,
} from './rules/violations.js';

export type { Horizon } from './scheduling/availability.js';
export {
  expandAvailability,
  unavailableIntervals,
  windowCovering,
} from './scheduling/availability.js';

export {
  focusDurationMin,
  reservedDurationMin,
  reservedSpan,
  reservedSpans,
  visibleSpan,
} from './scheduling/reserved.js';

export type { FreeIntervalsInput } from './scheduling/freeIntervals.js';
export {
  candidateSlots,
  disqualifyingBlocks,
  freeIntervals,
  preferredBlocks,
  usableIntervals,
} from './scheduling/freeIntervals.js';

export type { AllocateFn, AllocateInput, AllocateResult } from './scheduling/allocate.js';

export type { PomodoroProgress, RunningSession } from './pomodoro/timer.js';
export {
  countCompletedFocus,
  elapsedSec,
  finishesAt,
  formatCountdown,
  isFinished,
  nextSessionKind,
  plannedSecFor,
  pomodoroProgress,
  remainingSec,
} from './pomodoro/timer.js';
