import type { Affine2D, Vec2 } from '../types';
import {
  applyToPoint,
  applyToPolygon,
  compose,
  invert,
  translateXy,
  basisToMatrix,
} from '../affine';
import {
  EPS,
  scale,
  dot,
  norm,
  area,
  intersectConvex,
  intersectionArea,
  distancePointToLine,
} from './geometry';

export type Basis = { a: Vec2; b: Vec2 };

const det = (m: Affine2D): number => m.a * m.d - m.b * m.c;
const isRotation = (m: Affine2D): boolean => det(m) > 0;
const isReflection = (m: Affine2D): boolean => det(m) < 0;

const TWO_PI = Math.PI * 2;

// Order of a rotation from its angle: the smallest m≤12 with m·θ ≡ 0 (mod 2π).
const rotationOrder = (m: Affine2D): number => {
  const theta = Math.atan2(m.b, m.a);
  for (let k = 1; k <= 12; k++) {
    const r = (k * theta) % TWO_PI;
    const d = Math.min(Math.abs(r), Math.abs(Math.abs(r) - TWO_PI));
    if (d < 1e-6) return k;
  }
  return 1;
};

// Axis direction (unit, angle in [0,π)) of a reflection's linear part.
const reflectionAxis = (m: Affine2D): Vec2 => {
  // Reflection across a line at angle φ has linear part [[cos2φ, sin2φ],[sin2φ,-cos2φ]].
  const twoPhi = Math.atan2(m.b, m.a);
  const phi = twoPhi / 2;
  return { x: Math.cos(phi), y: Math.sin(phi) };
};

const latticeWindow = (radius: number): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (let i = -radius; i <= radius; i++) {
    for (let j = -radius; j <= radius; j++) out.push([i, j]);
  }
  return out;
};

const latticeVec = (basis: Basis, i: number, j: number): Vec2 => ({
  x: i * basis.a.x + j * basis.b.x,
  y: i * basis.a.y + j * basis.b.y,
});

// Is a vector a lattice vector (integer combination of the basis)?
const isLatticeVector = (basis: Basis, v: Vec2): boolean => {
  const inv = invert(basisToMatrix(basis));
  const f = applyToPoint(inv, v); // fractional coords (linear part only; e=f=0)
  return (
    Math.abs(f.x - Math.round(f.x)) < 1e-6 &&
    Math.abs(f.y - Math.round(f.y)) < 1e-6
  );
};

// All group elements within a lattice window: T_l ∘ g for g ∈ ops, l ∈ window.
const groupElements = (
  ops: Affine2D[],
  basis: Basis,
  radius: number,
): Affine2D[] => {
  const win = latticeWindow(radius);
  const out: Affine2D[] = [];
  for (const g of ops) {
    for (const [i, j] of win) {
      const t = latticeVec(basis, i, j);
      out.push(compose(translateXy(t.x, t.y), g));
    }
  }
  return out;
};

// Glide vector of a reflection element = the component of its translation along its
// axis. Pure mirror ⇔ this is ~0; essential glide ⇔ it is non-zero and not a lattice
// vector (i.e. the minimal glide is a fraction of a lattice translation).
const glideVector = (m: Affine2D): Vec2 => {
  const u = reflectionAxis(m);
  const t: Vec2 = { x: m.e, y: m.f };
  return scale(u, dot(t, u));
};

export type GroupAnalysis = {
  order: number;
  maxRotationOrder: number;
  mirrorDirections: number;
  hasGlide: boolean;
};

export const analyzeGroup = (
  ops: Affine2D[],
  basis: Basis,
): GroupAnalysis => {
  const order = ops.length;

  const maxRotationOrder = ops
    .filter(isRotation)
    .reduce((mx, r) => Math.max(mx, rotationOrder(r)), 1);

  const elements = groupElements(ops, basis, 2);
  const reflections = elements.filter(isReflection);

  const mirrorAngles = new Set<number>();
  let hasGlide = false;

  for (const r of reflections) {
    const w = glideVector(r);
    if (norm(w) < EPS) {
      // Pure mirror — record its axis direction (mod π).
      const u = reflectionAxis(r);
      let ang = Math.atan2(u.y, u.x);
      if (ang < 0) ang += Math.PI;
      ang %= Math.PI;
      mirrorAngles.add(Math.round(ang / 1e-4));
    } else if (!isLatticeVector(basis, w)) {
      hasGlide = true; // essential glide (glide vector is not a lattice vector)
    }
  }

  return {
    order,
    maxRotationOrder,
    mirrorDirections: mirrorAngles.size,
    hasGlide,
  };
};

// Fixed point (rotation centre) of a rotation element: (I - R)⁻¹ t.
const rotationCentre = (m: Affine2D): Vec2 => {
  const ixR: Affine2D = {
    a: 1 - m.a,
    b: -m.b,
    c: -m.c,
    d: 1 - m.d,
    e: 0,
    f: 0,
  };
  const inv = invert(ixR);
  return { x: inv.a * m.e + inv.c * m.f, y: inv.b * m.e + inv.d * m.f };
};

type Line = { o: Vec2; dir: Vec2 };

