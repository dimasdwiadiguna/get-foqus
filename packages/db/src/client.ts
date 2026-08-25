/**
 * Database client.
 *
 * `@neondatabase/serverless` over HTTP (§3): each query is an independent fetch, which is the
 * only shape that works on Vercel — there is no connection pool to keep warm between requests
 * and no guarantee the same instance handles the next one (D13).
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { schema } from './schema.js';

export type Database = ReturnType<typeof createDatabase>;

export function createDatabase(connectionString: string) {
  if (!connectionString) {
    throw new Error('DATABASE_URL belum diisi — lihat .env.example');
  }
  return drizzle(neon(connectionString), { schema });
}

/**
 * Cached per module instance. This is a *warm-start* optimisation only — correctness never
 * depends on the cache surviving, because a cold start simply rebuilds it.
 */
let cached: Database | null = null;

export function getDatabase(connectionString = process.env.DATABASE_URL ?? ''): Database {
  if (!cached) cached = createDatabase(connectionString);
  return cached;
}
