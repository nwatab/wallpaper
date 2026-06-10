import { describe, it, expect } from 'vitest';
import type { Affine2D, Vec2, WallpaperGroup } from '../types';
import { applyToPoint, compose, rotateDeg, scaleUniform } from '../affine';
import { getGroup } from '../groups';
import { asymmetricUnitUv } from '../regions';
import { cellStampTransforms } from '../export/exportSvg';
import { overlapDepth } from '../engine/render';
import { tile } from '../engine/tile';
import { unitTemplates } from '../unitTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// CELL-TILING CONSISTENCY — the gap that let cm/cmm through.
//
// The seamless cell (buildCellLayers) is REPEAT-tiled by translation, both by the tileable
// <pattern> export and by the Warp shader (uv = fract(B⁻¹·z)). For that to reproduce a group,
// the cell must contain ONE COMPLETE PERIOD: every fractional point of [0,1)² must be covered
// by the same motif copy the group's own tiling (engine `tile()`) puts there.
//
// This is a basis-INDEPENDENT, uv-space question (B is a bijection world↔uv that can't change
// coverage), so we test it in fractional coords with the identity basis: then the cell's stamp
// transforms equal the coset reps × lattice neighbours — exactly what cellStampTransforms emits.
//
// The PRIOR gap: the export refactor was gated export-vs-export (byte-identical), so nothing
// compared the cell against the GROUP-applied render. Centred lattices (cm, cmm) have coset-rep
// copies that land outside [0,1)² at their raw position and arrive in-cell only via a lattice
// neighbour; without the neighbour wrap they were dropped → a sparse, wrong pattern.
// ─────────────────────────────────────────────────────────────────────────────

const IDENTITY_BASIS = { a: { x: 1, y: 0 }, b: { x: 0, y: 1 } };
const ALL_GROUPS = Object.keys(asymmetricUnitUv) as WallpaperGroup[];

const frac = (x: number): number => x - Math.floor(x);
const key = (p: Vec2): string => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
const inUnitCell = (p: Vec2): boolean =>
  p.x >= 0 && p.x < 1 && p.y >= 0 && p.y < 1;

// Even-odd ray cast; offset-grid samples never land on a region edge so membership is crisp.
const pointInPolygon = (p: Vec2, poly: Vec2[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
};

// Offset grid over [0,1)² restricted to the fundamental region — the "ink" we orbit. The half
// offset keeps every sample strictly interior (no edge ambiguity) and closed under the integer
// coset matrices + {0, ½, 1} translations the groups use.
const N = 12;
const regionSamples = (region: Vec2[]): Vec2[] => {
  const pts: Vec2[] = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const p = { x: (i + 0.5) / N, y: (j + 0.5) / N };
      if (pointInPolygon(p, region)) pts.push(p);
    }
  }
  return pts;
};

const orbitFolded = (reps: Affine2D[], samples: Vec2[]): Set<string> => {
  const set = new Set<string>();
  for (const rep of reps)
    for (const p of samples) {
      const q = applyToPoint(rep, p);
      set.add(key({ x: frac(q.x), y: frac(q.y) }));
    }
  return set;
};

const cellCoverage = (stamps: Affine2D[], samples: Vec2[]): Set<string> => {
  const set = new Set<string>();
  for (const m of stamps)
    for (const p of samples) {
      const q = applyToPoint(m, p);
      if (inUnitCell(q)) set.add(key(q)); // clipped to the cell — NO wrap-key (the texture clips)
    }
  return set;
};

describe('cell tiling reproduces the full group, for all 17 groups', () => {
  for (const group of ALL_GROUPS) {
    it(`${group}: cell coverage == group orbit`, () => {
      const reps = getGroup(group).cosetReps;
      const samples = regionSamples(asymmetricUnitUv[group]);
      expect(samples.length).toBeGreaterThan(0);

      const groupSet = orbitFolded(reps, samples);
      const stamps = cellStampTransforms(IDENTITY_BASIS, reps);
      const cellSet = cellCoverage(stamps, samples);

      expect(cellSet).toEqual(groupSet);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAP DEPTH ORDER — coverage alone is NOT sufficient for overlap patterns: the painter's
// (z-depth) order IS the content (which arc sits on top). The baked cell must stack copies in
// the SAME order as the gallery; equal coverage + equal top-copy ⇒ identical pattern.
// ─────────────────────────────────────────────────────────────────────────────
describe('overlap depth: baked cell stacks like the gallery at its default pose (seigaiha)', () => {
  const template = unitTemplates.find(
    (t) => t.id === 'cm-seigaiha-equilateral-triangle',
  )!;
  const depthRot = template.defaultPose!.rotationDeg; // 210° — the design's recede orientation
  const CENTRE = { x: 0.5, y: 0.5 };
  const sgn = (x: number): number => (x > 1e-9 ? 1 : x < -1e-9 ? -1 : 0);

  // Canonical (identity-pose) copies of the overlap motif over several cells.
  const { orbitElements } = tile({
    template,
    viewport: { x: 0, y: 0, width: 3, height: 3 },
    pose: { scale: 1, rotationDeg: 0, translate: { x: 0, y: 0 } },
  });
  const centres = orbitElements.map((el) => applyToPoint(el.transform, CENTRE));

  // Gallery painter's depth AT THE DEFAULT POSE (the on-screen reference): screen-y after the
  // template's pose. Uniform scale + rotation; translate is a constant offset (order-irrelevant).
  const poseDefault = compose(
    rotateDeg(depthRot),
    scaleUniform(template.defaultPose!.scale),
  );
  const galleryDepth = orbitElements.map(
    (el) => applyToPoint(compose(poseDefault, el.transform), CENTRE).y,
  );
  // The shared cell-baking key (engine/render.overlapDepth) with the recede orientation.
  const cellDepth = centres.map((c) => overlapDepth(c, depthRot));

  it('top copy agrees for every pair (same painter order as the gallery)', () => {
    for (let i = 0; i < centres.length; i++)
      for (let j = i + 1; j < centres.length; j++)
        expect(sgn(cellDepth[i] - cellDepth[j])).toBe(
          sgn(galleryDepth[i] - galleryDepth[j]),
        );
  });

  it('the un-oriented (0°) depth would DISAGREE — the recede orientation matters', () => {
    const flat = centres.map((c) => overlapDepth(c, 0)); // the pre-fix canonical-y sort
    const disagrees = centres.some((_, i) =>
      centres.some(
        (__, j) =>
          i < j && sgn(flat[i] - flat[j]) !== sgn(galleryDepth[i] - galleryDepth[j]),
      ),
    );
    expect(disagrees).toBe(true);
  });
});

describe('the test has teeth (it would catch the cmm regression)', () => {
  // Without the lattice-neighbour wrap (raw coset-rep copies only, t=0, clipped to the cell),
  // any group with origin-based coset reps that send the FR outside [0,1)² drops those copies →
  // strictly fewer cells covered. cmm is the reported case: its mirror (−v,−u) and rotation
  // (−u,−v) reps map the FR entirely into negative coords, so half the cell goes uncovered
  // pre-fix. (Note cm itself does NOT exhibit this — its `swap` keeps both copies in-cell.)
  it('cmm: un-wrapped (no neighbour) coverage is a STRICT subset of the orbit', () => {
    const reps = getGroup('cmm').cosetReps;
    const samples = regionSamples(asymmetricUnitUv.cmm);
    const groupSet = orbitFolded(reps, samples);
    const noWrap = cellCoverage(reps, samples); // raw reps only — the pre-fix behaviour
    expect(noWrap.size).toBeLessThan(groupSet.size);
  });
});
