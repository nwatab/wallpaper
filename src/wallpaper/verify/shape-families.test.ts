import { describe, it, expect } from 'vitest';
import { asymmetricUnitUv } from '../regions';
import { getGroup } from '../groups';
import { motifInk } from '../galleryMotifs';
import { toggleSets } from '../switch/shapeFamilies';
import { groupGeoms, groupSymmetry, discriminatorOf } from '../switch/congruence';
import {
  sampleInk,
  patternFingerprint,
  isInvariantUnder,
  FRAC,
} from './maximality';
import type { WallpaperGroup } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// SWITCH SETS (M1, derived). The toggle-sets are the congruence classes with ≥2
// members (switch/congruence.ts) — never hand-listed here. These tests defend the
// properties every derived toggle-set must have, and PIN the caption discriminators
// to known group-theory truth.
// ─────────────────────────────────────────────────────────────────────────────

const N = 100;
const sets = toggleSets();
const sigByGroup = new Map(groupGeoms().map((g) => [g.group, g.sigKey]));

// ── (1) every derived toggle-set is internally congruent (same shape, size, lattice)
describe('(1) toggle-sets are congruence classes (derived, not hand-listed)', () => {
  it('there is at least one toggle-set', () => {
    expect(sets.length).toBeGreaterThan(0);
  });
  for (const set of sets) {
    it(`${set.id}: members share one congruence signature`, () => {
      const sigs = new Set(set.members.map((m) => sigByGroup.get(m.group)));
      expect(set.members.length).toBeGreaterThanOrEqual(2);
      expect(sigs.size, `members of ${set.id} congruent`).toBe(1);
      // congruence ⇒ equal point-group order (region area = cell/order)
      const orders = new Set(set.members.map((m) => getGroup(m.group).cosetReps.length));
      expect(orders.size, 'equal order').toBe(1);
    });
  }
});

// ── (2) switching is meaningful: members render to DISTINCT orbits ───────────────
const fingerprintOf = (group: WallpaperGroup, placedMotif: ReturnType<typeof toggleSets>[number]['members'][number]['placedMotif']) => {
  const ink = sampleInk(motifInk(placedMotif), N, asymmetricUnitUv[group]);
  return patternFingerprint(ink, getGroup(group).cosetReps);
};

describe('(2) within each toggle-set, members render to distinct patterns', () => {
  for (const set of sets) {
    it(`${set.id}: pairwise-distinct fingerprints`, () => {
      const fps = set.members.map((m) => fingerprintOf(m.group, m.placedMotif));
      for (let i = 0; i < fps.length; i++) {
        for (let j = i + 1; j < fps.length; j++) {
          const a = fps[i];
          const b = fps[j];
          const differ = a.size !== b.size || [...a].some((k) => !b.has(k));
          expect(differ, `${set.members[i].group} ≠ ${set.members[j].group}`).toBe(true);
        }
      }
    });
  }
});

// ── (3) switching is honest: each render is MAXIMAL for its group ────────────────
// Promoting generators per at-risk member (test config — the SETS are still derived).
// The lattice-holohedral members (p4m square, pmm rectangular) are maximal by
// construction, so they only need a non-trivial fill.
const PROMOTERS: Partial<Record<WallpaperGroup, string[]>> = {
  p4g: ['mirrorU', 'mirrorV'], // → p4m
  pm: ['rot180c', 'mirrorV'], // → pmm / pmg
  pg: ['rot180c', 'mirrorU', 'mirrorV'], // → pgg / pmg / pm
  pmg: ['mirrorV', 'rot90c'], // → pmm / p4m
  p6: ['mirrorP3m1', 'mirrorP31m'], // → p6m
  p31m: ['mirrorP3m1', 'rot60'], // → p6m
};

describe('(3) each switched render is maximal for its group', () => {
  for (const set of sets) {
    for (const m of set.members) {
      it(`${set.id} · ${m.group}`, () => {
        const reps = getGroup(m.group).cosetReps;
        const ink = sampleInk(motifInk(m.placedMotif), N, asymmetricUnitUv[m.group]);
        const fp = patternFingerprint(ink, reps);
        expect(fp.size, 'non-trivial pattern').toBeGreaterThan(20);
        for (const g of PROMOTERS[m.group] ?? []) {
          expect(
            isInvariantUnder(fp, ink, reps, FRAC[g]),
            `${m.group} must NOT be invariant under ${g}`,
          ).toBe(false);
        }
      });
    }
  }
});

// ── (4) caption discriminators pinned to known truth ────────────────────────────
describe('(4) discriminators match known group-theory values', () => {
  it('incidence (highestRotationCentresOnMirrors): p4m/p3m1 true, p4g/p31m false', () => {
    expect(groupSymmetry('p4m').centresOnMirrors).toBe(true);
    expect(groupSymmetry('p4g').centresOnMirrors).toBe(false);
    expect(groupSymmetry('p3m1').centresOnMirrors).toBe(true);
    expect(groupSymmetry('p31m').centresOnMirrors).toBe(false);
  });

  it('mirror presence: p6 false (chiral), p31m true', () => {
    expect(groupSymmetry('p6').hasMirror).toBe(false);
    expect(groupSymmetry('p31m').hasMirror).toBe(true);
  });

  it('derived discriminator kind per flagship set', () => {
    expect(discriminatorOf(['p4m', 'p4g']).kind).toBe('incidence');
    expect(discriminatorOf(['pmm', 'pmg']).kind).toBe('incidence');
    expect(discriminatorOf(['p6', 'p31m']).kind).toBe('mirror-presence');
    expect(discriminatorOf(['pm', 'pg']).kind).toBe('mirror-presence');
  });
});
