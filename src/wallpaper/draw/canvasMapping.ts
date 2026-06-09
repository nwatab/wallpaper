import type { Affine2D, Vec2 } from '../types';
import { applyToPoint, invert } from '../affine';

// ─────────────────────────────────────────────────────────────────────────────
// POLYGON ↔ CANVAS MAPPING (M2 draw capture).
//
// The draw pane presents ONE fundamental region — in true XY geometry, so a hex or
// rhombic region shows its real angles — at a fixed, un-posed scale. Capturing a
// pointer position is then a SINGLE clean affine, independent of the wallpaper's
// pose/alignment. The given polygon's bounding box is fitted into the canvas rect with
// a uniform (aspect-preserving) scale, centred, with source axes aligned to the canvas
// axes (x → right, y → down) to match the SVG Y-down convention the engine renders in.
//
// Space-neutral: the source polygon may be XY (region/cell) or uv — the mapping only
// fits a bbox. Pure geometry, no DOM. `toCanvas` and `fromCanvas` are exact inverses,
// so a captured stroke round-trips, which makes the capture model unit-testable even
// though the canvas UI is not.
// ─────────────────────────────────────────────────────────────────────────────

export type CanvasRect = { width: number; height: number; padding?: number };

export type CanvasMapping = {
  toCanvas: Affine2D;
  fromCanvas: Affine2D;
};

const bbox = (poly: Vec2[]): { min: Vec2; max: Vec2 } => {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  return {
    min: { x: Math.min(...xs), y: Math.min(...ys) },
    max: { x: Math.max(...xs), y: Math.max(...ys) },
  };
};

/**
 * Build the source↔canvas mapping for a polygon shown in a canvas rect. A uniform
 * scale fits the polygon's bbox inside the padded rect; the result is centred. Both
 * directions are returned (fromCanvas = invert(toCanvas)).
 */
export const buildCanvasMapping = (
  poly: Vec2[],
  canvas: CanvasRect,
): CanvasMapping => {
  const pad = canvas.padding ?? 0;
  const { min, max } = bbox(poly);
  const dx = max.x - min.x || 1;
  const dy = max.y - min.y || 1;
  const availW = Math.max(1, canvas.width - 2 * pad);
  const availH = Math.max(1, canvas.height - 2 * pad);
  const s = Math.min(availW / dx, availH / dy);

  // Centre the scaled polygon within the canvas.
  const offX = (canvas.width - s * dx) / 2 - s * min.x;
  const offY = (canvas.height - s * dy) / 2 - s * min.y;

  const toCanvas: Affine2D = { a: s, b: 0, c: 0, d: s, e: offX, f: offY };
  return { toCanvas, fromCanvas: invert(toCanvas) };
};

export const pointToCanvas = (m: CanvasMapping, p: Vec2): Vec2 =>
  applyToPoint(m.toCanvas, p);

export const pointFromCanvas = (m: CanvasMapping, p: Vec2): Vec2 =>
  applyToPoint(m.fromCanvas, p);
