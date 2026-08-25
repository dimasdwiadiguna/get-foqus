import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AVAILABILITY,
  defaultSettings,
  MAX_OUTBOX_ATTEMPTS,
  outboxBackoffMs,
} from './defaults.js';

describe('seed defaults', () => {
  it('covers all seven days (§4.6)', () => {
    expect(new Set(DEFAULT_AVAILABILITY.map((w) => w.dayOfWeek)).size).toBe(7);
    expect(DEFAULT_AVAILABILITY.filter((w) => w.startTime === '04:00')).toHaveLength(5);
  });

  it('ships the settings from §4.10', () => {
    const settings = defaultSettings('u1');
    expect(settings).toMatchObject({
      timezone: 'Asia/Jakarta',
      defaultBufferAfterMin: 10,
      celebration: 'full',
    });
    expect(settings.pomodoro.focusMin).toBe(25);
  });
});

describe('outbox backoff (§7)', () => {
  it('grows exponentially and stops climbing after the attempt cap', () => {
    const delays = [1, 2, 3, 4, 5].map(outboxBackoffMs);
    expect(delays).toEqual([30_000, 60_000, 120_000, 240_000, 480_000]);
    expect(outboxBackoffMs(MAX_OUTBOX_ATTEMPTS + 3)).toBe(480_000);
  });
});
