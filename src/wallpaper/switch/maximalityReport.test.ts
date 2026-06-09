import { describe, it, expect } from 'vitest';
import type { WallpaperGroup } from '../types';
import { asymmetricUnitUv } from '../regions';
import { galleryMotifDefs, type GalleryMotif } from '../galleryMotifs';
import { detectMaximalGroup } from './maximalityReport';

// ─────────────────────────────────────────────────────────────────────────────
// CONDITION-1 HARD PINS. detectMaximalGroup is a REPORT, not core — but its naming is
// the risky part, so pin it both ways against known motifs:
//   • chiral / already-maximal drawings stay at their declared group — including
//     p4g-pinwheel staying p4g (NOT p4m) and p31m-medallion staying p31m (NOT p3m1 or
//     p6m), which is exactly the incidence-name discrimination;
//   • a drawing that fills its whole fundamental region tiles the plane uniformly, so
//     its orbit is invariant under every same-lattice op → it must promote to the
//     lattice's holonomy group (square → p4m, hexagonal → p6m). This guarantees a
//     genuine promotion (no hand-placed coordinates to get wrong).
// ─────────────────────────────────────────────────────────────────────────────

// A motif that fills the entire fundamental region (one fill = the region polygon).
const fillRegion = (group: WallpaperGroup): GalleryMotif => ({
  fills: [{ pts: asymmetricUnitUv[group], color: '#000' }],
});

const detect = (m: GalleryMotif, g: WallpaperGroup): WallpaperGroup =>
  detectMaximalGroup(m, g).maximal;

describe('detectMaximalGroup — chiral / maximal drawings stay put', () => {
  const cases: Array<[string, WallpaperGroup]> = [
    ['p4-cracked-ice', 'p4'],
    ['p4m-girih-star', 'p4m'],
    ['p4g-pinwheel', 'p4g'],
    ['p6-whirl', 'p6'],
    ['p3-trefoil-knot', 'p3'],
    ['p31m-medallion', 'p31m'],
    ['p6m-shamsa', 'p6m'],
  ];
  for (const [id, group] of cases) {
    it(`${id} declared ${group} → stays ${group}`, () => {
      const r = detectMaximalGroup(galleryMotifDefs[id], group);
      expect(r.maximal).toBe(group);
      expect(r.isMaximal).toBe(true);
    });
  }
});

describe('detectMaximalGroup — region-filling drawings promote to the holonomy group', () => {
  it('a chiral p4 region filled solid → p4m (gains a mirror)', () => {
    expect(detect(fillRegion('p4'), 'p4')).toBe('p4m');
  });

  it('a chiral p6 region filled solid → p6m', () => {
    expect(detect(fillRegion('p6'), 'p6')).toBe('p6m');
  });

  it('reports the gained element in the caption', () => {
    const r = detectMaximalGroup(fillRegion('p4'), 'p4');
    expect(r.isMaximal).toBe(false);
    expect(r.maximal).toBe('p4m');
    expect(r.gained).toContain('a mirror line');
  });
});

// Incidence discrimination is pinned by the "stays put" cases above — the dangerous
// failure a reporter must avoid is FALSE promotion, and p4g-pinwheel staying p4g (not
// p4m) and p31m-medallion staying p31m (not p3m1/p6m) pin exactly the centred-vs-off-
// centre mirror distinction with real authored art. A clean synthetic p4g→p4m promotion
// is geometry-brittle (the p4g region's diagonal hypotenuse samples asymmetrically on a
// finite grid), so per the M2 plan it is left to the reporter's honest grid verdict
// rather than forced with hand-placed coordinates.
