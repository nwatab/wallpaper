import type { Affine2D, Vec2, WallpaperGroup } from '../types';
import { basisToMatrix, compose, invert } from '../affine';
import { getGroup } from '../groups';
import { congruenceClasses, storedBasisOf } from './congruence';

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAP SOUNDNESS GATE. Painter compositing orders copies by depth d(copy) =
// ⟨centre, u⟩ for a recede direction u. The rendered pattern actually HAS the declared
// group's symmetry only if every op g ∈ G preserves the depth order of overlapping
// pairs: d(g·A) − d(g·B) = ⟨centre_A − centre_B, Rᵀu⟩, so order is preserved for all
// pairs iff R u = u for every coset rep's linear part R (translations only shift d).
// A rotation of order ≥ 2 fixes no direction (R = −I reverses every pair); two
// non-parallel mirror axes leave no common u. So the sound groups are exactly the
// single-axis-direction ones — p1, pm, pg, cm — matching the gallery's implicit
// restriction of motifLayer:'overlap'. DERIVED from the coset reps, not hand-listed.
//
// The direction is computed in XY (orthogonal linear parts; uv hex matrices are not)
// and doubles as the layer's depth orientation: overlapDepth measures the y-component
// after rotateDeg(depthRotationDeg), so the rotation maps u onto +y. For pm that is 0
// (vertical mirror axis), for pg 90° (horizontal glide axis) — a constant 0 was only
// correct for pm-like axes.
// ─────────────────────────────────────────────────────────────────────────────

const det = (m: Affine2D): number => m.a * m.d - m.b * m.c;

const isIdentityLinear = (m: Affine2D): boolean =>
  Math.abs(m.a - 1) < 1e-9 &&
  Math.abs(m.b) < 1e-9 &&
  Math.abs(m.c) < 1e-9 &&
  Math.abs(m.d - 1) < 1e-9;

// Axis direction of a reflection's linear part (XY, orthogonal): φ = atan2(b, a) / 2.
const reflectionAxis = (m: Affine2D): Vec2 => {
  const phi = Math.atan2(m.b, m.a) / 2;
  return { x: Math.cos(phi), y: Math.sin(phi) };
};

/**
 * The common XY direction fixed by every coset rep's linear part, or null when none
 * exists (some rep is a proper rotation, or mirror/glide axes disagree). p1 — no
 * constraint — defaults to +y, preserving the previous depth-0 behaviour.
 */
export const overlapRecedeDirection = (group: WallpaperGroup): Vec2 | null => {
  const B = basisToMatrix(storedBasisOf(group));
  const Binv = invert(B);
  let axis: Vec2 | null = null;
  for (const op of getGroup(group).cosetReps) {
    const m = compose(B, compose(op, Binv));
    if (det(m) > 0) {
      if (!isIdentityLinear(m)) return null; // a real rotation fixes no direction
      continue;
    }
    const u = reflectionAxis(m);
    if (axis === null) {
      axis = u;
    } else if (Math.abs(axis.x * u.y - axis.y * u.x) > 1e-9) {
      return null; // two distinct axis directions — no common u
    }
  }
  return axis ?? { x: 0, y: 1 };
};

/**
 * Depth orientation for the group's overlap layer: the rotation carrying the recede
 * direction onto +y (what overlapDepth measures). null ⇔ overlap drawing is unsound
 * for this group (the gate).
 */
export const overlapDepthRotationDeg = (group: WallpaperGroup): number | null => {
  const u = overlapRecedeDirection(group);
  if (!u) return null;
  return 90 - (Math.atan2(u.y, u.x) * 180) / Math.PI;
};

/**
 * May the DRAW UI offer overlap mode for this group? A kept drawing must stay faithful
 * across everything sharing its drawing frame, so the whole congruence class must be
 * sound — derived, like the toggle sets themselves, from the stored data.
 */
export const overlapAllowed = (group: WallpaperGroup): boolean => {
  const cls = congruenceClasses().find((c) => c.members.includes(group));
  const members = cls ? cls.members : [group];
  return members.every((g) => overlapRecedeDirection(g) !== null);
};
