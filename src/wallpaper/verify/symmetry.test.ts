import { describe, it, expect } from 'vitest';
import { unitTemplates } from '../unitTemplates';
import { compileUnit } from '../engine/compile';
import { tile } from '../engine/tile';
import { applyToPoint } from '../affine';
import {
  analyzeGroup,
  highestRotationCentresOnMirrors,
  orbitTiling,
  cellArea,
  polygonArea,
  toCellFrac,
} from './symmetry';
import type { Affine2D, Vec2, WallpaperGroup } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// IMMUTABLE EXTERNAL REFERENCE TABLE — the standard classification of the 17
// wallpaper groups (International Tables / Schattschneider). This is the authority.
// DO NOT edit these values to make tests pass; if a test fails, fix groups.ts.
// ─────────────────────────────────────────────────────────────────────────────
const TABLE: Record<
  WallpaperGroup,
  { order: number; maxRot: number; mirrorDirs: number; glide: boolean }
> = {
  p1: { order: 1, maxRot: 1, mirrorDirs: 0, glide: false },
  p2: { order: 2, maxRot: 2, mirrorDirs: 0, glide: false },
  pm: { order: 2, maxRot: 1, mirrorDirs: 1, glide: false },
  pg: { order: 2, maxRot: 1, mirrorDirs: 0, glide: true },
  cm: { order: 2, maxRot: 1, mirrorDirs: 1, glide: true },
  pmm: { order: 4, maxRot: 2, mirrorDirs: 2, glide: false },
  pmg: { order: 4, maxRot: 2, mirrorDirs: 1, glide: true },
  pgg: { order: 4, maxRot: 2, mirrorDirs: 0, glide: true },
  cmm: { order: 4, maxRot: 2, mirrorDirs: 2, glide: true },
  p4: { order: 4, maxRot: 4, mirrorDirs: 0, glide: false },
  p4m: { order: 8, maxRot: 4, mirrorDirs: 4, glide: true },
  p4g: { order: 8, maxRot: 4, mirrorDirs: 2, glide: true },
  p3: { order: 3, maxRot: 3, mirrorDirs: 0, glide: false },
  p3m1: { order: 6, maxRot: 3, mirrorDirs: 3, glide: true },
  p31m: { order: 6, maxRot: 3, mirrorDirs: 3, glide: true },
  p6: { order: 6, maxRot: 6, mirrorDirs: 0, glide: false },
  p6m: { order: 12, maxRot: 6, mirrorDirs: 6, glide: true },
};

// Incidence discriminator (the real p4m↔p4g and p3m1↔p31m separators):
// do ALL highest-order rotation centres lie on pure-mirror lines?
const INCIDENCE: Partial<Record<WallpaperGroup, boolean>> = {
  p4m: true,
  p4g: false,
  p3m1: true,
  p31m: false,
};

// A representative template (basis + XY ops) per group.
const repByGroup = new Map<
  WallpaperGroup,
  { ops: Affine2D[]; basis: { a: { x: number; y: number }; b: { x: number; y: number } } }
>();
for (const t of unitTemplates) {
  if (!repByGroup.has(t.group)) {
    const compiled = compileUnit(t);
    repByGroup.set(t.group, { ops: compiled.opsInCellXy, basis: compiled.basis });
  }
}

const det = (m: Affine2D): number => m.a * m.d - m.b * m.c;
const normDeg = (d: number): number => ((Math.round(d) % 360) + 360) % 360;

// Orientation-reversing ops = reflections + glides. Dihedral groups have order/2 of
// them; pure-rotation groups (p1,p2,p3,p4,p6) have none.
const expectedReversing = (name: WallpaperGroup): number =>
  TABLE[name].mirrorDirs > 0 || TABLE[name].glide ? TABLE[name].order / 2 : 0;

describe('(1) coset/point-group invariants match the reference table', () => {
  for (const name of Object.keys(TABLE) as WallpaperGroup[]) {
    it(`${name}`, () => {
      const rep = repByGroup.get(name);
      expect(rep, `no template for ${name}`).toBeDefined();
      const a = analyzeGroup(rep!.ops, rep!.basis);
      expect(a.order, 'point-group order').toBe(TABLE[name].order);
      expect(a.maxRotationOrder, 'max rotation order').toBe(TABLE[name].maxRot);
      expect(a.mirrorDirections, 'pure-mirror directions').toBe(
        TABLE[name].mirrorDirs,
      );
      expect(a.hasGlide, 'glide present').toBe(TABLE[name].glide);

      // Count of orientation-reversing (conjugate=true) ops. For pure-rotation groups
      // this must be 0 — a single reflection here would turn p6 into p6m, etc.
      const reversing = rep!.ops.filter((o) => det(o) < 0).length;
      expect(reversing, 'orientation-reversing ops').toBe(
        expectedReversing(name),
      );
    });
  }
});

