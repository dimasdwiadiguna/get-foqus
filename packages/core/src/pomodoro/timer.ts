/**
 * Pomodoro timer maths (D9, §9).
 *
 * The timer is **derived from timestamps**, never accumulated from `setInterval`. A phone that
 * locks its screen throttles or suspends JS timers; the only number that survives that is
 * `startedAt`. Everything here is a pure function of `(session, now)`, which is also what makes
 * the resume path in §9 ("app comes back, session already over") a one-liner for the UI.
 */

import type { ISODateTime, PomodoroKind, PomodoroSettings, PomodoroSession } from '../types.js';

export interface RunningSession {
  startedAt: ISODateTime;
  plannedSec: number;
  kind: PomodoroKind;
  /** Total seconds spent paused so far. Pausing shifts the finish line, it does not stop clocks. */
  pausedSec?: number;
  /** When set, the session is paused as of this instant. */
  pausedAt?: ISODateTime | null;
}

export function elapsedSec(session: RunningSession, now: ISODateTime): number {
  const start = new Date(session.startedAt).getTime();
  const reference = session.pausedAt
    ? new Date(session.pausedAt).getTime()
    : new Date(now).getTime();
  const raw = (reference - start) / 1000 - (session.pausedSec ?? 0);
  return Math.max(0, raw);
}

export function remainingSec(session: RunningSession, now: ISODateTime): number {
  return Math.max(0, session.plannedSec - elapsedSec(session, now));
}

/** True once the planned duration has passed — the check run on `visibilitychange` (§9). */
export function isFinished(session: RunningSession, now: ISODateTime): boolean {
  return remainingSec(session, now) <= 0;
}

/** The instant the session is due to end, so the UI can schedule a single `setTimeout`. */
export function finishesAt(session: RunningSession, now: ISODateTime): ISODateTime {
  return new Date(new Date(now).getTime() + remainingSec(session, now) * 1000).toISOString();
}

/** `25:00` — the big timer readout, rendered in Martian Mono (§11). */
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function plannedSecFor(kind: PomodoroKind, settings: PomodoroSettings): number {
  if (kind === 'focus') return settings.focusMin * 60;
  if (kind === 'short_break') return settings.shortBreakMin * 60;
  return settings.longBreakMin * 60;
}

/**
 * What comes after a finished session.
 * `completedFocusCount` is the number of *completed* focus sessions including the one just done.
 */
export function nextSessionKind(
  justFinished: PomodoroKind,
  completedFocusCount: number,
  settings: PomodoroSettings,
): PomodoroKind {
  if (justFinished !== 'focus') return 'focus';
  const every = Math.max(1, settings.longBreakEvery);
  return completedFocusCount % every === 0 ? 'long_break' : 'short_break';
}

export interface PomodoroProgress {
  /** Circles the task budgeted for (`allocatedPomodoros`) — rendered as ○ (§4.5). */
  allocated: number;
  /** Completed focus sessions — rendered as ● (§4.5). */
  completed: number;
  /** Sessions beyond the allocation — rendered as ⬤ with a ring, never as a failure (§4.5). */
  overflow: number;
}

export function pomodoroProgress(
  allocated: number,
  completedFocusSessions: number,
): PomodoroProgress {
  const budget = Math.max(0, Math.floor(allocated));
  const done = Math.max(0, Math.floor(completedFocusSessions));
  return {
    allocated: budget,
    completed: Math.min(done, budget),
    overflow: Math.max(0, done - budget),
  };
}

/** Completed focus sessions for a task (or agenda) — `PomodoroSession` is append-only (§4.5). */
export function countCompletedFocus(
  sessions: Pick<PomodoroSession, 'kind' | 'outcome' | 'taskId' | 'agendaId'>[],
  scope: { taskId?: string; agendaId?: string },
): number {
  return sessions.filter((session) => {
    if (session.kind !== 'focus' || session.outcome !== 'completed') return false;
    if (scope.agendaId !== undefined && session.agendaId !== scope.agendaId) return false;
    if (scope.taskId !== undefined && session.taskId !== scope.taskId) return false;
    return true;
  }).length;
}