const pureMirrorLines = (ops: Affine2D[], basis: Basis): Line[] => {
  const elements = groupElements(ops, basis, 2);
  return elements
    .filter((m) => isReflection(m) && norm(glideVector(m)) < EPS)
    .map((m) => ({ o: scale({ x: m.e, y: m.f }, 0.5), dir: reflectionAxis(m) }));
};

// Distinct rotation centres of a given order, reduced into the unit cell.
const rotationCentresOfOrder = (
  ops: Affine2D[],
  basis: Basis,
  order: number,
): Vec2[] => {
  const elements = groupElements(ops, basis, 2);
  const inv = invert(basisToMatrix(basis));
  const seen = new Map<string, Vec2>();
  for (const m of elements) {
    if (!isRotation(m) || rotationOrder(m) !== order) continue;
    const c = rotationCentre(m);
    // Reduce to fractional coords mod 1 for dedup.
    const f = applyToPoint(inv, c);
    const fu = ((f.x % 1) + 1) % 1;
    const fv = ((f.y % 1) + 1) % 1;
    const key = `${Math.round(fu / 1e-4)},${Math.round(fv / 1e-4)}`;
    if (!seen.has(key)) {
      // store a canonical XY centre inside the base cell
      seen.set(key, latticeVec(basis, fu, fv));
    }
  }
  return [...seen.values()];
};

// Highest rotation order whose centre coincides with the given point (1 if none).
// Used to verify a region's vertices are genuine rotation centres of the expected order.
export const rotationOrderAtPoint = (
  ops: Affine2D[],
  basis: Basis,
  point: Vec2,
  radius = 2,
): number => {
  const elements = groupElements(ops, basis, radius);
  let best = 1;
  for (const g of elements) {
    if (!isRotation(g) || rotationOrder(g) === 1) continue;
    const img = applyToPoint(g, point);
    if (Math.hypot(img.x - point.x, img.y - point.y) < 1e-6) {
      best = Math.max(best, rotationOrder(g));
    }
  }
  return best;
};

// Incidence discriminator: do the rotation centres of the highest order all lie on a
// pure-mirror line? (p4m yes / p4g no; p3m1 yes / p31m no.)
export const highestRotationCentresOnMirrors = (
  ops: Affine2D[],
  basis: Basis,
): boolean => {
  const maxOrder = analyzeGroup(ops, basis).maxRotationOrder;
  const centres = rotationCentresOfOrder(ops, basis, maxOrder);
  const mirrors = pureMirrorLines(ops, basis);
  if (centres.length === 0 || mirrors.length === 0) return false;
  return centres.every((c) =>
    mirrors.some((ln) => distancePointToLine(c, ln.o, ln.dir) < 1e-6),
  );
};

// Orbit tiling: map the fundamental region by every coset rep × lattice translate,
// clip each copy to the unit cell, and report how the clipped copies cover the cell.
// A genuine fundamental domain gives coverRatio ≈ 1 and maxOverlap ≈ 0.
export const orbitTiling = (
  region: Vec2[],
  ops: Affine2D[],
  basis: Basis,
): { coverRatio: number; maxOverlap: number } => {
  const cell: Vec2[] = [
    { x: 0, y: 0 },
    basis.a,
    { x: basis.a.x + basis.b.x, y: basis.a.y + basis.b.y },
    basis.b,
  ];
  const cellArea = area(cell);
  const win = latticeWindow(2);
  const pieces: Vec2[][] = [];
  for (const op of ops) {
    for (const [i, j] of win) {
      const t = latticeVec(basis, i, j);
      const moved = applyToPolygon(compose(translateXy(t.x, t.y), op), region);
      const clipped = intersectConvex(moved, cell);
      if (area(clipped) > EPS) pieces.push(clipped);
    }
  }
  const total = pieces.reduce((s, p) => s + area(p), 0);
  let maxOverlap = 0;
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      maxOverlap = Math.max(maxOverlap, intersectionArea(pieces[i], pieces[j]));
    }
  }
  return { coverRatio: total / cellArea, maxOverlap: maxOverlap / cellArea };
};

// Export for the region/area validity test.
export const cellArea = (basis: Basis): number =>
  area([
    { x: 0, y: 0 },
    basis.a,
    { x: basis.a.x + basis.b.x, y: basis.a.y + basis.b.y },
    basis.b,
  ]);

export const polygonArea = (poly: Vec2[]): number => area(poly);

// Instance "anchors": where each orbit element maps a representative glyph point. Used
// by the render-level symmetry test to count copies per cell and check g·set ≅ set.
export const anchorsModLattice = (
  ops: Affine2D[],
  basis: Basis,
  radius: number,
  anchorUv: Vec2 = { x: 0.25, y: 0.25 },
): Vec2[] => {
  const B = basisToMatrix(basis);
  const elements = groupElements(ops, basis, radius);
  return elements.map((g) => applyToPoint(compose(g, B), anchorUv));
};

// Reduce an XY point to fractional cell coords mod 1 (for cell counting / set compare).
export const toCellFrac = (basis: Basis, p: Vec2): Vec2 => {
  const f = applyToPoint(invert(basisToMatrix(basis)), p);
  return { x: ((f.x % 1) + 1) % 1, y: ((f.y % 1) + 1) % 1 };
};
