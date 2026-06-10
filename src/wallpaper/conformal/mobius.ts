// ─────────────────────────────────────────────────────────────────────────────
// MÖBIUS MATH — the pure, tested mirror of the fragment shader's complex algebra.
//
// A Möbius transform is M(z) = (a·z + b) / (c·z + d) with complex coefficients a,b,c,d.
// It is the most fundamental conformal map and the direct generalisation of the affine
// z ↦ α·z + β the SVG engine already uses (c = 0 ⇒ M(z) = (a/d)·z + b/d — pure affine).
//
// The WebGL path renders by INVERSE mapping: for each output pixel w it computes z = M⁻¹(w)
// and samples the pattern there. M⁻¹ is itself a Möbius map whose coefficient matrix is the
// ADJUGATE of M's:  M⁻¹(w) = (d·w − b) / (−c·w + a).
//
// INVARIANT: the formulas here are the source of truth for shader.ts. The GLSL implements
// the SAME operations (cMul/cDiv/mobius/inverseCoeffs) line-for-line; there is no GL context
// in node, so only this TS mirror is unit-tested. If you edit one, edit the other — see the
// header of shader.ts which names this gap explicitly.
// ─────────────────────────────────────────────────────────────────────────────

export type Complex = { re: number; im: number };

export type MobiusCoeffs = {
  a: Complex;
  b: Complex;
  c: Complex;
  d: Complex;
};

export const complex = (re: number, im = 0): Complex => ({ re, im });

export const cAdd = (z: Complex, w: Complex): Complex => ({
  re: z.re + w.re,
  im: z.im + w.im,
});

export const cSub = (z: Complex, w: Complex): Complex => ({
  re: z.re - w.re,
  im: z.im - w.im,
});

export const cNeg = (z: Complex): Complex => ({ re: -z.re, im: -z.im });

export const cMul = (z: Complex, w: Complex): Complex => ({
  re: z.re * w.re - z.im * w.im,
  im: z.re * w.im + z.im * w.re,
});

// |z|² — cheaper than |z| and all we need for invertibility / pole tests.
export const cAbs2 = (z: Complex): number => z.re * z.re + z.im * z.im;

export const cDiv = (z: Complex, w: Complex): Complex => {
  const denom = cAbs2(w);
  return {
    re: (z.re * w.re + z.im * w.im) / denom,
    im: (z.im * w.re - z.re * w.im) / denom,
  };
};

export const cInv = (z: Complex): Complex => {
  const denom = cAbs2(z);
  return { re: z.re / denom, im: -z.im / denom };
};

// — Transcendentals (principal branch) — used by the log/exp/power primitives. arg ∈ (−π,π]
// via atan2; the negative-real-axis branch cut is intentional (it is the Droste recursion).
export const cExp = (z: Complex): Complex => {
  const r = Math.exp(z.re);
  return { re: r * Math.cos(z.im), im: r * Math.sin(z.im) };
};

export const cLog = (z: Complex): Complex => ({
  re: Math.log(Math.hypot(z.re, z.im)),
  im: Math.atan2(z.im, z.re),
});

export const cPow = (z: Complex, alpha: Complex): Complex =>
  cExp(cMul(alpha, cLog(z)));

// det = a·d − b·c. M is invertible (and conformal everywhere off its pole) iff det ≠ 0.
export const determinant = (m: MobiusCoeffs): Complex =>
  cSub(cMul(m.a, m.d), cMul(m.b, m.c));

export const DEFAULT_EPS = 1e-9;

/** A Möbius map is degenerate (non-invertible — M⁻¹ undefined) when |det| → 0. */
export const isInvertible = (m: MobiusCoeffs, eps = DEFAULT_EPS): boolean =>
  cAbs2(determinant(m)) > eps * eps;

/** M(z) = (a·z + b) / (c·z + d). */
export const mobius = (m: MobiusCoeffs, z: Complex): Complex =>
  cDiv(cAdd(cMul(m.a, z), m.b), cAdd(cMul(m.c, z), m.d));

// Coefficients of M⁻¹ — the adjugate of [[a,b],[c,d]]: [[d,−b],[−c,a]]. The shared scalar
// 1/det cancels in the Möbius ratio, so the adjugate (not the true inverse matrix) is exact.
export const inverseCoeffs = (m: MobiusCoeffs): MobiusCoeffs => ({
  a: m.d,
  b: cNeg(m.b),
  c: cNeg(m.c),
  d: m.a,
});

/** M⁻¹(w) = (d·w − b) / (−c·w + a). */
export const mobiusInverse = (m: MobiusCoeffs, w: Complex): Complex =>
  mobius(inverseCoeffs(m), w);

// The canonical first conformal example: inversion z ↦ 1/z  (a=0, b=1, c=1, d=0).
export const INVERSION: MobiusCoeffs = {
  a: complex(0),
  b: complex(1),
  c: complex(1),
  d: complex(0),
};

/**
 * Prepare the warp the renderer actually uploads. Degenerate (|det| < eps) coefficients have
 * no inverse — warping would divide by zero and spray NaN — so we report it and the renderer
 * skips the warp (identity passthrough) rather than rendering garbage. Pure: returns data, no
 * throw, never NaN. The GL renderer and the "handled gracefully" test both go through this.
 */
export type PreparedWarp =
  | { kind: 'mobius'; inverse: MobiusCoeffs }
  | { kind: 'passthrough'; reason: 'degenerate' };

export const prepareWarp = (
  m: MobiusCoeffs,
  eps = DEFAULT_EPS,
): PreparedWarp =>
  isInvertible(m, eps)
    ? { kind: 'mobius', inverse: inverseCoeffs(m) }
    : { kind: 'passthrough', reason: 'degenerate' };
