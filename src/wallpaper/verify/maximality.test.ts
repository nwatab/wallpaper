import { describe, it, expect } from 'vitest';
import { asymmetricUnitUv } from '../regions';
import { getGroup } from '../groups';
import { galleryMotifDefs, motifInk } from '../galleryMotifs';
import {
  sampleInk,
  patternFingerprint,
  isInvariantUnder,
  FRAC,
} from './maximality';
import type { Affine2D, Vec2, WallpaperGroup } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// MAXIMALITY of the gallery motifs: the declared group must be the FULL symmetry of
// the rendered (clipped) pattern. For each at-risk motif we name the generators that
// would promote it to the next larger group and assert the inked pattern is NOT
// invariant under any of them. (Color is ignored — the wallpaper-group convention.)
//
// p4m / p6m are the maximal groups of their lattice and cmm is maximal for the rhombic
// lattice, so they need no upgrade check — only that the motif actually fills.
// ─────────────────────────────────────────────────────────────────────────────

const N = 100;

// Which generators, if they preserved the pattern, would over-promote each motif.
const UPGRADE_GENERATORS: Record<
  string,
  { group: WallpaperGroup; gens: string[]; promotesTo: string }
> = {
  // chiral C4 → adding any reflection ⇒ p4m
  'gen-p4-cracked-ice': {
    group: 'p4',
    gens: ['mirrorU', 'mirrorV', 'diag', 'antiDiag'],
    promotesTo: 'p4m',
  },
  // rectangular D2 → 4-fold rotation or a diagonal mirror ⇒ p4m
  'gen-pmm-leiwen': {
    group: 'pmm',
    gens: ['rot90c', 'diag', 'antiDiag'],
    promotesTo: 'p4m',
  },
  // chiral C6 → any reflection ⇒ p6m
  'gen-p6-whirl': {
    group: 'p6',
    gens: ['mirrorP3m1', 'mirrorP31m'],
    promotesTo: 'p6m',
  },
  // p4g vs p4m: the centred axial mirror through the 4-fold centre ⇒ p4m
  'gen-p4g-pinwheel': {
    group: 'p4g',
    gens: ['mirrorU', 'mirrorV'],
    promotesTo: 'p4m',
  },
  // chiral C3 → a reflection (either family) ⇒ p3m1/p31m; 60° rotation ⇒ p6
  'gen-p3-trefoil': {
    group: 'p3',
    gens: ['mirrorP3m1', 'mirrorP31m', 'rot60'],
    promotesTo: 'p3m1 / p31m / p6',
  },
  // p31m → the other mirror family or a 60° rotation ⇒ p6m
  'gen-p31m-medallion': {
    group: 'p31m',
    gens: ['mirrorP3m1', 'rot60'],
    promotesTo: 'p6m',
  },
};

// Every gallery motif, with the group it is declared under, so we can also assert it
// actually fills its region.
const FILL: Record<string, WallpaperGroup> = {
  'gen-p4m-girih': 'p4m',
  'gen-p4-cracked-ice': 'p4',
  'gen-p6m-shamsa': 'p6m',
  'gen-pmm-leiwen': 'pmm',
  'gen-p6-whirl': 'p6',
  'gen-cmm-quatrefoil': 'cmm',
  'gen-p4g-pinwheel': 'p4g',
  'gen-p3-trefoil': 'p3',
  'gen-p31m-medallion': 'p31m',
};

const MOTIF_OF: Record<string, string> = {
  'gen-p4m-girih': 'p4m-girih-star',
  'gen-p4-cracked-ice': 'p4-cracked-ice',
  'gen-p6m-shamsa': 'p6m-shamsa',
  'gen-pmm-leiwen': 'pmm-leiwen',
  'gen-p6-whirl': 'p6-whirl',
  'gen-cmm-quatrefoil': 'cmm-quatrefoil',
  'gen-p4g-pinwheel': 'p4g-pinwheel',
  'gen-p3-trefoil': 'p3-trefoil-knot',
  'gen-p31m-medallion': 'p31m-medallion',
};

const inkOf = (id: string): { ink: Vec2[]; reps: Affine2D[]; regionFrac: number } => {
  const group = FILL[id];
  const region = asymmetricUnitUv[group];
  const reps = getGroup(group).cosetReps;
  const ink = sampleInk(motifInk(galleryMotifDefs[MOTIF_OF[id]]), N, region);
  const regionCells = sampleInk([region], N, region).length;
  return { ink, reps, regionFrac: ink.length / regionCells };
};

describe('gallery motifs fill their fundamental region', () => {
  for (const id of Object.keys(FILL)) {
    it(`${id} spans its region`, () => {
      const { regionFrac } = inkOf(id);
      // The inked network (with chiral negative space) must span the region, not float
      // as a small glyph: at least ~18% of the region's grid cells are ink.
      expect(regionFrac, `${id} inked fraction`).toBeGreaterThan(0.18);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SEPARATE AUDIT: is the existing 千鳥格子 (houndstooth) template's declared group its
// MAXIMAL symmetry? The idealised classic houndstooth is cmm (180° centres + diagonal
// mirror — Feijs, Bridges 2012), but this engine motif is a stylised 4-tooth variant.
// We measure THIS motif: it must carry ONLY the diagonal mirror y=x (the cm `swap`),
// and none of rot180 / rot90 / the perpendicular mirror / the axial mirrors — i.e. its
// true group is exactly cm, so the declaration is correct AND maximal (not under-
// declared cmm). DO NOT relabel on a literature hunch; this pins the measured truth.
// ─────────────────────────────────────────────────────────────────────────────
describe('houndstooth (cm) declaration is maximal — true group is exactly cm', () => {
  const TRIS: Vec2[][] = [
    [{ x: 0, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0, y: 0 }],
    [{ x: 0.5, y: 0.75 }, { x: 0.25, y: 0.5 }, { x: 0, y: 0.5 }],
    [{ x: 0.5, y: 1 }, { x: 0.5, y: 0.75 }, { x: 0, y: 0.5 }],
    [{ x: 0, y: 1 }, { x: 0.25, y: 1 }, { x: 0, y: 0.75 }],
  ];
  const reps = getGroup('cm').cosetReps; // [I, swap] under the square basis
  const ink = sampleInk(TRIS, N);
  const fp = patternFingerprint(ink, reps);

  it('IS invariant under the in-group diagonal mirror y=x', () => {
    expect(isInvariantUnder(fp, ink, reps, FRAC.diag)).toBe(true);
  });

  it('is NOT invariant under any generator that would promote cm → cmm / p4 / p4m', () => {
    for (const g of ['rot180c', 'rot90c', 'antiDiag', 'mirrorU', 'mirrorV']) {
      expect(
        isInvariantUnder(fp, ink, reps, FRAC[g]),
        `houndstooth must NOT gain ${g}`,
      ).toBe(false);
    }
  });
});

describe('gallery motifs are MAXIMAL — no symmetry beyond the declared group', () => {
  for (const [id, spec] of Object.entries(UPGRADE_GENERATORS)) {
    it(`${id} is not promoted to ${spec.promotesTo}`, () => {
      const { ink, reps } = inkOf(id);
      const fp = patternFingerprint(ink, reps);
      // Sanity: a non-trivial pattern (otherwise invariance is vacuous).
      expect(fp.size).toBeGreaterThan(50);
      for (const g of spec.gens) {
        const invariant = isInvariantUnder(fp, ink, reps, FRAC[g]);
        expect(invariant, `${id} must NOT be invariant under ${g}`).toBe(false);
      }
    });
  }
});
