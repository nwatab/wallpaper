import { PNG } from 'pngjs';
import { type Page, type Locator } from '@playwright/test';
import { type Image } from './lattice';

export type WarpDebug = Record<string, unknown>;
export type PipelineStatus = { count: number; empty: boolean };

// Set a React-controlled range input and fire input/change so React picks it up.
export const setRange = (loc: Locator, value: number) =>
  loc.evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!;
    setter.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);

/**
 * Drive the UI to P1 → Warp (Scale 120, Rotation 0, lattice frame on). NO preset is clicked, so
 * Warp opens on its DEFAULT pipeline — which is the Identity preset = `cards: []` = EMPTY (0/8).
 * This is the bug-definition state ("empty pipeline").
 */
// Open the app and select a gallery template by its visible title (gallery mode).
export const selectTemplate = async (
  page: Page,
  title = 'Parallelogram (70°)',
): Promise<void> => {
  await page.goto('/wallpaper');
  await page.locator(`button[title="${title}"]`).click();
  await setRange(page.locator('input[type=range][min="20"]'), 120);
  await setRange(page.locator('input[type=range][min="0"]'), 0);
};

// Enter the Warp stage on the currently-selected template, Scale 120 / Rotation 0, lattice on.
export const enterWarp = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: /Warp/ }).click();
  await setRange(page.locator('input[type=range][min="20"]'), 120);
  await setRange(page.locator('input[type=range][min="0"]'), 0);
  await page
    .locator('label:has-text("Show lattice frame") input[type=checkbox]')
    .check();
  await page.waitForFunction(() => !!globalThis.__warpDebug);
  await page.waitForSelector('#wallpaper svg line[stroke="#e5484d"]', {
    state: 'attached',
  });
};

// Screenshot the full-screen #wallpaper layer (panel hidden) — works for the gallery SVG render
// and the warp canvas. Returns a decoded RGBA image (y-down, screen px).
export const screenshotWallpaper = async (page: Page): Promise<Image> => {
  await page.evaluate(() => {
    const a = document.querySelector('aside');
    if (a) (a as HTMLElement).style.visibility = 'hidden';
  });
  const buf = await page.locator('#wallpaper').screenshot();
  await page.evaluate(() => {
    const a = document.querySelector('aside');
    if (a) (a as HTMLElement).style.visibility = '';
  });
  const png = PNG.sync.read(buf);
  return { width: png.width, height: png.height, data: png.data };
};

// Read the pipeline card count ("{n}/8") and whether the "Empty — …" message is shown.
export const pipelineStatus = async (page: Page): Promise<PipelineStatus> => {
  const countText =
    (await page
      .locator('aside')
      .getByText(/^\s*\d+\/8\s*$/)
      .first()
      .textContent()) ?? '';
  const count = parseInt(countText.trim().split('/')[0], 10);
  const empty = await page
    .getByText('Empty — the pattern is shown unwarped', { exact: false })
    .isVisible()
    .catch(() => false);
  return { count, empty };
};

// Read window.__warpDebug (everything except the gl handle), incl. the render-path fields.
export const readWarpDebug = async (page: Page): Promise<WarpDebug> =>
  page.evaluate(() => {
    const d = (globalThis as unknown as { __warpDebug: Record<string, unknown> })
      .__warpDebug;
    return {
      dpr: d.dpr,
      Rx: d.Rx,
      Ry: d.Ry,
      Hx: d.Hx,
      Hy: d.Hy,
      canvasW: d.canvasW,
      canvasH: d.canvasH,
      cssW: d.cssW,
      cssH: d.cssH,
      viewport: d.viewport,
      B: Array.from(d.B as Float32Array),
      Binv: Array.from(d.Binv as Float32Array),
      programId: d.programId,
      count: d.count,
      blend: d.blend,
      sampling: d.sampling,
    };
  });
