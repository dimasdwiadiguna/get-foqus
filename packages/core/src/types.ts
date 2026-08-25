/**
 * Domain types for FOQUS — the complete data model from BRIEF §4.
 *
 * Locked to the full spec from M0 on (D3) so later milestones only ever fill tables in,
 * never restructure them. All timestamps are UTC ISO-8601 strings; anything that is
 * calendar-shaped rather than instant-shaped (due dates, override dates) is a date-only
 * `YYYY-MM-DD` string interpreted in the user's timezone.
 */

/** UTC ISO-8601 instant, e.g. `2026-08-25T02:30:00.000Z`. */
export type ISODateTime = string;
/** Date-only, `YYYY-MM-DD`, interpreted in the user's timezone. */
export type ISODate = string;
/** Wall-clock time of day, `HH:mm`, in the user's timezone. */
export type ClockTime = string;
/** IANA timezone identifier, e.g. `Asia/Jakarta`. */
export type TimeZone = string;

export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export type TaskStatus = 'inbox' | 'active' | 'done' | 'archived';
export type AgendaStatus = 'planned' | 'done' | 'partial' | 'missed' | 'skipped';
export type SyncState = 'pending' | 'synced' | 'error';
export type PomodoroKind = 'focus' | 'short_break' | 'long_break';
export type PomodoroOutcome = 'completed' | 'abandoned';
export type CelebrationLevel = 'full' | 'subtle' | 'off';
export type WorkdayPreference = 'morning' | 'even';
export type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
/** 0 = Sunday … 6 = Saturday, matching `Date#getDay`. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Fields every user-owned row carries (BRIEF §4). */
export interface OwnedRecord {
  id: string;
  userId: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt?: ISODateTime | null;
}

export interface Task extends OwnedRecord {
  parentTaskId?: string | null;
  title: string;
  notes?: string | null;
  categoryId?: string | null;
  priority: Priority;
  dueDate?: ISODate | null;
  allocatedPomodoros: number;
  status: TaskStatus;
  completedAt?: ISODateTime | null;
  sortOrder: number;
}

export interface Category extends OwnedRecord {
  name: string;
  colorHex: string;
  sortOrder: number;
}

export interface Tag extends OwnedRecord {
  name: string;
}

export interface TaskTag {
  taskId: string;
  tagId: string;
}

/** Dependency graph, kept separate from the parent/child display hierarchy (§4.3). */
export interface TaskDependency {
  taskId: string;
  dependsOnTaskId: string;
}

export interface Agenda extends OwnedRecord {
  taskId: string;
  startAt: ISODateTime;
  endAt: ISODateTime;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  status: AgendaStatus;
  realizationCheckedAt?: ISODateTime | null;
  gcalEventId?: string | null;
  syncState: SyncState;
}

export interface PomodoroSession extends OwnedRecord {
  taskId: string;
  agendaId?: string | null;
  kind: PomodoroKind;
  startedAt: ISODateTime;
  endedAt?: ISODateTime | null;
  plannedSec: number;
  actualSec: number;
  outcome: PomodoroOutcome;
}

export interface AvailabilityWindow extends OwnedRecord {
  dayOfWeek: DayOfWeek;
  startTime: ClockTime;
  endTime: ClockTime;
}

export interface TimeBlockFilter {
  categoryIds?: string[];
  tagIds?: string[];
  taskIds?: string[];
  priorities?: Priority[];
}

export interface TimeBlock extends OwnedRecord {
  title: string;
  colorHex: string;
  /** RRULE string, or null for a one-time block. */
  recurrence?: string | null;
  startAt: ISODateTime;
  endAt: ISODateTime;
  filter: TimeBlockFilter;
}

/** A time block with its RRULE already expanded into a concrete occurrence. */
export interface ResolvedTimeBlock {
  timeBlockId: string;
  title: string;
  startAt: ISODateTime;
  endAt: ISODateTime;
  filter: TimeBlockFilter;
}

export interface PerPrayerSetting {
  enabled: boolean;
  durationMin: number;
}

export interface PrayerSettings {
  userId: string;
  latitude: number;
  longitude: number;
  /** adhan-js calculation method key; FOQUS defaults to Kemenag RI parameters. */
  method: string;
  ihtiyatiMin: number;
  perPrayer: Record<PrayerName, PerPrayerSetting>;
  pushToGoogleCalendar: boolean;
}

export interface PrayerOverride {
  userId: string;
  date: ISODate;
  prayer: PrayerName;
  enabled?: boolean | null;
  durationMin?: number | null;
}

export interface WeeklyPlan extends OwnedRecord {
  /** ISO week, e.g. `2026-W35`. */
  isoWeek: string;
  taskIds: string[];
}

export interface AllocationDraft extends OwnedRecord {
  weeklyPlanId: string;
  status: 'open' | 'committed' | 'discarded';
  items: DraftItem[];
}

export interface DraftItem {
  taskId: string;
  startAt: ISODateTime;
  endAt: ISODateTime;
  /** Short Indonesian sentence explaining *why* this slot was chosen (§6.8). */
  reason: string;
  conflicts: Conflict[];
  accepted: boolean;
}

/** A task the engine could not place, with a human-readable Indonesian reason (§6.7). */
export interface UnallocatedTask {
  taskId: string;
  reason: string;
}

export type ConflictKind =
  | 'outside_availability'
  | 'prayer_block'
  | 'time_block_filter'
  | 'agenda_overlap'
  | 'external_busy'
  | 'past_due'
  | 'unfinished_dependency';

export interface Conflict {
  kind: ConflictKind;
  /** Specific Indonesian message — never generic (§5.5). */
  message: string;
}

export interface PomodoroSettings {
  focusMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  longBreakEvery: number;
  tickingSound: boolean;
  bellSound: boolean;
  autoStartBreak: boolean;
}

export interface AllocationSettings {
  allowSplit: boolean;
  minChunkPomodoros: number;
  workdayStartPreference: WorkdayPreference;
}

export interface Settings {
  userId: string;
  timezone: TimeZone;
  defaultBufferAfterMin: number;
  pomodoro: PomodoroSettings;
  celebration: CelebrationLevel;
  allocation: AllocationSettings;
}

export interface GoogleAccount {
  userId: string;
  refreshTokenEncrypted: string;
  scopes: string[];
  agendaCalendarId?: string | null;
  busyCalendarIds: string[];
}

export type OutboxEntity = 'agenda' | 'prayer_block';
export type OutboxOp = 'create' | 'update' | 'delete';
export type OutboxStatus = 'pending' | 'processing' | 'done' | 'error';

export interface SyncOutboxEntry extends OwnedRecord {
  entity: OutboxEntity;
  entityId: string;
  op: OutboxOp;
  payload: unknown;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: ISODateTime;
  lastError?: string | null;
}

export interface FreeBusyCacheEntry {
  calendarId: string;
  startAt: ISODateTime;
  endAt: ISODateTime;
  fetchedAt: ISODateTime;
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  pictureUrl?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
