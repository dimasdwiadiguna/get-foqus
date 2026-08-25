/**
 * Query layer. One bootstrap query feeds every screen (§8): read from Dexie instantly, then
 * revalidate over the network. Screens never fetch on their own.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Bootstrap } from '@foqus/shared';
import { DEFAULT_PRAYER_SETTINGS, DEFAULT_SETTINGS } from '@foqus/core';
import { api, UnauthenticatedError } from './api.js';
import { applyBootstrap } from '../data/mirror.js';
import { db, META_KEYS, readMeta } from '../data/db.js';

export const queryKeys = {
  bootstrap: ['bootstrap'] as const,
};

export function useBootstrap(): UseQueryResult<Bootstrap, Error> {
  return useQuery({
    queryKey: queryKeys.bootstrap,
    queryFn: async () => {
      const bootstrap = await api.bootstrap();
      await applyBootstrap(bootstrap);
      return bootstrap;
    },
    // A lapsed session is a routing decision, not something to retry into.
    retry: (failureCount, error) => !(error instanceof UnauthenticatedError) && failureCount < 2,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** Live reads straight off the mirror, so screens render before the network answers. */
export function useMirroredTasks() {
  return useLiveQuery(() => db.tasks.orderBy('sortOrder').toArray(), [], undefined);
}

export function useMirroredAgendas() {
  return useLiveQuery(() => db.agendas.orderBy('startAt').toArray(), [], undefined);
}

export function useMirroredPomodoroSessions() {
  return useLiveQuery(() => db.pomodoroSessions.orderBy('startedAt').toArray(), [], undefined);
}

export function useMirroredCategories() {
  return useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), [], undefined);
}

export function useMirroredAvailability() {
  return useLiveQuery(() => db.availabilityWindows.toArray(), [], undefined);
}

export function useMirroredSettings() {
  return useLiveQuery(
    async () => (await readMeta<typeof DEFAULT_SETTINGS>(META_KEYS.settings)) ?? DEFAULT_SETTINGS,
    [],
    DEFAULT_SETTINGS,
  );
}

export function useMirroredPrayerSettings() {
  return useLiveQuery(
    async () =>
      (await readMeta<typeof DEFAULT_PRAYER_SETTINGS>(META_KEYS.prayerSettings)) ??
      DEFAULT_PRAYER_SETTINGS,
    [],
    DEFAULT_PRAYER_SETTINGS,
  );
}
