import { describe, expect, it } from 'vitest';
import type { PrayerSettings } from '../types.js';
import { localClockTime } from '../time/timezone.js';
import {
  DEFAULT_PRAYER_SETTINGS,
  PRAYER_LABELS,
  blockForPrayer,
  defaultPrayerSettings,
  derivePrayerBlocks,
  prayerIntervals,
} from './blocks.js';

const JKT = 'Asia/Jakarta';
const settings: PrayerSettings = defaultPrayerSettings('u1');

describe('default prayer settings (§4.8)', () => {
  it('works with no setup: Bandung, Kemenag, 30-minute blocks, all five enabled', () => {
    expect(DEFAULT_PRAYER_SETTINGS).toMatchObject({
      latitude: -6.9175,
      longitude: 107.6191,
      method: 'Kemenag',
      ihtiyatiMin: 2,
      pushToGoogleCalendar: false,
    });
    expect(Object.values(DEFAULT_PRAYER_SETTINGS.perPrayer).every((p) => p.enabled)).toBe(true);
    expect(
      Object.values(DEFAULT_PRAYER_SETTINGS.perPrayer).every((p) => p.durationMin === 30),
    ).toBe(true);
  });
});

describe('derivePrayerBlocks', () => {
  const blocks = derivePrayerBlocks(['2026-08-25'], settings);

  it('produces the five daily blocks in order', () => {
    expect(blocks.map((b) => b.label)).toEqual(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);
  });

  it('lands on plausible Bandung times in the user timezone', () => {
    const clock = Object.fromEntries(blocks.map((b) => [b.label, localClockTime(b.startAt, JKT)]));
    expect(clock).toEqual({
      fajr: '04:37',
      dhuhr: '11:54',
      asr: '15:14',
      maghrib: '17:52',
      isha: '19:02',
    });
  });

  it('gives each block the configured duration', () => {
    for (const block of blocks) {
      expect(new Date(block.endAt).getTime() - new Date(block.startAt).getTime()).toBe(30 * 60_000);
    }
  });

  it('carries the Indonesian name so violation messages can be specific (§5.5)', () => {
    expect(blockForPrayer(blocks, '2026-08-25', 'asr')?.displayName).toBe(PRAYER_LABELS.asr);
  });

  it('is deterministic — same date, same output', () => {
    expect(derivePrayerBlocks(['2026-08-25'], settings)).toEqual(blocks);
  });

  it('honours the ihtiyati margin', () => {
    const noMargin = derivePrayerBlocks(['2026-08-25'], { ...settings, ihtiyatiMin: 0 });
    const dhuhrWith = blockForPrayer(blocks, '2026-08-25', 'dhuhr');
    const dhuhrWithout = blockForPrayer(noMargin, '2026-08-25', 'dhuhr');
    expect(new Date(dhuhrWith!.startAt).getTime() - new Date(dhuhrWithout!.startAt).getTime()).toBe(
      2 * 60_000,
    );
  });

  it('drops prayers turned off in settings', () => {
    const noFajr = derivePrayerBlocks(['2026-08-25'], {
      ...settings,
      perPrayer: { ...settings.perPrayer, fajr: { enabled: false, durationMin: 30 } },
    });
    expect(noFajr.map((b) => b.label)).not.toContain('fajr');
  });

  it('applies a per-date override on top of settings', () => {
    const overridden = derivePrayerBlocks(['2026-08-25', '2026-08-26'], settings, [
      { userId: 'u1', date: '2026-08-25', prayer: 'dhuhr', durationMin: 90 },
      { userId: 'u1', date: '2026-08-25', prayer: 'isha', enabled: false },
    ]);
    const dhuhr = blockForPrayer(overridden, '2026-08-25', 'dhuhr');
    expect(new Date(dhuhr!.endAt).getTime() - new Date(dhuhr!.startAt).getTime()).toBe(90 * 60_000);
    expect(blockForPrayer(overridden, '2026-08-25', 'isha')).toBeNull();
    // The next day is untouched by the override.
    expect(blockForPrayer(overridden, '2026-08-26', 'isha')).not.toBeNull();
  });
});

describe('prayerIntervals', () => {
  it('flattens blocks into merged intervals for the scheduling engine', () => {
    const intervals = prayerIntervals(derivePrayerBlocks(['2026-08-25'], settings));
    expect(intervals).toHaveLength(5);
    expect(intervals[0]).toHaveProperty('startAt');
    expect(intervals[0]).not.toHaveProperty('label');
  });
});
