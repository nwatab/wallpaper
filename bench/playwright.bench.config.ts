import { defineConfig } from '@playwright/test';

// Dedicated config for the Stage-A render-performance harness. SEPARATE from the Warp
// e2e config (playwright.config.ts) — it measures a PRODUCTION static export, never `next dev`.
//
// `output:'export'` makes `next start` fail, so we build the static export and serve `out/`
// under the `/wallpaper` basePath via bench/serve-export.mjs (see that file for the why).
// Set BENCH_SKIP_BUILD=1 to reuse an existing `out/` while iterating on the harness.
const SKIP_BUILD = !!process.env.BENCH_SKIP_BUILD;
const PORT = Number(process.env.BENCH_PORT || 3100);

export default defineConfig({
  testDir: './',
  testMatch: '**/render.bench.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 120 * 60_000, // the whole matrix + panel probe runs inside one test
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
  },
  projects: [{ name: 'bench-chromium', use: { channel: undefined } }],
  webServer: {
    command: SKIP_BUILD
      ? 'node bench/serve-export.mjs'
      : 'npm run build && node bench/serve-export.mjs',
    // Playwright defaults webServer cwd to the config's dir (bench/); the command paths are
    // repo-root-relative (matching `npm run bench:render`'s cwd), so pin it back to root.
    cwd: process.cwd(),
    url: `http://localhost:${PORT}/wallpaper`,
    reuseExistingServer: !process.env.CI,
    timeout: 5 * 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
