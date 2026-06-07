import { describe, it, expect } from 'vitest';
import { asymmetricUnitUv } from '../regions';
import { getGroup } from '../groups';
import { basisToMatrix, conjugateByBasis, applyToPolygon } from '../affine';
import { rotationOrderAtPoint } from './symmetry';
import type { Vec2, WallpaperGroup } from '../types';

// The region SHAPE is pinned canonically: every vertex must coincide with a verified
// rotation centre of a specific order (the orbifold corner orders — the authority).
// Area + tiling are necessary; matching the rotation-centre vertices is sufficient to
// fix the standard characteristic polygon (so M3 region→group is well defined).
// DO NOT edit these expected orders to make a test pass; fix the region in regions.ts.
const S3_2 = Math.sqrt(3) / 2;
const SQUARE = { a: { x: 1, y: 0 }, b: { x: 0, y: 1 } };
const RHOMBIC = { a: { x: 1, y: 0.5 }, b: { x: 1, y: -0.5 } };
const HEX = { a: { x: 1, y: 0 }, b: { x: -0.5, y: S3_2 } };

const CASES: Array<{
  group: WallpaperGroup;
  basis: { a: Vec2; b: Vec2 };
  vertexOrders: number[]; // sorted; rotation order at each region vertex
}> = [
  { group: 'p2', basis: SQUARE, vertexOrders: [2, 2, 2] },
  { group: 'pmm', basis: SQUARE, vertexOrders: [2, 2, 2, 2] },
  { group: 'cmm', basis: RHOMBIC, vertexOrders: [2, 2, 2] },
  { group: 'p4', basis: SQUARE, vertexOrders: [4, 4, 4] },
  { group: 'p4m', basis: SQUARE, vertexOrders: [2, 4, 4] },
  { group: 'p4g', basis: SQUARE, vertexOrders: [2, 2, 4] },
  { group: 'p3', basis: HEX, vertexOrders: [3, 3, 3, 3] },
  { group: 'p3m1', basis: HEX, vertexOrders: [3, 3, 3] },
  { group: 'p31m', basis: HEX, vertexOrders: [3, 3, 3] },
  { group: 'p6', basis: HEX, vertexOrders: [3, 6, 6] },
  { group: 'p6m', basis: HEX, vertexOrders: [2, 3, 6] },
];

const opsXyOf = (group: WallpaperGroup, basis: { a: Vec2; b: Vec2 }) => {
  const B = basisToMatrix(basis);
  return getGroup(group).cosetReps.map((op) => conjugateByBasis(B, op));
};

describe('(6) canonical region vertices coincide with verified rotation centres', () => {
  for (const { group, basis, vertexOrders } of CASES) {
    it(`${group} vertices have rotation orders ${JSON.stringify(vertexOrders)}`, () => {
      const ops = opsXyOf(group, basis);
      const verticesXy = applyToPolygon(
        basisToMatrix(basis),
        asymmetricUnitUv[group],
      );
      const orders = verticesXy
        .map((p) => rotationOrderAtPoint(ops, basis, p))
        .sort((a, b) => a - b);
      expect(orders).toEqual(vertexOrders);
    });
  }
});
