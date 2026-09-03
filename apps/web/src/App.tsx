/**
 * App shell.
 *
 * One decision drives the structure: FOQUS reads from the Dexie mirror first and revalidates
 * (§8). So the shell renders as soon as the mirror answers, and the bootstrap query only ever
 * updates it — a slow network delays fresh data, never the first paint.
 */

import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { BottomTabs } from './components/BottomTabs.js';
import { ApiError, UnauthenticatedError } from './lib/api.js';
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
        {bootstrap.error instanceof ApiError && (
          // The status and code tell a platform failure apart from an application one:
          // `FUNCTION_INVOCATION_FAILED` means the serverless function never booted, while a
          // FOQUS-authored message means it booted and something inside it went wrong
          // (DECISIONS T18). Diagnostic, so it stays — folded away, so it is not the first
          // thing the screen says.
          <details className="text-label text-muted">
            <summary className="cursor-pointer">Detail teknis</summary>
            <p className="mt-2 font-mono">
              HTTP {bootstrap.error.status} · {bootstrap.error.code}
            </p>
          </details>
        )}
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

/**
 * A skeleton shaped like the day ribbon, not a lone pulsing dot.
 *
 * The dot it replaces was two pixels across on an empty screen, which reads as a broken page
 * rather than a loading one. This paints the shape the user is about to get.
 */
function SplashScreen() {
  return (
    <main className="surface min-h-full animate-pulse px-4 pt-8" aria-busy="true">
      <span className="sr-only">Memuat FOQUS…</span>
      <div className="mx-auto w-full max-w-2xl" aria-hidden="true">
        <div className="h-7 w-40 rounded-lg bg-mist/25" />
        <div className="mt-2 h-4 w-56 rounded bg-mist/20" />
        <div className="mt-6 flex gap-3">
          <div className="w-12 shrink-0 space-y-8 pt-1">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="ml-auto h-3 w-8 rounded bg-mist/20" />
            ))}
          </div>
          <div className="h-72 flex-1 rounded-xl border hairline surface-raised" />
        </div>
      </div>
    </main>
  );
}
