import type { Vec2 } from '../types';

// Small, dependency-free computational-geometry helpers used by the symmetry
// verification. All pure; all convex-polygon oriented (our regions and their affine
// images are convex).

export const EPS = 1e-7;

export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
export const norm = (a: Vec2): number => Math.hypot(a.x, a.y);

// Signed area via the shoelace formula (positive for CCW).
export const signedArea = (poly: Vec2[]): number => {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    s += cross(p, q);
  }
  return s / 2;
};

export const area = (poly: Vec2[]): number => Math.abs(signedArea(poly));

// Clip a convex polygon to the half-plane { x : n·x ≤ c } (Sutherland–Hodgman edge).
const clipHalfPlane = (poly: Vec2[], n: Vec2, c: number): Vec2[] => {
  if (poly.length === 0) return [];
  const out: Vec2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const nxt = poly[(i + 1) % poly.length];
    const dCur = dot(n, cur) - c;
    const dNxt = dot(n, nxt) - c;
    const curIn = dCur <= EPS;
    const nxtIn = dNxt <= EPS;
    if (curIn) out.push(cur);
    if (curIn !== nxtIn) {
      const t = dCur / (dCur - dNxt);
      out.push(add(cur, scale(sub(nxt, cur), t)));
    }
  }
  return out;
};

// Intersection of two convex polygons (clip subject by each edge of the clip polygon).
export const intersectConvex = (subject: Vec2[], clip: Vec2[]): Vec2[] => {
  if (subject.length < 3 || clip.length < 3) return [];
  // Ensure clip is CCW so inward normals point consistently.
  const ccw = signedArea(clip) >= 0 ? clip : [...clip].reverse();
  let result = subject;
  for (let i = 0; i < ccw.length && result.length > 0; i++) {
    const a = ccw[i];
    const b = ccw[(i + 1) % ccw.length];
    const edge = sub(b, a);
    // Inward normal for a CCW polygon is (edge.y, -edge.x) pointing left of edge…
    // half-plane: points p with n·(p) ≤ n·a where n is the OUTWARD normal.
    const nOut: Vec2 = { x: edge.y, y: -edge.x };
    result = clipHalfPlane(result, nOut, dot(nOut, a));
  }
  return result;
};

export const intersectionArea = (p: Vec2[], q: Vec2[]): number =>
  area(intersectConvex(p, q));

// Distance from a point to an infinite line given by a point `o` and direction `d`.
export const distancePointToLine = (p: Vec2, o: Vec2, d: Vec2): number => {
  const len = norm(d);
  if (len < EPS) return norm(sub(p, o));
  return Math.abs(cross(d, sub(p, o))) / len;
};
