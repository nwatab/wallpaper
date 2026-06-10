import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

// KALEIDOSCOPE-FOLD GUARD: in Draw mode / p4m, a committed stroke must stay visible
// under the pen wherever it was drawn — including the canvas triangles outside the
// asymmetric unit, where un-folded capture used to clip the ink away silently. One
// stroke per diagonal triangle (top / right / bottom / left), Clear in between: orbit
// copies of a live stroke land in other triangles (top↔left, right↔bottom mirror
// across the unit's diagonal), so without isolation a dead zone can fake a hit.

const PROBES: Array<{ name: string; fx: number; fy: number }> = [
  { name: 'top', fx: 0.5, fy: 0.2 },
  { name: 'right', fx: 0.8, fy: 0.5 },
  { name: 'bottom', fx: 0.5, fy: 0.8 },
  { name: 'left', fx: 0.2, fy: 0.5 },
];

// the pen's default navy (#1c3f7a) against the white canvas / red overlay
const isInk = (r: number, g: number, b: number): boolean =>
  b > 90 && r < 90 && g < 100 && b - r > 35;

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

    const box = (await capture.boundingBox())!;
    const cx = box.x + probe.fx * box.width;
    const cy = box.y + probe.fy * box.height;
    const half = 0.05 * box.width;

    await page.mouse.move(cx - half, cy);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(cx - half + (i / 6) * 2 * half, cy);
    }
    await page.mouse.up();
    await page.waitForTimeout(150);

    const png = PNG.sync.read(await surface.screenshot());
    const px = Math.round(probe.fx * png.width);
    const py = Math.round(probe.fy * png.height);
    const w = Math.round(0.07 * png.width);
    let hit = false;
    for (let dy = -8; dy <= 8 && !hit; dy++) {
      for (let dx = -w; dx <= w && !hit; dx++) {
        const idx = ((py + dy) * png.width + (px + dx)) * 4;
        if (isInk(png.data[idx], png.data[idx + 1], png.data[idx + 2])) hit = true;
      }
    }
    expect(hit, `stroke drawn in the ${probe.name} triangle must stay visible`).toBe(
      true,
    );
  }
});
