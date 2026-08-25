/**
 * Hari Ini (§10.3).
 *
 * M0 stands up the frame and the parts that are already real: the day ribbon with locally
 * computed prayer notches, and the tasks due today that have no agenda yet. The review card
 * (§10.7), the "Berikutnya" card and its focus button land in M7 and M4.
 */

import { PRAYER_LABELS, formatDateLong, formatTime, localDateKey } from '@foqus/core';
import { ScreenTitle } from '../components/ScreenTitle.js';
import { EmptyState } from '../components/EmptyState.js';
import { DayRibbon } from '../components/DayRibbon.js';
import { useDayContext } from '../lib/useDayContext.js';
import { useNow } from '../lib/useNow.js';
import {
  useMirroredAgendas,
  useMirroredAvailability,
  useMirroredCategories,
  useMirroredPomodoroSessions,
  useMirroredPrayerSettings,
  useMirroredSettings,
  useMirroredTasks,
} from '../lib/queries.js';
import { useRibbonAgendas } from '../lib/useRibbonAgendas.js';

export function TodayScreen() {
  const now = useNow();
  const settings = useMirroredSettings();
  const prayerSettings = useMirroredPrayerSettings();
  const windows = useMirroredAvailability();
  const tasks = useMirroredTasks();
  const agendas = useMirroredAgendas();
  const categories = useMirroredCategories();
  const sessions = useMirroredPomodoroSessions();
  const timezone = settings.timezone;

  const day = useDayContext({ now, timezone, windows, prayerSettings });
  const todayKey = localDateKey(now, timezone);
  const ribbonAgendas = useRibbonAgendas({
    dateKey: day.dateKey,
    timezone,
    agendas,
    tasks,
    categories,
    sessions,
  });

  const dueToday = (tasks ?? []).filter(
    (task) =>
      task.status !== 'done' &&
      task.status !== 'archived' &&
      task.dueDate === todayKey &&
      !(agendas ?? []).some((agenda) => agenda.taskId === task.id),
  );

  const nextPrayer = day.prayerBlocks.find((block) => block.startAt > now);

  return (
    <div className="pb-6">
      <ScreenTitle sub={formatDateLong(todayKey)}>Hari Ini</ScreenTitle>

      {nextPrayer && (
        <p className="px-4 pb-4 text-sm text-muted">
          {PRAYER_LABELS[nextPrayer.label]} pukul{' '}
          <span className="font-mono tabular-nums">{formatTime(nextPrayer.startAt, timezone)}</span>
        </p>
      )}

      <DayRibbon
        dateKey={day.dateKey}
        timezone={timezone}
        prayerBlocks={day.prayerBlocks}
        unavailable={day.unavailable}
        agendas={ribbonAgendas}
        now={now}
      />

      <section className="mt-8">
        <h2 className="px-4 pb-3 font-display text-lg font-semibold">Sisa hari ini</h2>
        {dueToday.length === 0 ? (
          <EmptyState
            title="Tidak ada yang menunggu"
            body="Task yang jatuh tempo hari ini dan belum punya slot akan muncul di sini."
          />
        ) : (
          <ul className="divide-y hairline border-y hairline">
            {dueToday.map((task) => (
              <li key={task.id} className="flex min-h-touch items-center gap-3 px-4 py-3">
                <span className="font-mono text-[10px] text-muted">{task.priority}</span>
                <span className="flex-1 text-sm">{task.title}</span>
                <span className="font-mono text-[10px] text-muted">
                  {'○'.repeat(Math.min(task.allocatedPomodoros, 8))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
