import { describe, it, expect } from 'vitest';
import type { Vec2 } from '../types';
import { basisToMatrix, invert, applyToPoint } from '../affine';
import { inverseBasis2 } from './lattice';
import { mat2ColumnMajor } from './glRenderer';

// ─────────────────────────────────────────────────────────────────────────────
// WARP MATRIX SERIALIZATION AUDIT — the test the geometry oracle CAN'T do.
//
// The oracle uses the correct TS B⁻¹ on both sides, so a TS→GL serialization transpose would be
// invisible to it. The fingerprint "rectangular/square fine, oblique/hex/rhombic skewed" is the
// signature of a TRANSPOSE (symmetric/diagonal B is transpose-invariant; non-symmetric B is not).
//
// This test takes the EXACT array uploaded to gl.uniformMatrix2fv (mat2ColumnMajor), interprets
// it COLUMN-MAJOR exactly as GLSL `mat2 * vec2` will, and asserts the result equals the intended
// B⁻¹·v — for deliberately NON-SYMMETRIC bases. A row-major pack (transpose=false on row-major
// data) would reconstruct (B⁻¹)ᵀ and fail. We also assert the row-major MISREAD differs, so the
// test genuinely discriminates (has teeth).
// ─────────────────────────────────────────────────────────────────────────────

// GLSL `M * v` with M uploaded column-major as arr=[m0,m1,m2,m3]:
//   M[0] = col0 = (m0,m1),  M[1] = col1 = (m2,m3)
//   result.x = M[0][0]·vx + M[1][0]·vy = m0·vx + m2·vy
//   result.y = M[0][1]·vx + M[1][1]·vy = m1·vx + m3·vy
const glslMul = (arr: number[], v: Vec2): Vec2 => ({
  x: arr[0] * v.x + arr[2] * v.y,
  y: arr[1] * v.x + arr[3] * v.y,
});
// What GLSL would compute if the SAME bytes were actually row-major (i.e. the matrix had been
// packed transposed): result = (B⁻¹)ᵀ·v.
const rowMajorMisread = (arr: number[], v: Vec2): Vec2 => ({
  x: arr[0] * v.x + arr[1] * v.y,
  y: arr[2] * v.x + arr[3] * v.y,
});

const near = (a: Vec2, b: Vec2, eps = 1e-9) =>
  expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(eps);

const S3_2 = Math.sqrt(3) / 2;
// Deliberately NON-SYMMETRIC bases (B⁻¹ ≠ (B⁻¹)ᵀ): oblique p1 70°, hex 120°, rhombic.
const NON_SYMMETRIC: Record<string, { a: Vec2; b: Vec2 }> = {
  'p1 70° oblique': {
    a: { x: 1, y: 0 },
    b: { x: Math.cos((70 * Math.PI) / 180), y: Math.sin((70 * Math.PI) / 180) },
  },
  'hex 120°': { a: { x: 1, y: 0 }, b: { x: -0.5, y: S3_2 } },
  rhombic: { a: { x: 1, y: 0.5 }, b: { x: 1, y: -0.5 } },
};

const PROBES: Vec2[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 0.7, y: -0.4 },
  { x: -1.3, y: 0.9 },
];

describe('u_invBasis is serialized column-major as B⁻¹ (no transpose)', () => {
  for (const [name, basis] of Object.entries(NON_SYMMETRIC)) {
    const invBasis = inverseBasis2(basis); // exactly what WarpPane passes to the renderer
    const arr = mat2ColumnMajor(invBasis); // exactly the bytes uploaded to the uniform
    const Binv = invert(basisToMatrix(basis)); // the intended map, in TS

    it(`${name}: GLSL column-major read == B⁻¹·v`, () => {
      for (const v of PROBES) {
        near(glslMul(arr, v), applyToPoint(Binv, v));
      }
    });

    it(`${name}: the matrix is non-symmetric, so a transpose WOULD be caught`, () => {
      // off-diagonal b ≠ c ⇒ B⁻¹ ≠ (B⁻¹)ᵀ
      expect(Math.abs(invBasis.b - invBasis.c)).toBeGreaterThan(1e-6);
      // a row-major (transposed) read diverges from the intended map on some probe.
      const diverges = PROBES.some((v) => {
        const wrong = rowMajorMisread(arr, v);
        const right = applyToPoint(Binv, v);
        return Math.hypot(wrong.x - right.x, wrong.y - right.y) > 1e-6;
      });
      expect(diverges).toBe(true);
    });
  }
});
