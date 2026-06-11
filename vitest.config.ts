import { defineConfig, configDefaults } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Keep the Playwright suites out of the Vitest (pure-TS) run — they import @playwright/test and
// drive a real browser. e2e/ runs via `npm run test:e2e`; the bench/ render-perf harness +
// regression guards run via `npm run bench:render` / `npm run bench:guard`.
export default defineConfig({
  resolve: {
    // Mirror tsconfig "paths" ("@/*" → "./src/*") so source/tests can import via "@/".
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**', 'bench/**'],
  },
});
