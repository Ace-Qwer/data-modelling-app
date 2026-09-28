import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/desktop/src/**'],
      exclude: ['**/*.test.{ts,tsx}', '**/index.ts'],
      thresholds: {
        'packages/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
      },
    },
  },
});
