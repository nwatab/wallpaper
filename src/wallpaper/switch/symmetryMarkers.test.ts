import { describe, it, expect } from 'vitest';
import { compileUnit } from '../engine/compile';
import { renderSymmetryElements } from '../engine/symmetryElements';
import { storedBasisOf } from './congruence';
import { asymmetricUnitUv } from '../regions';
import { applyToPolygon, basisToMatrix } from '../affine';
import type { Vec2, WallpaperGroup } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// SYMMETRY-ELEMENT OVERLAY: rotation-centre glyphs + viewport coverage.
//
// 1) Glyphs follow the Wikipedia cell-diagram legend — ◆ 2-fold, ▲ 3-fold, ■ 4-fold,
//    ⬢ 6-fold — so the marker SHAPE encodes the order.
//
// 2) Coverage regression for the bottom-right dropout: an element of the translated op
//    T_t∘g sits at (I−R)⁻¹(t + t_g) — a FRACTION of t (half rate for 2-fold centres and
//    mirror offsets) — so enumerating the engine's tile range (chosen so motif TILES
//    cover the view) left the corner of the view far from the XY origin bare. The
//    overlay now inverts each op's position map over the viewport corners; every view
//    quadrant must contain centre glyphs, and axis lines must pass near every corner.
// ─────────────────────────────────────────────────────────────────────────────

const render = (group: WallpaperGroup, view: number): string => {
  const basis = storedBasisOf(group);
  const regionXy = applyToPolygon(basisToMatrix(basis), asymmetricUnitUv[group]);
  const compiled = compileUnit({
    id: 'x',
    group,
    label: 'x',
    basis,
    regionXy,
    motifId: 'x',
  });
  return renderSymmetryElements({
    opsInCellXy: compiled.opsInCellXy,
    basis,
    // No translate: the XY origin sits at the view's top-left corner, the geometry in
    // which the old tile-range enumeration left the bottom-right of the view bare.
    poseMatrix: { a: 80, b: 0, c: 0, d: 80, e: 0, f: 0 },
    viewBox: { x: 0, y: 0, w: view, h: view },
  });
};

const polygons = (svg: string): Vec2[][] =>
  [...svg.matchAll(/<polygon points="([^"]+)"/g)].map((m) =>
    m[1].split(' ').map((pair) => {
      const [x, y] = pair.split(',').map(Number);
      return { x, y };
    }),
  );

const centroid = (pts: Vec2[]): Vec2 => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

type Glyph = 'diamond' | 'triangle' | 'square' | 'hexagon';

// Triangle/hexagon by vertex count; the two 4-gons split by aspect: the ■ 4-fold glyph
// is equilateral about its centre, the ◆ 2-fold rhombus is taller than wide.
const classify = (pts: Vec2[]): Glyph | null => {
  if (pts.length === 3) return 'triangle';
  if (pts.length === 6) return 'hexagon';
  if (pts.length !== 4) return null;
  const c = centroid(pts);
  const dx = Math.max(...pts.map((p) => Math.abs(p.x - c.x)));
  const dy = Math.max(...pts.map((p) => Math.abs(p.y - c.y)));
  return Math.abs(dx - dy) < 0.5 ? 'square' : 'diamond';
};

describe('symmetry overlay — Wikipedia rotation-centre glyphs', () => {
  const EXPECTED: Record<string, Glyph[]> = {
    p2: ['diamond'],
    p3: ['triangle'],
    p4: ['diamond', 'square'],
    p6: ['diamond', 'triangle', 'hexagon'],
  };
  for (const [group, glyphs] of Object.entries(EXPECTED)) {
    it(`${group} → ${glyphs.join(' + ')}`, () => {
      const seen = new Set(
        polygons(render(group as WallpaperGroup, 400)).map(classify),
      );
      expect([...seen].sort()).toEqual([...glyphs].sort());
    });
  }
});

describe('symmetry overlay — elements cover the whole viewport', () => {
  const VIEW = 800;
  const GROUPS: WallpaperGroup[] = ['p2', 'pmm', 'p4m', 'p6m'];

  it.each(GROUPS)('%s puts centre glyphs in every view quadrant', (group) => {
    const centres = polygons(render(group, VIEW)).map(centroid);
    const quadrant = (p: Vec2): string =>
      `${p.x < VIEW / 2 ? 'L' : 'R'}${p.y < VIEW / 2 ? 'T' : 'B'}`;
    const inView = centres.filter(
      (p) => p.x >= 0 && p.x <= VIEW && p.y >= 0 && p.y <= VIEW,
    );
    expect(new Set(inView.map(quadrant))).toEqual(
      new Set(['LT', 'RT', 'LB', 'RB']),
    );
  });

  it.each(['pmm', 'p4m', 'p6m'] as WallpaperGroup[])(
    '%s axis lines pass near every view corner',
    (group) => {
      const svg = render(group, VIEW);
      const lines = [...svg.matchAll(
        /<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g,
      )].map((m) => m.slice(1, 5).map(Number));
      const distTo = (c: Vec2): number =>
        Math.min(
          ...lines.map(([x1, y1, x2, y2]) => {
            const len = Math.hypot(x2 - x1, y2 - y1) || 1;
            return Math.abs(
              ((x2 - x1) * (c.y - y1) - (y2 - y1) * (c.x - x1)) / len,
            );
          }),
        );
      const corners: Vec2[] = [
        { x: 0, y: 0 },
        { x: VIEW, y: 0 },
        { x: 0, y: VIEW },
        { x: VIEW, y: VIEW },
      ];
      // Mirror families repeat every half-cell (≤ 40px at scale 80), so a corner more
      // than 80px from every axis line means the corner's lines were dropped.
      for (const c of corners) expect(distTo(c)).toBeLessThan(80);
    },
  );
});
