import { describe, it, expect } from 'vitest';
import { compileUnit } from './compile';
import { unitTemplates } from '../unitTemplates';
import type { Affine2D } from '../types';

const S3_2 = Math.sqrt(3) / 2;
const I: Affine2D = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

// XY ops exactly as they were hand-authored inline in unitTemplates.ts before the
// group-data refactor. compileUnit now derives these by conjugating the group's
// fractional cosetReps with each template's basis — this pins that they match.
const expectedOpsById: Record<string, Affine2D[]> = {
  'p1-parallelogram-70deg': [I],
  'p2-hex-equilateral-triangle': [
    I,
    { a: -1, b: 0, c: 0, d: -1, e: 1.5, f: S3_2 },
  ],
  'pm-rectangular-vertical-mirrors': [
    I,
    { a: -1, b: 0, c: 0, d: 1, e: 1, f: 0 },
  ],
  'pg-rectangular-horizontal-glides': [
    I,
    { a: 1, b: 0, c: 0, d: -1, e: 0.5, f: 1 },
  ],
  'cm-seigaiha-equilateral-triangle': [
    I,
    { a: -0.5, b: S3_2, c: S3_2, d: 0.5, e: 0, f: 0 },
  ],
  'pmm-rectangular': [
    I,
    { a: -1, b: 0, c: 0, d: 1, e: 1, f: 0 },
    { a: 1, b: 0, c: 0, d: -1, e: 0, f: 1 },
    { a: -1, b: 0, c: 0, d: -1, e: 1, f: 1 },
  ],
  'pmg-rectangular-vertical-mirrors': [
    I,
    { a: -1, b: 0, c: 0, d: 1, e: 1, f: 0 },
    { a: 1, b: 0, c: 0, d: -1, e: 0.5, f: 1 },
    { a: -1, b: 0, c: 0, d: -1, e: 0.5, f: 1 },
  ],
  'pgg-rectangular': [
    I,
    { a: 1, b: 0, c: 0, d: -1, e: 0.5, f: 1.5 },
    { a: -1, b: 0, c: 0, d: -1, e: 1, f: 1 },
    { a: -1, b: 0, c: 0, d: 1, e: 0.5, f: -0.5 },
  ],
  'cm-houndstooth': [I, { a: 0, b: 1, c: 1, d: 0, e: 0, f: 0 }],
};

const byId = new Map(unitTemplates.map((t) => [t.id, t]));

describe('compileUnit derives XY ops matching the original inlined matrices', () => {
  for (const [id, expected] of Object.entries(expectedOpsById)) {
    it(`${id}`, () => {
      const template = byId.get(id);
      expect(template, `template ${id} not found`).toBeDefined();

      const { opsInCellXy } = compileUnit(template!);
      expect(opsInCellXy).toHaveLength(expected.length);

      opsInCellXy.forEach((op, k) => {
        for (const key of ['a', 'b', 'c', 'd', 'e', 'f'] as const) {
          expect(op[key], `op[${k}].${key}`).toBeCloseTo(expected[k][key], 9);
        }
      });
    });
  }

  it('every original design template has a recorded expectation', () => {
    // Pins the pre-refactor designs. New ids (e.g. test-* glyphs) are exempt.
    const designIds = unitTemplates
      .map((t) => t.id)
      .filter((id) => !id.startsWith('test-'));
    expect(designIds.sort()).toEqual(Object.keys(expectedOpsById).sort());
  });
});

describe('compiled XY ops are isometries for every template', () => {
  // If a template's basis does not match its group (e.g. a 60° basis paired with the
  // 120° hexagonal rotation matrices), conjugation produces a shear — the linear part
  // is no longer orthonormal. This pins that basis ↔ group pairings are consistent.
  for (const template of unitTemplates) {
    it(`${template.id}`, () => {
      const { opsInCellXy } = compileUnit(template);
      for (const op of opsInCellXy) {
        // Columns (a,b) and (c,d) must be orthonormal.
        expect(op.a * op.a + op.b * op.b, 'col1 unit').toBeCloseTo(1, 9);
        expect(op.c * op.c + op.d * op.d, 'col2 unit').toBeCloseTo(1, 9);
        expect(op.a * op.c + op.b * op.d, 'cols orthogonal').toBeCloseTo(0, 9);
      }
    });
  }
});
