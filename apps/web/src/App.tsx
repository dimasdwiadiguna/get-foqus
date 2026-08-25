/**
 * App shell.
 *
 * One decision drives the structure: FOQUS reads from the Dexie mirror first and revalidates
 * (§8). So the shell renders as soon as the mirror answers, and the bootstrap query only ever
 * updates it — a slow network delays fresh data, never the first paint.
 */

import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { AppHeader } from './components/AppHeader.js';
import { BottomTabs } from './components/BottomTabs.js';
import { UnauthenticatedError } from './lib/api.js';
import { useBootstrap } from './lib/queries.js';
import { CalendarScreen } from './screens/CalendarScreen.js';
import { LoginScreen } from './screens/LoginScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { TasksScreen } from './screens/TasksScreen.js';
import { TodayScreen } from './screens/TodayScreen.js';

const OAUTH_ERRORS: Record<string, string> = {
  access_denied: 'Akses ditolak. FOQUS butuh izin kalender untuk menulis agenda.',
};

export function App() {
  const [searchParams] = useSearchParams();
  const bootstrap = useBootstrap();

  const oauthError = searchParams.get('error');
  const loginError = oauthError
    ? (OAUTH_ERRORS[oauthError] ?? 'Login Google gagal. Coba lagi.')
    : null;

  if (bootstrap.error instanceof UnauthenticatedError || (oauthError && !bootstrap.data)) {
    return <LoginScreen error={loginError} />;
  }

  if (bootstrap.isPending && !bootstrap.data) {
    return <SplashScreen />;
  }

  if (bootstrap.error && !bootstrap.data) {
    return (
      <main className="surface flex min-h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="font-display text-lg font-semibold">Tidak bisa memuat data</p>
        <p className="text-sm text-muted">{bootstrap.error.message}</p>
        <button
          type="button"
          onClick={() => bootstrap.refetch()}
          className="min-h-touch rounded-2xl bg-tea px-6 text-sm font-semibold text-paper"
        >
          Coba lagi
        </button>
      </main>
    );
  }

  return (
    <div className="surface flex min-h-full flex-col">
      <AppHeader pendingCount={bootstrap.data?.pendingSyncCount ?? 0} />
      <main className="mx-auto w-full max-w-2xl flex-1">
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/tugas" element={<TasksScreen />} />
          <Route path="/kalender" element={<CalendarScreen />} />
          <Route path="/setelan" element={<SettingsScreen user={bootstrap.data?.user} />} />
          <Route path="/masuk" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomTabs />
    </div>
  );
}

function SplashScreen() {
  return (
    <main className="surface flex min-h-full items-center justify-center">
      <span className="sr-only">Memuat FOQUS…</span>
      <span className="h-2 w-2 animate-pulse rounded-full bg-tea" aria-hidden="true" />
    </main>
  );
}
