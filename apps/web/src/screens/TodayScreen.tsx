/**
 * Hari Ini (§10.3) — the only surface that speaks about *today*.
 *
 * Since the calendar tab now opens on the week, this screen owns the day ribbon outright; the
 * two no longer render the same thing under different names.
 *
 * M0 stands up the frame and the parts that are already real: the ribbon with locally computed
 * prayer notches, the next agenda, and everything due that has no slot yet. The review card
 * (§10.7) and the "Mulai fokus" button (M4) are not here, because they are not built yet.
 */

import {
  PRAYER_LABELS,
  describeDueDate,
  formatDateLong,
  formatDuration,
  formatTime,
  localDateKey,
} from '@foqus/core';
import { ScreenTitle } from '../components/ScreenTitle.js';
import { ConnectionStatus } from '../components/ConnectionStatus.js';
import { EmptyState } from '../components/EmptyState.js';
import { DayRibbon } from '../components/DayRibbon.js';
import { PomodoroDots } from '../components/PomodoroDots.js';
import { PriorityBar } from '../components/PriorityBar.js';
import { Wordmark } from '../components/Wordmark.js';
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

  /**
   * Everything due today **or earlier** that still has no slot.
   *
   * The earlier filter matched today's date exactly, so a task whose deadline slipped past
   * simply vanished from the screen that is supposed to catch it — the worst possible failure
   * for a day that misses often (§1). Overdue items are marked, not scolded, and sorted first.
   */
  const waiting = (tasks ?? [])
    .filter(
      (task) =>
        task.status !== 'done' &&
        task.status !== 'archived' &&
        task.dueDate !== undefined &&
        task.dueDate !== null &&
        task.dueDate <= todayKey &&
        !(agendas ?? []).some((agenda) => agenda.taskId === task.id),
    )
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));

  const nextPrayer = day.prayerBlocks.find((block) => block.startAt > now);
  const nextAgenda = ribbonAgendas.find((agenda) => agenda.endAt > now);

  return (
    <div className="pb-6">
      <ScreenTitle
        eyebrow={<Wordmark className="text-label text-muted" />}
        sub={formatDateLong(todayKey)}
        actions={<ConnectionStatus />}
      >
        Hari Ini
      </ScreenTitle>

      {nextPrayer && (
        <p className="px-4 pb-3 text-meta text-muted">
          {PRAYER_LABELS[nextPrayer.label]} pukul{' '}
          <span className="font-mono tabular-nums">{formatTime(nextPrayer.startAt, timezone)}</span>
        </p>
      )}

      {nextAgenda && (
        <section className="px-4 pb-4">
          <h2 className="pb-2 font-display text-base font-semibold">Berikutnya</h2>
          <div className="rounded-2xl border hairline surface-raised p-4">
            <p className="font-display text-lg font-semibold">{nextAgenda.title}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-meta text-muted">
              <span className="font-mono tabular-nums">
                {formatTime(nextAgenda.startAt, timezone)}–{formatTime(nextAgenda.endAt, timezone)}
              </span>
              <span>
                ·{' '}
                {formatDuration(
                  (new Date(nextAgenda.endAt).getTime() - new Date(nextAgenda.startAt).getTime()) /
                    60_000,
                )}
              </span>
              <PomodoroDots
                allocated={nextAgenda.allocatedPomodoros}
                completed={nextAgenda.completedPomodoros}
              />
            </p>
            {/* No "Mulai fokus" button yet: the focus screen is M4, and a button that does
                nothing is worse than an honest absence (DECISIONS U1). */}
          </div>
        </section>
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
        {waiting.length === 0 ? (
          <EmptyState
            title="Tidak ada yang menunggu"
            body="Task yang jatuh tempo hari ini dan belum punya slot akan muncul di sini."
          />
        ) : (
          <ul className="divide-y hairline border-y hairline">
            {waiting.map((task) => {
              const overdue = (task.dueDate ?? todayKey) < todayKey;
              return (
                <li
                  key={task.id}
                  className="relative flex min-h-touch items-center gap-3 px-4 py-3"
                >
                  <PriorityBar priority={task.priority} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{task.title}</p>
                    {task.dueDate && (
                      <p className={`text-label ${overdue ? 'text-ember' : 'text-muted'}`}>
                        {describeDueDate(task.dueDate, todayKey)}
                      </p>
                    )}
                  </div>
                  <PomodoroDots allocated={task.allocatedPomodoros} className="text-muted" />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
