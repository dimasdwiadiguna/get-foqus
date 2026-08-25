/**
 * Shapes mirrored agendas into what the day ribbon draws, for one local day.
 *
 * Pomodoro counts come from the mirrored append-only session log (§4.5), counted by
 * `@foqus/core` so the ○/● rule lives in exactly one place.
 */

import { useMemo } from 'react';
import { countCompletedFocus, localDateKey, type ISODate, type TimeZone } from '@foqus/core';
import type { AgendaDto, PomodoroSessionDto, TaskDto, CategoryDto } from '@foqus/shared';
import type { RibbonAgenda } from '../components/DayRibbon.js';

export function useRibbonAgendas(options: {
  dateKey: ISODate;
  timezone: TimeZone;
  agendas: AgendaDto[] | undefined;
  tasks: TaskDto[] | undefined;
  categories: CategoryDto[] | undefined;
  sessions?: PomodoroSessionDto[] | undefined;
}): RibbonAgenda[] {
  const { dateKey, timezone, agendas, tasks, categories, sessions } = options;

  return useMemo(() => {
    const tasksById = new Map((tasks ?? []).map((task) => [task.id, task]));
    const categoriesById = new Map((categories ?? []).map((category) => [category.id, category]));

    return (agendas ?? [])
      .filter((agenda) => agenda.status !== 'skipped')
      .filter((agenda) => localDateKey(agenda.startAt, timezone) === dateKey)
      .map((agenda) => {
        const task = tasksById.get(agenda.taskId);
        const category = task?.categoryId ? categoriesById.get(task.categoryId) : undefined;
        return {
          id: agenda.id,
          title: task?.title ?? 'Agenda',
          startAt: agenda.startAt,
          endAt: agenda.endAt,
          bufferBeforeMin: agenda.bufferBeforeMin,
          bufferAfterMin: agenda.bufferAfterMin,
          colorHex: category?.colorHex,
          allocatedPomodoros: task?.allocatedPomodoros ?? 1,
          completedPomodoros: countCompletedFocus(sessions ?? [], { agendaId: agenda.id }),
        };
      });
  }, [dateKey, timezone, agendas, tasks, categories, sessions]);
}
