/**
 * Seed data.
 *
 * Two layers, deliberately separate:
 *  - `seedUserDefaults` — the rows a brand-new account cannot function without: settings,
 *    availability windows, prayer settings. Called from the OAuth callback on first login,
 *    so FOQUS is usable the moment you arrive (§4.8: "sudah terisi tanpa setup").
 *  - `seedSampleContent` — example categories, tags and tasks so the first screen is not empty.
 *    Every one of them is deletable; FOQUS ships no built-in categories (§4.2).
 */

import { eq } from 'drizzle-orm';
import {
  DEFAULT_AVAILABILITY,
  DEFAULT_PRAYER_SETTINGS,
  DEFAULT_SETTINGS,
  uuidv7,
} from '@foqus/core';
import type { Database } from './client.js';
import {
  availabilityWindows,
  categories,
  prayerSettings,
  settings,
  tags,
  taskTags,
  tasks,
} from './schema.js';

export async function seedUserDefaults(db: Database, userId: string): Promise<void> {
  await db
    .insert(settings)
    .values({
      userId,
      timezone: DEFAULT_SETTINGS.timezone,
      defaultBufferAfterMin: DEFAULT_SETTINGS.defaultBufferAfterMin,
      pomodoro: DEFAULT_SETTINGS.pomodoro,
      celebration: DEFAULT_SETTINGS.celebration,
      allocation: DEFAULT_SETTINGS.allocation,
    })
    .onConflictDoNothing();

  await db
    .insert(prayerSettings)
    .values({
      userId,
      latitude: DEFAULT_PRAYER_SETTINGS.latitude,
      longitude: DEFAULT_PRAYER_SETTINGS.longitude,
      method: DEFAULT_PRAYER_SETTINGS.method,
      ihtiyatiMin: DEFAULT_PRAYER_SETTINGS.ihtiyatiMin,
      perPrayer: DEFAULT_PRAYER_SETTINGS.perPrayer,
      pushToGoogleCalendar: DEFAULT_PRAYER_SETTINGS.pushToGoogleCalendar,
    })
    .onConflictDoNothing();

  const existingWindows = await db
    .select({ id: availabilityWindows.id })
    .from(availabilityWindows)
    .where(eq(availabilityWindows.userId, userId))
    .limit(1);

  if (existingWindows.length === 0) {
    await db.insert(availabilityWindows).values(
      DEFAULT_AVAILABILITY.map((window) => ({
        id: uuidv7(),
        userId,
        dayOfWeek: window.dayOfWeek,
        startTime: window.startTime,
        endTime: window.endTime,
      })),
    );
  }
}

/** Example categories drawn from the brief's description of the user's day (§1). */
const SAMPLE_CATEGORIES = [
  { name: 'Operasional', colorHex: '#1F6F5C' },
  { name: 'Mengajar', colorHex: '#E8A33D' },
  { name: 'Riset', colorHex: '#6B4B7A' },
  { name: 'Dakwah', colorHex: '#8FA09B' },
];

const SAMPLE_TAGS = ['fokus', 'cepat', 'tunggu-orang'];

export async function seedSampleContent(db: Database, userId: string): Promise<void> {
  const existing = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .limit(1);
  if (existing.length > 0) return;

  const categoryRows = SAMPLE_CATEGORIES.map((category, index) => ({
    id: uuidv7(),
    userId,
    name: category.name,
    colorHex: category.colorHex,
    sortOrder: index,
  }));
  await db.insert(categories).values(categoryRows);

  const tagRows = SAMPLE_TAGS.map((name) => ({ id: uuidv7(), userId, name }));
  await db.insert(tags).values(tagRows).onConflictDoNothing();

  const [operasional, mengajar, riset] = categoryRows;
  const parentId = uuidv7();

  const taskRows = [
    {
      id: parentId,
      userId,
      title: 'Susun rencana pekan ini',
      notes: 'Contoh — hapus kapan saja.',
      categoryId: operasional?.id ?? null,
      priority: 'P2' as const,
      allocatedPomodoros: 2,
      status: 'active' as const,
      sortOrder: 0,
    },
    {
      id: uuidv7(),
      userId,
      parentTaskId: parentId,
      title: 'Pilih task untuk pekan ini',
      categoryId: operasional?.id ?? null,
      priority: 'P3' as const,
      allocatedPomodoros: 1,
      status: 'active' as const,
      sortOrder: 1,
    },
    {
      id: uuidv7(),
      userId,
      title: 'Siapkan materi kuliah',
      categoryId: mengajar?.id ?? null,
      priority: 'P1' as const,
      allocatedPomodoros: 3,
      status: 'active' as const,
      sortOrder: 2,
    },
    {
      id: uuidv7(),
      userId,
      title: 'Baca dua paper',
      categoryId: riset?.id ?? null,
      priority: 'P3' as const,
      allocatedPomodoros: 2,
      status: 'inbox' as const,
      sortOrder: 3,
    },
  ];
  await db.insert(tasks).values(taskRows);

  const focusTag = tagRows[0];
  const deepTask = taskRows[2];
  if (focusTag && deepTask) {
    await db
      .insert(taskTags)
      .values({ taskId: deepTask.id, tagId: focusTag.id })
      .onConflictDoNothing();
  }
}

export async function seedUser(db: Database, userId: string): Promise<void> {
  await seedUserDefaults(db, userId);
  await seedSampleContent(db, userId);
}
