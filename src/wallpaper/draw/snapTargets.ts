import type { Affine2D, Vec2, WallpaperGroup } from '../types';
import {
  applyToPoint,
  basisToMatrix,
  compose,
  invert,
  translateXy,
} from '../affine';
import { getGroup } from '../groups';
import { asymmetricUnitUv } from '../regions';

// ─────────────────────────────────────────────────────────────────────────────
// SNAP TARGETS (M3 precision drawing). A dense, regular design hangs on exactly the
// geometry the group already owns: lattice points, rotation centres, mirror axes and
// the unit's corners (a seigaiha arc is "concentric circles about a lattice point").
// This module derives those targets — in the draw pane's reference uv frame — from the
// same cosetReps the engine tiles with, so a snapped point is exact by construction.
//
// Classification runs in XY, where a reflection's linear part is orthogonal and
// (I − R) is well-conditioned; uv matrices on the hex lattice are integral but NOT
// orthogonal, so the axis/centre formulas must not run there (cf. the XY overlay in
// engine/symmetryElements.ts, which this mirrors). Results are carried back to uv by
// B⁻¹ — affine maps send centres to centres and axes to axes. Pure; memoised.
// ─────────────────────────────────────────────────────────────────────────────

export type SnapLine = { c: Vec2; dir: Vec2 }; // a point on the axis + direction (uv)
export type SnapTargets = { points: Vec2[]; lines: SnapLine[] };
export type UvWindow = { min: Vec2; max: Vec2 };

const det = (m: Affine2D): number => m.a * m.d - m.b * m.c;

const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

// Apply only the linear part of an affine to a direction vector.
const applyLinear = (m: Affine2D, v: Vec2): Vec2 => ({
  x: m.a * v.x + m.c * v.y,
  y: m.b * v.x + m.d * v.y,
});

const rotationOrder = (m: Affine2D): number => {
  const theta = Math.atan2(m.b, m.a);
  const TWO_PI = Math.PI * 2;
  for (let k = 1; k <= 12; k++) {
    const r = (k * theta) % TWO_PI;
    const d = Math.min(Math.abs(r), Math.abs(Math.abs(r) - TWO_PI));
    if (d < 1e-6) return k;
  }
  return 1;
};

// Fixed point of a rotation: (I − R)⁻¹ t.
const rotationCentre = (m: Affine2D): Vec2 => {
  const ixR: Affine2D = { a: 1 - m.a, b: -m.b, c: -m.c, d: 1 - m.d, e: 0, f: 0 };
  const inv = invert(ixR);
  return { x: inv.a * m.e + inv.c * m.f, y: inv.b * m.e + inv.d * m.f };
};

// Axis direction (unit, in [0,π)) of an orientation-reversing isometry's linear part.
const reflectionAxis = (m: Affine2D): Vec2 => {
  const phi = Math.atan2(m.b, m.a) / 2;
  return { x: Math.cos(phi), y: Math.sin(phi) };
};

// Axis of an orientation-reversing isometry: direction + a point on the line.
const reflectionLine = (m: Affine2D): { c: Vec2; dir: Vec2 } => {
  const u = reflectionAxis(m);
  const n: Vec2 = { x: -u.y, y: u.x };
  const perp = dot({ x: m.e, y: m.f }, n);
  return { c: { x: (n.x * perp) / 2, y: (n.y * perp) / 2 }, dir: u };
};

// Pure mirror ⇔ the translation component along the axis is (mod lattice) zero.
const isGlide = (m: Affine2D, B: Affine2D): boolean => {
  const u = reflectionAxis(m);
  const along = dot({ x: m.e, y: m.f }, u);
  const g = { x: u.x * along, y: u.y * along };
  const frac = applyLinear(invert(B), g);
  const nearInt = (x: number): boolean => Math.abs(x - Math.round(x)) < 1e-4;
  return !(nearInt(frac.x) && nearInt(frac.y));
};

