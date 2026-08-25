/**
 * `GET /api/cron/drain-outbox` — outbox drain for *all* users, protected by `CRON_SECRET`.
 *
 * Built now, deliberately **not registered as a Vercel Cron in v1** (§12, D13). There is no
 * `crons` block in `vercel.json`, and there must not be one: the Hobby plan caps cron at once
 * per day, and a daily drain buys FOQUS nothing — agendas are only created while the app is
 * open, so `waitUntil` plus the client-driven `POST /api/sync/drain` already covers every real
 * scenario.
 *
 * It exists so an external scheduler (cron-job.org, a GitHub Actions schedule) or Vercel Cron on
 * a paid plan can be attached later **without any code change** — just point it at this URL.
 *
 * The endpoint is public unless it is guarded, hence the constant-time `CRON_SECRET` check.
 * The actual push to Google Calendar lands in M3; until then this reports an empty queue.
 */

import { readEnv } from '../_lib/env.js';

export const config = { runtime: 'nodejs' };

/** Constant-time comparison so the secret cannot be recovered by timing the response. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function handler(request: Request): Promise<Response> {
  const env = readEnv();

  if (!env.CRON_SECRET) {
    return Response.json(
      { error: { code: 'not_configured', message: 'CRON_SECRET belum diisi.' } },
      { status: 503 },
    );
  }

  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${env.CRON_SECRET}`;
  if (!safeEqual(header, expected)) {
    return Response.json(
      { error: { code: 'unauthorized', message: 'Tidak berwenang.' } },
      { status: 401 },
    );
  }

  // M3 wires the shared drain routine in here, with the same OUTBOX_BATCH_SIZE cap the
  // client-driven endpoint uses — a 10-second function must never try to empty the queue.
  return Response.json({ processed: 0, remaining: 0, errors: [] });
}
