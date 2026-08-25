import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests live next to the code they cover. `packages/core` is the priority
    // surface: BRIEF §15 treats a scheduling rule without a test as unfinished.
    include: ['packages/**/*.test.ts', 'apps/web/src/**/*.test.ts'],
    environment: 'node',
  },
});
