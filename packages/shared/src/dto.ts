/**
 * DTO schemas for every entity in §4.
 *
 * Present in full from M0 (D3): later milestones wire routes to these, they do not redefine
 * the shapes. Client-minted ids are accepted on create so an offline mutation never needs a
 * round-trip to learn its own identity (§4).
 */

import { z } from 'zod';
import {
  agendaStatusSchema,
  celebrationSchema,
  clockTimeSchema,
  colorHexSchema,
  dayOfWeekSchema,
  isoDateSchema,
  isoDateTimeSchema,
  pomodoroKindSchema,
  pomodoroOutcomeSchema,
  prayerNameSchema,
  prioritySchema,
  syncStateSchema,
  taskStatusSchema,
  timezoneSchema,
  uuidSchema,
} from './primitives.js';

/* --------------------------------------------------------------------- task */

export const taskSchema = z.object({
  id: uuidSchema,
  parentTaskId: uuidSchema.nullable().optional(),
  title: z.string().min(1, 'Judul tidak boleh kosong').max(500),
  notes: z.string().max(10_000).nullable().optional(),
  categoryId: uuidSchema.nullable().optional(),
  priority: prioritySchema,
  dueDate: isoDateSchema.nullable().optional(),
  allocatedPomodoros: z.number().int().min(1).max(32),
  status: taskStatusSchema,
  completedAt: isoDateTimeSchema.nullable().optional(),
  sortOrder: z.number().int(),
  tagIds: z.array(uuidSchema).default([]),
});

export const createTaskSchema = taskSchema.partial({
  priority: true,
  allocatedPomodoros: true,
  status: true,
  sortOrder: true,
  tagIds: true,
});

export const updateTaskSchema = taskSchema.omit({ id: true }).partial();

/* ---------------------------------------------------------- category and tag */

export const categorySchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(80),
  colorHex: colorHexSchema,
  sortOrder: z.number().int(),
});

export const createCategorySchema = categorySchema.partial({ sortOrder: true });
export const updateCategorySchema = categorySchema.omit({ id: true }).partial();

export const tagSchema = z.object({ id: uuidSchema, name: z.string().min(1).max(60) });
export const createTagSchema = tagSchema;

/* --------------------------------------------------------------- dependency */

export const dependencySchema = z.object({
  taskId: uuidSchema,
  dependsOnTaskId: uuidSchema,
});

/* ------------------------------------------------------------------- agenda */

export const agendaSchema = z
  .object({
    id: uuidSchema,
    taskId: uuidSchema,
    startAt: isoDateTimeSchema,
    endAt: isoDateTimeSchema,
    bufferBeforeMin: z.number().int().min(0).max(240),
    bufferAfterMin: z.number().int().min(0).max(240),
    status: agendaStatusSchema,
    realizationCheckedAt: isoDateTimeSchema.nullable().optional(),
    gcalEventId: z.string().nullable().optional(),
    syncState: syncStateSchema,
  })
  .refine((agenda) => agenda.startAt < agenda.endAt, {
    message: 'Agenda harus berakhir setelah dimulai',
    path: ['endAt'],
  });

export const createAgendaSchema = z.object({
  id: uuidSchema,
  taskId: uuidSchema,
  startAt: isoDateTimeSchema,
  endAt: isoDateTimeSchema,
  bufferBeforeMin: z.number().int().min(0).max(240).optional(),
  bufferAfterMin: z.number().int().min(0).max(240).optional(),
  /**
   * Set when the user has confirmed an override sheet (§5.5, D6). The API records the
   * acknowledged violations; it never uses this flag to skip validation for the *engine*.
   */
  overrideAcknowledged: z.boolean().default(false),
  acknowledgedConflicts: z.array(z.string()).default([]),
});

export const updateAgendaSchema = z.object({
  startAt: isoDateTimeSchema.optional(),
  endAt: isoDateTimeSchema.optional(),
  bufferBeforeMin: z.number().int().min(0).max(240).optional(),
  bufferAfterMin: z.number().int().min(0).max(240).optional(),
  status: agendaStatusSchema.optional(),
  realizationCheckedAt: isoDateTimeSchema.nullable().optional(),
  overrideAcknowledged: z.boolean().optional(),
  acknowledgedConflicts: z.array(z.string()).optional(),
});

/* ----------------------------------------------------------------- pomodoro */

/** Append-only (§4.5): sessions are posted whole, never patched. */
export const pomodoroSessionSchema = z.object({
  id: uuidSchema,
  taskId: uuidSchema,
  agendaId: uuidSchema.nullable().optional(),
  kind: pomodoroKindSchema,
  startedAt: isoDateTimeSchema,
  endedAt: isoDateTimeSchema.nullable().optional(),
  plannedSec: z
    .number()
    .int()
    .min(0)
    .max(24 * 3600),
  actualSec: z
    .number()
    .int()
    .min(0)
    .max(24 * 3600),
  outcome: pomodoroOutcomeSchema,
});

