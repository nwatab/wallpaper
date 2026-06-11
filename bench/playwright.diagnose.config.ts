import { defineConfig } from '@playwright/test';

// Config for the over-invalidation diagnosis (diagnose-invalidation.bench.spec.ts). Same
// production static-export webServer; separate testMatch so it never runs under bench:render.
// Run directly: BENCH_SKIP_BUILD=1 npx playwright test -c bench/playwright.diagnose.config.ts
const SKIP_BUILD = !!process.env.BENCH_SKIP_BUILD;
const PORT = Number(process.env.BENCH_PORT || 3100);

export default defineConfig({
  testDir: './',
  testMatch: '**/diagnose-*.bench.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 60 * 60_000,
  use: { baseURL: `http://localhost:${PORT}`, headless: true },
  projects: [{ name: 'bench-chromium', use: { channel: undefined } }],
  webServer: {
    command: SKIP_BUILD
      ? 'node bench/serve-export.mjs'
      : 'npm run build && node bench/serve-export.mjs',
    cwd: process.cwd(),
    url: `http://localhost:${PORT}/wallpaper`,
    reuseExistingServer: !process.env.CI,
    timeout: 5 * 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
