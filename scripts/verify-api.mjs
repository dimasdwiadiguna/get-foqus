/**
 * Boots the Vercel function the way Vercel does, and asserts it answers.
 *
 * Why this exists: Vite and Vitest transpile TypeScript on the fly, so they happily resolve
 * `@foqus/core` straight to its `.ts` source. The Vercel function runtime is **plain Node**,
 * which cannot. That gap is invisible to `pnpm test`, `pnpm typecheck` and `pnpm build` — it
 * only shows up in production as `FUNCTION_INVOCATION_FAILED`, and it cost us one bad deploy.
 *
 * So: transform `api/**` to JavaScript exactly as the platform would, import the entrypoint
 * with plain Node resolution, and exercise the routes. Run it before every deploy.
 *
 *   pnpm verify:api
 *
 * Requires `pnpm build:packages` to have run first — that is the thing being verified.
 */

import { build } from 'esbuild';
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const webRoot = resolve(import.meta.dirname, '../apps/web');
const failures = [];

function check(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? 'OK  ' : 'GAGAL'}  ${label} → ${actual}${ok ? '' : ` (harusnya ${expected})`}`);
  if (!ok) failures.push(label);
}

/**
 * The output must live *inside* `apps/web`: ESM resolution walks up from the importing file's
 * own URL, not from the working directory, so a temp dir elsewhere would never find
 * `node_modules` — and finding it is the whole point of this check.
 */
const outdir = join(webRoot, '.verify-api');
await rm(outdir, { recursive: true, force: true });

try {
  await build({
    entryPoints: [
      `${webRoot}/api/[[...route]].ts`,
      `${webRoot}/api/_lib/*.ts`,
      `${webRoot}/api/cron/*.ts`,
    ],
    outdir,
    outbase: `${webRoot}/api`,
    // Not bundled, on purpose: this must exercise real Node module resolution against
    // `node_modules`, which is precisely where the failure lived.
    bundle: false,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    logLevel: 'warning',
  });

  const handler = (await import(pathToFileURL(join(outdir, '[[...route]].js')).href)).default;

  // 1. A route that touches no environment at all — proves the module graph loads.
  const health = await handler(new Request('https://foqus.test/api/health'));
  check('GET /api/health', health.status, 200);

  // 2. Protected route with the environment filled in but no session cookie.
  Object.assign(process.env, {
    DATABASE_URL: 'postgres://user:pass@host/db',
    GOOGLE_CLIENT_ID: 'test-client',
    GOOGLE_CLIENT_SECRET: 'test-secret',
    GOOGLE_REDIRECT_URI: 'https://foqus.test/api/auth/google/callback',
    SESSION_SECRET: 's'.repeat(32),
    TOKEN_ENC_KEY: Buffer.alloc(32, 7).toString('base64'),
    APP_URL: 'https://foqus.test',
  });
  const unauthorized = await handler(new Request('https://foqus.test/api/bootstrap'));
  check('GET /api/bootstrap tanpa sesi', unauthorized.status, 401);

  // 3. OAuth start must redirect to Google (D10, §7).
  const start = await handler(new Request('https://foqus.test/api/auth/google/start'));
  check('GET /api/auth/google/start', start.status, 302);
  const location = start.headers.get('location') ?? '';
  check(
    'redirect menuju accounts.google.com',
    location.startsWith('https://accounts.google.com/o/oauth2/v2/auth'),
    true,
  );

  // 4. The cron endpoint must refuse an unauthenticated caller — it is public otherwise (§12).
  process.env.CRON_SECRET = 'cron-secret';
  const cron = (await import(pathToFileURL(join(outdir, 'cron/drain-outbox.js')).href)).default;
  check(
    'GET /api/cron/drain-outbox tanpa CRON_SECRET',
    (await cron(new Request('https://foqus.test/api/cron/drain-outbox'))).status,
    401,
  );
  check(
    'GET /api/cron/drain-outbox dengan CRON_SECRET',
    (
      await cron(
        new Request('https://foqus.test/api/cron/drain-outbox', {
          headers: { authorization: 'Bearer cron-secret' },
        }),
      )
    ).status,
    200,
  );

  // 5. An unknown route must be a clean 404, not a crash.
  check(
    'GET /api/entah-apa',
    (await handler(new Request('https://foqus.test/api/entah-apa'))).status,
    404,
  );
} finally {
  await rm(outdir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\n${failures.length} pemeriksaan gagal: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nFungsi API boot dan menjawab di bawah Node polos.');
