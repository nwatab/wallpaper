// ─────────────────────────────────────────────────────────────────────────────
// SURFACE ADAPTERS — the explicit canonical → surface transform (and its inverse) for
// each concrete render/input target. Each adapter is a pure function; the inverse is
// required for pointer input. No surface hardcodes a flip or a viewBox literal — the
// orientation is DERIVED from canonical space (see canonical.ts).
// ─────────────────────────────────────────────────────────────────────────────

import type { Affine2D } from '@/wallpaper/types';
import { identity } from '@/wallpaper/affine';
import { Y_AXIS_DIRECTION } from './canonical';

// ── SVG ───────────────────────────────────────────────────────────────────────

export type SvgSurface = {
  /** Centred viewBox: `[-w/2, -h/2, w, h]` (criterion: declared `center` → `0`). */
  viewBox: { x: number; y: number; w: number; h: number };
  /** canonical → SVG user space. */
  forward: Affine2D;
  /** SVG user space → canonical (pointer input). */
  inverse: Affine2D;
};

/**
 * SVG adapter. SVG user space is y-down. Canonical space is y-down (canonical.ts), so
 * the orientation map is the IDENTITY — no `scale(1,-1)`, no mirror. (Were canonical
 * y-up, this is exactly where the flip would be derived from the centred viewBox; the
 * single `Y_AXIS_DIRECTION` switch keeps that future change isolated to this function.)
 *
 * The viewBox is centred at `0`; the caller pairs it with the view-stage recenter
 * (view.ts `viewTransform`) so content drawn around `center` lands inside the box.
 */
export const toSVG = (size: { w: number; h: number }): SvgSurface => {
  const flipY = Y_AXIS_DIRECTION === 'down' ? identity() : { ...identity(), d: -1 };
  return {
    viewBox: { x: -size.w / 2, y: -size.h / 2, w: size.w, h: size.h },
    forward: flipY,
    inverse: flipY, // scale(1,±1) is its own inverse
  };
};

// ── WebGL (contract-only this PR) ──────────────────────────────────────────────

export type WebGLSurface = {
  /** canonical → NDC `[-1,1]²`. */
  forward: Affine2D;
  /** NDC → canonical. */
  inverse: Affine2D;
};

/**
 * WebGL adapter on a symmetric frustum `[-a,a] × [-b,b]`. NDC is centre-origin and
 * y-UP; canonical is y-down — so this carries the ONE legitimate y-flip in the system
 * (a surface fact, not a stray flip): `ndc = (x/a, -y/b)`.
 *
 * SCOPE: shipped as the forward INTERFACE + contract test only. The live glRenderer is
 * NOT rerouted through this in this PR (its existing even-parity rigging is left intact
 * per the approved plan); this documents the canonical↔NDC contract for the future.
 */
export const toWebGL = (frustum: { a: number; b: number }): WebGLSurface => {
  const { a, b } = frustum;
  return {
    forward: { a: 1 / a, b: 0, c: 0, d: -1 / b, e: 0, f: 0 },
    inverse: { a, b: 0, c: 0, d: -b, e: 0, f: 0 },
  };
};
