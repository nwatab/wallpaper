import { describe, it, expect } from 'vitest';
import type { GalleryMotif } from '../galleryMotifs';
import {
  placedUserMotif,
  referenceGroupOf,
  sameDrawingFrame,
} from './shapeFamilies';

// ─────────────────────────────────────────────────────────────────────────────
// M2 reset-on-CLASS-change + the draw-once-toggle re-mapping.
//   • sameDrawingFrame is true within a toggle set (the drawing is kept) and false
//     across congruence classes (the drawing is reset);
//   • a drawing authored in the reference frame is dynamically RE-MAPPED into each
//     member's region by the placement isometry — not statically carried — so toggling
//     produces genuinely different placed geometry.
// ─────────────────────────────────────────────────────────────────────────────

describe('sameDrawingFrame (reset-on-class-change rule)', () => {
  it('is true within a toggle set — drawing is kept across the toggle', () => {
    expect(sameDrawingFrame('p4m', 'p4g')).toBe(true);
    expect(sameDrawingFrame('p6', 'p31m')).toBe(true);
    expect(sameDrawingFrame('pm', 'pg')).toBe(true);
    expect(sameDrawingFrame('pmm', 'pmg')).toBe(true);
    expect(sameDrawingFrame('p4g', 'p4g')).toBe(true);
  });

  it('is false across congruence classes — drawing is reset', () => {
    expect(sameDrawingFrame('cm', 'p4m')).toBe(false); // singleton → toggle set
    expect(sameDrawingFrame('p4', 'p4m')).toBe(false); // square singleton → square toggle
    expect(sameDrawingFrame('cmm', 'cm')).toBe(false); // two different singletons
    expect(sameDrawingFrame('p4m', 'p6')).toBe(false); // two different toggle sets
  });
});

describe('drawing re-maps across a toggle (not statically carried)', () => {
  const motif: GalleryMotif = {
    strokes: [
      { pts: [{ x: 0.2, y: 0.05 }, { x: 0.4, y: 0.25 }], width: 0.04, color: '#000' },
    ],
  };
  const firstStroke = (m: GalleryMotif) => m.strokes![0].pts;

  it('the reference member places the drawing unchanged (identity placement)', () => {
    // p4m is the reference of {p4m, p4g}.
    expect(referenceGroupOf('p4g')).toBe('p4m');
    const placed = placedUserMotif('p4m', motif);
    expect(firstStroke(placed)).toEqual(motif.strokes![0].pts);
  });

  it('the other member re-maps the drawing by the placement isometry', () => {
    const placed = placedUserMotif('p4g', motif);
    const orig = motif.strokes![0].pts;
    const moved = firstStroke(placed);
    // Same number of points, but moved (isometry, not identity) — and still finite.
    expect(moved.length).toBe(orig.length);
    const changed = moved.some(
      (p, i) => Math.hypot(p.x - orig[i].x, p.y - orig[i].y) > 1e-6,
    );
    expect(changed).toBe(true);
    for (const p of moved) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });

  it('re-mapping is a true isometry — segment length preserved', () => {
    const seg = (pts: { x: number; y: number }[]) =>
      Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    const placed = placedUserMotif('p4g', motif);
    expect(seg(placed.strokes![0].pts)).toBeCloseTo(seg(motif.strokes![0].pts), 9);
  });
});
