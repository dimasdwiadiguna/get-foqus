/**
 * Applies pending migrations. Run manually from a developer machine (`pnpm db:migrate`),
 * never as part of a Vercel build — a deploy must not be able to fail on a migration (§3).
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL belum diisi. Salin .env.example ke .env lalu isi.');
  process.exit(1);
}

const db = drizzle(neon(url));
await migrate(db, { migrationsFolder: new URL('../migrations', import.meta.url).pathname });
console.log('Migrasi selesai.');
