import { describe, it, expect } from 'vitest';
import type { Vec2 } from '../types';
import {
  frac,
  worldToCellUv,
  worldToCellContinuous,
  latticeTranslate,
} from './lattice';

// Square, skewed-hex, and oblique bases — the reduction must hold for any lattice.
const SQUARE = { a: { x: 1, y: 0 }, b: { x: 0, y: 1 } };
const HEX = { a: { x: 1, y: 0 }, b: { x: 0.5, y: Math.sqrt(3) / 2 } };
const OBLIQUE = { a: { x: 1.3, y: 0.2 }, b: { x: -0.4, y: 0.9 } };
const BASES = [SQUARE, HEX, OBLIQUE];

const SAMPLE_Z: Vec2[] = [
  { x: 0.3, y: 0.7 },
  { x: -1.2, y: 0.4 },
  { x: 2.5, y: -1.5 },
  { x: 0.0, y: 0.0 },
];

describe('frac', () => {
  it('folds into [0,1) for negatives too', () => {
    expect(frac(2.25)).toBeCloseTo(0.25, 12);
    expect(frac(-0.25)).toBeCloseTo(0.75, 12);
    expect(frac(3)).toBeCloseTo(0, 12);
  });
});

describe('lattice reduction uv = frac(B⁻¹·z)', () => {
  it('always lands in [0,1)²', () => {
    for (const basis of BASES) {
      for (const z of SAMPLE_Z) {
        const uv = worldToCellUv(basis, z);
        expect(uv.x).toBeGreaterThanOrEqual(0);
        expect(uv.x).toBeLessThan(1);
        expect(uv.y).toBeGreaterThanOrEqual(0);
        expect(uv.y).toBeLessThan(1);
      }
    }
  });

  // uv lives on a torus: 0 and 1−ε are the same point (REPEAT wrap samples adjacent texels),
  // so equality is the CIRCULAR distance ≈ 0, not raw |a−b| — a value that should be integer
  // can fall to 0.9999999998 by floating-point and is "equal" to 0.
  const circDist = (a: number, b: number): number => {
    const d = Math.abs(frac(a - b));
    return Math.min(d, 1 - d);
  };

  it('z and z + (i·a + j·b) reduce to the SAME uv (the seamless-wrap guarantee)', () => {
    const offsets = [
      { i: 1, j: 0 },
      { i: 0, j: 1 },
      { i: -3, j: 2 },
      { i: 5, j: -4 },
    ];
    for (const basis of BASES) {
      for (const z of SAMPLE_Z) {
        const base = worldToCellUv(basis, z);
        for (const { i, j } of offsets) {
          const t = latticeTranslate(basis, i, j);
          const shifted = worldToCellUv(basis, { x: z.x + t.x, y: z.y + t.y });
          expect(circDist(shifted.x, base.x)).toBeLessThan(1e-9);
          expect(circDist(shifted.y, base.y)).toBeLessThan(1e-9);
        }
      }
    }
  });

  it('continuous coords invert the basis: B·(B⁻¹·z) = z', () => {
    for (const basis of BASES) {
      for (const z of SAMPLE_Z) {
        const c = worldToCellContinuous(basis, z);
        const back = {
          x: c.x * basis.a.x + c.y * basis.b.x,
          y: c.x * basis.a.y + c.y * basis.b.y,
        };
        expect(back.x).toBeCloseTo(z.x, 9);
        expect(back.y).toBeCloseTo(z.y, 9);
      }
    }
  });
});
