/**
 * Drizzle schema — the **complete** FOQUS data model from BRIEF §4, present from M0 (D3).
 *
 * Conventions, applied without exception:
 *  - ids are UUIDv7 strings minted on the client (§4), so every PK is `text`, never `serial`;
 *  - instants are `timestamptz` and stored in UTC; date-only values are `date`;
 *  - every user-owned table carries `user_id`, `created_at`, `updated_at`, `deleted_at`;
 *  - `deleted_at` is a soft delete — queries filter it, rows are never removed, which is what
 *    keeps offline mirrors from resurrecting tombstoned records.
 *
 * Postgres only. SQLite/better-sqlite3 is forbidden: Vercel's filesystem is ephemeral (§3).
 */

import { relations, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type {
  AgendaStatus,
  AllocationSettings,
  CelebrationLevel,
  DraftItem,
  OutboxOp,
  OutboxStatus,
  PerPrayerSetting,
  PomodoroKind,
  PomodoroOutcome,
  PomodoroSettings,
  PrayerName,
  Priority,
  SyncState,
  TaskStatus,
  TimeBlockFilter,
} from '@foqus/core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .default(sql`now()`),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
};

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

/* ------------------------------------------------------------------ identity */

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  pictureUrl: text('picture_url'),
  googleSub: text('google_sub').notNull().unique(),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
});

/**
 * Google credentials (§7). `refresh_token_encrypted` is AES-GCM ciphertext keyed by
 * `TOKEN_ENC_KEY`; the plaintext refresh token never leaves the serverless function (D2).
 */
export const googleAccounts = pgTable('google_accounts', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),
  scopes: jsonb('scopes')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  /** The dedicated "FOQUS — Agenda" calendar (D12) — never the user's primary calendar. */
  agendaCalendarId: text('agenda_calendar_id'),
  /** Calendars read via FreeBusy for conflict detection; excludes the agenda calendar (§7). */
  busyCalendarIds: jsonb('busy_calendar_ids')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
});

export const settings = pgTable('settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  timezone: text('timezone').notNull().default('Asia/Jakarta'),
  defaultBufferAfterMin: integer('default_buffer_after_min').notNull().default(10),
  pomodoro: jsonb('pomodoro').$type<PomodoroSettings>().notNull(),
  celebration: text('celebration').$type<CelebrationLevel>().notNull().default('full'),
  allocation: jsonb('allocation').$type<AllocationSettings>().notNull(),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
});

/* --------------------------------------------------------------------- tasks */

export const categories = pgTable(
  'categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    colorHex: text('color_hex').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (table) => [index('categories_user_idx').on(table.userId)],
);

export const tags = pgTable(
  'tags',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('tags_user_name_idx').on(table.userId, table.name)],
);

export const tasks = pgTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Display hierarchy, max 3 levels (§4.1). A child is a full task with its own agendas. */
    parentTaskId: text('parent_task_id').references((): AnyPgColumn => tasks.id, {
      onDelete: 'cascade',
    }),
    title: text('title').notNull(),
    notes: text('notes'),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    priority: text('priority').$type<Priority>().notNull().default('P3'),
    /** Date-only and read in the user's timezone (§5.9) — not an instant. */
    dueDate: date('due_date'),
    allocatedPomodoros: integer('allocated_pomodoros').notNull().default(1),
    status: text('status').$type<TaskStatus>().notNull().default('inbox'),
    completedAt: instant('completed_at'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index('tasks_user_status_idx').on(table.userId, table.status),
    index('tasks_user_due_idx').on(table.userId, table.dueDate),
    index('tasks_parent_idx').on(table.parentTaskId),
  ],
);

export const taskTags = pgTable(
  'task_tags',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.taskId, table.tagId] })],
);

/**
 * Dependency graph (§4.3) — separate from the parent/child hierarchy. Cycles are rejected in
 * `@foqus/core` at write time; an unfinished dependency only warns, it never gates (D5).
 */
