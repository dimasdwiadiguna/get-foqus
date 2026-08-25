/**
 * Reserved spans (§4.4).
 *
 * An agenda occupies more clock time than it shows: `[startAt - bufferBefore, endAt + bufferAfter]`.
 * The scheduling engine treats that whole span as taken. Buffers are an internal concept and are
 * deliberately **not** sent to Google Calendar — the GCal event is only `[startAt, endAt]` (§7).
 */

import type { Agenda } from '../types.js';
import type { Interval } from '../time/interval.js';
import { normalize } from '../time/interval.js';

export function reservedSpan(
  agenda: Pick<Agenda, 'startAt' | 'endAt' | 'bufferBeforeMin' | 'bufferAfterMin'>,
): Interval {
  return {
    startAt: new Date(
      new Date(agenda.startAt).getTime() - agenda.bufferBeforeMin * 60_000,
    ).toISOString(),
    endAt: new Date(
      new Date(agenda.endAt).getTime() + agenda.bufferAfterMin * 60_000,
    ).toISOString(),
  };
}

/** What the calendar actually publishes for an agenda — no buffer (§4.4, §7). */
export function visibleSpan(agenda: Pick<Agenda, 'startAt' | 'endAt'>): Interval {
  return { startAt: agenda.startAt, endAt: agenda.endAt };
}

export interface ReservedSpanOptions {
  /** Skip this agenda — used when moving an agenda so it does not collide with itself. */
  excludeAgendaId?: string;
}

export function reservedSpans(agendas: Agenda[], options: ReservedSpanOptions = {}): Interval[] {
  return normalize(
    agendas
      .filter((agenda) => !agenda.deletedAt)
      .filter((agenda) => agenda.status !== 'skipped')
      .filter((agenda) => agenda.id !== options.excludeAgendaId)
      .map(reservedSpan),
  );
}

/**
 * Minutes a task of `pomodoros` length occupies, excluding buffer (§6.4):
 * n focus blocks with (n-1) short breaks between them.
 */
export function focusDurationMin(
  pomodoros: number,
  pomodoroSettings: { focusMin: number; shortBreakMin: number },
): number {
  const count = Math.max(1, Math.floor(pomodoros));
  return count * pomodoroSettings.focusMin + (count - 1) * pomodoroSettings.shortBreakMin;
}

/** Focus duration plus the trailing buffer the engine must reserve (§6.4). */
export function reservedDurationMin(
  pomodoros: number,
  pomodoroSettings: { focusMin: number; shortBreakMin: number },
  bufferAfterMin: number,
  bufferBeforeMin = 0,
): number {
  return focusDurationMin(pomodoros, pomodoroSettings) + bufferAfterMin + bufferBeforeMin;
}
