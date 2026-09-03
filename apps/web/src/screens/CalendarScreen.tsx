/**
 * Kalender (§10.5) — the planning surface.
 *
 * It opens on the **week**. It used to open on a day ribbon that was all but identical to Hari
 * Ini, so two of the four tabs showed the same thing; the day is now Hari Ini's job, and the
 * calendar answers the question only it can answer — where is there room this week.
 *
 * Day mode still exists, as a destination rather than a duplicate: tapping a column, or a deep
 * link carrying `?tanggal=`, opens it. Keeping the date in the URL is what lets carry mode
 * (§10.2 Jalur B) send the user to a specific day and back again, and it survives a trip to
 * another tab — component state did not.
 *
 * The week grid here is a density read, not yet the full column view of §10.5; placing blocks
 * and moving them is M2.
 */

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  addLocalDays,
  derivePrayerBlocks,
  formatDateLong,
  formatDateShort,
  formatTime,
  localDateKey,
  localTimeOn,
  unavailableIntervals,
  type AvailabilityWindow,
  type ISODate,
  type PrayerSettings,
  type TimeZone,
} from '@foqus/core';
import { DayRibbon } from '../components/DayRibbon.js';
import { ScreenTitle } from '../components/ScreenTitle.js';
import { ConnectionStatus } from '../components/ConnectionStatus.js';
import { EmptyState } from '../components/EmptyState.js';
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

/** Two letters, because Senin, Selasa and Sabtu all start with the same one. */
const DAY_SHORT = ['Mg', 'Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb'];
const TRACK_FROM = '04:00';
const TRACK_TO = '23:00';

export function CalendarScreen() {
  const now = useNow();
  const settings = useMirroredSettings();
  const timezone = settings.timezone;
  const [params, setParams] = useSearchParams();

  const todayKey = localDateKey(now, timezone);
  const dayParam = params.get('tanggal');
  const dateKey = isDateKey(dayParam) ? dayParam : null;

  const setDate = (next: ISODate | null) => {
    const updated = new URLSearchParams(params);
    if (next) updated.set('tanggal', next);
    else updated.delete('tanggal');
    setParams(updated, { replace: true });
  };

  return dateKey ? (
    <DayMode dateKey={dateKey} todayKey={todayKey} timezone={timezone} now={now} onDate={setDate} />
  ) : (
    <WeekMode todayKey={todayKey} timezone={timezone} now={now} onDate={setDate} />
  );
}

/* ------------------------------------------------------------------ week */

