import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Vite and Vitest transpile TypeScript themselves, so they read `packages/*` straight
      // from source — edits to the domain layer hot-reload with no build step. The published
      // `exports` map points at `dist/` instead, because the Vercel function runtime is plain
      // Node and cannot load a `.ts` file (see DECISIONS T18).
      '@foqus/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      '@foqus/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
      '@foqus/db': fileURLToPath(new URL('./packages/db/src/index.ts', import.meta.url)),
    },
  },
  test: {
    // Unit tests live next to the code they cover. `packages/core` is the priority
    // surface: BRIEF §15 treats a scheduling rule without a test as unfinished.
    include: ['packages/**/*.test.ts', 'apps/web/src/**/*.test.ts'],
    environment: 'node',
  },
});
