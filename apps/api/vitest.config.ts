import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        // TRD §7 — 80% on apps/api.
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
      exclude: ['**/dist/**', '**/test/**', '**/*.d.ts', 'src/openapi/generate.ts'],
    },
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});