function WeekMode({
  todayKey,
  timezone,
  now,
  onDate,
}: {
  todayKey: ISODate;
  timezone: TimeZone;
  now: string;
  onDate: (next: ISODate) => void;
}) {
  const prayerSettings = useMirroredPrayerSettings();
  const windows = useMirroredAvailability();
  const agendas = useMirroredAgendas();
  const tasks = useMirroredTasks();

  // Monday-first, the way a work week is planned.
  const weekStart = useMemo(() => startOfWeek(todayKey), [todayKey]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addLocalDays(weekStart, index)),
    [weekStart],
  );

  const week = useMemo(() => {
    const fullWindows: AvailabilityWindow[] = (windows ?? []).map((window) => ({
      ...window,
      dayOfWeek: window.dayOfWeek as AvailabilityWindow['dayOfWeek'],
      userId: '',
      createdAt: now,
      updatedAt: now,
    }));
    const horizon = {
      from: localTimeOn(days[0] as ISODate, '00:00', timezone).toISOString(),
      to: localTimeOn(days[6] as ISODate, '24:00', timezone).toISOString(),
    };
    const prayerBlocks = derivePrayerBlocks(days as ISODate[], {
      userId: '',
      ...(prayerSettings as Omit<PrayerSettings, 'userId'>),
    });
    const unavailable = unavailableIntervals(fullWindows, horizon, timezone);
    const titles = new Map((tasks ?? []).map((task) => [task.id, task.title]));

    return days.map((day) => ({
      dateKey: day as ISODate,
      prayers: prayerBlocks.filter((block) => localDateKey(block.startAt, timezone) === day),
      unavailable: unavailable.filter(
        (interval) => localDateKey(interval.startAt, timezone) === day,
      ),
      agendas: (agendas ?? [])
        .filter((agenda) => agenda.status !== 'skipped')
        .filter((agenda) => localDateKey(agenda.startAt, timezone) === day)
        .map((agenda) => ({
          id: agenda.id,
          startAt: agenda.startAt,
          endAt: agenda.endAt,
          title: titles.get(agenda.taskId) ?? 'Agenda',
        })),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, timezone, windows, prayerSettings, agendas, tasks]);

  const scheduled = week.reduce((total, day) => total + day.agendas.length, 0);

  return (
    <div className="pb-6">
      <ScreenTitle
        sub={`${formatDateShort(days[0] as ISODate)}–${formatDateShort(days[6] as ISODate)} · ${scheduled} agenda`}
        actions={<ConnectionStatus />}
      >
        Kalender
      </ScreenTitle>

      <div className="flex gap-1 px-4 pb-3">
        {week.map((day) => {
          const isToday = day.dateKey === todayKey;
          return (
            <button
              key={day.dateKey}
              type="button"
              onClick={() => onDate(day.dateKey)}
              aria-label={`Buka ${formatDateLong(day.dateKey)}, ${day.agendas.length} agenda`}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl border px-1 pb-1 pt-2 ${
                isToday ? 'border-tea bg-tea-soft/60' : 'hairline'
              }`}
            >
              <span className="text-label text-muted">{DAY_SHORT[dayIndex(day.dateKey)]}</span>
              <span
                className={`font-mono text-meta tabular-nums ${isToday ? 'font-bold text-tea' : ''}`}
              >
                {day.dateKey.slice(8)}
              </span>
              <DayTrack day={day} timezone={timezone} now={isToday ? now : undefined} />
            </button>
          );
        })}
      </div>

      <p className="px-4 pb-6 text-meta leading-relaxed text-muted">
        Ketuk satu hari untuk membukanya. Kolom gelap adalah agenda, garis ungu waktu sholat, area
        abu di luar jam tersedia.
      </p>

      <h2 className="px-4 pb-2 font-display text-lg font-semibold">Agenda pekan ini</h2>
      {scheduled === 0 ? (
        <EmptyState
          title="Pekan ini masih kosong"
          body="Belum ada satu pun task yang punya slot pekan ini."
        />
      ) : (
        <ul className="divide-y hairline border-y hairline">
          {week.flatMap((day) =>
            day.agendas.map((agenda) => (
              <li key={agenda.id}>
                <button
                  type="button"
                  onClick={() => onDate(day.dateKey)}
                  className="flex min-h-touch w-full items-center gap-3 px-4 py-2 text-left"
                >
                  <span className="w-16 shrink-0 font-mono text-label text-muted tabular-nums">
                    {DAY_SHORT[dayIndex(day.dateKey)]} {day.dateKey.slice(8)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{agenda.title}</span>
                  <span className="shrink-0 font-mono text-label text-muted tabular-nums">
                    {formatTime(agenda.startAt, timezone)}
                  </span>
                </button>
              </li>
            )),
          )}
        </ul>
      )}
    </div>
  );
}

/** A day as a 19-hour vertical track: enough to read where the day is full, and where it is not. */
function DayTrack({
  day,
  timezone,
  now,
}: {
  day: {
    dateKey: ISODate;
    prayers: { startAt: string; label: string }[];
    unavailable: { startAt: string; endAt: string }[];
    agendas: { id: string; startAt: string; endAt: string }[];
  };
  timezone: TimeZone;
  now?: string;
}) {
  const start = localTimeOn(day.dateKey, TRACK_FROM, timezone).getTime();
  const end = localTimeOn(day.dateKey, TRACK_TO, timezone).getTime();
  const span = Math.max(1, end - start);
  const pct = (instant: string) =>
    Math.min(100, Math.max(0, ((new Date(instant).getTime() - start) / span) * 100));

  return (
    <span className="relative block h-40 w-full overflow-hidden rounded-md surface-raised">
      {day.unavailable.map((interval) => (
        <span
          key={`off-${interval.startAt}`}
          className="absolute inset-x-0 bg-mist/25"
          style={{
            top: `${pct(interval.startAt)}%`,
            height: `${pct(interval.endAt) - pct(interval.startAt)}%`,
          }}
        />
      ))}
      {day.prayers.map((prayer) => (
        <span
          key={`p-${prayer.label}`}
          className="absolute inset-x-0 h-px bg-dusk/70"
          style={{ top: `${pct(prayer.startAt)}%` }}
        />
      ))}
      {day.agendas.map((agenda) => (
        <span
          key={agenda.id}
          className="absolute inset-x-[2px] rounded-sm bg-tea"
          style={{
            top: `${pct(agenda.startAt)}%`,
            // A short agenda still has to be visible at this scale.
            height: `max(3px, ${pct(agenda.endAt) - pct(agenda.startAt)}%)`,
          }}
        />
      ))}
      {now && <span className="absolute inset-x-0 h-px bg-ember" style={{ top: `${pct(now)}%` }} />}
    </span>
  );
}

/* ------------------------------------------------------------------- day */

function DayMode({
  dateKey,
  todayKey,
  timezone,
  now,
  onDate,
}: {
  dateKey: ISODate;
  todayKey: ISODate;
  timezone: TimeZone;
  now: string;
  onDate: (next: ISODate | null) => void;
}) {
  const prayerSettings = useMirroredPrayerSettings();
  const windows = useMirroredAvailability();
  const agendas = useMirroredAgendas();
  const tasks = useMirroredTasks();
  const categories = useMirroredCategories();
  const sessions = useMirroredPomodoroSessions();

  const day = useDayContext({ now, timezone, windows, prayerSettings, dateKey });
  const ribbonAgendas = useRibbonAgendas({
    dateKey,
    timezone,
    agendas,
    tasks,
    categories,
    sessions,
  });

  return (
    <div className="pb-6">
      <ScreenTitle sub={formatDateLong(dateKey)} actions={<ConnectionStatus />}>
        Kalender
      </ScreenTitle>

      <div className="flex items-center gap-1 px-4 pb-3">
        <button
          type="button"
          onClick={() => onDate(null)}
          className="flex min-h-touch items-center rounded-xl border hairline px-3 text-meta font-medium"
        >
          ‹ Pekan
        </button>
        <div className="flex-1" />
        <ArrowButton label="Hari sebelumnya" onClick={() => onDate(addLocalDays(dateKey, -1))}>
          ‹
        </ArrowButton>
        {/*
         * Without this, wandering six days out cost six taps to come back — a plain dead end
         * in a screen whose whole job is orientation.
         */}
        <button
          type="button"
          onClick={() => onDate(todayKey)}
          disabled={dateKey === todayKey}
          className="flex min-h-touch items-center rounded-xl border hairline px-3 text-meta font-medium disabled:opacity-40"
        >
          Hari ini
        </button>
        <ArrowButton label="Hari berikutnya" onClick={() => onDate(addLocalDays(dateKey, 1))}>
          ›
        </ArrowButton>
      </div>

      <DayRibbon
        dateKey={day.dateKey}
        timezone={timezone}
        prayerBlocks={day.prayerBlocks}
        unavailable={day.unavailable}
        agendas={ribbonAgendas}
        now={now}
        maxHeight="64vh"
      />

      <p className="px-4 pt-4 text-meta leading-relaxed text-muted">
        Memberi slot pada task langsung dari kalender belum tersedia. Untuk sekarang kalender
        menampilkan hari apa adanya.
      </p>
    </div>
  );
}

function ArrowButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-touch w-touch items-center justify-center rounded-xl border hairline text-lg"
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------- utils */

function isDateKey(value: string | null): value is ISODate {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dayIndex(dateKey: ISODate): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay();
}

/** Monday-first week start, computed on the date key so no timezone maths is duplicated. */
function startOfWeek(dateKey: ISODate): ISODate {
  const offset = (dayIndex(dateKey) + 6) % 7;
  return addLocalDays(dateKey, -offset);
}
