/**
 * Writes a `/api/bootstrap` response into the Dexie mirror (§8).
 *
 * Replace-per-table rather than merge: bootstrap is the complete, authoritative read model, so
 * a row missing from it has been deleted server-side and must not linger locally. The client
 * outbox is deliberately left untouched — it holds mutations the server has not seen yet.
 */

import type { Bootstrap } from '@foqus/shared';
import { db, META_KEYS, writeMeta } from './db.js';

export async function applyBootstrap(bootstrap: Bootstrap): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.meta,
      db.tasks,
      db.categories,
      db.tags,
      db.dependencies,
      db.agendas,
      db.pomodoroSessions,
      db.availabilityWindows,
      db.timeBlocks,
      db.prayerOverrides,
      db.weeklyPlans,
      db.allocationDrafts,
      db.freeBusy,
    ],
    async () => {
      await Promise.all([
        replace(db.tasks, bootstrap.tasks),
        replace(db.categories, bootstrap.categories),
        replace(db.tags, bootstrap.tags),
        replace(
          db.dependencies,
          bootstrap.dependencies.map((dependency) => ({
            id: `${dependency.taskId}:${dependency.dependsOnTaskId}`,
            ...dependency,
          })),
        ),
        replace(db.agendas, bootstrap.agendas),
        replace(db.pomodoroSessions, bootstrap.pomodoroSessions),
        replace(db.availabilityWindows, bootstrap.availabilityWindows),
        replace(db.timeBlocks, bootstrap.timeBlocks),
        replace(
          db.prayerOverrides,
          bootstrap.prayerOverrides.map((override) => ({
            id: `${override.date}:${override.prayer}`,
            ...override,
          })),
        ),
        replace(db.weeklyPlans, bootstrap.weeklyPlans),
        replace(db.allocationDrafts, bootstrap.allocationDrafts),
        replace(
          db.freeBusy,
          bootstrap.freeBusy.map((interval, index) => ({
            id: `${interval.startAt}:${index}`,
            ...interval,
          })),
        ),
      ]);

      await writeMeta(META_KEYS.user, bootstrap.user);
      await writeMeta(META_KEYS.settings, bootstrap.settings);
      await writeMeta(META_KEYS.prayerSettings, bootstrap.prayerSettings);
      await writeMeta(META_KEYS.pendingSyncCount, bootstrap.pendingSyncCount);
      await writeMeta(META_KEYS.lastBootstrapAt, bootstrap.serverTime);
    },
  );
}

async function replace<T>(
  table: { clear: () => Promise<unknown>; bulkPut: (rows: T[]) => Promise<unknown> },
  rows: T[],
) {
  await table.clear();
  if (rows.length > 0) await table.bulkPut(rows);
}
