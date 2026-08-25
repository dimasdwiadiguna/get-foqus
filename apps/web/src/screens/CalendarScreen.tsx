/**
 * Kalender (§10.5).
 *
 * M0: the day view with its overlays — availability, prayer blocks — and arrow navigation
 * between days. Week mode, carry mode (§10.2 Jalur B), block dragging and the override sheet
 * are M2. The header arrows exist from day one because every gesture must have a tap
 * equivalent (§10.10).
 */

import { useState } from 'react';
import { addLocalDays, formatDateLong, localDateKey } from '@foqus/core';
import { DayRibbon } from '../components/DayRibbon.js';
import { ScreenTitle } from '../components/ScreenTitle.js';
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

export function CalendarScreen() {
  const now = useNow();
  const settings = useMirroredSettings();
  const prayerSettings = useMirroredPrayerSettings();
  const windows = useMirroredAvailability();
  const timezone = settings.timezone;

  const agendas = useMirroredAgendas();
  const tasks = useMirroredTasks();
  const categories = useMirroredCategories();
  const sessions = useMirroredPomodoroSessions();

  const [dateKey, setDateKey] = useState(() => localDateKey(now, timezone));
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
      <div className="flex items-end justify-between">
        <ScreenTitle sub={formatDateLong(dateKey)}>Kalender</ScreenTitle>
        <div className="flex gap-1 px-4 pb-2">
          <ArrowButton
            label="Hari sebelumnya"
            onClick={() => setDateKey(addLocalDays(dateKey, -1))}
          >
            ‹
          </ArrowButton>
          <ArrowButton label="Hari berikutnya" onClick={() => setDateKey(addLocalDays(dateKey, 1))}>
            ›
          </ArrowButton>
        </div>
      </div>

      <DayRibbon
        dateKey={day.dateKey}
        timezone={timezone}
        prayerBlocks={day.prayerBlocks}
        unavailable={day.unavailable}
        agendas={ribbonAgendas}
        now={now}
      />

      <p className="px-4 pt-6 text-xs leading-relaxed text-muted">
        Area redup di luar jam tersedia, blok ungu waktu sholat. Menjadwalkan task lewat slot usulan
        dan mode bawa masuk di milestone berikutnya.
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
