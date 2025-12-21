import type { Affine2D, Vec2, UV } from './types';

export const identity = (): Affine2D => ({
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0,
});

export const toSvgMatrix = (m: Affine2D): string =>
  `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;

// m = m2 ∘ m1
export const compose = (m2: Affine2D, m1: Affine2D): Affine2D => ({
  a: m2.a * m1.a + m2.c * m1.b,
  b: m2.b * m1.a + m2.d * m1.b,
  c: m2.a * m1.c + m2.c * m1.d,
  d: m2.b * m1.c + m2.d * m1.d,
  e: m2.a * m1.e + m2.c * m1.f + m2.e,
  f: m2.b * m1.e + m2.d * m1.f + m2.f,
});

export const applyToPoint = (m: Affine2D, p: Vec2): Vec2 => ({
  x: m.a * p.x + m.c * p.y + m.e,
  y: m.b * p.x + m.d * p.y + m.f,
});

export const applyToUv = (m: Affine2D, p: UV): UV => ({
  u: m.a * p.u + m.c * p.v + m.e,
  v: m.b * p.u + m.d * p.v + m.f,
});

export const invert = (m: Affine2D): Affine2D => {
  const det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-12) {
    throw new Error('Affine2D is not invertible.');
  }
  const invDet = 1 / det;
  return {
    a: m.d * invDet,
    b: -m.b * invDet,
    c: -m.c * invDet,
    d: m.a * invDet,
    e: (m.c * m.f - m.d * m.e) * invDet,
    f: (m.b * m.e - m.a * m.f) * invDet,
  };
};

export const translateUv = (du: number, dv: number): Affine2D => ({
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: du,
  f: dv,
});

export const translateXy = (dx: number, dy: number): Affine2D => ({
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: dx,
  f: dy,
});

export const scaleUniform = (s: number): Affine2D => ({
  a: s,
  b: 0,
  c: 0,
  d: s,
  e: 0,
  f: 0,
});

export const rotateDeg = (deg: number): Affine2D => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { a: c, b: s, c: -s, d: c, e: 0, f: 0 };
};
export type Polygon = Vec2[];

export const applyToPolygon = (m: Affine2D, poly: Polygon): Polygon =>
  poly.map((p) => applyToPoint(m, p));
