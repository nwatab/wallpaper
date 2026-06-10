import { describe, it, expect } from 'vitest';
import type { Vec2, WallpaperGroup, Affine2D } from '../types';
import { basisToMatrix, invert, applyToPoint } from '../affine';
import { tile } from '../engine/tile';
import { unitTemplates } from '../unitTemplates';
import { cellStampTransforms } from '../export/exportSvg';

// ─────────────────────────────────────────────────────────────────────────────
// WARP FIDELITY — independent oracle (the trap-free test).
//
// Prior tests reconstructed the "expected" with the SAME B / cell-uv ops the warp uses, so a
// wrong B would cancel and pass green. This compares two DIFFERENT, independent code paths over
// a dense WORLD grid:
//   • GALLERY side = the REAL render geometry: tile()'s orbit transforms (pose∘latticeT∘opXY∘B)
//     placing the motif in world. (This is exactly what svgRenderer/the main view stamps.)
//   • WARP side    = the cell-texture pipeline: uv = fract(B⁻¹·z), then the cell content at uv
//     (cellStampTransforms in the unit square). NO orbit transforms here.
// An asymmetric test motif (so a shear/rotation can't hide behind symmetry) is placed by each
// path; the ink masks must agree. Run on the NON-RECTANGULAR lattices (oblique/hex/rhombic)
// where a shear would bite, plus a square/rect control.
// ─────────────────────────────────────────────────────────────────────────────

// Deliberately asymmetric (no mirror/rotation symmetry) so orientation/shear errors show.
const TEST_MOTIF: Vec2[] = [
  { x: 0.18, y: 0.22 },
  { x: 0.62, y: 0.16 },
  { x: 0.7, y: 0.44 },
  { x: 0.4, y: 0.38 },
  { x: 0.36, y: 0.7 },
  { x: 0.2, y: 0.6 },
];

const pointInPolygon = (p: Vec2, poly: Vec2[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
};

const frac = (x: number): number => x - Math.floor(x);

// One representative template per lattice type (most-oblique where there's a choice).
const TEMPLATE_BY_GROUP = (group: WallpaperGroup) =>
  unitTemplates.find((t) => t.group === group);

const CASES: { group: WallpaperGroup; kind: string }[] = [
  { group: 'p1', kind: 'oblique' },
  { group: 'p2', kind: 'oblique/hex' },
  { group: 'p3', kind: 'hex 120°' },
  { group: 'p6', kind: 'hex 120°' },
  { group: 'cm', kind: 'rhombic' },
  { group: 'cmm', kind: 'rhombic' },
  { group: 'p4', kind: 'square (control)' },
  { group: 'pmm', kind: 'rectangular (control)' },
];

describe('warp cell sampling reproduces the gallery orbit placement (independent oracle)', () => {
  for (const { group, kind } of CASES) {
    const template = TEMPLATE_BY_GROUP(group);
    it(`${group} (${kind}): ink masks agree over a world grid`, () => {
      expect(template).toBeTruthy();
      if (!template) return;

      // Identity pose so the gallery orbit is the canonical placement (the warp also samples
      // the canonical cell; the live rotation is verified separately in warp-pose.test.ts).
      const viewport = { x: -1, y: -1, width: 6, height: 6 };
      const { orbitElements, opsInCellXy, basis } = tile({
        template,
        viewport,
        pose: { scale: 1, rotationDeg: 0, translate: { x: 0, y: 0 } },
      });
      const B = basisToMatrix(basis);
      const Binv = invert(B);
      const stamps = cellStampTransforms(basis, opsInCellXy);
      const stampInv: Affine2D[] = stamps.map((s) => invert(s));
      const orbitInv: Affine2D[] = orbitElements.map((el) => invert(el.transform));

      // GALLERY: world z is ink iff some orbit copy maps it into the motif.
      const galleryInk = (z: Vec2): boolean =>
        orbitInv.some((inv) => pointInPolygon(applyToPoint(inv, z), TEST_MOTIF));

      // WARP: fold to cell uv, then the cell-texture content at uv (any stamp's motif copy).
      const warpInk = (z: Vec2): boolean => {
        const c = applyToPoint(Binv, z);
        const uv = { x: frac(c.x), y: frac(c.y) };
        return stampInv.some((inv) =>
          pointInPolygon(applyToPoint(inv, uv), TEST_MOTIF),
        );
      };

      // Dense world grid well inside the overscanned orbit (avoid the coverage edge), offset
      // off exact lattice lines so boundary ties don't cause spurious flips.
      const N = 60;
      let disagreements = 0;
      let inkCount = 0;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const z = { x: 0.5 + (i + 0.37) / N * 2.0, y: 0.5 + (j + 0.41) / N * 2.0 };
          const g = galleryInk(z);
          const w = warpInk(z);
          if (g) inkCount++;
          if (g !== w) disagreements++;
        }
      }
      // Sanity: the motif actually covers some of the grid (test isn't vacuous).
      expect(inkCount).toBeGreaterThan(0);
      expect(disagreements).toBe(0);
    });
  }
});
