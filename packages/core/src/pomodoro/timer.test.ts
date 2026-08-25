import { describe, expect, it } from 'vitest';
import type { PomodoroSettings } from '../types.js';
import {
  countCompletedFocus,
  elapsedSec,
  finishesAt,
  formatCountdown,
  isFinished,
  nextSessionKind,
  plannedSecFor,
  pomodoroProgress,
  remainingSec,
} from './timer.js';

const settings: PomodoroSettings = {
  focusMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longBreakEvery: 4,
  tickingSound: true,
  bellSound: true,
  autoStartBreak: true,
};

const session = {
  startedAt: '2026-08-25T02:00:00.000Z',
  plannedSec: 25 * 60,
  kind: 'focus' as const,
};

describe('timestamp-based timer (D9)', () => {
  it('derives elapsed time from the clock, not from ticks', () => {
    expect(elapsedSec(session, '2026-08-25T02:10:00.000Z')).toBe(600);
    expect(remainingSec(session, '2026-08-25T02:10:00.000Z')).toBe(900);
  });

  it('reports a session finished after the screen was locked past the deadline', () => {
    // The M4 DoD: start, lock for 26 minutes, reopen — no drift.
    expect(isFinished(session, '2026-08-25T02:26:00.000Z')).toBe(true);
    expect(remainingSec(session, '2026-08-25T02:26:00.000Z')).toBe(0);
  });

  it('excludes paused time from elapsed', () => {
    const paused = { ...session, pausedSec: 120 };
    expect(elapsedSec(paused, '2026-08-25T02:10:00.000Z')).toBe(480);
  });

  it('freezes the clock while paused', () => {
    const paused = { ...session, pausedAt: '2026-08-25T02:05:00.000Z' };
    expect(elapsedSec(paused, '2026-08-25T02:20:00.000Z')).toBe(300);
  });

  it('reports the finish instant so the UI can arm one timeout', () => {
    expect(finishesAt(session, '2026-08-25T02:10:00.000Z')).toBe('2026-08-25T02:25:00.000Z');
  });
});

describe('session sequencing', () => {
  it('uses settings for planned duration', () => {
    expect(plannedSecFor('focus', settings)).toBe(1500);
    expect(plannedSecFor('long_break', settings)).toBe(900);
  });

  it('inserts a long break every fourth focus session', () => {
    expect(nextSessionKind('focus', 1, settings)).toBe('short_break');
    expect(nextSessionKind('focus', 4, settings)).toBe('long_break');
    expect(nextSessionKind('short_break', 4, settings)).toBe('focus');
  });
});

describe('progress symbols (§4.5)', () => {
  it('splits completed sessions into filled circles and overflow', () => {
    expect(pomodoroProgress(3, 2)).toEqual({ allocated: 3, completed: 2, overflow: 0 });
    expect(pomodoroProgress(3, 5)).toEqual({ allocated: 3, completed: 3, overflow: 2 });
  });

  it('counts only completed focus sessions in scope', () => {
    const sessions = [
      { kind: 'focus' as const, outcome: 'completed' as const, taskId: 't1', agendaId: 'a1' },
      { kind: 'focus' as const, outcome: 'abandoned' as const, taskId: 't1', agendaId: 'a1' },
      { kind: 'short_break' as const, outcome: 'completed' as const, taskId: 't1', agendaId: 'a1' },
      { kind: 'focus' as const, outcome: 'completed' as const, taskId: 't2', agendaId: 'a2' },
    ];
    expect(countCompletedFocus(sessions, { taskId: 't1' })).toBe(1);
    expect(countCompletedFocus(sessions, { agendaId: 'a2' })).toBe(1);
  });
});

describe('formatCountdown', () => {
  it('renders mm:ss', () => {
    expect(formatCountdown(1500)).toBe('25:00');
    expect(formatCountdown(65)).toBe('01:05');
    expect(formatCountdown(0)).toBe('00:00');
  });
});
