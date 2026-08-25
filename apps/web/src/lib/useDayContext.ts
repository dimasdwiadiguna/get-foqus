/**
 * Everything a day view needs, derived on the client.
 *
 * Prayer blocks are computed locally with adhan-js each time (§4.8) — no network, no rows. The
 * availability expansion and the ribbon's dimmed regions come from `@foqus/core`, so the client
 * never reimplements a scheduling rule (§3).
 */

import { useMemo } from 'react';
import {
  derivePrayerBlocks,
  localDateKey,
  localTimeOn,
  unavailableIntervals,
  type AvailabilityWindow,
  type ISODate,
  type PrayerSettings,
  type TimeZone,
} from '@foqus/core';
import type { AvailabilityWindowDto, PrayerSettingsDto } from '@foqus/shared';

export interface DayContext {
  dateKey: ISODate;
  prayerBlocks: ReturnType<typeof derivePrayerBlocks>;
  unavailable: ReturnType<typeof unavailableIntervals>;
}

export function useDayContext(options: {
  now: string;
  timezone: TimeZone;
  windows: AvailabilityWindowDto[] | undefined;
  prayerSettings: PrayerSettingsDto;
  dateKey?: ISODate;
}): DayContext {
  const { now, timezone, windows, prayerSettings } = options;
  const dateKey = options.dateKey ?? localDateKey(now, timezone);

  return useMemo(() => {
    const fullWindows: AvailabilityWindow[] = (windows ?? []).map((window) => ({
      ...window,
      dayOfWeek: window.dayOfWeek as AvailabilityWindow['dayOfWeek'],
      userId: '',
      createdAt: now,
      updatedAt: now,
    }));

    const horizon = {
      from: localTimeOn(dateKey, '00:00', timezone).toISOString(),
      to: localTimeOn(dateKey, '24:00', timezone).toISOString(),
    };

    return {
      dateKey,
      prayerBlocks: derivePrayerBlocks([dateKey], {
        userId: '',
        ...(prayerSettings as Omit<PrayerSettings, 'userId'>),
      }),
      unavailable: unavailableIntervals(fullWindows, horizon, timezone),
    };
    // `now` only participates through `dateKey`; recomputing every tick would be wasteful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, timezone, windows, prayerSettings]);
}