export const taskDependencies = pgTable(
  'task_dependencies',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    dependsOnTaskId: text('depends_on_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.taskId, table.dependsOnTaskId] })],
);

/* ------------------------------------------------------------------- agendas */

/**
 * An agenda is a task that has been given a slot (§4.4).
 *
 * Invariant §5.1: deleting an agenda must never touch its task. That is why there is no
 * cascade from agenda to task here in either direction beyond `task → agendas` (§5.2).
 * Buffers are internal: the Google Calendar event covers only `[start_at, end_at]` (§7).
 */
export const agendas = pgTable(
  'agendas',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    startAt: instant('start_at').notNull(),
    endAt: instant('end_at').notNull(),
    bufferBeforeMin: integer('buffer_before_min').notNull().default(0),
    bufferAfterMin: integer('buffer_after_min').notNull().default(10),
    status: text('status').$type<AgendaStatus>().notNull().default('planned'),
    realizationCheckedAt: instant('realization_checked_at'),
    gcalEventId: text('gcal_event_id'),
    syncState: text('sync_state').$type<SyncState>().notNull().default('pending'),
    syncError: text('sync_error'),
    ...timestamps,
  },
  (table) => [
    index('agendas_user_start_idx').on(table.userId, table.startAt),
    index('agendas_task_idx').on(table.taskId),
    index('agendas_sync_idx').on(table.userId, table.syncState),
  ],
);

/** Append-only (§4.5) — never updated after the session closes, so offline sync cannot conflict. */
export const pomodoroSessions = pgTable(
  'pomodoro_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    agendaId: text('agenda_id').references(() => agendas.id, { onDelete: 'set null' }),
    kind: text('kind').$type<PomodoroKind>().notNull(),
    startedAt: instant('started_at').notNull(),
    endedAt: instant('ended_at'),
    plannedSec: integer('planned_sec').notNull(),
    actualSec: integer('actual_sec').notNull().default(0),
    outcome: text('outcome').$type<PomodoroOutcome>().notNull(),
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  },
  (table) => [
    index('pomodoro_user_started_idx').on(table.userId, table.startedAt),
    index('pomodoro_task_idx').on(table.taskId),
  ],
);

/* --------------------------------------------------------------- constraints */

export const availabilityWindows = pgTable(
  'availability_windows',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 0 = Sunday … 6 = Saturday. More than one window per day is allowed (§4.6). */
    dayOfWeek: integer('day_of_week').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    ...timestamps,
  },
  (table) => [index('availability_user_day_idx').on(table.userId, table.dayOfWeek)],
);

export const timeBlocks = pgTable(
  'time_blocks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    colorHex: text('color_hex').notNull(),
    /** RRULE string; null for a one-time block (§4.7). Expanded by `rrule` in the client. */
    recurrence: text('recurrence'),
    startAt: instant('start_at').notNull(),
    endAt: instant('end_at').notNull(),
    /** Binding for smart allocation, advisory for manual placement (D6). */
    filter: jsonb('filter')
      .$type<TimeBlockFilter>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [index('time_blocks_user_idx').on(table.userId)],
);

/**
 * Prayer settings (§4.8). The blocks themselves are **derived, never stored** — computed
 * locally with adhan-js each day, which is what makes them work offline with no rows to sync.
 */
export const prayerSettings = pgTable('prayer_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  latitude: doublePrecision('latitude').notNull().default(-6.9175),
  longitude: doublePrecision('longitude').notNull().default(107.6191),
  method: text('method').notNull().default('Kemenag'),
  ihtiyatiMin: integer('ihtiyati_min').notNull().default(2),
  perPrayer: jsonb('per_prayer').$type<Record<PrayerName, PerPrayerSetting>>().notNull(),
  pushToGoogleCalendar: boolean('push_to_google_calendar').notNull().default(false),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
});

export const prayerOverrides = pgTable(
  'prayer_overrides',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    prayer: text('prayer').$type<PrayerName>().notNull(),
    enabled: boolean('enabled'),
    durationMin: integer('duration_min'),
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  },
  (table) => [primaryKey({ columns: [table.userId, table.date, table.prayer] })],
);