// Lattice range whose translated copies of one op put its element inside the window:
// invert the op's element-position map over the window corners (same derivation as the
// symmetry overlay's cellsFor — elements sit at FRACTIONS of the translation).
const cellRange = (
  cornersXy: Vec2[],
  toLattice: Affine2D,
  mapPointToT: (e: Vec2) => Vec2,
): { i: number; j: number }[] => {
  const margin = 2;
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

const MARGIN = 0.05; // keep targets slightly past the window so its edges snap too

const pointKey = (p: Vec2): string =>
  `${Math.round(p.x * 1e6)},${Math.round(p.y * 1e6)}`;

const cache = new Map<string, SnapTargets>();

/**
 * All snap targets inside (a hair beyond) the uv window: lattice points, the unit's
 * vertices, every rotation centre, and every pure-mirror axis. Derived from the
 * group's cosetReps × lattice translates; glide axes are excluded (ink does not lie
 * ON a glide line the way it hugs a mirror).
 */
export const snapTargetsUv = (args: {
  group: WallpaperGroup;
  basis: { a: Vec2; b: Vec2 };
  window: UvWindow;
}): SnapTargets => {
  const { group, basis, window } = args;
  // The basis is part of the key: today it is unique per group, but lattice-parameter
  // editing (L2) will vary it, and a stale hit would hand back targets derived from
  // another basis' numerics. Same discipline as regionCandidatesUv's (group, window) key.
  const key = `${group}:${pointKey(basis.a)}:${pointKey(basis.b)}:${pointKey(window.min)}:${pointKey(window.max)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const B = basisToMatrix(basis);
  const Binv = invert(B);
  const opsXy = getGroup(group).cosetReps.map((op) =>
    compose(B, compose(op, Binv)),
  );
  const cornersXy = [
    { x: window.min.x, y: window.min.y },
    { x: window.max.x, y: window.min.y },
    { x: window.max.x, y: window.max.y },
    { x: window.min.x, y: window.max.y },
  ].map((p) => applyToPoint(B, p));

  const inWindow = (p: Vec2): boolean =>
    p.x >= window.min.x - MARGIN &&
    p.x <= window.max.x + MARGIN &&
    p.y >= window.min.y - MARGIN &&
    p.y <= window.max.y + MARGIN;

  const points = new Map<string, Vec2>();
  const addPoint = (p: Vec2) => {
    if (inWindow(p)) points.set(pointKey(p), p);
  };

  // Lattice points + the unit's vertices in EVERY cell of the window — the zoomed-out
  // windows show neighbour cells, whose identity-copy region corners must snap exactly
  // like the home cell's (lattice points/centres/axes already cover the whole window).
  const unit = asymmetricUnitUv[group];
  for (let i = Math.floor(window.min.x) - 1; i <= Math.ceil(window.max.x); i++) {
    for (let j = Math.floor(window.min.y) - 1; j <= Math.ceil(window.max.y); j++) {
      addPoint({ x: i, y: j });
      for (const v of unit) addPoint({ x: v.x + i, y: v.y + j });
    }
  }

  const lines = new Map<string, SnapLine>();
  const halfDiag =
    Math.hypot(window.max.x - window.min.x, window.max.y - window.min.y) / 2 +
    MARGIN;
  const centre = {
    x: (window.min.x + window.max.x) / 2,
    y: (window.min.y + window.max.y) / 2,
  };
  const addLine = (cUv: Vec2, dirUv: Vec2) => {
    const len = Math.hypot(dirUv.x, dirUv.y) || 1;
    const dir = { x: dirUv.x / len, y: dirUv.y / len };
    const n = { x: -dir.y, y: dir.x };
    const off = dot({ x: cUv.x - centre.x, y: cUv.y - centre.y }, n);
    if (Math.abs(off) > halfDiag) return; // axis misses the window entirely
    let ang = Math.atan2(dir.y, dir.x);
    if (ang < 0) ang += Math.PI;
    ang %= Math.PI;
    const key = `${Math.round(ang / 1e-4)}:${Math.round(dot(cUv, n) / 1e-4)}`;
    if (!lines.has(key)) lines.set(key, { c: cUv, dir });
  };

  for (const op of opsXy) {
    if (det(op) > 0) {
      if (rotationOrder(op) < 2) continue;
      const cells = cellRange(cornersXy, Binv, (e) => ({
        x: (1 - op.a) * e.x - op.c * e.y - op.e,
        y: -op.b * e.x + (1 - op.d) * e.y - op.f,
      }));
      for (const { i, j } of cells) {
        const t = applyToPoint(B, { x: i, y: j });
        const cellOp = compose(translateXy(t.x, t.y), op);
        addPoint(applyToPoint(Binv, rotationCentre(cellOp)));
      }
    } else {
      const cells = cellRange(cornersXy, Binv, (e) => ({
        x: 2 * e.x - op.e,
        y: 2 * e.y - op.f,
      }));
      for (const { i, j } of cells) {
        const t = applyToPoint(B, { x: i, y: j });
        const cellOp = compose(translateXy(t.x, t.y), op);
        if (isGlide(cellOp, B)) continue;
        const { c, dir } = reflectionLine(cellOp);
        addLine(applyToPoint(Binv, c), applyLinear(Binv, dir));
      }
    }
  }

  const targets: SnapTargets = Object.freeze({
    points: [...points.values()],
    lines: [...lines.values()],
  });
  cache.set(key, targets);
  return targets;
};

export type SnapHit = { uv: Vec2; kind: 'point' | 'line' };

/**
 * Snap a pointer position to the nearest target within `radiusPx`, measured on the
 * CANVAS (what the finger feels) — the uv metric is anisotropic on skewed lattices,
 * so px distance is the honest one. Points win over lines; a line hit projects the
 * pointer perpendicularly onto the axis. Returns null when nothing is in range.
 */
export const snapToTargets = (args: {
  uv: Vec2;
  targets: SnapTargets;
  toCanvas: Affine2D; // uv → canvas px
  radiusPx: number;
}): SnapHit | null => {
  const { uv, targets, toCanvas, radiusPx } = args;
  const pPx = applyToPoint(toCanvas, uv);

  const best = targets.points.reduce<{ uv: Vec2; d: number } | null>((acc, q) => {
    const qPx = applyToPoint(toCanvas, q);
    const d = Math.hypot(qPx.x - pPx.x, qPx.y - pPx.y);
    return d <= radiusPx && (!acc || d < acc.d) ? { uv: q, d } : acc;
  }, null);
  if (best) return { uv: best.uv, kind: 'point' };

  const bestLine = targets.lines.reduce<{ uv: Vec2; d: number } | null>(
    (acc, line) => {
      const cPx = applyToPoint(toCanvas, line.c);
      const dRaw = applyLinear(toCanvas, line.dir);
      const len = Math.hypot(dRaw.x, dRaw.y) || 1;
      const dPx = { x: dRaw.x / len, y: dRaw.y / len };
      const rel = { x: pPx.x - cPx.x, y: pPx.y - cPx.y };
      const along = dot(rel, dPx);
      const foot = { x: cPx.x + dPx.x * along, y: cPx.y + dPx.y * along };
      const d = Math.hypot(pPx.x - foot.x, pPx.y - foot.y);
      if (d > radiusPx || (acc && d >= acc.d)) return acc;
      return { uv: applyToPoint(invert(toCanvas), foot), d };
    },
    null,
  );
  return bestLine ? { uv: bestLine.uv, kind: 'line' } : null;
};
