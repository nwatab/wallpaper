// ─────────────────────────────────────────────────────────────────────────────
// LATTICE REDUCTION — world point → cell (uv) coordinates, the tested mirror of the
// shader's reduction step.
//
// The pattern texture is the ONE seamless cell drawn in the unit square (see buildCellSvg).
// To sample it at an arbitrary world point z, reduce z into the cell:  uv = frac(B⁻¹·z),
// where B maps fractional cell coords (u,v) → XY (u·a + v·b). frac() folds every lattice
// translate i·a + j·b back onto the same point of the cell, so a REPEAT-wrapped texture
// reproduces the infinite lattice exactly.
//
// INVARIANT: the GLSL does the identical mat2 multiply + fract(); only this TS is unit-tested.
// ─────────────────────────────────────────────────────────────────────────────

import type { Vec2 } from '../types';
import {
  basisToMatrix,
  invert,
  applyToPoint,
  rotateDeg,
  type Polygon,
} from '../affine';

export const frac = (x: number): number => x - Math.floor(x);

/**
 * Rotate the cell basis to the live VIEW orientation. The gallery puts its pose rotation in the
 * world→uv map (cellToWorld = R·B, with an axis-aligned viewport); the warp must match that
 * STRUCTURE — rotate the base lattice by the same live rotation, NOT rotate the view/clip frame
 * (opposite sense) and NOT bake the per-template defaultPose. So warp-empty at (scale, rotation)
 * reproduces the gallery main view at (scale, rotation); at rotation 0 it is the canonical fold.
 * Uniform scale stays the warp's separate framing/zoom.
 */
export const rotateBasis = (
  basis: { a: Vec2; b: Vec2 },
  rotationDeg: number,
): { a: Vec2; b: Vec2 } => {
  if (!rotationDeg) return basis;
  const R = rotateDeg(rotationDeg);
  return { a: applyToPoint(R, basis.a), b: applyToPoint(R, basis.b) };
};

/** The 2×2 (column-major a,b,c,d) inverse-basis the shader uploads as a mat2. */
export type Basis2 = { a: number; b: number; c: number; d: number };

/** B⁻¹ as a pure linear 2×2 (no translation — the basis is linear). */
export const inverseBasis2 = (basis: { a: Vec2; b: Vec2 }): Basis2 => {
  const inv = invert(basisToMatrix(basis));
  return { a: inv.a, b: inv.b, c: inv.c, d: inv.d };
};

/** Continuous cell coordinates (u,v) = B⁻¹·z — before folding into the cell. */
export const worldToCellContinuous = (
  basis: { a: Vec2; b: Vec2 },
  z: Vec2,
): Vec2 => applyToPoint(invert(basisToMatrix(basis)), z);

/** Reduced cell coordinates uv = frac(B⁻¹·z) ∈ [0,1)² — the texture lookup. */
export const worldToCellUv = (
  basis: { a: Vec2; b: Vec2 },
  z: Vec2,
): Vec2 => {
  const c = worldToCellContinuous(basis, z);
  return { x: frac(c.x), y: frac(c.y) };
};

/** The XY lattice translate for integer cell offset (i,j): i·a + j·b. */
export const latticeTranslate = (
  basis: { a: Vec2; b: Vec2 },
  i: number,
  j: number,
): Vec2 => ({
  x: i * basis.a.x + j * basis.b.x,
  y: i * basis.a.y + j * basis.b.y,
});

export type { Polygon };
