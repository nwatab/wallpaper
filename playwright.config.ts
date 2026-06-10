import { defineConfig, devices } from '@playwright/test';

// E2E measurement harness for the Warp (WebGL) render — separate from the Vitest pure-TS suite.
// A NON-SQUARE viewport is essential: a square one hides the anisotropic-stretch bug.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1280, height: 720 }, // NON-SQUARE on purpose
    deviceScaleFactor: 1,
    launchOptions: {
      // Headless WebGL2 via ANGLE/SwiftShader.
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
      ],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/wallpaper',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
