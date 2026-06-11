import type { Affine2D, Vec2 } from '../types';
import {
  applyToPoint,
  basisToMatrix,
  compose,
  invert,
  translateXy,
} from '../affine';

// ─────────────────────────────────────────────────────────────────────────────
// SYMMETRY-ELEMENT OVERLAY for the group switcher.
//
// Draws the CELL STRUCTURE on top of the rendered pattern so the p3m1-vs-p31m (and
// p4m-vs-p4g) distinction is visible: mirror lines (solid), glide lines (dashed), and
// rotation centres marked with the Wikipedia cell-diagram glyphs — ◆ 2-fold, ▲ 3-fold,
// ■ 4-fold, ⬢ 6-fold. With these on screen you can SEE that p3m1 puts every highest-
// order rotation centre on a mirror line while p31m leaves the deep-hole centres off
// them.
//
// All geometry is derived locally from the XY coset ops (opsInCellXy) the engine
// already computed — this module reads them, it does not touch groups.ts or
// verify/symmetry.ts. Pure functions; no mutation.
// ─────────────────────────────────────────────────────────────────────────────

type Basis = { a: Vec2; b: Vec2 };

const det = (m: Affine2D): number => m.a * m.d - m.b * m.c;
const isRotation = (m: Affine2D): boolean => det(m) > 0;
const isReflection = (m: Affine2D): boolean => det(m) < 0;

const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
const scaleVec = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });

// Apply only the linear part of an affine to a direction vector.
const applyLinear = (m: Affine2D, v: Vec2): Vec2 => ({
  x: m.a * v.x + m.c * v.y,
  y: m.b * v.x + m.d * v.y,
});

// Axis direction (unit, in [0,π)) of a reflection's linear part.
const reflectionAxis = (m: Affine2D): Vec2 => {
  const phi = Math.atan2(m.b, m.a) / 2;
  return { x: Math.cos(phi), y: Math.sin(phi) };
};

