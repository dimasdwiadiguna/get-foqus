import { describe, expect, it } from 'vitest';
import {
  formatDateLong,
  formatDateShort,
  formatDuration,
  formatRelativeDay,
  formatTimeRange,
  joinList,
} from './id.js';

const JKT = 'Asia/Jakarta';

describe('Indonesian formatting', () => {
  it('renders time ranges in the user timezone with an en dash', () => {
    expect(formatTimeRange('2026-08-25T02:00:00.000Z', '2026-08-25T03:40:00.000Z', JKT)).toBe(
      '09:00–10:40',
    );
  });

  it('formats dates from a date-only key without a timezone shift', () => {
    expect(formatDateShort('2026-08-25')).toBe('25 Agu');
    expect(formatDateLong('2026-08-25')).toBe('Selasa, 25 Agustus 2026');
  });

  it('formats durations the way the UI reads them', () => {
    expect(formatDuration(40)).toBe('40 menit');
    expect(formatDuration(120)).toBe('2 jam');
    expect(formatDuration(100)).toBe('1 jam 40 menit');
  });

  it('uses relative day words for the near future', () => {
    const now = '2026-08-25T02:00:00.000Z'; // Tuesday 09:00 Jakarta
    expect(formatRelativeDay('2026-08-25T08:00:00.000Z', now, JKT)).toBe('hari ini');
    expect(formatRelativeDay('2026-08-26T02:00:00.000Z', now, JKT)).toBe('besok');
    expect(formatRelativeDay('2026-08-28T02:00:00.000Z', now, JKT)).toBe('Jumat 28 Agu');
  });

  it('joins lists with "dan"', () => {
    expect(joinList(['Subuh'])).toBe('Subuh');
    expect(joinList(['Subuh', 'Zuhur', 'Ashar'])).toBe('Subuh, Zuhur dan Ashar');
  });
});
