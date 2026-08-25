/**
 * Dexie mirror (§8).
 *
 * FOQUS reads from IndexedDB first and revalidates over the network — that is what makes the
 * app usable the instant it opens and what makes M5's offline mode a small step rather than a
 * rewrite. Every table in the read model is mirrored from M0 (D3), even the ones no screen
 * uses yet, so later milestones only add queries.
 *
 * The client outbox is here too: offline mutations queue locally and replay on reconnect. It is
 * separate from the server-side `sync_outbox`, which queues pushes to Google Calendar.
 */

import Dexie, { type EntityTable } from 'dexie';
import type {
  AgendaDto,
  AllocationDraftDto,
  AvailabilityWindowDto,
  CategoryDto,
  OfflineMutation,
  PomodoroSessionDto,
  PrayerOverrideDto,
  TagDto,
  TaskDto,
  TimeBlockDto,
  WeeklyPlanDto,
} from '@foqus/shared';
import type { Interval } from '@foqus/core';

/** A key/value row for things there is exactly one of: settings, session user, sync state. */
export interface MetaRow {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface DependencyRow {
  id: string; // `${taskId}:${dependsOnTaskId}` — Dexie needs a single primary key
  taskId: string;
  dependsOnTaskId: string;
}

export interface FreeBusyRow extends Interval {
  id: string;
}

/** A mutation made while offline, waiting to be replayed via `POST /api/sync/push` (§8). */
export interface OutboxRow {
  id: string;
  mutation: OfflineMutation;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export class FoqusDatabase extends Dexie {
  meta!: EntityTable<MetaRow, 'key'>;
  tasks!: EntityTable<TaskDto, 'id'>;
  categories!: EntityTable<CategoryDto, 'id'>;
  tags!: EntityTable<TagDto, 'id'>;
  dependencies!: EntityTable<DependencyRow, 'id'>;
  agendas!: EntityTable<AgendaDto, 'id'>;
  pomodoroSessions!: EntityTable<PomodoroSessionDto, 'id'>;
  availabilityWindows!: EntityTable<AvailabilityWindowDto, 'id'>;
  timeBlocks!: EntityTable<TimeBlockDto, 'id'>;
  prayerOverrides!: EntityTable<PrayerOverrideDto & { id: string }, 'id'>;
  weeklyPlans!: EntityTable<WeeklyPlanDto, 'id'>;
  allocationDrafts!: EntityTable<AllocationDraftDto, 'id'>;
  freeBusy!: EntityTable<FreeBusyRow, 'id'>;
  outbox!: EntityTable<OutboxRow, 'id'>;

  constructor() {
    super('foqus');
    this.version(1).stores({
      meta: 'key',
      tasks: 'id, status, dueDate, categoryId, parentTaskId, sortOrder',
      categories: 'id, sortOrder',
      tags: 'id, name',
      dependencies: 'id, taskId, dependsOnTaskId',
      agendas: 'id, taskId, startAt, status, syncState',
      pomodoroSessions: 'id, taskId, agendaId, startedAt',
      availabilityWindows: 'id, dayOfWeek',
      timeBlocks: 'id, startAt',
      prayerOverrides: 'id, date',
      weeklyPlans: 'id, isoWeek',
      allocationDrafts: 'id, status',
      freeBusy: 'id, startAt',
      outbox: 'id, createdAt',
    });
  }
}

export const db = new FoqusDatabase();

export async function readMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function writeMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value, updatedAt: new Date().toISOString() });
}

export const META_KEYS = {
  settings: 'settings',
  prayerSettings: 'prayerSettings',
  user: 'user',
  lastBootstrapAt: 'lastBootstrapAt',
  pendingSyncCount: 'pendingSyncCount',
} as const;

/** Wipes the mirror. Used on logout so a second account never sees the first one's data. */
export async function clearMirror(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
}
