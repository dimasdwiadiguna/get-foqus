/**
 * API envelope shapes: the payloads that are not simply one entity.
 *
 * `/api/bootstrap` is the one the client leans on hardest — FOQUS reads from Dexie first and
 * revalidates (§8), so bootstrap must return the whole read model in a single round trip.
 */

import { z } from 'zod';
import {
  agendaSchema,
  allocationDraftSchema,
  availabilityWindowSchema,
  categorySchema,
  dependencySchema,
  pomodoroSessionSchema,
  prayerOverrideSchema,
  prayerSettingsSchema,
  settingsSchema,
  tagSchema,
  taskSchema,
  timeBlockSchema,
  weeklyPlanSchema,
} from './dto.js';
import { intervalSchema, isoDateTimeSchema, uuidSchema } from './primitives.js';

export const sessionUserSchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  name: z.string().nullable(),
  pictureUrl: z.string().nullable(),
  googleConnected: z.boolean(),
  agendaCalendarId: z.string().nullable(),
});

export const bootstrapSchema = z.object({
  user: sessionUserSchema,
  serverTime: isoDateTimeSchema,
  settings: settingsSchema,
  prayerSettings: prayerSettingsSchema,
  prayerOverrides: z.array(prayerOverrideSchema),
  availabilityWindows: z.array(availabilityWindowSchema),
  categories: z.array(categorySchema),
  tags: z.array(tagSchema),
  tasks: z.array(taskSchema),
  dependencies: z.array(dependencySchema),
  agendas: z.array(agendaSchema),
  timeBlocks: z.array(timeBlockSchema),
  pomodoroSessions: z.array(pomodoroSessionSchema),
  weeklyPlans: z.array(weeklyPlanSchema),
  allocationDrafts: z.array(allocationDraftSchema),
  freeBusy: z.array(intervalSchema),
  /** Outbox entries still waiting to reach Google Calendar — drives the header indicator (§8). */
  pendingSyncCount: z.number().int().min(0),
});

/**
 * Response of `POST /api/sync/drain` (§7).
 * The client keeps calling while `remaining > 0`; the server never tries to empty the queue
 * in one request, because a Hobby function has 10 seconds (§12).
 */
export const drainResultSchema = z.object({
  processed: z.number().int().min(0),
  remaining: z.number().int().min(0),
  errors: z.array(z.object({ entityId: z.string(), message: z.string() })),
});

/** Offline mutations replayed on reconnect (§8) — the three allowed kinds, nothing else. */
export const offlineMutationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('task_completion'),
    taskId: uuidSchema,
    done: z.boolean(),
    at: isoDateTimeSchema,
  }),
  z.object({
    kind: z.literal('agenda_realization'),
    agendaId: uuidSchema,
    status: z.enum(['done', 'partial', 'missed', 'skipped']),
    at: isoDateTimeSchema,
  }),
  z.object({
    kind: z.literal('pomodoro_session'),
    session: pomodoroSessionSchema,
  }),
]);

export const syncPushSchema = z.object({
  mutations: z.array(offlineMutationSchema).max(200),
});

export const syncPushResultSchema = z.object({
  applied: z.number().int().min(0),
  rejected: z.array(z.object({ index: z.number().int(), message: z.string() })),
});

export const freeBusyQuerySchema = z.object({
  from: isoDateTimeSchema,
  to: isoDateTimeSchema,
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    /** User-facing, in Indonesian — the UI shows it verbatim. */
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type SessionUser = z.infer<typeof sessionUserSchema>;
export type Bootstrap = z.infer<typeof bootstrapSchema>;
export type DrainResult = z.infer<typeof drainResultSchema>;
export type OfflineMutation = z.infer<typeof offlineMutationSchema>;
export type SyncPush = z.infer<typeof syncPushSchema>;
export type SyncPushResult = z.infer<typeof syncPushResultSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
