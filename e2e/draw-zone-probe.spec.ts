import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

// KALEIDOSCOPE-FOLD GUARD: in Draw mode / p4m, a committed stroke must stay visible
// under the pen wherever it was drawn — including the canvas triangles outside the
// asymmetric unit, where un-folded capture used to clip the ink away silently.
//
// Probe design (this exact instrument read LIVE/LIVE/DEAD/DEAD on the pre-fold code):
// - One stroke per diagonal triangle, Clear in between: orbit copies of a live stroke
//   land in other triangles (top↔left, right↔bottom mirror across the unit's
//   diagonal), so without isolation a dead zone can fake a hit.
// - Before each stroke, the sampled window must read blank — pins that the sampler
//   sees committed ink only, not the symmetry overlay or leftover state.
// - Probe positions are asymmetric: off the canvas medians and clear of both canvas
//   diagonals (the p4m window is the unit's bbox = a quarter cell, so the medians map
//   to uv 0.25 — not symmetry axes — but staying off them costs nothing and removes
//   any chance of a stroke coinciding with its own orbit image).

const PROBES: Array<{ name: string; fx: number; fy: number }> = [
  { name: 'top', fx: 0.42, fy: 0.16 },
  { name: 'right', fx: 0.84, fy: 0.42 },
  { name: 'bottom', fx: 0.58, fy: 0.84 },
  { name: 'left', fx: 0.16, fy: 0.58 },
];
const HALF = 0.04; // stroke half-length, canvas fraction

// the pen's default navy (#1c3f7a) against the white canvas / red overlay
const isInk = (r: number, g: number, b: number): boolean =>
  b > 90 && r < 90 && g < 100 && b - r > 35;

const inkInWindow = (png: PNG, fx: number, fy: number): boolean => {
  const px = Math.round(fx * png.width);
  const py = Math.round(fy * png.height);
  const w = Math.round((HALF + 0.02) * png.width);
  for (let dy = -8; dy <= 8; dy++) {
    for (let dx = -w; dx <= w; dx++) {
      const idx = ((py + dy) * png.width + (px + dx)) * 4;
      if (isInk(png.data[idx], png.data[idx + 1], png.data[idx + 2])) return true;
    }
  }
  return false;
};

test('p4m draw pane: committed ink survives in all four canvas triangles', async ({
  page,
}) => {
  await page.goto('/wallpaper');
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await page.locator('button', { hasText: /^p4m$/ }).first().click();

  const capture = page.locator('svg.cursor-crosshair');
  await capture.scrollIntoViewIfNeeded();
  const surface = capture.locator('..');

  for (const probe of PROBES) {
    await page.getByRole('button', { name: '✕ Clear' }).click();
    await page.waitForTimeout(100);

    // instrument zero-check: nothing in the window before the stroke commits
    const before = PNG.sync.read(await surface.screenshot());
    expect(
      inkInWindow(before, probe.fx, probe.fy),
      `${probe.name}: window must be blank before drawing`,
    ).toBe(false);

    const box = (await capture.boundingBox())!;
    const cx = box.x + probe.fx * box.width;
    const cy = box.y + probe.fy * box.height;
    const half = HALF * box.width;

    await page.mouse.move(cx - half, cy);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(cx - half + (i / 6) * 2 * half, cy);
    }
    await page.mouse.up();
    await page.waitForTimeout(150);

    const after = PNG.sync.read(await surface.screenshot());
    expect(
      inkInWindow(after, probe.fx, probe.fy),
      `stroke drawn in the ${probe.name} triangle must stay visible`,
    ).toBe(true);
  }
});