/* -------------------------------------------------------------- constraints */

export const availabilityWindowSchema = z
  .object({
    id: uuidSchema,
    dayOfWeek: dayOfWeekSchema,
    startTime: clockTimeSchema,
    endTime: clockTimeSchema,
  })
  .refine((window) => window.startTime !== window.endTime, {
    message: 'Jendela harus punya durasi',
    path: ['endTime'],
  });

export const timeBlockFilterSchema = z.object({
  categoryIds: z.array(uuidSchema).optional(),
  tagIds: z.array(uuidSchema).optional(),
  taskIds: z.array(uuidSchema).optional(),
  priorities: z.array(prioritySchema).optional(),
});

export const timeBlockSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1).max(120),
  colorHex: colorHexSchema,
  recurrence: z.string().max(500).nullable().optional(),
  startAt: isoDateTimeSchema,
  endAt: isoDateTimeSchema,
  filter: timeBlockFilterSchema.default({}),
});

export const perPrayerSchema = z.object({
  enabled: z.boolean(),
  durationMin: z.number().int().min(0).max(240),
});

export const prayerSettingsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  method: z.string().min(1).max(60),
  ihtiyatiMin: z.number().int().min(0).max(60),
  perPrayer: z.record(prayerNameSchema, perPrayerSchema),
  pushToGoogleCalendar: z.boolean(),
});

export const prayerOverrideSchema = z.object({
  date: isoDateSchema,
  prayer: prayerNameSchema,
  enabled: z.boolean().nullable().optional(),
  durationMin: z.number().int().min(0).max(240).nullable().optional(),
});

/* ----------------------------------------------------------------- settings */

export const settingsSchema = z.object({
  timezone: timezoneSchema,
  defaultBufferAfterMin: z.number().int().min(0).max(240),
  pomodoro: z.object({
    focusMin: z.number().int().min(1).max(180),
    shortBreakMin: z.number().int().min(1).max(60),
    longBreakMin: z.number().int().min(1).max(120),
    longBreakEvery: z.number().int().min(1).max(12),
    tickingSound: z.boolean(),
    bellSound: z.boolean(),
    autoStartBreak: z.boolean(),
  }),
  celebration: celebrationSchema,
  allocation: z.object({
    allowSplit: z.boolean(),
    minChunkPomodoros: z.number().int().min(1).max(8),
    workdayStartPreference: z.enum(['morning', 'even']),
  }),
});

export const updateSettingsSchema = settingsSchema.partial();

/* ------------------------------------------------------------------ planning */

export const weeklyPlanSchema = z.object({
  id: uuidSchema,
  isoWeek: z.string().regex(/^\d{4}-W\d{2}$/, 'Format pekan harus 2026-W35'),
  taskIds: z.array(uuidSchema),
});

export const draftItemSchema = z.object({
  taskId: uuidSchema,
  startAt: isoDateTimeSchema,
  endAt: isoDateTimeSchema,
  reason: z.string(),
  conflicts: z.array(z.object({ kind: z.string(), message: z.string() })),
  accepted: z.boolean(),
});

export const allocationDraftSchema = z.object({
  id: uuidSchema,
  weeklyPlanId: uuidSchema,
  status: z.enum(['open', 'committed', 'discarded']),
  items: z.array(draftItemSchema),
});

export type TaskDto = z.infer<typeof taskSchema>;
export type CreateTaskDto = z.infer<typeof createTaskSchema>;
export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;
export type CategoryDto = z.infer<typeof categorySchema>;
export type TagDto = z.infer<typeof tagSchema>;
export type AgendaDto = z.infer<typeof agendaSchema>;
export type CreateAgendaDto = z.infer<typeof createAgendaSchema>;
export type UpdateAgendaDto = z.infer<typeof updateAgendaSchema>;
export type PomodoroSessionDto = z.infer<typeof pomodoroSessionSchema>;
export type AvailabilityWindowDto = z.infer<typeof availabilityWindowSchema>;
export type TimeBlockDto = z.infer<typeof timeBlockSchema>;
export type PrayerSettingsDto = z.infer<typeof prayerSettingsSchema>;
export type PrayerOverrideDto = z.infer<typeof prayerOverrideSchema>;
export type SettingsDto = z.infer<typeof settingsSchema>;
export type WeeklyPlanDto = z.infer<typeof weeklyPlanSchema>;
export type AllocationDraftDto = z.infer<typeof allocationDraftSchema>;
