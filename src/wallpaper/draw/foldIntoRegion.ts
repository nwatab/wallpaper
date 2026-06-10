import type { Affine2D, Vec2, WallpaperGroup } from '../types';
import { applyToPoint, compose, invert, translateXy } from '../affine';
import { getGroup } from '../groups';
import { asymmetricUnitUv } from '../regions';

// ─────────────────────────────────────────────────────────────────────────────
// KALEIDOSCOPE FOLD (M2 draw capture).
//
// The draw canvas shows the whole region-bbox window, but the stored motif must live
// inside the asymmetric unit: the renderer clips every orbit copy to its region, so any
// ink outside the unit would silently vanish at commit. Instead of clipping the user's
// stroke, fold it: the asymmetric unit R tiles the plane under cosetReps × lattice
// (verified in tests), so every drawn point p lies in exactly one copy g(R) — store
// g⁻¹(p). The orbit then reproduces the stroke exactly where it was drawn (plus its
// symmetric images), like ink folding through a kaleidoscope.
//
// A stroke that crosses copy boundaries is split into per-copy pieces, with the exact
// boundary crossing inserted on both sides so the rendered joins are seamless. All in
// reference-frame uv (the cosetReps' frame); pure geometry, no DOM.
// ─────────────────────────────────────────────────────────────────────────────

export type FoldedShape = { pts: Vec2[]; closed: boolean };

type Candidate = { fwd: Affine2D; inv: Affine2D };

const EPS_INSIDE = 1e-7; // boundary tolerance for the point-in-region test
const EPS_AREA = 1e-9; // discard degenerate clipped-fill slivers
const DENSIFY_STEP = 0.005; // max uv segment length before folding (≈3 canvas px)

const cross = (o: Vec2, a: Vec2, b: Vec2): number =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

const signedArea = (poly: Vec2[]): number =>
  poly.reduce((s, p, i) => {
    const q = poly[(i + 1) % poly.length];
    return s + (p.x * q.y - q.x * p.y);
  }, 0) / 2;

// Signed distance-like edge test, oriented by the polygon's winding: ≥0 ⇔ inside.
const edgeValues = (p: Vec2, poly: Vec2[], winding: number): number[] =>
  poly.map((v, i) => winding * cross(v, poly[(i + 1) % poly.length], p));

const insideConvex = (p: Vec2, poly: Vec2[], winding: number): boolean =>
  edgeValues(p, poly, winding).every((d) => d >= -EPS_INSIDE);

// Lattice window for the candidate copies, ±LATTICE_WINDOW cells. Must be 2 for the
// same reason as the engine's TILE_OVERSCAN: origin-based ops (rotations/glides about
// a corner, e.g. cmm's (u,v)↦(−u,−v)) throw their copy to the far side of the origin,
// so covering a point just outside cell corner (1,0) can take translate (+2,0). The
// coverage test scans the cell plus the widest canvas margin densely to pin this.
const LATTICE_WINDOW = 2;

// The copies of the asymmetric unit that cover the draw window: the cell's cosetReps
// plus the surrounding lattice translates, ordered home-cell-first and then by ring,
// so near copies win the membership scan. Memoised per group (pure derivation).
const candidatesCache = new Map<WallpaperGroup, Candidate[]>();

export const regionCandidatesUv = (group: WallpaperGroup): Candidate[] => {
  const cached = candidatesCache.get(group);
  if (cached) return cached;
  const ops = getGroup(group).cosetReps;
  const cells: Array<[number, number]> = [];
  for (let i = -LATTICE_WINDOW; i <= LATTICE_WINDOW; i++) {
    for (let j = -LATTICE_WINDOW; j <= LATTICE_WINDOW; j++) {
      cells.push([i, j]);
    }
  }
  cells.sort((p, q) => Math.max(Math.abs(p[0]), Math.abs(p[1])) - Math.max(Math.abs(q[0]), Math.abs(q[1])));
  const cands = cells.flatMap(([i, j]) =>
    ops.map((op) => {
      const fwd = compose(translateXy(i, j), op);
      return { fwd, inv: invert(fwd) };
    }),
  );
  candidatesCache.set(group, cands);
  return cands;
};

// Index of the candidate copy containing p (−1 if none). `sticky` is re-tested first so
// a stroke hugging a boundary stays in one copy instead of flapping across it.
const locate = (
  p: Vec2,
  cands: Candidate[],
  region: Vec2[],
  winding: number,
  sticky: number,
): number => {
  if (sticky >= 0 && insideConvex(applyToPoint(cands[sticky].inv, p), region, winding)) {
    return sticky;
  }
  return cands.findIndex((c) =>
    insideConvex(applyToPoint(c.inv, p), region, winding),
  );
};

// Largest t ∈ [0,1] with lerp(a,b,t) still inside the convex region, both points given
// in region space (a inside, b outside). Linear per edge, so exact.
const exitParam = (a: Vec2, b: Vec2, region: Vec2[], winding: number): number => {
  const fa = edgeValues(a, region, winding);
  const fb = edgeValues(b, region, winding);
  return fa.reduce((t, f0c, i) => {
    const f1 = fb[i];
    if (f1 >= 0) return t; // never exits through this edge
    const f0 = Math.max(f0c, 0);
    return Math.min(t, f0 / (f0 - f1));
  }, 1);
};

