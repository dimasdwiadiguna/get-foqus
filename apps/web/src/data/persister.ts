/**
 * TanStack Query persister backed by Dexie (§3).
 *
 * `localStorage` would be the easy choice and the wrong one: it is synchronous, capped around
 * 5 MB, and FOQUS already keeps IndexedDB open for the mirror. One storage engine, one
 * eviction story.
 */

import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { db } from './db.js';

const CACHE_KEY = 'react-query-cache';

export function createDexiePersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await db.meta.put({ key: CACHE_KEY, value: client, updatedAt: new Date().toISOString() });
    },
    restoreClient: async () => {
      const row = await db.meta.get(CACHE_KEY);
      return row?.value as PersistedClient | undefined;
    },
    removeClient: async () => {
      await db.meta.delete(CACHE_KEY);
    },
  };
}
