// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL MATH SPACE — the single source of truth for coordinate conventions.
//
// This module is the ONLY place that declares the y-direction, the view-rotation
// sign, and the origin semantics. Every surface (SVG gallery, switch/draw, WebGL)
// derives its transform from here; nothing else hardcodes a `scale(1,-1)`, a viewBox
// literal, or a projection-sign flip.
//
// SCOPE NOTE (this PR is the "centered viewBox only" unification): canonical space is
// kept **y-down** — the convention the engine, group ops, motifs and regionXy already
// use end to end (verified internally consistent: no stray/double flip anywhere). The
// International-Tables y-up flip is deliberately NOT done here; it would mirror every
// pattern and is out of scope. What this PR adds is (1) a centered view origin so the
// future conformal layer has `0` at the viewport centre, and (2) a CCW-positive
// view-rotation control. Group-operation algebra (rotateDeg / opsInCellXy) is untouched.
// ─────────────────────────────────────────────────────────────────────────────

/** Direction of increasing y in canonical space. y-down (SVG-native) for this PR. */
export const Y_AXIS_DIRECTION = 'down' as const;

/**
 * The USER-FACING view-rotation control reads counterclockwise-positive: a positive
 * angle rotates the displayed pattern CCW on screen, identically on SVG and WebGL.
 */
export const VIEW_ROTATION_POSITIVE = 'ccw-visual' as const;

const mod360 = (deg: number): number => ((deg % 360) + 360) % 360;

// ── View-rotation sign mapping (the ONLY declaration of it) ───────────────────
//
// Internally the engine's pose rotation is the math-CCW matrix `rotateDeg` applied in
// y-down space, which reads as visual CW for a positive *internal* value. The single
// mapping between the user-facing (CCW-positive) angle and the internal angle is a
// negation. Applying it at the UI input boundary leaves the entire render path —
// poseToMatrix, the orbit transforms, and `overlapDepth` — byte-for-byte unchanged.
//
// DUAL-ROLE WARNING (the trap this design avoids): `template.defaultPose.rotationDeg`
// is read in TWO places — (i) as the seed for the live view rotation, and (ii) as the
// fixed `depthRotationDeg` recede angle for `overlapDepth` (engine/render.ts), which is
// pose-stripped and pose-independent. Negating the rotation *inside* poseToMatrix would
// flip (i) without flipping (ii), desyncing the displayed orientation from the painter's
// stacking order — silently breaking seigaiha at its default pose (no golden catches it;
// all goldens render at rotation 0). That is why the negation lives HERE, at the input
// boundary, and the two roles stay coupled through the unchanged internal convention.

/** User-facing (CCW-positive) angle → internal engine angle. Involution, mod 360. */
export const toInternalViewAngleDeg = (userDeg: number): number =>
  mod360(-userDeg);

/** Internal engine angle → user-facing (CCW-positive) angle. Involution, mod 360. */
export const toUserViewAngleDeg = (internalDeg: number): number =>
  mod360(-internalDeg);