const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

// Subdivide so no segment exceeds DENSIFY_STEP — sparse shapes (line/rect corners) can
// cross several copies within one segment, and folding classifies per sample.
const densify = (pts: Vec2[]): Vec2[] =>
  pts.flatMap((p, i) => {
    if (i === 0) return [p];
    const prev = pts[i - 1];
    const n = Math.ceil(Math.hypot(p.x - prev.x, p.y - prev.y) / DENSIFY_STEP);
    return Array.from({ length: n }, (_, k) => lerp(prev, p, (k + 1) / n));
  });

/**
 * Fold a drawn stroke (uv polyline; `closed` for rect/ellipse outlines) into the
 * group's asymmetric unit. Returns one piece per region copy crossed — each fully
 * inside the unit, meeting its neighbours exactly on the boundary. A shape contained
 * in a single copy round-trips as one piece with its original points (and stays
 * closed); pieces of a split shape are open (the orbit closes them visually).
 */
export const foldShapeUv = (
  pts: Vec2[],
  closed: boolean,
  group: WallpaperGroup,
): FoldedShape[] => {
  const region = asymmetricUnitUv[group];
  const winding = Math.sign(signedArea(region)) || 1;
  const cands = regionCandidatesUv(group);

  const walk = densify(closed ? [...pts, pts[0]] : pts);
  // membership scan, sticky: prefer the previous sample's copy at every step
  let prev = -1;
  const ops = walk.map((p) => {
    const idx = locate(p, cands, region, winding, prev);
    prev = idx >= 0 ? idx : prev;
    return idx;
  });

  // Single-copy fast path: keep the original (un-densified) points and closedness.
  const found = ops.filter((i) => i >= 0);
  if (found.length > 0 && found.every((i) => i === found[0])) {
    const inv = cands[found[0]].inv;
    return [{ pts: pts.map((p) => applyToPoint(inv, p)), closed }];
  }

  const pieces: Vec2[][] = [];
  let cur: Vec2[] = [];
  let curIdx = -1;
  const flush = () => {
    if (cur.length >= 2) pieces.push(cur);
    cur = [];
    curIdx = -1;
  };

  walk.forEach((p, k) => {
    const idx = ops[k];
    if (idx < 0) {
      flush();
      return;
    }
    if (curIdx < 0) {
      cur = [applyToPoint(cands[idx].inv, p)];
      curIdx = idx;
      return;
    }
    if (idx === curIdx) {
      cur.push(applyToPoint(cands[idx].inv, p));
      return;
    }
    // copy change: insert the exact boundary crossing on both sides of the split
    const prevP = walk[k - 1];
    const a = applyToPoint(cands[curIdx].inv, prevP);
    const b = applyToPoint(cands[curIdx].inv, p);
    const c = lerp(prevP, p, exitParam(a, b, region, winding));
    cur.push(applyToPoint(cands[curIdx].inv, c));
    flush();
    cur = [applyToPoint(cands[idx].inv, c), applyToPoint(cands[idx].inv, p)];
    curIdx = idx;
  });
  flush();

  return pieces.map((pp) => ({ pts: pp, closed: false }));
};

// Sutherland–Hodgman: clip a polygon against one convex clipper (any winding).
const clipPolygon = (subject: Vec2[], clipper: Vec2[]): Vec2[] => {
  const winding = Math.sign(signedArea(clipper)) || 1;
  return clipper.reduce((poly, v, i) => {
    if (poly.length === 0) return poly;
    const w = clipper[(i + 1) % clipper.length];
    const inside = (p: Vec2): boolean => winding * cross(v, w, p) >= -EPS_INSIDE;
    const intersect = (p: Vec2, q: Vec2): Vec2 => {
      const d0 = winding * cross(v, w, p);
      const d1 = winding * cross(v, w, q);
      return lerp(p, q, d0 / (d0 - d1));
    };
    return poly.flatMap((p, k) => {
      const q = poly[(k + 1) % poly.length];
      if (inside(q)) return inside(p) ? [q] : [intersect(p, q), q];
      return inside(p) ? [intersect(p, q)] : [];
    });
  }, subject);
};

/**
 * Fold a filled polygon into the group's asymmetric unit: clip it against every region
 * copy and carry each non-degenerate piece back by the copy's inverse isometry. The
 * pieces partition the drawn area, so the rendered orbit reproduces the fill exactly
 * as drawn.
 */
export const foldFillUv = (pts: Vec2[], group: WallpaperGroup): Vec2[][] => {
  if (pts.length < 3) return [];
  const region = asymmetricUnitUv[group];
  const cands = regionCandidatesUv(group);
  return cands.flatMap((c) => {
    const clipped = clipPolygon(pts, applyPoly(c.fwd, region));
    if (clipped.length < 3 || Math.abs(signedArea(clipped)) < EPS_AREA) return [];
    return [clipped.map((p) => applyToPoint(c.inv, p))];
  });
};

const applyPoly = (m: Affine2D, poly: Vec2[]): Vec2[] =>
  poly.map((p) => applyToPoint(m, p));
