import type { Vec2, WallpaperGroup } from './types';

// Standard fundamental regions (characteristic polygons) in fractional unit-cell
// coordinates (uv ∈ [0,1]²). The SHAPE is canonical, not merely a valid domain: every
// vertex is a verified rotation centre (or, for the rotation-free groups, a corner of
// the mirror/glide/cell frame). Mirror groups use the kaleidoscope (characteristic)
// triangle itself; pure-rotation groups use two of those triangles joined along the
// edge whose mirror was dropped, so a 2-fold centre lands at the joined edge's midpoint.
// e.g. p6 = 30-30-120 triangle: a 3-fold centre (120° apex) + two 6-fold centres
// (30° base), with a 2-fold centre at the base midpoint.
// Each has area 1/|point group| and tiles the cell under the group's cosetReps ×
// lattice. This single definition is shared by glyph placement, overlay, and tests.
const v = (x: number, y: number): Vec2 => ({ x, y });
const T3 = 1 / 3;
const T23 = 2 / 3;

export const asymmetricUnitUv: Record<WallpaperGroup, Vec2[]> = {
  // order 1 — whole cell.
  p1: [v(0, 0), v(1, 0), v(1, 1), v(0, 1)],
  // order 2 — triangle with 2-fold centres at all three corners (4th at the
  // hypotenuse midpoint).
  p2: [v(0, 0), v(1, 0), v(0, 1)],
  // rotation-free groups: bounded by mirror/glide axes + cell edges.
  pm: [v(0, 0), v(0.5, 0), v(0.5, 1), v(0, 1)],
  pg: [v(0, 0), v(1, 0), v(1, 0.5), v(0, 0.5)],
  cm: [v(0, 0), v(1, 0), v(1, 1)],
  // order 4 (2-fold dihedral).
  pmm: [v(0, 0), v(0.5, 0), v(0.5, 0.5), v(0, 0.5)],
  pmg: [v(0, 0), v(0.5, 0), v(0.5, 0.5), v(0, 0.5)],
  pgg: [v(0, 0.5), v(1, 0.5), v(0.5, 1)],
  cmm: [v(0, 0), v(1, 0), v(0.5, 0.5)],
  // order 4 (4-fold): two *442 characteristic triangles → corners are 4-fold centres,
  // 2-fold centre at the base midpoint (1/2,0).
  p4: [v(0, 0), v(1, 0), v(0.5, 0.5)],
  // order 8: *442 characteristic triangle {4,4,2}.
  p4m: [v(0, 0), v(0.5, 0), v(0.5, 0.5)],
  // order 8: 4*2 characteristic triangle {4,2,2}.
  p4g: [v(0, 0), v(0.5, 0), v(0, 0.5)],
  // order 3: 333 domain — rhombus with a 3-fold centre at each corner.
  p3: [v(0, 0), v(T23, T3), v(1, 1), v(T3, T23)],
  // order 6: 30-30-120 triangle — 3-fold apex + two 6-fold base corners,
  // 2-fold centre at base midpoint (1/2,1/2).
  p6: [v(0, 0), v(T3, T23), v(1, 1)],
  // order 6: *333 characteristic triangle joining the three 3-fold centres.
  p3m1: [v(0, 0), v(T23, T3), v(T3, T23)],
  // order 6: 3*3 characteristic triangle.
  p31m: [v(0, 0), v(T23, T3), v(1, 1)],
  // order 12: *632 characteristic triangle {6,2,3}.
  p6m: [v(0, 0), v(0.5, 0), v(T23, T3)],
};
