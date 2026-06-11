import { describe, expect, it } from 'vitest';
import type { Vec2, WallpaperGroup } from '../types';
import { placeUserMotif } from '../switch/shapeFamilies';
import { snapTargetsUv, snapToTargets, type SnapTargets } from './snapTargets';

// ─────────────────────────────────────────────────────────────────────────────
// Snap-target invariants, pinned per group against the published cell diagrams:
// rotation centres / mirror axes land where Wikipedia's cell diagrams put them, and
// glide axes are NOT offered as snap lines. Geometry is exercised through the same
// stored basis the draw pane uses (placeUserMotif), so the hex groups run through a
// genuinely non-orthogonal uv↔XY conversion.
// ─────────────────────────────────────────────────────────────────────────────

const WINDOW = { min: { x: -0.2, y: -0.2 }, max: { x: 1.2, y: 1.2 } };

const targetsOf = (group: WallpaperGroup): SnapTargets =>
  snapTargetsUv({
    group,
    basis: placeUserMotif(group, {}).template.basis,
    window: WINDOW,
  });

const hasPoint = (t: SnapTargets, p: Vec2): boolean =>
  t.points.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 1e-6);

// Is there one snap line passing through BOTH p and q?
const hasLineThrough = (t: SnapTargets, p: Vec2, q: Vec2): boolean =>
  t.lines.some((l) => {
    const on = (r: Vec2): boolean =>
      Math.abs((r.x - l.c.x) * l.dir.y - (r.y - l.c.y) * l.dir.x) < 1e-6;
    return on(p) && on(q);
  });

describe('snapTargetsUv', () => {
  it('p4m: 4-fold corners/centre, the 2-fold edge midpoint, axial + diagonal mirrors', () => {
    const t = targetsOf('p4m');
    expect(hasPoint(t, { x: 0, y: 0 })).toBe(true); // 4-fold (lattice corner)
    expect(hasPoint(t, { x: 0.5, y: 0.5 })).toBe(true); // 4-fold (cell centre)
    expect(hasPoint(t, { x: 0.5, y: 0 })).toBe(true); // 2-fold (edge midpoint)
    expect(hasLineThrough(t, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true); // axial mirror v=0
    expect(hasLineThrough(t, { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(true); // diagonal mirror
    // the diagonal AXIS between the mirrors is a glide in p4m — must NOT snap
    expect(hasLineThrough(t, { x: 0.5, y: 0 }, { x: 1, y: 0.5 })).toBe(false);
  });

  it('pg: glide axes are not snap lines; unit vertices still snap', () => {
    const t = targetsOf('pg');
    expect(t.lines).toHaveLength(0); // pg has glides only, no mirrors
    expect(hasPoint(t, { x: 0, y: 0.5 })).toBe(true); // unit vertex on the glide
    expect(hasPoint(t, { x: 1, y: 1 })).toBe(true); // lattice point
  });

  it('p1: lattice points only (no symmetry elements)', () => {
    const t = targetsOf('p1');
    expect(t.lines).toHaveLength(0);
    for (const p of t.points) {
      expect(Math.abs(p.x - Math.round(p.x))).toBeLessThan(1e-9);
      expect(Math.abs(p.y - Math.round(p.y))).toBeLessThan(1e-9);
    }
  });

  it('p3 (hex basis): deep-hole 3-fold centres at (1/3,2/3) and (2/3,1/3)', () => {
    const t = targetsOf('p3');
    expect(hasPoint(t, { x: 1 / 3, y: 2 / 3 })).toBe(true);
    expect(hasPoint(t, { x: 2 / 3, y: 1 / 3 })).toBe(true);
    expect(t.lines).toHaveLength(0); // chiral group — no mirrors
  });

  it('p6: 2-fold centre at the cell centre; no mirror lines (chiral)', () => {
    const t = targetsOf('p6');
    expect(hasPoint(t, { x: 0.5, y: 0.5 })).toBe(true);
    expect(t.lines).toHaveLength(0);
  });

  it('p6m: mirror axes exist (through the origin along the lattice direction)', () => {
    const t = targetsOf('p6m');
    expect(hasLineThrough(t, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true);
  });
});

describe('snapToTargets', () => {
  // 100 px per uv unit, no skew — px distances are uv distances × 100.
  const toCanvas = { a: 100, b: 0, c: 0, d: 100, e: 0, f: 0 };
  const targets: SnapTargets = {
    points: [{ x: 0, y: 0 }, { x: 0.5, y: 0 }],
    lines: [{ c: { x: 0, y: 0 }, dir: { x: Math.SQRT1_2, y: Math.SQRT1_2 } }],
  };

  it('snaps to a point in range, preferring it over a nearer line', () => {
    // (0.05,0.02): 5.4 px from the point (0,0), 2.1 px from the line y=x.
    const hit = snapToTargets({
      uv: { x: 0.05, y: 0.02 },
      targets,
      toCanvas,
      radiusPx: 12,
    });
    expect(hit?.kind).toBe('point');
    expect(hit?.uv.x).toBeCloseTo(0, 9);
    expect(hit?.uv.y).toBeCloseTo(0, 9);
  });

  it('projects onto a line when only the line is in range', () => {
    const hit = snapToTargets({
      uv: { x: 0.3, y: 0.26 },
      targets,
      toCanvas,
      radiusPx: 12,
    });
    expect(hit?.kind).toBe('line');
    expect(hit?.uv.x).toBeCloseTo(0.28, 6);
    expect(hit?.uv.y).toBeCloseTo(0.28, 6);
  });

  it('returns null when nothing is within the radius', () => {
    const hit = snapToTargets({
      uv: { x: 0.3, y: 0.1 },
      targets,
      toCanvas,
      radiusPx: 12,
    });
    expect(hit).toBeNull();
  });
});
