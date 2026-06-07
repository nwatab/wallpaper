import { describe, it, expect } from 'vitest';
import { groups } from './groups';
import { compose } from './affine';
import type { Affine2D, WallpaperGroup } from './types';

// The coset reps of a wallpaper group form a transversal of the translation lattice:
// for any two reps g_i, g_j, the product g_i ∘ g_j equals some rep g_k up to a lattice
// translation. In fractional (lattice-basis) coords the lattice is ℤ², so we compare
// linear parts exactly and translation parts modulo 1. This catches matrix typos in
// the hand-authored cosetReps without rendering anything.

const mod1 = (x: number): number => {
  const r = x - Math.round(x - 0.5 + 1e-9); // wrap to [0,1)
  return Math.abs(r) < 1e-9 || Math.abs(r - 1) < 1e-9 ? 0 : r;
};

const r6 = (x: number): number => Math.round(x * 1e6) / 1e6;

// Identity for the linear part + translation reduced mod the lattice.
const cosetKey = (m: Affine2D): string =>
  [r6(m.a), r6(m.b), r6(m.c), r6(m.d), r6(mod1(m.e)), r6(mod1(m.f))].join(',');

const det = (m: Affine2D): number => m.a * m.d - m.b * m.c;

// Expected point-group order and number of orientation-reversing ops (reflections +
// glides) per wallpaper group.
const expected: Record<WallpaperGroup, { order: number; reflections: number }> = {
  p1: { order: 1, reflections: 0 },
  p2: { order: 2, reflections: 0 },
  pm: { order: 2, reflections: 1 },
  pg: { order: 2, reflections: 1 },
  cm: { order: 2, reflections: 1 },
  pmm: { order: 4, reflections: 2 },
  pmg: { order: 4, reflections: 2 },
  pgg: { order: 4, reflections: 2 },
  cmm: { order: 4, reflections: 2 },
  p4: { order: 4, reflections: 0 },
  p4m: { order: 8, reflections: 4 },
  p4g: { order: 8, reflections: 4 },
  p3: { order: 3, reflections: 0 },
  p3m1: { order: 6, reflections: 3 },
  p31m: { order: 6, reflections: 3 },
  p6: { order: 6, reflections: 0 },
  p6m: { order: 12, reflections: 6 },
};

describe('wallpaper group cosetReps', () => {
  it('all 17 groups are defined', () => {
    expect(Object.keys(groups).sort()).toEqual(
      (Object.keys(expected) as WallpaperGroup[]).sort(),
    );
  });

  for (const name of Object.keys(expected) as WallpaperGroup[]) {
    describe(name, () => {
      const def = groups[name]!;
      const keys = def.cosetReps.map(cosetKey);
      const keySet = new Set(keys);

      it(`has order ${expected[name].order} with distinct reps`, () => {
        expect(def.cosetReps).toHaveLength(expected[name].order);
        expect(keySet.size).toBe(expected[name].order); // no duplicate cosets
      });

      it(`has ${expected[name].reflections} orientation-reversing ops`, () => {
        const reversing = def.cosetReps.filter((g) => det(g) < 0).length;
        expect(reversing).toBe(expected[name].reflections);
        // Isometries: |det| must be 1 for every rep.
        for (const g of def.cosetReps) {
          expect(Math.abs(det(g))).toBeCloseTo(1, 9);
        }
      });

      it('is closed under composition modulo the lattice', () => {
        for (const gi of def.cosetReps) {
          for (const gj of def.cosetReps) {
            const k = cosetKey(compose(gi, gj));
            expect(
              keySet.has(k),
              `${name}: product escaped the coset set (${k})`,
            ).toBe(true);
          }
        }
      });
    });
  }
});
