import { describe, expect, it } from 'vitest';
import type { WallpaperGroup } from '../types';
import { applyToPoint, rotateDeg } from '../affine';
import { asymmetricUnitUv } from '../regions';
import {
  overlapAllowed,
  overlapDepthRotationDeg,
  overlapRecedeDirection,
} from './overlapGate';

// ─────────────────────────────────────────────────────────────────────────────
// Overlap soundness gate. Painter depth d = ⟨centre, u⟩ survives the group action iff
// every coset rep's linear part fixes u — so the allowed set must come out as exactly
// the single-axis-direction groups {p1, pm, pg, cm}, DERIVED, matching the gallery's
// implicit motifLayer:'overlap' restriction. The depth rotation must carry each
// group's own axis onto +y (pg's axis is horizontal — a constant 0 was wrong for it).
// ─────────────────────────────────────────────────────────────────────────────

const ALL = Object.keys(asymmetricUnitUv) as WallpaperGroup[];
const SOUND = new Set<WallpaperGroup>(['p1', 'pm', 'pg', 'cm']);

describe('overlapRecedeDirection / overlapAllowed', () => {
  it('derives exactly the single-axis-direction groups', () => {
    for (const g of ALL) {
      expect(overlapRecedeDirection(g) !== null, g).toBe(SOUND.has(g));
      expect(overlapAllowed(g), g).toBe(SOUND.has(g));
    }
  });

  it('rotations of order ≥ 2 always reject (p2 has only ±I linear parts)', () => {
    expect(overlapRecedeDirection('p2')).toBeNull();
    expect(overlapRecedeDirection('p4')).toBeNull();
  });

  it('crossing mirror axes reject even without rotations in the axis test (pmm)', () => {
    expect(overlapRecedeDirection('pmm')).toBeNull();
  });
});

describe('overlapDepthRotationDeg', () => {
  it('pm: vertical mirror axis ⇒ depth 0 (the previous default was right here)', () => {
    expect(overlapDepthRotationDeg('pm')).toBeCloseTo(0, 9);
  });

  it('pg: horizontal glide axis ⇒ depth 90 (the previous default was wrong here)', () => {
    expect(overlapDepthRotationDeg('pg')).toBeCloseTo(90, 9);
  });

  it('p1: unconstrained ⇒ defaults to +y / depth 0 (back-compat)', () => {
    expect(overlapDepthRotationDeg('p1')).toBeCloseTo(0, 9);
  });

  it('maps every sound group’s recede direction onto +y', () => {
    for (const g of [...SOUND]) {
      const u = overlapRecedeDirection(g)!;
      const rot = overlapDepthRotationDeg(g)!;
      const mapped = applyToPoint(rotateDeg(rot), u);
      expect(mapped.x, g).toBeCloseTo(0, 9);
      expect(mapped.y, g).toBeCloseTo(1, 9);
    }
  });

  it('returns null for unsound groups (the gate)', () => {
    for (const g of ALL.filter((g) => !SOUND.has(g))) {
      expect(overlapDepthRotationDeg(g), g).toBeNull();
    }
  });
});
