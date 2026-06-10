import { test, expect } from '@playwright/test';
import { selectTemplate, enterWarp, pipelineStatus, readWarpDebug } from './harness';

// ─────────────────────────────────────────────────────────────────────────────
// PART B — RENDER-PATH DIFF (hypothesis: does the EMPTY 0/8 path differ from the with-cards path?)
// Same base (P1), same dpr: capture window.__warpDebug at draw for (i) empty 0/8 and (ii) a
// 1-card pipeline, and diff the render-path fields — shader programId, uResolution (Rx,Ry),
// uViewHalfExtents (Hx,Hy), gl.VIEWPORT, blend, and texture sampling. Identical ⇒ SAME render
// path (only u_count + the op arrays differ). A difference would be evidence of a separate
// empty-only passthrough path (to audit next as a possible anisotropy source).
//
// NOTE: in this codebase the "Identity" preset is itself `cards: []` (0/8), so the meaningful
// non-empty comparison is a real 1-card pipeline — added here via the "+ Möbius" button.
// ─────────────────────────────────────────────────────────────────────────────

const PATH_KEYS = ['programId', 'Rx', 'Ry', 'Hx', 'Hy', 'viewport', 'blend', 'sampling'];

test('empty 0/8 and 1-card use the SAME render path (only u_count differs)', async ({
  page,
}) => {
  await selectTemplate(page);
  await enterWarp(page);

  // (i) empty 0/8
  const s0 = await pipelineStatus(page);
  const d0 = await readWarpDebug(page);
  expect(s0.count, 'empty pipeline count').toBe(0);
  expect(s0.empty, 'empty message shown').toBe(true);
  expect(d0.count, 'u_count uploaded (empty)').toBe(0);

  // (ii) add ONE card (Möbius) → 1/8, re-draw
  await page.getByRole('button', { name: '+ Möbius' }).click();
  await page.waitForFunction(
    () =>
      (globalThis as unknown as { __warpDebug?: { count: number } }).__warpDebug
        ?.count === 1,
  );
  const s1 = await pipelineStatus(page);
  const d1 = await readWarpDebug(page);
  expect(s1.count, '1-card pipeline count').toBe(1);
  expect(d1.count, 'u_count uploaded (1 card)').toBe(1);

  // diff the render-path fields
  const diff: Record<string, { empty: unknown; oneCard: unknown }> = {};
  for (const k of PATH_KEYS)
    if (JSON.stringify(d0[k]) !== JSON.stringify(d1[k]))
      diff[k] = { empty: d0[k], oneCard: d1[k] };

  console.log('empty  __warpDebug =', JSON.stringify(d0));
  console.log('1card  __warpDebug =', JSON.stringify(d1));
  console.log(
    `PATH DIFF (count ${d0.count} → ${d1.count}) =`,
    Object.keys(diff).length ? JSON.stringify(diff) : 'NONE (same render path)',
  );

  // same render path: program + framing + blend + sampling identical; only u_count changes
  expect(d0.programId, 'same shader program').toBe(d1.programId);
  expect(d0.Rx).toBe(d1.Rx);
  expect(d0.Ry).toBe(d1.Ry);
  expect(d0.Hx).toBe(d1.Hx);
  expect(d0.Hy).toBe(d1.Hy);
  expect(d0.viewport).toEqual(d1.viewport);
  expect(d0.blend).toEqual(d1.blend);
  expect(d0.sampling).toEqual(d1.sampling);
});
