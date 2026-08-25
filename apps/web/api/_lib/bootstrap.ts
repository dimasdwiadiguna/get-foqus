/**
 * `/api/bootstrap` payload assembly.
 *
 * FOQUS reads from Dexie first and revalidates (§8), so bootstrap hands over the whole read
 * model in one round trip rather than making the client stitch a dozen requests together.
 * Soft-deleted rows are filtered out here, once, so no caller has to remember to.
 */

import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '@foqus/db';
import {
  agendas,
  allocationDrafts,
  availabilityWindows,
  categories,
  freebusyCache,
  googleAccounts,
  pomodoroSessions,
  prayerOverrides,
  prayerSettings,
  settings as settingsTable,
  syncOutbox,
  tags,
  taskDependencies,
  taskTags,
  tasks,
  timeBlocks,
  users,
  weeklyPlans,
} from '@foqus/db';
import { DEFAULT_PRAYER_SETTINGS, DEFAULT_SETTINGS } from '@foqus/core';
import type { Bootstrap } from '@foqus/shared';

const alive = <T extends { userId: unknown; deletedAt: unknown }>(table: T, userId: string) =>
  and(eq(table.userId as never, userId), isNull(table.deletedAt as never));

export async function buildBootstrap(db: Database, userId: string): Promise<Bootstrap> {
  const [
    userRows,
    googleRows,
    settingsRows,
    prayerRows,
    overrideRows,
    windowRows,
    categoryRows,
    tagRows,
    taskRows,
    taskTagRows,
    dependencyRows,
    agendaRows,
    timeBlockRows,
    sessionRows,
    planRows,
    draftRows,
    freeBusyRows,
    outboxRows,
  ] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    db.select().from(googleAccounts).where(eq(googleAccounts.userId, userId)).limit(1),
    db.select().from(settingsTable).where(eq(settingsTable.userId, userId)).limit(1),
    db.select().from(prayerSettings).where(eq(prayerSettings.userId, userId)).limit(1),
    db.select().from(prayerOverrides).where(eq(prayerOverrides.userId, userId)),
    db.select().from(availabilityWindows).where(alive(availabilityWindows, userId)),
    db.select().from(categories).where(alive(categories, userId)),
    db.select().from(tags).where(alive(tags, userId)),
    db.select().from(tasks).where(alive(tasks, userId)),
    db.select({ taskId: taskTags.taskId, tagId: taskTags.tagId }).from(taskTags),
    db.select().from(taskDependencies),
    db.select().from(agendas).where(alive(agendas, userId)),
    db.select().from(timeBlocks).where(alive(timeBlocks, userId)),
    db.select().from(pomodoroSessions).where(eq(pomodoroSessions.userId, userId)),
    db.select().from(weeklyPlans).where(alive(weeklyPlans, userId)),
    db.select().from(allocationDrafts).where(alive(allocationDrafts, userId)),
    db.select().from(freebusyCache).where(eq(freebusyCache.userId, userId)),
    db
      .select({ id: syncOutbox.id })
      .from(syncOutbox)
      .where(and(eq(syncOutbox.userId, userId), eq(syncOutbox.status, 'pending'))),
  ]);

  const user = userRows[0];
  if (!user) throw new Error('Pengguna tidak ditemukan.');

  const google = googleRows[0];
  const storedSettings = settingsRows[0];
  const storedPrayer = prayerRows[0];

  const taskIds = new Set(taskRows.map((task) => task.id));
  const tagsByTask = new Map<string, string[]>();
  for (const link of taskTagRows) {
    if (!taskIds.has(link.taskId)) continue;
    const list = tagsByTask.get(link.taskId);
    if (list) list.push(link.tagId);
    else tagsByTask.set(link.taskId, [link.tagId]);
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      pictureUrl: user.pictureUrl,
      googleConnected: Boolean(google),
      agendaCalendarId: google?.agendaCalendarId ?? null,
    },
    serverTime: new Date().toISOString(),
    settings: storedSettings
      ? {
          timezone: storedSettings.timezone,
          defaultBufferAfterMin: storedSettings.defaultBufferAfterMin,
          pomodoro: storedSettings.pomodoro,
          celebration: storedSettings.celebration,
          allocation: storedSettings.allocation,
        }
      : DEFAULT_SETTINGS,
    prayerSettings: storedPrayer
      ? {
          latitude: storedPrayer.latitude,
          longitude: storedPrayer.longitude,
          method: storedPrayer.method,
          ihtiyatiMin: storedPrayer.ihtiyatiMin,
          perPrayer: storedPrayer.perPrayer,
          pushToGoogleCalendar: storedPrayer.pushToGoogleCalendar,
        }
      : DEFAULT_PRAYER_SETTINGS,
    prayerOverrides: overrideRows.map((row) => ({
      date: row.date,
      prayer: row.prayer,
      enabled: row.enabled,
      durationMin: row.durationMin,
    })),
    availabilityWindows: windowRows.map((row) => ({
      id: row.id,
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
    })),
    categories: categoryRows.map((row) => ({
      id: row.id,
      name: row.name,
      colorHex: row.colorHex,
      sortOrder: row.sortOrder,
    })),
    tags: tagRows.map((row) => ({ id: row.id, name: row.name })),
    tasks: taskRows.map((row) => ({
      id: row.id,
      parentTaskId: row.parentTaskId,
      title: row.title,
      notes: row.notes,
      categoryId: row.categoryId,
      priority: row.priority,
      dueDate: row.dueDate,
      allocatedPomodoros: row.allocatedPomodoros,
      status: row.status,
      completedAt: row.completedAt,
      sortOrder: row.sortOrder,
      tagIds: tagsByTask.get(row.id) ?? [],
    })),
    dependencies: dependencyRows
      .filter((row) => taskIds.has(row.taskId) && taskIds.has(row.dependsOnTaskId))
      .map((row) => ({ taskId: row.taskId, dependsOnTaskId: row.dependsOnTaskId })),
    agendas: agendaRows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      startAt: row.startAt,
      endAt: row.endAt,
      bufferBeforeMin: row.bufferBeforeMin,
      bufferAfterMin: row.bufferAfterMin,
      status: row.status,
      realizationCheckedAt: row.realizationCheckedAt,
      gcalEventId: row.gcalEventId,
      syncState: row.syncState,
    })),
    timeBlocks: timeBlockRows.map((row) => ({
      id: row.id,
      title: row.title,
      colorHex: row.colorHex,
      recurrence: row.recurrence,
      startAt: row.startAt,
      endAt: row.endAt,
      filter: row.filter,
    })),
    pomodoroSessions: sessionRows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      agendaId: row.agendaId,
      kind: row.kind,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      plannedSec: row.plannedSec,
      actualSec: row.actualSec,
      outcome: row.outcome,
    })),
    weeklyPlans: planRows.map((row) => ({
      id: row.id,
      isoWeek: row.isoWeek,
      taskIds: row.taskIds,
    })),
    allocationDrafts: draftRows.map((row) => ({
      id: row.id,
      weeklyPlanId: row.weeklyPlanId,
      status: row.status,
      items: row.items,
    })),
    freeBusy: freeBusyRows.map((row) => ({ startAt: row.startAt, endAt: row.endAt })),
    pendingSyncCount: outboxRows.length,
  };
}
