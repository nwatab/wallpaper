// ─────────────────────────────────────────────────────────────────────────────
// VIEW STAGE — places a chosen `center` at canonical `0` (with zoom/pan hooks).
//
// Pipeline position:  group orbit (canonical) → [view recenter T_{-center}] →
//   [future conformal W around 0/∞] → surface adapter → pixels.
//
// `center` is a PARAMETER: it is the `0` of the future conformal maps. Its default is
// the geometric centre of the displayed extent, which makes the recenter output-
// preserving (the same pixels as the old top-left viewBox, just re-windowed). The
// conformal layer can later pass a different centre (e.g. a principal rotation centre)
// without any change here.
// ─────────────────────────────────────────────────────────────────────────────

import type { Affine2D, Vec2 } from '@/wallpaper/types';
import { translateXy } from '@/wallpaper/affine';

/** A rectangular extent in canonical coordinates ({w,h} match Scene.viewBox). */
export type Extent = { x: number; y: number; w: number; h: number };

export type ViewParams = {
  /** The canonical point to place at `0` (viewport centre). */
  center: Vec2;
  /** Forward hooks — not used this PR (identity zoom, no pan). */
  zoom?: number;
  pan?: Vec2;
};

/** Geometric centre of an extent — the output-preserving default `center`. */
export const extentCenter = (e: Extent): Vec2 => ({
  x: e.x + e.w / 2,
  y: e.y + e.h / 2,
});

/**
 * Canonical → canonical: translate so `center` lands at `0`. zoom/pan are accepted as
 * forward hooks for the conformal layer; this PR uses zoom = 1, pan = 0 (pure recenter).
 */
export const viewTransform = (v: ViewParams): Affine2D =>
  translateXy(-v.center.x, -v.center.y);

/** Inverse of {@link viewTransform} — required for pointer input round-trips. */
export const inverseViewTransform = (v: ViewParams): Affine2D =>
  translateXy(v.center.x, v.center.y);
