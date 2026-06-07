import { describe, it, expect } from 'vitest';
import {
  identity,
  compose,
  applyToPoint,
  invert,
  translateXy,
  scaleUniform,
  rotateDeg,
} from './affine';
import type { Affine2D, Vec2 } from './types';

const det = (m: Affine2D): number => m.a * m.d - m.b * m.c;

const expectMatClose = (m: Affine2D, n: Affine2D): void => {
  for (const k of ['a', 'b', 'c', 'd', 'e', 'f'] as const) {
    expect(m[k], `component ${k}`).toBeCloseTo(n[k], 9);
  }
};

const expectPointClose = (p: Vec2, q: Vec2): void => {
  expect(p.x).toBeCloseTo(q.x, 9);
  expect(p.y).toBeCloseTo(q.y, 9);
};

// Reflection across the x-axis: (x,y) -> (x,-y)
const reflectX: Affine2D = { a: 1, b: 0, c: 0, d: -1, e: 0, f: 0 };
// Glide along x with offset t: reflect across x-axis then translate x by t.
const glideX = (t: number): Affine2D => ({ a: 1, b: 0, c: 0, d: -1, e: t, f: 0 });

describe('affine core', () => {
  it('identity is a left and right unit for compose', () => {
    const m = compose(rotateDeg(37), translateXy(3, -2));
    expectMatClose(compose(identity(), m), m);
    expectMatClose(compose(m, identity()), m);
  });

  it('compose(m2, m1) applies m1 first (right-to-left)', () => {
    // Rotate-then-translate vs translate-then-rotate must differ, and the
    // composition order must match "m1 applied first".
    const T = translateXy(10, 0);
    const R = rotateDeg(90);
    const p: Vec2 = { x: 1, y: 0 };

    // compose(R, T): translate first, then rotate.
    const rtThenR = applyToPoint(compose(R, T), p);
    const manual = applyToPoint(R, applyToPoint(T, p));
    expectPointClose(rtThenR, manual);

    // Order matters: the two orderings disagree.
    const other = applyToPoint(compose(T, R), p);
    expect(
      Math.abs(rtThenR.x - other.x) + Math.abs(rtThenR.y - other.y),
    ).toBeGreaterThan(1e-6);
  });

  it('compose is associative', () => {
    const A = rotateDeg(20);
    const B = translateXy(2, 5);
    const C = scaleUniform(3);
    expectMatClose(compose(compose(A, B), C), compose(A, compose(B, C)));
  });

  it('rotations and translations have determinant +1; reflections -1', () => {
    expect(det(rotateDeg(123))).toBeCloseTo(1, 9);
    expect(det(translateXy(7, -4))).toBeCloseTo(1, 9);
    expect(det(reflectX)).toBeCloseTo(-1, 9);
  });

  it('reflection composed with itself is the identity', () => {
    expectMatClose(compose(reflectX, reflectX), identity());
  });

  it('a glide composed with itself is a pure translation (no reflection)', () => {
    const g = glideX(0.5);
    const gg = compose(g, g);
    // det back to +1 (orientation restored), linear part is identity,
    // translation doubled along the glide axis.
    expect(det(gg)).toBeCloseTo(1, 9);
    expectMatClose(gg, translateXy(1, 0));
  });

  it('invert round-trips to identity for a similarity transform', () => {
    const m = compose(
      translateXy(11, -7),
      compose(rotateDeg(50), scaleUniform(2)),
    );
    expectMatClose(compose(m, invert(m)), identity());
    expectMatClose(compose(invert(m), m), identity());
  });

  it('invert handles reflections (det -1)', () => {
    const g = glideX(0.5);
    expectMatClose(compose(g, invert(g)), identity());
  });

  it('invert throws on a singular matrix', () => {
    const singular: Affine2D = { a: 0, b: 0, c: 0, d: 0, e: 1, f: 1 };
    expect(() => invert(singular)).toThrow();
  });

  it('applyToPoint matches the matrix(a b c d e f) convention', () => {
    const m: Affine2D = { a: 2, b: 3, c: 4, d: 5, e: 6, f: 7 };
    const p: Vec2 = { x: 1, y: 1 };
    // x' = a*x + c*y + e, y' = b*x + d*y + f
    expectPointClose(applyToPoint(m, p), { x: 2 + 4 + 6, y: 3 + 5 + 7 });
  });
});
