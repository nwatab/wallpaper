import { describe, it, expect } from 'vitest';
import {
  type Complex,
  type MobiusCoeffs,
  complex,
  cAdd,
  cMul,
  cDiv,
  cSub,
  cAbs2,
  determinant,
  isInvertible,
  mobius,
  inverseCoeffs,
  mobiusInverse,
  prepareWarp,
  INVERSION,
} from './mobius';

const near = (z: Complex, w: Complex, eps = 1e-9) =>
  expect(cAbs2(cSub(z, w))).toBeLessThan(eps * eps);

// A few non-degenerate maps to exercise. Inversion, a general one, and a similarity.
const GENERAL: MobiusCoeffs = {
  a: complex(2, -1),
  b: complex(0.5, 3),
  c: complex(-1, 0.25),
  d: complex(1, 1),
};
const AFFINE: MobiusCoeffs = {
  // c = 0 ⇒ pure affine z ↦ (a/d)·z + b/d
  a: complex(1.5, 0.5),
  b: complex(-2, 1),
  c: complex(0, 0),
  d: complex(1, 0),
};
const SAMPLE_W: Complex[] = [
  complex(0.3, 0.7),
  complex(-1.2, 0.4),
  complex(2.5, -1.5),
  complex(0.1, -0.9),
];

describe('Möbius inverse correctness', () => {
  // Precondition (per review addition): every map we test for inversion must have det ≠ 0.
  for (const [name, m] of [
    ['inversion', INVERSION],
    ['general', GENERAL],
    ['affine', AFFINE],
  ] as const) {
    it(`${name} is invertible (det ≠ 0) — the inverse precondition`, () => {
      expect(cAbs2(determinant(m))).toBeGreaterThan(1e-12);
      expect(isInvertible(m)).toBe(true);
    });
  }

  it('inverseCoeffs is the adjugate [[d,−b],[−c,a]]', () => {
    const inv = inverseCoeffs(GENERAL);
    near(inv.a, GENERAL.d);
    near(inv.b, { re: -GENERAL.b.re, im: -GENERAL.b.im });
    near(inv.c, { re: -GENERAL.c.re, im: -GENERAL.c.im });
    near(inv.d, GENERAL.a);
  });

  it('M(M⁻¹(w)) = w and M⁻¹(M(w)) = w at sample points', () => {
    for (const m of [INVERSION, GENERAL, AFFINE]) {
      for (const w of SAMPLE_W) {
        near(mobius(m, mobiusInverse(m, w)), w);
        near(mobiusInverse(m, mobius(m, w)), w);
      }
    }
  });

  it('inversion z↦1/z is its own inverse, and 1/(1/z) = z', () => {
    for (const w of SAMPLE_W) {
      near(mobius(INVERSION, w), { re: w.re / cAbs2(w), im: -w.im / cAbs2(w) });
      near(mobius(INVERSION, mobius(INVERSION, w)), w);
    }
  });
});

describe('c=0 affine anchor (Möbius generalises z ↦ α·z + β)', () => {
  it('reduces exactly to (a/d)·z + b/d when c = 0', () => {
    // α = a/d, β = b/d; here d = 1 so α = a, β = b. The direct affine value:
    const affineDirect = (z: Complex): Complex =>
      cAdd(cDiv(cMul(AFFINE.a, z), AFFINE.d), cDiv(AFFINE.b, AFFINE.d));
    for (const z of SAMPLE_W) {
      near(mobius(AFFINE, z), affineDirect(z));
    }
  });
});

describe('degenerate handling (review addition: never NaN)', () => {
  // ad − bc = 0: rows proportional ⇒ non-invertible.
  const DEGENERATE: MobiusCoeffs = {
    a: complex(1, 0),
    b: complex(2, 0),
    c: complex(2, 0),
    d: complex(4, 0),
  };

  it('isInvertible is false for a degenerate map', () => {
    expect(cAbs2(determinant(DEGENERATE))).toBeLessThan(1e-12);
    expect(isInvertible(DEGENERATE)).toBe(false);
  });

  it('prepareWarp returns a passthrough (no inverse, no NaN) for degenerate coeffs', () => {
    const prepared = prepareWarp(DEGENERATE);
    expect(prepared.kind).toBe('passthrough');
  });

  it('prepareWarp returns the adjugate inverse for a well-formed map', () => {
    const prepared = prepareWarp(GENERAL);
    expect(prepared.kind).toBe('mobius');
    if (prepared.kind === 'mobius') {
      near(prepared.inverse.a, GENERAL.d);
      near(prepared.inverse.d, GENERAL.a);
    }
  });
});

describe('conformality — Jacobian of M is a scaled rotation (Cauchy–Riemann)', () => {
  // Treat M : R² → R², (x,y) ↦ (u,v). Conformal ⇔ u_x = v_y and u_y = −v_x, which makes the
  // Jacobian [[u_x, u_y],[v_x, v_y]] a scaled rotation: the two columns are orthogonal, equal
  // length, and the second is the first rotated +90°.
  const h = 1e-6;
  const jacobian = (m: MobiusCoeffs, z: Complex) => {
    const fx0 = mobius(m, { re: z.re - h, im: z.im });
    const fx1 = mobius(m, { re: z.re + h, im: z.im });
    const fy0 = mobius(m, { re: z.re, im: z.im - h });
    const fy1 = mobius(m, { re: z.re, im: z.im + h });
    return {
      ux: (fx1.re - fx0.re) / (2 * h),
      vx: (fx1.im - fx0.im) / (2 * h),
      uy: (fy1.re - fy0.re) / (2 * h),
      vy: (fy1.im - fy0.im) / (2 * h),
    };
  };

  for (const [name, m] of [
    ['inversion', INVERSION],
    ['general', GENERAL],
    ['affine', AFFINE],
  ] as const) {
    it(`${name}: angle-preserving away from the pole`, () => {
      for (const z of SAMPLE_W) {
        const J = jacobian(m, z);
        // Cauchy–Riemann
        expect(Math.abs(J.ux - J.vy)).toBeLessThan(1e-4);
        expect(Math.abs(J.uy + J.vx)).toBeLessThan(1e-4);
        // columns orthogonal and equal length (scaled rotation), assuming non-singular here
        const dot = J.ux * J.uy + J.vx * J.vy;
        const len0 = Math.hypot(J.ux, J.vx);
        const len1 = Math.hypot(J.uy, J.vy);
        expect(Math.abs(dot)).toBeLessThan(1e-4 * (1 + len0 * len1));
        expect(Math.abs(len0 - len1)).toBeLessThan(1e-4 * (1 + len0 + len1));
      }
    });
  }
});
