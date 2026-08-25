/**
 * Entry point.
 *
 * TanStack Query is persisted into Dexie (§3), which is what makes a cold open render from the
 * mirror rather than from a spinner. The service worker registers itself via vite-plugin-pwa's
 * `registerType: 'prompt'` — FOQUS never swaps the running app out from under an active
 * pomodoro without asking.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { createDexiePersister } from './data/persister.js';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reads are offline-first; the mirror is the source of first paint (§8).
      networkMode: 'offlineFirst',
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24 * 7,
      refetchOnReconnect: true,
    },
  },
});

const persister = createDexiePersister();

const container = document.getElementById('root');
if (!container) throw new Error('#root tidak ditemukan');

createRoot(container).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7 }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
);
