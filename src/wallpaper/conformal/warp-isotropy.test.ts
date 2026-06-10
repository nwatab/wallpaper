import { describe, it, expect } from 'vitest';
import { worldPixelScale, viewHalfExtents } from './glRenderer';

// ─────────────────────────────────────────────────────────────────────────────
// WARP ISOTROPY GUARD — world→PIXEL must scale x and y EQUALLY, or oblique/hex lattices skew
// (b's angle distorts while a stays horizontal — an axis-aligned anisotropic scale). Must use a
// NON-SQUARE canvas: W==H hides the bug. sx/sy anisotropy ratio would equal the canvas W/H.
// ─────────────────────────────────────────────────────────────────────────────

const NON_SQUARE = [
  { w: 1600, h: 900 },
  { w: 900, h: 1600 },
  { w: 1920, h: 1080 },
  { w: 800, h: 1280 },
  { w: 1366, h: 768 },
];

describe('warp world→pixel is isotropic on non-square canvases', () => {
  for (const { w, h } of NON_SQUARE) {
    it(`${w}×${h}: sx == sy (no axis-aligned anisotropic scale)`, () => {
      const { sx, sy } = worldPixelScale(3.3, w, h);
      expect(Math.abs(sx - sy)).toBeLessThan(1e-9);
    });
  }

  it('world region aspect matches the canvas aspect (the condition for isotropy)', () => {
    for (const { w, h } of NON_SQUARE) {
      const { halfX, halfY } = viewHalfExtents(3.3, w, h);
      expect(Math.abs(halfX / halfY - w / h)).toBeLessThan(1e-9);
    }
  });

  it('teeth: a SINGLE shared half-extent (the pre-fix bug) IS anisotropic on a non-square canvas', () => {
    // The reported bug: one `half` for both axes → world is square → stretched onto W×H.
    const half = 3.3;
    const w = 1600;
    const h = 900;
    const sxBuggy = w / (2 * half);
    const syBuggy = h / (2 * half);
    expect(Math.abs(sxBuggy - syBuggy)).toBeGreaterThan(1); // clearly anisotropic
    // and the anisotropy ratio equals the canvas aspect, as predicted.
    expect(Math.abs(sxBuggy / syBuggy - w / h)).toBeLessThan(1e-9);
  });
});
