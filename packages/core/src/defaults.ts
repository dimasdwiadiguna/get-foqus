/**
 * Seed defaults (§4.6, §4.8, §4.10).
 *
 * These are what a brand-new account gets before touching settings. The brief treats
 * "works with no setup" as a product promise, so the defaults live in `core` and are shared
 * by the database seed and the client.
 */

import type { AvailabilityWindow, DayOfWeek, Settings, TimeZone } from './types.js';

export const DEFAULT_TIMEZONE: TimeZone = 'Asia/Jakarta';

export const DEFAULT_SETTINGS: Omit<Settings, 'userId'> = {
  timezone: DEFAULT_TIMEZONE,
  defaultBufferAfterMin: 10,
  pomodoro: {
    focusMin: 25,
    shortBreakMin: 5,
    longBreakMin: 15,
    longBreakEvery: 4,
    tickingSound: true,
    bellSound: true,
    autoStartBreak: true,
  },
  celebration: 'full',
  allocation: {
    allowSplit: true,
    minChunkPomodoros: 1,
    workdayStartPreference: 'morning',
  },
};

export function defaultSettings(userId: string): Settings {
  return { userId, ...DEFAULT_SETTINGS };
}

/** Weekdays 04:00–22:00, weekend 06:00–20:00 (§4.6). */
export const DEFAULT_AVAILABILITY: { dayOfWeek: DayOfWeek; startTime: string; endTime: string }[] =
  [
    { dayOfWeek: 1, startTime: '04:00', endTime: '22:00' },
    { dayOfWeek: 2, startTime: '04:00', endTime: '22:00' },
    { dayOfWeek: 3, startTime: '04:00', endTime: '22:00' },
    { dayOfWeek: 4, startTime: '04:00', endTime: '22:00' },
    { dayOfWeek: 5, startTime: '04:00', endTime: '22:00' },
    { dayOfWeek: 6, startTime: '06:00', endTime: '20:00' },
    { dayOfWeek: 0, startTime: '06:00', endTime: '20:00' },
  ];

export type DefaultAvailabilityWindow = Omit<
  AvailabilityWindow,
  'id' | 'userId' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/** The calendar FOQUS writes into — never the user's primary calendar (D12). */
export const AGENDA_CALENDAR_NAME = 'FOQUS — Agenda';

/** OAuth scopes requested in one step at login (D10, §7). */
export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

/** Max outbox entries handled per request — Hobby functions stop at 10 seconds (§7, §12). */
export const OUTBOX_BATCH_SIZE = 5;

/** Exponential backoff for outbox retries, capped at 5 attempts (§7). */
export function outboxBackoffMs(attempts: number): number {
  const capped = Math.min(Math.max(attempts, 1), 5);
  return 2 ** capped * 15_000; // 30s, 1m, 2m, 4m, 8m
}

export const MAX_OUTBOX_ATTEMPTS = 5;
