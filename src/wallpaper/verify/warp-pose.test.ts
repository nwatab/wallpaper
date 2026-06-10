import { describe, it, expect } from 'vitest';
import type { Vec2, WallpaperGroup } from '../types';
import { basisToMatrix, invert, applyToPoint, rotateDeg, compose } from '../affine';
import { asymmetricUnitUv } from '../regions';
import { tile } from '../engine/tile';
import { renderableByGroup } from '../switch/shapeFamilies';
import { unitTemplates } from '../unitTemplates';
import { cellFromGroup, cellFromTemplate } from '../export/exportSvg';
import { rotateBasis } from '../conformal/lattice';

// ─────────────────────────────────────────────────────────────────────────────
// WARP POSE — warp-empty must reproduce the gallery MAIN VIEW (the live global pose), NOT the
// swatch/defaultPose. (A test validates nothing beyond its anchor: an earlier version compared
// against the defaultPose render and "passed" while the warp was actually 210° off the main
// view.) The gallery puts its pose rotation in world→uv (cellToWorld = R·B, axis-aligned
// viewport); the warp must match that — rotate the base lattice (rotateBasis), NOT bake the
// per-template defaultPose. Uniform scale is the warp's separate framing/zoom (excluded here).
//
// WORLD-space, no pose stripping: for a grid of world points z, the warp's uv = fract(B_warp⁻¹·z)
// must equal the gallery main view's fold = fract(cellToWorld⁻¹·z), at the SAME (scale-normalised)
// rotation. At rotation 0 both reduce to the canonical fold.
// ─────────────────────────────────────────────────────────────────────────────

const ALL_GROUPS = Object.keys(asymmetricUnitUv) as WallpaperGroup[];
const ROTATIONS = [0, 45, 120, 210, 315];
const GRID: Vec2[] = [
  { x: 0.3, y: 0.2 },
  { x: 1.7, y: -0.6 },
  { x: -1.1, y: 0.9 },
  { x: 2.4, y: 1.3 },
  { x: -0.5, y: -1.8 },
];
const frac = (x: number): number => x - Math.floor(x);
const circDist = (a: number, b: number): number => {
  const d = Math.abs(frac(a - b));
  return Math.min(d, 1 - d);
};

describe('warp-empty reproduces the gallery MAIN VIEW (live rotation), for all 17 groups', () => {
  for (const group of ALL_GROUPS) {
    it(`${group}: warp uv-reduction == gallery main-view fold across rotations`, () => {
      const r = renderableByGroup().get(group);
      expect(r).toBeTruthy();
      if (!r) return;
      const cell = cellFromGroup(group, undefined);
      expect(cell).toBeTruthy();
      if (!cell) return;

      for (const R of ROTATIONS) {
        // Warp: the base lattice rotated by the LIVE rotation (what WarpPane uploads).
        const warpInv = invert(basisToMatrix(rotateBasis(cell.basis, R)));
        // Gallery MAIN VIEW fold at the same rotation (scale 1 — scale is framing only).
        const galleryInv = invert(
          tile({
            template: r.template,
            viewport: { x: 0, y: 0, width: 1, height: 1 },
            pose: { scale: 1, rotationDeg: R, translate: { x: 0, y: 0 } },
          }).cellToWorld,
        );
        for (const z of GRID) {
          const w = applyToPoint(warpInv, z);
          const g = applyToPoint(galleryInv, z);
          expect(circDist(frac(w.x), frac(g.x))).toBeLessThan(1e-9);
          expect(circDist(frac(w.y), frac(g.y))).toBeLessThan(1e-9);
        }
      }
    });
  }
});

describe('regression guard: the warp does NOT bake the per-template defaultPose', () => {
  const seigaiha = unitTemplates.find(
    (t) => t.id === 'cm-seigaiha-equilateral-triangle',
  )!;
  const defRot = seigaiha.defaultPose!.rotationDeg; // 210

  const close = (m: ReturnType<typeof basisToMatrix>, n: typeof m): boolean =>
    (['a', 'b', 'c', 'd', 'e', 'f'] as const).every(
      (k) => Math.abs(m[k] - n[k]) < 1e-9,
    );

  it('seigaiha warp basis at rotation 0 is CANONICAL (not rotated by defaultPose 210°)', () => {
    const canonical = basisToMatrix(cellFromTemplate(seigaiha).basis);
    const atZero = basisToMatrix(rotateBasis(cellFromTemplate(seigaiha).basis, 0));
    const defaultPosed = compose(rotateDeg(defRot), canonical);
    expect(close(atZero, canonical)).toBe(true); // matches the gallery main view at R=0
    expect(close(atZero, defaultPosed)).toBe(false); // the reverted regression — NOT 210°-baked
  });
});
