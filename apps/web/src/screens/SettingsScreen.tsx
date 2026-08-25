/**
 * Setelan (§10.9).
 *
 * M0 shows the state that already exists — availability windows, prayer defaults, pomodoro,
 * Google connection — read-only, plus logout. Editing arrives with the milestone that owns each
 * setting, so nothing here pretends to be adjustable before it is.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DAY_NAMES,
  PRAYER_LABELS,
  PRAYER_ORDER,
  formatTime,
  localDateKey,
  type DayOfWeek,
} from '@foqus/core';
import { ScreenTitle } from '../components/ScreenTitle.js';
import { api } from '../lib/api.js';
import { clearMirror } from '../data/db.js';
import { useDayContext } from '../lib/useDayContext.js';
import { useNow } from '../lib/useNow.js';
import {
  useMirroredAvailability,
  useMirroredPrayerSettings,
  useMirroredSettings,
} from '../lib/queries.js';
import type { SessionUser } from '@foqus/shared';

export function SettingsScreen({ user }: { user: SessionUser | undefined }) {
  const now = useNow();
  const settings = useMirroredSettings();
  const prayerSettings = useMirroredPrayerSettings();
  const windows = useMirroredAvailability();
  const timezone = settings.timezone;
  const queryClient = useQueryClient();

  const day = useDayContext({ now, timezone, windows, prayerSettings });

  const logout = useMutation({
    mutationFn: async () => {
      await api.logout();
      // Wipe the mirror so a different account never inherits this one's data.
      await clearMirror();
      queryClient.clear();
    },
    onSuccess: () => window.location.assign('/'),
  });

  const sortedWindows = [...(windows ?? [])].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime),
  );

  return (
    <div className="pb-10">
      <ScreenTitle sub={user?.email}>Setelan</ScreenTitle>

      <Section title="Koneksi Google">
        <Row label="Status">{user?.googleConnected ? 'Terhubung' : 'Belum terhubung'}</Row>
        <Row label="Kalender agenda">
          {user?.agendaCalendarId ? 'FOQUS — Agenda' : 'Dibuat saat sinkronisasi pertama'}
        </Row>
      </Section>

      <Section title="Jam tersedia">
        {sortedWindows.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">Belum ada jendela.</p>
        ) : (
          sortedWindows.map((window) => (
            <Row key={window.id} label={DAY_NAMES[window.dayOfWeek as DayOfWeek]}>
              <span className="font-mono tabular-nums">
                {window.startTime}–{window.endTime}
              </span>
            </Row>
          ))
        )}
      </Section>

      <Section title={`Waktu sholat · ${localDateKey(now, timezone)}`}>
        {PRAYER_ORDER.map((prayer) => {
          const block = day.prayerBlocks.find((candidate) => candidate.label === prayer);
          const perPrayer = prayerSettings.perPrayer[prayer];
          return (
            <Row key={prayer} label={PRAYER_LABELS[prayer]}>
              {block ? (
                <span className="font-mono tabular-nums">
                  {formatTime(block.startAt, timezone)} · {perPrayer?.durationMin ?? 0} menit
                </span>
              ) : (
                <span className="text-muted">nonaktif</span>
              )}
            </Row>
          );
        })}
        <Row label="Metode">
          {prayerSettings.method} · ihtiyati +{prayerSettings.ihtiyatiMin} menit
        </Row>
      </Section>

      <Section title="Pomodoro">
        <Row label="Fokus">{settings.pomodoro.focusMin} menit</Row>
        <Row label="Jeda pendek">{settings.pomodoro.shortBreakMin} menit</Row>
        <Row label="Jeda panjang">
          {settings.pomodoro.longBreakMin} menit, tiap {settings.pomodoro.longBreakEvery} sesi
        </Row>
      </Section>

      <Section title="Umum">
        <Row label="Zona waktu">{settings.timezone}</Row>
        <Row label="Buffer default">{settings.defaultBufferAfterMin} menit</Row>
        <Row label="Perayaan">{settings.celebration}</Row>
      </Section>

      <div className="px-4 pt-6">
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="min-h-touch w-full rounded-2xl border hairline px-4 text-sm font-semibold disabled:opacity-50"
        >
          {logout.isPending ? 'Keluar…' : 'Keluar'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="px-4 pb-2 font-display text-base font-semibold">{title}</h2>
      <div className="divide-y hairline border-y hairline">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-touch items-center justify-between gap-4 px-4 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
