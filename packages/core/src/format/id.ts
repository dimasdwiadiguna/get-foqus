/**
 * Indonesian formatting helpers.
 *
 * The interface language is Bahasa Indonesia (§1) and violation messages must name the
 * specific thing that was violated (§5.5), so the phrasing lives in `core` next to the rules
 * that produce it rather than being reassembled in the UI.
 */

import type {
  CelebrationLevel,
  ClockTime,
  DayOfWeek,
  ISODate,
  ISODateTime,
  TimeZone,
} from '../types.js';
import { localClockTime, localDateKey, parseDateKey, zonedParts } from '../time/timezone.js';

export const DAY_NAMES: Record<DayOfWeek, string> = {
  0: 'Minggu',
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
};

export const MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export const MONTH_NAMES_LONG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/** `09:00` in the user's timezone. */
export function formatTime(instant: ISODateTime, timezone: TimeZone): ClockTime {
  return localClockTime(instant, timezone);
}

/** `09:00–10:40` — en dash, as used throughout the UI copy in the brief. */
export function formatTimeRange(
  startAt: ISODateTime,
  endAt: ISODateTime,
  timezone: TimeZone,
): string {
  return `${formatTime(startAt, timezone)}–${formatTime(endAt, timezone)}`;
}

/** `25 Agu` */
export function formatDateShort(value: ISODate | ISODateTime, timezone?: TimeZone): string {
  const { month, day } = splitDate(value, timezone);
  return `${day} ${MONTH_NAMES_SHORT[month - 1] ?? ''}`;
}

/** `Selasa, 25 Agustus 2026` */
export function formatDateLong(value: ISODate | ISODateTime, timezone?: TimeZone): string {
  const { year, month, day, dayOfWeek } = splitDate(value, timezone);
  return `${DAY_NAMES[dayOfWeek]}, ${day} ${MONTH_NAMES_LONG[month - 1] ?? ''} ${year}`;
}

function splitDate(
  value: ISODate | ISODateTime,
  timezone?: TimeZone,
): { year: number; month: number; day: number; dayOfWeek: DayOfWeek } {
  if (value.length === 10) {
    const { year, month, day } = parseDateKey(value);
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay() as DayOfWeek;
    return { year, month, day, dayOfWeek };
  }
  const zone = timezone ?? 'UTC';
  const parts = zonedParts(value, zone);
  return { year: parts.year, month: parts.month, day: parts.day, dayOfWeek: parts.dayOfWeek };
}

/** `1 jam 40 menit`, `40 menit`, `2 jam`. */
export function formatDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (hours === 0) return `${rest} menit`;
  if (rest === 0) return `${hours} jam`;
  return `${hours} jam ${rest} menit`;
}

/**
 * `hari ini`, `besok`, `kemarin`, otherwise `Selasa 25 Agu` — the phrasing used on
 * suggested-slot rows (§10.2 Jalur A).
 */
export function formatRelativeDay(
  instant: ISODateTime,
  now: ISODateTime,
  timezone: TimeZone,
): string {
  const target = localDateKey(instant, timezone);
  const today = localDateKey(now, timezone);
  const diff = daysBetween(today, target);
  if (diff === 0) return 'hari ini';
  if (diff === 1) return 'besok';
  if (diff === 2) return 'lusa';
  if (diff === -1) return 'kemarin';
  const { dayOfWeek } = splitDate(target);
  return `${DAY_NAMES[dayOfWeek]} ${formatDateShort(target)}`;
}

function daysBetween(from: ISODate, to: ISODate): number {
  const a = parseDateKey(from);
  const b = parseDateKey(to);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000,
  );
}

/** Joins a list the way Indonesian prose does: `A, B, dan C`. */
export function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} dan ${items[items.length - 1]}`;
}

/**
 * Enum values are English identifiers; the interface is Bahasa Indonesia (§1). These maps are
 * the boundary between the two, and they live here for the same reason violation messages do
 * (DECISIONS T5): the phrasing belongs next to the domain, never reassembled in React.
 */
export const CELEBRATION_LABELS: Record<CelebrationLevel, string> = {
  full: 'Penuh',
  subtle: 'Halus',
  off: 'Mati',
};

/** Prayer calculation methods, named the way the user recognises them. */
export const PRAYER_METHOD_LABELS: Record<string, string> = {
  Kemenag: 'Kemenag RI',
  MuslimWorldLeague: 'Muslim World League',
  Egyptian: 'Egyptian General Authority',
  Karachi: 'University of Islamic Sciences, Karachi',
  UmmAlQura: 'Umm al-Qura, Makkah',
  Singapore: 'Singapura',
  Turkey: 'Diyanet, Turki',
  Other: 'Kustom',
};

/** Falls back to the raw key rather than to an empty string — an unknown method is still a name. */
export function describePrayerMethod(method: string): string {
  return PRAYER_METHOD_LABELS[method] ?? method;
}

export function describeCelebration(level: CelebrationLevel): string {
  return CELEBRATION_LABELS[level];
}

/** `Terlambat 1 hari` / `Jatuh tempo hari ini` — used by "Sisa hari ini" (§10.3). */
export function describeDueDate(dueDate: ISODate, today: ISODate): string {
  const diff = daysBetween(today, dueDate);
  if (diff === 0) return 'Jatuh tempo hari ini';
  if (diff === -1) return 'Terlambat sejak kemarin';
  if (diff < 0) return `Terlambat ${Math.abs(diff)} hari`;
  if (diff === 1) return 'Jatuh tempo besok';
  return `Jatuh tempo ${formatDateShort(dueDate)}`;
}
