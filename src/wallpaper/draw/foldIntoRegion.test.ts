import { describe, expect, it } from 'vitest';
import type { Affine2D, Rect, Vec2, WallpaperGroup } from '../types';
import { applyToPoint, basisToMatrix, compose, invert } from '../affine';
import { asymmetricUnitUv } from '../regions';
import { tile } from '../engine/tile';
import { placeUserMotif } from '../switch/shapeFamilies';
import {
  foldFillUv,
  foldShapeUv,
  regionCandidatesUv,
} from './foldIntoRegion';

// ─────────────────────────────────────────────────────────────────────────────
// Kaleidoscope-fold invariants. The contract: every folded piece lies inside the
// asymmetric unit, and the orbit of the folded pieces reproduces the gesture exactly
// where it was drawn (ink under the pen) — the renderer clips each orbit copy to its
// region, so these two properties are what make a committed stroke visible.
// ─────────────────────────────────────────────────────────────────────────────

const EPS = 1e-6;

const cross = (o: Vec2, a: Vec2, b: Vec2): number =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

const signedArea = (poly: Vec2[]): number =>
  poly.reduce((s, p, i) => {
    const q = poly[(i + 1) % poly.length];
    return s + (p.x * q.y - q.x * p.y);
  }, 0) / 2;

const insideRegion = (p: Vec2, group: WallpaperGroup): boolean => {
  const region = asymmetricUnitUv[group];
  const w = Math.sign(signedArea(region)) || 1;
  return region.every(
    (v, i) => w * cross(v, region[(i + 1) % region.length], p) >= -EPS,
  );
};

// Is the drawn point reproduced by SOME orbit copy of the folded geometry?
const reproduced = (drawn: Vec2, foldedPts: Vec2[], group: WallpaperGroup): boolean =>
  regionCandidatesUv(group).some((c) =>
    foldedPts.some((q) => {
      const back = applyToPoint(c.fwd, q);
      return Math.hypot(back.x - drawn.x, back.y - drawn.y) < 1e-4;
    }),
  );

