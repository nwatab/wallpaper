import type { Affine2D, Vec2 } from '../types';
import { applyToPoint } from '../affine';

// ─────────────────────────────────────────────────────────────────────────────
// MAXIMALITY: is a template's *declared* group the FULL symmetry of the pattern it
// renders, or does the drawn motif accidentally carry extra symmetry that promotes
// the pattern to a larger group (e.g. a chiral p4 motif that is secretly mirror-
// symmetric → the pattern is really p4m)?
//
// We work entirely in fractional (uv / lattice-basis) coordinates. There the cell is
// the unit square, the group's coset reps and every candidate extra generator are the
// integer/half-integer matrices of groups.ts, and a regular grid {k/N} is mapped onto
// itself by all of them. So the combinatorial question "which cells are inked" is
// exact and basis-independent (the basis only decides whether those fractional ops are
// XY isometries — pinned separately by the compile/isometry test).
//
// A motif is a union of filled polygons (its ink). We rasterise the ink to grid
// samples, take their orbit under the declared point group reduced mod 1 — the
// pattern's fingerprint — and then, for each generator h that would extend the group
// to the next named supergroup, check h does NOT preserve the fingerprint. That is a
// direct, rigorous (to grid resolution) proof of maximality.
// ─────────────────────────────────────────────────────────────────────────────

const KEY_TOL = 1e-3;

const keyOfFrac = (p: Vec2): string => {
  const u = ((p.x % 1) + 1) % 1;
  const v = ((p.y % 1) + 1) % 1;
  const wrap = (t: number): number => (Math.abs(t - 1) < KEY_TOL ? 0 : t);
  return `${Math.round(wrap(u) / KEY_TOL)},${Math.round(wrap(v) / KEY_TOL)}`;
};

// Even-odd ray cast; counts a point strictly inside the polygon.
const pointInPolygon = (p: Vec2, poly: Vec2[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const crosses =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
};

/**
 * Rasterise the motif's ink (a set of filled uv polygons) to a regular fractional
 * grid {k/N}. The grid is preserved exactly by every group / candidate generator, so
 * the resulting sample set is a faithful, transform-stable stand-in for the filled
 * motif. N even so the cell mid-lines (1/2) are sampled.
 *
 * `clip` (the fundamental region) restricts sampling to ink that actually renders:
 * templates use motifLayer 'clip', so the on-screen motif is motif ∩ region. Sampling
 * the same intersection makes the maximality verdict match the rendered pattern and
 * frees the motif art to overhang the region (the overhang is simply not counted).
 */
export const sampleInk = (
  polys: Vec2[][],
  N = 60,
  clip?: Vec2[],
): Vec2[] => {
  const out: Vec2[] = [];
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const p = { x: i / N, y: j / N };
      if (clip && !pointInPolygon(p, clip)) continue;
      if (polys.some((poly) => pointInPolygon(p, poly))) out.push(p);
    }
  }
  return out;
};

/** Orbit of the ink samples under the point group, reduced mod the lattice. */
export const patternFingerprint = (
  inkUv: Vec2[],
  cosetRepsFrac: Affine2D[],
): Set<string> => {
  const out = new Set<string>();
  for (const p of inkUv) {
    for (const g of cosetRepsFrac) out.add(keyOfFrac(applyToPoint(g, p)));
  }
  return out;
};

const setsEqual = (a: Set<string>, b: Set<string>): boolean => {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
};

/**
 * Does fractional isometry `h` map the pattern fingerprint onto itself (mod lattice)?
 * `true` ⇒ the pattern is invariant under h ⇒ its symmetry exceeds the declared group.
 */
export const isInvariantUnder = (
  fingerprint: Set<string>,
  inkUv: Vec2[],
  cosetRepsFrac: Affine2D[],
  h: Affine2D,
): boolean => {
  const mapped = new Set<string>();
  for (const p of inkUv) {
    for (const g of cosetRepsFrac) {
      mapped.add(keyOfFrac(applyToPoint(h, applyToPoint(g, p))));
    }
  }
  return setsEqual(fingerprint, mapped);
};

// ── Fractional candidate generators (same convention as groups.ts) ──────────────
// Each would, if it preserved the fingerprint, promote the pattern to a larger group.
export const FRAC: Record<string, Affine2D> = {
  mirrorU: { a: -1, b: 0, c: 0, d: 1, e: 1, f: 0 }, // x = 1/2 (axial)
  mirrorV: { a: 1, b: 0, c: 0, d: -1, e: 0, f: 1 }, // y = 1/2 (axial)
  diag: { a: 0, b: 1, c: 1, d: 0, e: 0, f: 0 }, // y = x
  antiDiag: { a: 0, b: -1, c: -1, d: 0, e: 1, f: 1 }, // y = -x through centre
  rot90c: { a: 0, b: 1, c: -1, d: 0, e: 1, f: 0 }, // 90° about cell centre
  rot180c: { a: -1, b: 0, c: 0, d: -1, e: 1, f: 1 }, // 180° about cell centre
  // Glide along u with axis v = 1/2 (groups.ts glideU) — pm/p1 → pmg/pg promotions.
  glideX: { a: 1, b: 0, c: 0, d: -1, e: 0.5, f: 1 },
  // Sub-lattice translations: invariance under any of these means the drawn cell is
  // not primitive (the true pattern repeats finer / is centred).
  halfU: { a: 1, b: 0, c: 0, d: 1, e: 0.5, f: 0 },
  halfV: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0.5 },
  centring: { a: 1, b: 0, c: 0, d: 1, e: 0.5, f: 0.5 },
  // Hexagonal-lattice generators (integer matrices in the hex basis).
  rot60: { a: 1, b: 1, c: -1, d: 0, e: 0, f: 0 },
  // p3m1 mirror family (axes through the deep-hole 3-fold centres).
  mirrorP3m1: { a: -1, b: 0, c: 1, d: 1, e: 0, f: 0 },
  // p31m mirror family (the `swap` axis, through lattice 3-fold centres).
  mirrorP31m: { a: 0, b: 1, c: 1, d: 0, e: 0, f: 0 },
};