/* ------------------------------------------------------- planning & drafting */

export const weeklyPlans = pgTable(
  'weekly_plans',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** ISO week key, e.g. `2026-W35` (§4.9). */
    isoWeek: text('iso_week').notNull(),
    taskIds: jsonb('task_ids')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    ...timestamps,
  },
  (table) => [uniqueIndex('weekly_plans_user_week_idx').on(table.userId, table.isoWeek)],
);

/**
 * A proposal, never a write (D4). Items are reviewed, nudged, then committed as a batch;
 * only the commit turns them into `agendas`.
 */
export const allocationDrafts = pgTable(
  'allocation_drafts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    weeklyPlanId: text('weekly_plan_id')
      .notNull()
      .references(() => weeklyPlans.id, { onDelete: 'cascade' }),
    status: text('status').$type<'open' | 'committed' | 'discarded'>().notNull().default('open'),
    items: jsonb('items')
      .$type<DraftItem[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    ...timestamps,
  },
  (table) => [index('allocation_drafts_user_idx').on(table.userId, table.status)],
);

/* ---------------------------------------------------------------------- sync */

/**
 * Outbox (§7). It lives in Postgres — **not** in process memory — precisely because Vercel
 * gives no guarantee the same function instance survives to the next request (D13).
 * Drained at most `OUTBOX_BATCH_SIZE` entries per call so a 10-second function never times out.
 */
export const syncOutbox = pgTable(
  'sync_outbox',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entity: text('entity').notNull(),
    entityId: text('entity_id').notNull(),
    op: text('op').$type<OutboxOp>().notNull(),
    payload: jsonb('payload'),
    status: text('status').$type<OutboxStatus>().notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: instant('next_attempt_at')
      .notNull()
      .default(sql`now()`),
    lastError: text('last_error'),
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  },
  (table) => [
    index('sync_outbox_drain_idx').on(table.userId, table.status, table.nextAttemptAt),
    index('sync_outbox_entity_idx').on(table.entity, table.entityId),
  ],
);

/** Cached FreeBusy windows so conflict detection survives the first moments offline (§7). */
export const freebusyCache = pgTable(
  'freebusy_cache',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    calendarId: text('calendar_id').notNull(),
    startAt: instant('start_at').notNull(),
    endAt: instant('end_at').notNull(),
    fetchedAt: instant('fetched_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => [index('freebusy_user_range_idx').on(table.userId, table.startAt)],
);

/* ----------------------------------------------------------------- relations */

export const usersRelations = relations(users, ({ many, one }) => ({
  tasks: many(tasks),
  agendas: many(agendas),
  categories: many(categories),
  tags: many(tags),
  settings: one(settings, { fields: [users.id], references: [settings.userId] }),
  googleAccount: one(googleAccounts, { fields: [users.id], references: [googleAccounts.userId] }),
}));

export const tasksRelations = relations(tasks, ({ many, one }) => ({
  category: one(categories, { fields: [tasks.categoryId], references: [categories.id] }),
  parent: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: 'subtasks',
  }),
  children: many(tasks, { relationName: 'subtasks' }),
  agendas: many(agendas),
  taskTags: many(taskTags),
  sessions: many(pomodoroSessions),
}));

export const agendasRelations = relations(agendas, ({ one, many }) => ({
  task: one(tasks, { fields: [agendas.taskId], references: [tasks.id] }),
  sessions: many(pomodoroSessions),
}));

export const taskTagsRelations = relations(taskTags, ({ one }) => ({
  task: one(tasks, { fields: [taskTags.taskId], references: [tasks.id] }),
  tag: one(tags, { fields: [taskTags.tagId], references: [tags.id] }),
}));

export const schema = {
  users,
  googleAccounts,
  settings,
  categories,
  tags,
  tasks,
  taskTags,
  taskDependencies,
  agendas,
  pomodoroSessions,
  availabilityWindows,
  timeBlocks,
  prayerSettings,
  prayerOverrides,
  weeklyPlans,
  allocationDrafts,
  syncOutbox,
  freebusyCache,
};