describe('foldShapeUv', () => {
  it('keeps a stroke already inside the p4m unit unchanged', () => {
    // p4m unit: triangle (0,0)–(0.5,0)–(0.5,0.5), i.e. {y ≤ x ≤ 0.5}
    const pts = [
      { x: 0.3, y: 0.1 },
      { x: 0.4, y: 0.15 },
      { x: 0.45, y: 0.2 },
    ];
    const pieces = foldShapeUv(pts, false, 'p4m');
    expect(pieces).toHaveLength(1);
    expect(pieces[0].closed).toBe(false);
    pieces[0].pts.forEach((p, i) => {
      expect(p.x).toBeCloseTo(pts[i].x, 9);
      expect(p.y).toBeCloseTo(pts[i].y, 9);
    });
  });

  it('folds a stroke from a dead canvas zone (below the diagonal) into the unit', () => {
    // y > x — outside the p4m unit; without folding this ink vanished at commit
    const pts = [
      { x: 0.15, y: 0.35 },
      { x: 0.25, y: 0.4 },
    ];
    const pieces = foldShapeUv(pts, false, 'p4m');
    expect(pieces.length).toBeGreaterThan(0);
    for (const piece of pieces) {
      for (const p of piece.pts) expect(insideRegion(p, 'p4m')).toBe(true);
    }
    for (const drawn of pts) {
      const all = pieces.flatMap((pc) => pc.pts);
      expect(reproduced(drawn, all, 'p4m')).toBe(true);
    }
  });

  it('splits a diagonal-crossing stroke at the boundary with touching ends', () => {
    const pts = [
      { x: 0.2, y: 0.3 }, // below the diagonal (dead half)
      { x: 0.35, y: 0.05 }, // inside the unit
    ];
    const pieces = foldShapeUv(pts, false, 'p4m');
    expect(pieces.length).toBe(2);
    for (const piece of pieces) {
      for (const p of piece.pts) expect(insideRegion(p, 'p4m')).toBe(true);
    }
    // both pieces end/start on the fold line y = x (the shared mirror boundary)
    const endA = pieces[0].pts[pieces[0].pts.length - 1];
    const startB = pieces[1].pts[0];
    expect(Math.abs(endA.x - endA.y)).toBeLessThan(1e-6);
    expect(Math.abs(startB.x - startB.y)).toBeLessThan(1e-6);
  });

  it('keeps a closed shape contained in one copy closed', () => {
    const rect = [
      { x: 0.3, y: 0.05 },
      { x: 0.4, y: 0.05 },
      { x: 0.4, y: 0.12 },
      { x: 0.3, y: 0.12 },
    ];
    const pieces = foldShapeUv(rect, true, 'p4m');
    expect(pieces).toHaveLength(1);
    expect(pieces[0].closed).toBe(true);
    expect(pieces[0].pts).toHaveLength(4);
  });

  it('is the identity for p1 (unit = whole cell)', () => {
    const pts = [
      { x: 0.1, y: 0.8 },
      { x: 0.9, y: 0.2 },
    ];
    const pieces = foldShapeUv(pts, false, 'p1');
    expect(pieces).toHaveLength(1);
    pieces[0].pts.forEach((p, i) => {
      expect(p.x).toBeCloseTo(pts[i].x, 9);
      expect(p.y).toBeCloseTo(pts[i].y, 9);
    });
  });

  it('folds into the unit for every group (probe grid over the cell)', () => {
    const groups = Object.keys(asymmetricUnitUv) as WallpaperGroup[];
    for (const group of groups) {
      for (let gx = 0.1; gx < 1; gx += 0.2) {
        for (let gy = 0.1; gy < 1; gy += 0.2) {
          const pts = [
            { x: gx, y: gy },
            { x: gx + 0.03, y: gy + 0.02 },
          ];
          const pieces = foldShapeUv(pts, false, group);
          expect(pieces.length, `${group} @ (${gx},${gy})`).toBeGreaterThan(0);
          for (const piece of pieces) {
            for (const p of piece.pts) {
              expect(insideRegion(p, group), `${group} @ (${gx},${gy})`).toBe(true);
            }
          }
          const all = pieces.flatMap((pc) => pc.pts);
          expect(reproduced(pts[0], all, group), `${group} @ (${gx},${gy})`).toBe(
            true,
          );
        }
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NON-SELF-REFERENTIAL GUARDS. The invariants above check the fold against its own
// model (asymmetricUnitUv + regionCandidatesUv). These two suites pin that model to
// the things that actually decide visibility:
//   coverage — locate() can never silently drop a point anywhere in (or around) the
//              cell, the precondition for "ink survives wherever you draw";
//   bridge   — every fold candidate IS an engine orbit transform and the engine's
//              clip polygon IS the unit the fold targets, so "inside the unit under
//              candidate c" is exactly the renderer's per-copy clip condition.
// ─────────────────────────────────────────────────────────────────────────────

describe('candidate coverage (no silent drops)', () => {
  it('covers a dense grid over the cell + draw-window margin for every group', () => {
    // The square canvas centres the unit's bbox, so a skinny bbox (pm: 0.5×1) leaves
    // slack margins up to (360−28·2−s·short)/2 ≈ 0.35 uv around the bbox — all of it
    // drawable. Scan the cell plus that worst-case margin. This grid found the cmm
    // corner holes that forced LATTICE_WINDOW = 2 (engine TILE_OVERSCAN parity).
    const groups = Object.keys(asymmetricUnitUv) as WallpaperGroup[];
    for (const group of groups) {
      const cands = regionCandidatesUv(group);
      const holes: string[] = [];
      for (let x = -0.36; x <= 1.36; x += 0.01) {
        for (let y = -0.36; y <= 1.36; y += 0.01) {
          const covered = cands.some((c) =>
            insideRegion(applyToPoint(c.inv, { x, y }), group),
          );
          if (!covered) holes.push(`(${x.toFixed(2)},${y.toFixed(2)})`);
        }
      }
      expect(holes, `${group} uncovered: ${holes.slice(0, 8).join(' ')}`).toHaveLength(0);
    }
  });
});

describe('fold model ≡ engine orbit (renderer bridge)', () => {
  const matClose = (m: Affine2D, n: Affine2D): boolean =>
    Math.max(
      Math.abs(m.a - n.a),
      Math.abs(m.b - n.b),
      Math.abs(m.c - n.c),
      Math.abs(m.d - n.d),
      Math.abs(m.e - n.e),
      Math.abs(m.f - n.f),
    ) < 1e-9;

  // World-XY rect spanning the [-1,2]² cell range, so tile() must enumerate at least
  // the fold's 3×3 lattice neighbourhood.
  const cellsRect = (B: Affine2D): Rect => {
    const pts: Vec2[] = [
      { x: -1, y: -1 },
      { x: 2, y: -1 },
      { x: 2, y: 2 },
      { x: -1, y: 2 },
    ].map((p) => applyToPoint(B, p));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  };

  it('every fold candidate equals an engine orbit transform; clip polygon equals the unit', () => {
    const groups = Object.keys(asymmetricUnitUv) as WallpaperGroup[];
    for (const group of groups) {
      const r = placeUserMotif(group, {});
      const B = basisToMatrix(r.template.basis);
      const { orbitElements, regionXy } = tile({
        template: r.template,
        viewport: cellsRect(B),
        pose: { scale: 1, rotationDeg: 0 },
      });

      // engine orbit transform for the user-motif pipeline: el = pose ∘ B ∘ (t ∘ op),
      // so with identity pose every candidate must appear as B ∘ c.fwd
      for (const c of regionCandidatesUv(group)) {
        const expected = compose(B, c.fwd);
        expect(
          orbitElements.some((el) => matClose(el.transform, expected)),
          `${group}: candidate missing from engine orbit`,
        ).toBe(true);
      }

      // the renderer's clip polygon (renderMotifLayer: B⁻¹ · regionXy) is the unit
      const Binv = invert(B);
      const clipUv = regionXy.map((p) => applyToPoint(Binv, p));
      const unit = asymmetricUnitUv[group];
      expect(clipUv).toHaveLength(unit.length);
      clipUv.forEach((p, i) => {
        expect(p.x, `${group} clip vertex ${i}.x`).toBeCloseTo(unit[i].x, 9);
        expect(p.y, `${group} clip vertex ${i}.y`).toBeCloseTo(unit[i].y, 9);
      });
    }
  });
});

describe('foldFillUv', () => {
  it('partitions a straddling fill with the original total area', () => {
    // rectangle straddling the p4m fold line y = x
    const rect = [
      { x: 0.15, y: 0.1 },
      { x: 0.35, y: 0.1 },
      { x: 0.35, y: 0.3 },
      { x: 0.15, y: 0.3 },
    ];
    const pieces = foldFillUv(rect, 'p4m');
    expect(pieces.length).toBeGreaterThan(1);
    for (const piece of pieces) {
      for (const p of piece) expect(insideRegion(p, 'p4m')).toBe(true);
    }
    const total = pieces.reduce((s, pc) => s + Math.abs(signedArea(pc)), 0);
    expect(total).toBeCloseTo(Math.abs(signedArea(rect)), 6);
  });

  it('keeps a fill inside one copy as a single piece', () => {
    const tri = [
      { x: 0.3, y: 0.05 },
      { x: 0.42, y: 0.05 },
      { x: 0.42, y: 0.15 },
    ];
    const pieces = foldFillUv(tri, 'p4m');
    expect(pieces).toHaveLength(1);
    expect(Math.abs(signedArea(pieces[0]))).toBeCloseTo(
      Math.abs(signedArea(tri)),
      9,
    );
  });
});
