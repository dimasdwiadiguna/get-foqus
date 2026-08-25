import { z } from 'zod';

/** UUIDv7 minted on the client (§4). Validated by shape, not by a v4-specific matcher. */
export const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'ID tidak valid',
  );

/** UTC ISO-8601 instant. */
export const isoDateTimeSchema = z.string().datetime({ offset: false }).describe('UTC ISO-8601');

/** Date-only `YYYY-MM-DD`, read in the user timezone (§5.9). */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus YYYY-MM-DD');

/** `HH:mm`, plus `24:00` for a window that runs to midnight. */
export const clockTimeSchema = z.string().regex(/^([01]\d|2[0-4]):[0-5]\d$/, 'Waktu harus HH:mm');

export const colorHexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Warna harus #RRGGBB');

export const timezoneSchema = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, 'Zona waktu tidak dikenal');

export const prioritySchema = z.enum(['P1', 'P2', 'P3', 'P4']);
export const taskStatusSchema = z.enum(['inbox', 'active', 'done', 'archived']);
export const agendaStatusSchema = z.enum(['planned', 'done', 'partial', 'missed', 'skipped']);
export const syncStateSchema = z.enum(['pending', 'synced', 'error']);
export const pomodoroKindSchema = z.enum(['focus', 'short_break', 'long_break']);
export const pomodoroOutcomeSchema = z.enum(['completed', 'abandoned']);
export const celebrationSchema = z.enum(['full', 'subtle', 'off']);
export const prayerNameSchema = z.enum(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);
export const dayOfWeekSchema = z.number().int().min(0).max(6);

export const intervalSchema = z
  .object({ startAt: isoDateTimeSchema, endAt: isoDateTimeSchema })
  .refine((interval) => interval.startAt < interval.endAt, {
    message: 'Waktu selesai harus setelah waktu mulai',
    path: ['endAt'],
  });