describe('(2) geometric incidence of highest-order rotation centres on mirrors', () => {
  for (const name of Object.keys(INCIDENCE) as WallpaperGroup[]) {
    it(`${name} → centres on mirrors = ${INCIDENCE[name]}`, () => {
      const rep = repByGroup.get(name)!;
      expect(highestRotationCentresOnMirrors(rep.ops, rep.basis)).toBe(
        INCIDENCE[name],
      );
    });
  }
});

describe('(3) region validity: area = cell/order and the region tiles the cell', () => {
  for (const t of unitTemplates) {
    it(`${t.id}`, () => {
      const compiled = compileUnit(t);
      const order = TABLE[t.group].order;

      // (a) area = cellArea / point-group order — on the actual region object.
      expect(
        polygonArea(compiled.regionXy),
        'region area = cellArea / order',
      ).toBeCloseTo(cellArea(compiled.basis) / order, 6);

      // (b) cosetReps × lattice of the region tiles the cell exactly.
      const { coverRatio, maxOverlap } = orbitTiling(
        compiled.regionXy,
        compiled.opsInCellXy,
        compiled.basis,
      );
      expect(coverRatio, 'cell coverage ratio').toBeCloseTo(1, 3);
      expect(maxOverlap, 'pairwise interior overlap').toBeLessThan(1e-3);
    });
  }
});

// Generic anchor (off every mirror/diagonal) so a glyph's orbit has trivial stabiliser.
const ANCHOR: Vec2 = { x: 0.2, y: 0.13 };
const keyOf = (basis: { a: Vec2; b: Vec2 }, p: Vec2): string => {
  const f = toCellFrac(basis, p);
  return `${Math.round(f.x / 1e-4)},${Math.round(f.y / 1e-4)}`;
};

describe('(4) render-level symmetry from the same tile() the renderer uses', () => {
  for (const t of unitTemplates) {
    it(`${t.id}`, () => {
      const compiled = compileUnit(t);
      const order = TABLE[t.group].order;

      // Drive the actual render path: tile() = cosetReps × lattice (pose = identity).
      const { orbitElements } = tile({
        template: t,
        viewport: { x: -3, y: -3, width: 6, height: 6 },
        pose: { scale: 1, rotationDeg: 0, translate: { x: 0, y: 0 } },
      });

      // Anchor positions of every drawn instance, reduced mod the lattice.
      const anchors = orbitElements.map((el) =>
        applyToPoint(el.transform, ANCHOR),
      );
      const distinct = new Set(anchors.map((p) => keyOf(compiled.basis, p)));

      // Copies per cell = point-group order.
      expect(distinct.size, 'distinct copies per cell').toBe(order);

      // Each coset rep maps the instance set onto itself (mod lattice).
      for (const g of compiled.opsInCellXy) {
        const mapped = new Set(
          anchors.map((p) => keyOf(compiled.basis, applyToPoint(g, p))),
        );
        expect(mapped, 'g · set ≅ set (mod lattice)').toEqual(distinct);
      }
    });
  }
});

describe('(5) p6 is pure C6 — six rotations, zero reflections', () => {
  const p6 = compileUnit(unitTemplates.find((t) => t.id === 'test-p6')!);

  it('cosetReps: exactly 6, all orientation-preserving, angles 0/60/120/180/240/300°', () => {
    expect(p6.opsInCellXy).toHaveLength(6);
    // Every op is conjugate=false (det > 0): not one reflection.
    for (const op of p6.opsInCellXy) {
      expect(det(op), 'det > 0 (orientation preserving)').toBeGreaterThan(0);
    }
    const angles = p6.opsInCellXy
      .map((op) => normDeg((Math.atan2(op.b, op.a) * 180) / Math.PI))
      .sort((x, y) => x - y);
    expect(angles).toEqual([0, 60, 120, 180, 240, 300]);
  });

  it('render: 6 copies/cell, every drawn copy orientation-preserving, set fixed by all 6 rotations', () => {
    const { orbitElements } = tile({
      template: unitTemplates.find((t) => t.id === 'test-p6')!,
      viewport: { x: -3, y: -3, width: 6, height: 6 },
      pose: { scale: 1, rotationDeg: 0, translate: { x: 0, y: 0 } },
    });

    // Not a single mirrored copy: every drawn instance has the same handedness.
    const signs = new Set(orbitElements.map((el) => Math.sign(det(el.transform))));
    expect(signs.size, 'all copies same handedness (no reflection)').toBe(1);

    const anchors = orbitElements.map((el) => applyToPoint(el.transform, ANCHOR));
    const distinct = new Set(anchors.map((p) => keyOf(p6.basis, p)));
    expect(distinct.size, '6 copies per cell').toBe(6);

    for (const g of p6.opsInCellXy) {
      const mapped = new Set(
        anchors.map((p) => keyOf(p6.basis, applyToPoint(g, p))),
      );
      expect(mapped, 'set invariant under each of the 6 rotations').toEqual(
        distinct,
      );
    }
  });
});
