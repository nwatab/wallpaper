import { describe, it, expect } from 'vitest';
import type { Vec2 } from '../types';
import { asymmetricUnitUv } from '../regions';
import {
  buildCanvasMapping,
  pointToCanvas,
  pointFromCanvas,
} from './canvasMapping';

// ─────────────────────────────────────────────────────────────────────────────
// CAPTURE ROUND-TRIP (M2 verification step 1). The pure source↔canvas mapping must be
// an exact inverse so a captured stroke maps to the expected geometry and back. The
// canvas UI is not tested here — only the mapping it relies on.
// ─────────────────────────────────────────────────────────────────────────────

const close = (a: Vec2, b: Vec2, eps = 1e-9): boolean =>
  Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;

describe('canvasMapping', () => {
  const canvas = { width: 400, height: 300, padding: 20 };

  it('round-trips canvas → source → canvas for every region', () => {
    for (const regionUv of Object.values(asymmetricUnitUv)) {
      const m = buildCanvasMapping(regionUv, canvas);
      for (const px of [
        { x: 0, y: 0 },
        { x: 200, y: 150 },
        { x: 357.2, y: 41.9 },
        { x: 400, y: 300 },
      ]) {
        const back = pointToCanvas(m, pointFromCanvas(m, px));
        expect(close(px, back)).toBe(true);
      }
    }
  });

  it('uses a uniform scale (no shear, no aspect distortion)', () => {
    const m = buildCanvasMapping(asymmetricUnitUv.p4m, canvas);
    expect(m.toCanvas.b).toBe(0);
    expect(m.toCanvas.c).toBe(0);
    expect(m.toCanvas.a).toBeCloseTo(m.toCanvas.d, 12);
  });

  it('fits the polygon inside the padded canvas and centres it', () => {
    // Unit square region [0,1]² → fitted to the short axis (height), centred in width.
    const m = buildCanvasMapping(asymmetricUnitUv.p1, canvas);
    const s = m.toCanvas.a;
    expect(s).toBeCloseTo((canvas.height - 2 * canvas.padding) / 1, 9); // 260

    const corners = asymmetricUnitUv.p1.map((p) => pointToCanvas(m, p));
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    // Inside the canvas.
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(canvas.width);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(canvas.height);
    // Centred: equal margins on the fitted (vertical) axis.
    expect(Math.min(...ys)).toBeCloseTo(canvas.padding, 6);
    expect(canvas.height - Math.max(...ys)).toBeCloseTo(canvas.padding, 6);
  });
});
