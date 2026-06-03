import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: { statements: 75, branches: 65, functions: 75, lines: 75 },
      exclude: ['**/.next/**', '**/dist/**', '**/*.d.ts', '**/next-env.d.ts'],
    },
  },
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
});
