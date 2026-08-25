/**
 * Login (§7, D10). Google only, and the same consent covers Calendar — one step, one tap.
 */

import { Wordmark } from '../components/Wordmark.js';
import { startGoogleLogin } from '../lib/api.js';

export function LoginScreen({ error }: { error?: string | null }) {
  return (
    <main className="surface flex min-h-full flex-col justify-between px-6 py-12">
      <div className="mx-auto w-full max-w-sm pt-12">
        <Wordmark className="text-5xl" />
        <p className="mt-6 text-base leading-relaxed text-muted">
          Sebuah todo hidup ketika ia punya slot waktu. FOQUS menjembatani backlog dan kalender —
          menghormati jam kerja, waktu sholat, dan jeda perpindahan.
        </p>
      </div>

      <div className="mx-auto w-full max-w-sm">
        {error && (
          <p className="mb-4 rounded-xl bg-ember-soft px-4 py-3 text-sm text-ink">{error}</p>
        )}
        <button
          type="button"
          onClick={startGoogleLogin}
          className="flex min-h-touch w-full items-center justify-center gap-3 rounded-2xl bg-tea px-6 text-base font-semibold text-paper transition-opacity active:opacity-90"
        >
          <GoogleGlyph />
          Masuk dengan Google
        </button>
        <p className="mt-4 text-center text-xs leading-relaxed text-muted">
          FOQUS meminta akses kalender sekaligus, supaya agenda bisa ditulis ke kalender “FOQUS —
          Agenda” milikmu. Kalender pribadimu tidak diubah.
        </p>
      </div>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 11v3.2h5.3c-.2 1.4-1.6 4.1-5.3 4.1-3.2 0-5.8-2.6-5.8-5.9S8.8 6.5 12 6.5c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.6 4 14.5 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.2-1.4H12Z"
      />
    </svg>
  );
}
