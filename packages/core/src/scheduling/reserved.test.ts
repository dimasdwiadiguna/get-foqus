import { describe, expect, it } from 'vitest';
import type { Agenda } from '../types.js';
import {
  focusDurationMin,
  reservedDurationMin,
  reservedSpan,
  reservedSpans,
  visibleSpan,
} from './reserved.js';

const agenda = (over: Partial<Agenda> = {}): Agenda => ({
  id: 'a1',
  userId: 'u1',
  taskId: 't1',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  startAt: '2026-08-25T02:00:00.000Z',
  endAt: '2026-08-25T03:00:00.000Z',
  bufferBeforeMin: 0,
  bufferAfterMin: 10,
  status: 'planned',
  syncState: 'pending',
  ...over,
});

describe('reservedSpan (§4.4)', () => {
  it('extends the agenda by its buffers on both sides', () => {
    expect(reservedSpan(agenda({ bufferBeforeMin: 15 }))).toEqual({
      startAt: '2026-08-25T01:45:00.000Z',
      endAt: '2026-08-25T03:10:00.000Z',
    });
  });

  it('keeps the calendar-visible span free of buffer', () => {
    expect(visibleSpan(agenda({ bufferBeforeMin: 15 }))).toEqual({
      startAt: '2026-08-25T02:00:00.000Z',
      endAt: '2026-08-25T03:00:00.000Z',
    });
  });
});

describe('reservedSpans', () => {
  it('ignores deleted and skipped agendas, and the one being moved', () => {
    const list = [
      agenda({ id: 'keep' }),
      agenda({ id: 'gone', deletedAt: '2026-08-02T00:00:00.000Z' }),
      agenda({ id: 'skipped', status: 'skipped' }),
      agenda({ id: 'moving' }),
    ];
    expect(reservedSpans(list, { excludeAgendaId: 'moving' })).toEqual([
      { startAt: '2026-08-25T02:00:00.000Z', endAt: '2026-08-25T03:10:00.000Z' },
    ]);
  });
});

describe('duration maths (§6.4)', () => {
  const pomodoro = { focusMin: 25, shortBreakMin: 5 };

  it('counts breaks only between focus blocks', () => {
    expect(focusDurationMin(1, pomodoro)).toBe(25);
    expect(focusDurationMin(4, pomodoro)).toBe(115);
  });

  it('adds buffer on top for the reservation', () => {
    expect(reservedDurationMin(2, pomodoro, 10)).toBe(65);
    expect(reservedDurationMin(2, pomodoro, 10, 15)).toBe(80);
  });
});
