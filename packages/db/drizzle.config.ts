import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * Migrations are generated here and applied **manually from a developer machine**
 * (`pnpm db:migrate`), never during a Vercel build — a deploy must never be able to fail
 * because of a migration (BRIEF §3).
 */
export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
});
