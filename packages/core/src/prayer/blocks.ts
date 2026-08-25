/**
 * Prayer blocks (§4.8).
 *
 * These are **derived, never stored** — computed locally from `PrayerSettings` with adhan-js,
 * so they work with no network and no rows to migrate. The scheduling engine treats them as
 * soft blocks: `allocate()` must avoid them (§5.4), but a manual placement may override them
 * after a confirmation dialog (D6).
 */

import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan';
import type { ISODate, PrayerName, PrayerOverride, PrayerSettings, TimeZone } from '../types.js';
import type { LabeledInterval } from '../time/interval.js';
import { normalize } from '../time/interval.js';
import { parseDateKey } from '../time/timezone.js';

export const PRAYER_ORDER: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

/** Indonesian display names — the UI language is Bahasa Indonesia (§1). */
export const PRAYER_LABELS: Record<PrayerName, string> = {
  fajr: 'Subuh',
  dhuhr: 'Zuhur',
  asr: 'Ashar',
  maghrib: 'Maghrib',
  isha: 'Isya',
};

/** Kemenag RI parameters: Fajr 20°, Isha 18° (§4.8). */
export const KEMENAG_METHOD = 'Kemenag';

/** Defaults that ship without any setup — this is a product promise (§4.8). */
export const DEFAULT_PRAYER_SETTINGS: Omit<PrayerSettings, 'userId'> = {
  latitude: -6.9175, // Bandung
  longitude: 107.6191,
  method: KEMENAG_METHOD,
  ihtiyatiMin: 2,
  perPrayer: {
    fajr: { enabled: true, durationMin: 30 },
    dhuhr: { enabled: true, durationMin: 30 },
    asr: { enabled: true, durationMin: 30 },
    maghrib: { enabled: true, durationMin: 30 },
    isha: { enabled: true, durationMin: 30 },
  },
  pushToGoogleCalendar: false,
};

function calculationParameters(settings: Pick<PrayerSettings, 'method' | 'ihtiyatiMin'>) {
  const params =
    settings.method === KEMENAG_METHOD
      ? Object.assign(CalculationMethod.Other(), { fajrAngle: 20, ishaAngle: 18 })
      : ((
          CalculationMethod as unknown as Record<
            string,
            () => ReturnType<typeof CalculationMethod.Other>
          >
        )[settings.method]?.() ??
        Object.assign(CalculationMethod.Other(), { fajrAngle: 20, ishaAngle: 18 }));

  // Ihtiyati (safety margin) is applied uniformly as a minute adjustment.
  const shift = settings.ihtiyatiMin;
  params.adjustments = {
    fajr: shift,
    sunrise: shift,
    dhuhr: shift,
    asr: shift,
    maghrib: shift,
    isha: shift,
  };
  return params;
}

export interface PrayerBlock extends LabeledInterval<PrayerName> {
  /** Indonesian name, ready to drop into a violation message ("Menabrak blok Ashar"). */
  displayName: string;
  dateKey: ISODate;
}

function effectiveSetting(
  prayer: PrayerName,
  dateKey: ISODate,
  settings: PrayerSettings,
  overrides: PrayerOverride[],
): { enabled: boolean; durationMin: number } {
  const base = settings.perPrayer[prayer];
  const override = overrides.find((o) => o.date === dateKey && o.prayer === prayer);
  return {
    enabled: override?.enabled ?? base.enabled,
    durationMin: override?.durationMin ?? base.durationMin,
  };
}

/**
 * Blocks for the given local dates.
 *
 * `dateKeys` are the user's local calendar days (§5.9); the astronomical calculation itself is
 * timezone-independent — adhan works from coordinates and the civil date, and returns instants.
 */
export function derivePrayerBlocks(
  dateKeys: ISODate[],
  settings: PrayerSettings,
  overrides: PrayerOverride[] = [],
): PrayerBlock[] {
  const coordinates = new Coordinates(settings.latitude, settings.longitude);
  const params = calculationParameters(settings);
  const blocks: PrayerBlock[] = [];

  for (const dateKey of dateKeys) {
    const { year, month, day } = parseDateKey(dateKey);
    // adhan reads the civil Y/M/D off the Date in the *runtime's* local zone, so build it
    // with the local constructor: the fields round-trip whatever the server's TZ happens to be.
    const civilDate = new Date(year, month - 1, day);
    const times = new PrayerTimes(coordinates, civilDate, params);

    for (const prayer of PRAYER_ORDER) {
      const { enabled, durationMin } = effectiveSetting(prayer, dateKey, settings, overrides);
      if (!enabled || durationMin <= 0) continue;
      const start = times[prayer];
      if (!(start instanceof Date) || Number.isNaN(start.getTime())) continue;
      blocks.push({
        label: prayer,
        displayName: PRAYER_LABELS[prayer],
        dateKey,
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + durationMin * 60_000).toISOString(),
      });
    }
  }

  return blocks.sort((a, b) => a.startAt.localeCompare(b.startAt));
}

/** Prayer blocks flattened into plain intervals, ready for `subtract()` in the engine. */
export function prayerIntervals(blocks: PrayerBlock[]) {
  return normalize(blocks.map(({ startAt, endAt }) => ({ startAt, endAt })));
}

/**
 * Timezone-aware view of a prayer time: what the user reads on the clock.
 * Kept here so the UI never re-derives prayer instants itself.
 */
export function blockForPrayer(blocks: PrayerBlock[], dateKey: ISODate, prayer: PrayerName) {
  return blocks.find((block) => block.dateKey === dateKey && block.label === prayer) ?? null;
}

export function defaultPrayerSettings(userId: string, timezone?: TimeZone): PrayerSettings {
  void timezone; // coordinates, not timezone, drive the calculation
  return { userId, ...DEFAULT_PRAYER_SETTINGS };
}
