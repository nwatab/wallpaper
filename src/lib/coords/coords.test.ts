import { describe, it, expect } from 'vitest';
import type { Vec2 } from '@/wallpaper/types';
import { applyToPoint, compose, rotateDeg } from '@/wallpaper/affine';
import {
  toInternalViewAngleDeg,
  toUserViewAngleDeg,
  Y_AXIS_DIRECTION,
} from './canonical';
import { extentCenter, viewTransform, inverseViewTransform } from './view';
import { toSVG, toWebGL } from './surfaces';

// Deterministic pseudo-random canonical points (no Math.random → reproducible).
const lcg = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 0xffffffff) * 2000 - 1000; // [-1000, 1000)
};
const points = (n: number, seed = 12345): Vec2[] => {
  const r = lcg(seed);
  return Array.from({ length: n }, () => ({ x: r(), y: r() }));
};
const closePt = (p: Vec2, q: Vec2): void => {
  expect(p.x).toBeCloseTo(q.x, 9);
  expect(p.y).toBeCloseTo(q.y, 9);
};
// z of the 2D cross product (orientation sign).
const crossZ = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;

describe('coords/canonical — view-rotation sign (CCW-positive)', () => {
  it('the user↔internal mapping is a mod-360 negation and an involution', () => {
    for (const d of [0, 15, 30, 90, 150, 210, 345]) {
      expect(toInternalViewAngleDeg(d)).toBe(((-d % 360) + 360) % 360);
      expect(toUserViewAngleDeg(toInternalViewAngleDeg(d))).toBe(((d % 360) + 360) % 360);
    }
    expect(toInternalViewAngleDeg(0)).toBe(0); // 0 is unaffected (goldens stay put)
    expect(toUserViewAngleDeg(210)).toBe(150); // seigaiha default displays as 150
  });

  // Criterion 7.2: a POSITIVE user angle rotates a reference point COUNTERCLOCKWISE on
  // the (y-down) SVG surface. In y-down screen space visual-CCW ⇒ negative cross-product
  // (a point on +x moves toward -y, i.e. visually up).
  it('positive user angle ⇒ visual CCW on the SVG surface', () => {
    const ref: Vec2 = { x: 1, y: 0 };
    const svg = toSVG({ w: 100, h: 100 });
    for (const userDeg of [15, 30, 90]) {
      const internal = toInternalViewAngleDeg(userDeg);
      const screen = compose(svg.forward, rotateDeg(internal));
      const rotated = applyToPoint(screen, ref);
      expect(crossZ(ref, rotated)).toBeLessThan(0); // visual CCW (y-down)
      // and the UN-negated angle would read the opposite way (visual CW) — documents the flip
      const naive = compose(svg.forward, rotateDeg(userDeg));
      expect(crossZ(ref, applyToPoint(naive, ref))).toBeGreaterThan(0);
    }
  });
});

describe('coords/view — centered recenter', () => {
  it('viewTransform places the declared center at canonical 0', () => {
    const extent = { x: 0, y: 0, w: 600, h: 600 };
    const center = extentCenter(extent);
    expect(center).toEqual({ x: 300, y: 300 });
    closePt(applyToPoint(viewTransform({ center }), center), { x: 0, y: 0 });
  });

  it('viewTransform / inverseViewTransform round-trip', () => {
    const center = { x: 137, y: -42 };
    const fwd = viewTransform({ center });
    const inv = inverseViewTransform({ center });
    for (const p of points(64)) closePt(applyToPoint(inv, applyToPoint(fwd, p)), p);
  });
});

describe('coords/surfaces — SVG adapter (no mirror, centered box)', () => {
  it('viewBox is centered: [-w/2, -h/2, w, h]', () => {
    expect(toSVG({ w: 600, h: 400 }).viewBox).toEqual({
      x: -300,
      y: -200,
      w: 600,
      h: 400,
    });
  });

  it('orientation is identity under y-down canonical (criterion 6: no flip)', () => {
    expect(Y_AXIS_DIRECTION).toBe('down');
    const { forward } = toSVG({ w: 100, h: 100 });
    expect(forward).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  });

  it('forward/inverse round-trip (criterion 7.3)', () => {
    const { forward, inverse } = toSVG({ w: 800, h: 600 });
    for (const p of points(64, 999))
      closePt(applyToPoint(inverse, applyToPoint(forward, p)), p);
  });
});

describe('coords/surfaces — WebGL contract (the one legitimate y-flip)', () => {
  const surf = toWebGL({ a: 300, b: 200 });

  it('forward/inverse round-trip (criterion 7.3)', () => {
    for (const p of points(64, 7))
      closePt(applyToPoint(surf.inverse, applyToPoint(surf.forward, p)), p);
  });

  it('canonical center → NDC origin; visually-up (y-down small/neg y) → NDC +y', () => {
    closePt(applyToPoint(surf.forward, { x: 0, y: 0 }), { x: 0, y: 0 });
    // canonical (0,-b) is the visual TOP (y-down); NDC top is +1.
    closePt(applyToPoint(surf.forward, { x: 0, y: -200 }), { x: 0, y: 1 });
    closePt(applyToPoint(surf.forward, { x: 300, y: 0 }), { x: 1, y: 0 });
  });
});