const rotationOrder = (m: Affine2D): number => {
  const theta = Math.atan2(m.b, m.a);
  const TWO_PI = Math.PI * 2;
  for (let k = 1; k <= 12; k++) {
    const r = (k * theta) % TWO_PI;
    const dd = Math.min(Math.abs(r), Math.abs(Math.abs(r) - TWO_PI));
    if (dd < 1e-6) return k;
  }
  return 1;
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

type Axis = { c: Vec2; dir: Vec2; glide: boolean };

// Axis of an orientation-reversing isometry: direction u (its reflection axis) and a
// point c on the line (perpendicular offset = half the perpendicular translation).
const reflectionLine = (m: Affine2D): { c: Vec2; dir: Vec2 } => {
  const u = reflectionAxis(m);
  const n: Vec2 = { x: -u.y, y: u.x };
  const t: Vec2 = { x: m.e, y: m.f };
  const perp = dot(t, n);
  return { c: scaleVec(n, perp / 2), dir: u };
};

// Pure mirror ⇔ the translation component along the axis is (mod lattice) zero.
const isGlide = (m: Affine2D, basis: Basis): boolean => {
  const u = reflectionAxis(m);
  const t: Vec2 = { x: m.e, y: m.f };
  const g = scaleVec(u, dot(t, u)); // glide vector (XY)
  const frac = applyLinear(invert(basisToMatrix(basis)), g); // → lattice coords
  const nearInt = (x: number): boolean =>
    Math.abs(x - Math.round(x)) < 1e-4;
  return !(nearInt(frac.x) && nearInt(frac.y));
};

const latticeVec = (basis: Basis, i: number, j: number): Vec2 => ({
  x: i * basis.a.x + j * basis.b.x,
  y: i * basis.a.y + j * basis.b.y,
});

const num = (x: number): string => Number(x.toFixed(3)).toString();

// ── Cell enumeration ─────────────────────────────────────────────────────────
// A symmetry element of the translated op T_t∘g does NOT sit at t: a rotation's fixed
// point is (I−R)⁻¹(t + t_g), and a reflection axis' perpendicular offset is ((t+t_g)·n)/2
// — the element moves at a FRACTION of the lattice translation (exactly half for 2-fold
// centres and mirror/glide offsets). The engine's tile range is chosen so the motif
// TILES cover the viewport, which is therefore too small for the overlay: elements
// thinned out toward the view corner opposite the XY origin. So each op enumerates its
// own range by inverting its position map over the viewport corners: t = M·e − t_g with
// M = I−R for rotations and M = 2I for reflections.
const cellsFor = (
  cornersXy: Vec2[],
  toLattice: Affine2D,
  mapPointToT: (e: Vec2) => Vec2,
): { i: number; j: number }[] => {
  const margin = 2; // covers floor/ceil rounding + edge-of-view axis lines
  const ijs = cornersXy.map((e) => applyLinear(toLattice, mapPointToT(e)));
  const iMin = Math.floor(Math.min(...ijs.map((q) => q.x))) - margin;
  const iMax = Math.ceil(Math.max(...ijs.map((q) => q.x))) + margin;
  const jMin = Math.floor(Math.min(...ijs.map((q) => q.y))) - margin;
  const jMax = Math.ceil(Math.max(...ijs.map((q) => q.y))) + margin;
  return Array.from({ length: iMax - iMin + 1 }, (_, di) =>
    Array.from({ length: jMax - jMin + 1 }, (_, dj) => ({
      i: iMin + di,
      j: jMin + dj,
    })),
  ).flat();
};

// Fuchsia — clear of the draw palette (navy/blue/iron-red/green/black) and of both
// motif families (cobalt ink, iron-red accent), so the overlay never disappears into
// the pattern or a user drawing.
const COLOR = '#c026d3';

// Rotation-centre glyphs per the Wikipedia cell-diagram legend: the ORDER is encoded by
// shape (◆ 2, ▲ 3, ■ 4, ⬢ 6), so one colour suffices. Y-down: "point-up" = −y.
const ringPoints = (p: Vec2, r: number, n: number, startDeg: number): string =>
  Array.from({ length: n }, (_, k) => {
    const a = ((startDeg + (k * 360) / n) * Math.PI) / 180;
    return `${num(p.x + r * Math.cos(a))},${num(p.y + r * Math.sin(a))}`;
  }).join(' ');

const markerPoints = (p: Vec2, order: number): string | null => {
  switch (order) {
    case 2: // narrow rhombus ◆
      return [
        `${num(p.x)},${num(p.y - 7)}`,
        `${num(p.x + 4.5)},${num(p.y)}`,
        `${num(p.x)},${num(p.y + 7)}`,
        `${num(p.x - 4.5)},${num(p.y)}`,
      ].join(' ');
    case 3:
      return ringPoints(p, 8, 3, -90); // ▲ point-up
    case 4:
      return ringPoints(p, 7, 4, 45); // ■ axis-aligned
    case 6:
      return ringPoints(p, 7, 6, 0); // ⬢ flat-top
    default:
      return null;
  }
};

/**
 * Build the symmetry-element overlay SVG (one <g>), in world coordinates matching the
 * pattern layer. Mirror lines solid, glide lines dashed, rotation centres as the
 * Wikipedia glyphs (◆ ▲ ■ ⬢ by order).
 */
export const renderSymmetryElements = (args: {
  opsInCellXy: Affine2D[];
  basis: Basis;
  poseMatrix: Affine2D;
  viewBox: { x: number; y: number; w: number; h: number };
}): string => {
  const { opsInCellXy, basis, poseMatrix, viewBox } = args;
  const reach = 2 * (viewBox.w + viewBox.h); // segment half-length; SVG clips to view

  // Viewport corners in pre-pose XY space — the domain the elements must cover.
  const poseInv = invert(poseMatrix);
  const cornersXy = [
    { x: viewBox.x, y: viewBox.y },
    { x: viewBox.x + viewBox.w, y: viewBox.y },
    { x: viewBox.x + viewBox.w, y: viewBox.y + viewBox.h },
    { x: viewBox.x, y: viewBox.y + viewBox.h },
  ].map((p) => applyToPoint(poseInv, p));
  const toLattice = invert(basisToMatrix(basis));

  // ── Axes (mirror / glide) ──────────────────────────────────────────────────
  // Classify each translated cell op. The mirror-vs-glide test MUST run on the lattice-
  // translated op (cellOp), not the bare coset rep: in the centered groups (cm, cmm) the
  // glide reflections arise as mirror ∘ centering-translation, so the same coset rep
  // yields a pure mirror at integer offsets and a glide at the centering half-offsets.
  // Classifying the bare origin op would label every translate a mirror and drop those
  // glides (the primitive groups pg/pgg/pmg carry the glide as its own coset rep, so they
  // were unaffected — but cm/cmm silently lost their glide lines).
  const axes: Axis[] = [];
  const seenAxis = new Set<string>();
  for (const op of opsInCellXy) {
    if (!isReflection(op)) continue;
    const cells = cellsFor(cornersXy, toLattice, (e) => ({
      x: 2 * e.x - op.e,
      y: 2 * e.y - op.f,
    }));
    for (const { i, j } of cells) {
      const t = latticeVec(basis, i, j);
      const cellOp = compose(translateXy(t.x, t.y), op);
      const glide = isGlide(cellOp, basis);
      const { c, dir } = reflectionLine(cellOp);
      const cWorld = applyToPoint(poseMatrix, c);
      const dWorld = applyLinear(poseMatrix, dir);
      const len = Math.hypot(dWorld.x, dWorld.y) || 1;
      const u = { x: dWorld.x / len, y: dWorld.y / len };
      const nrm = { x: -u.y, y: u.x };
      // canonical key: orientation (mod π) + signed perpendicular offset
      let ang = Math.atan2(u.y, u.x);
      if (ang < 0) ang += Math.PI;
      ang %= Math.PI;
      const off = dot(cWorld, nrm);
      const key = `${glide ? 'g' : 'm'}:${Math.round(ang / 1e-3)}:${Math.round(off / 0.5)}`;
      if (seenAxis.has(key)) continue;
      seenAxis.add(key);
      axes.push({ c: cWorld, dir: u, glide });
    }
  }

  // ── Rotation centres ───────────────────────────────────────────────────────
  const centres = new Map<string, { p: Vec2; order: number }>();
  for (const op of opsInCellXy) {
    if (!isRotation(op)) continue;
    const order = rotationOrder(op);
    if (order === 1) continue;
    const cells = cellsFor(cornersXy, toLattice, (e) => ({
      x: (1 - op.a) * e.x - op.c * e.y - op.e,
      y: -op.b * e.x + (1 - op.d) * e.y - op.f,
    }));
    for (const { i, j } of cells) {
      const t = latticeVec(basis, i, j);
      const cellOp = compose(translateXy(t.x, t.y), op);
      const cWorld = applyToPoint(poseMatrix, rotationCentre(cellOp));
      const key = `${Math.round(cWorld.x / 0.5)},${Math.round(cWorld.y / 0.5)}`;
      const prev = centres.get(key);
      if (!prev || order > prev.order) centres.set(key, { p: cWorld, order });
    }
  }

  const lineSvg = axes
    .map(({ c, dir, glide }) => {
      const x1 = num(c.x - dir.x * reach);
      const y1 = num(c.y - dir.y * reach);
      const x2 = num(c.x + dir.x * reach);
      const y2 = num(c.y + dir.y * reach);
      const dash = glide ? ' stroke-dasharray="8 6"' : '';
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COLOR}" stroke-width="2" stroke-opacity="0.85"${dash}/>`;
    })
    .join('');

  const markerSvg = [...centres.values()]
    .map(({ p, order }) => {
      const pts = markerPoints(p, order);
      return pts
        ? `<polygon points="${pts}" fill="${COLOR}" stroke="white" stroke-width="1.5"/>`
        : `<circle cx="${num(p.x)}" cy="${num(p.y)}" r="5" fill="${COLOR}" stroke="white" stroke-width="1.5"/>`;
    })
    .join('');

  return `<g data-layer="symmetry-elements">${lineSvg}${markerSvg}</g>`;
};
