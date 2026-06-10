import { defineConfig, configDefaults } from 'vitest/config';

// Keep the Playwright E2E suite (e2e/) out of the Vitest (pure-TS) run — it imports
// @playwright/test and drives a real browser, so it must run via `npm run test:e2e`.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
