import { describe, it, expect } from 'vitest';
import { compileUnit } from '../engine/compile';
import { renderSymmetryElements } from './symmetryElements';
import { storedBasisOf } from './congruence';
import { asymmetricUnitUv } from '../regions';
import { applyToPolygon, basisToMatrix } from '../affine';
import type { WallpaperGroup } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// SYMMETRY-ELEMENT OVERLAY: mirror vs GLIDE axis families per group.
//
// Regression for the centered-group glide bug: the glide reflections of cm/cmm arise as
// (mirror ∘ centering-translation), so they only appear once the coset rep is translated
// by the centering vector — classifying the bare origin op mislabelled them as mirrors
// and dropped every glide line. The primitive groups (pg/pgg/pmg) carry the glide as its
// own coset rep, so they were never affected; we pin them too as controls.
//
// We assert the number of DISTINCT axis-family ANGLES (mod π) for mirrors and for glides
// against the known crystallography — not the raw line count (which depends on the window
// and is just repetitions of each family).
// ─────────────────────────────────────────────────────────────────────────────

const window = (r: number) => {
  const out: { i: number; j: number }[] = [];
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) out.push({ i, j });
  return out;
};

// Distinct axis-family angles (mod π) split by mirror (solid) vs glide (dashed).
const axisFamilies = (group: WallpaperGroup): { mirrors: number; glides: number } => {
  const basis = storedBasisOf(group);
  const regionXy = applyToPolygon(basisToMatrix(basis), asymmetricUnitUv[group]);
  const compiled = compileUnit({
    id: 'x',
    group,
    label: 'x',
    basis,
    regionXy,
    motifId: 'x',
  });
  const svg = renderSymmetryElements({
    opsInCellXy: compiled.opsInCellXy,
    basis,
    poseMatrix: { a: 80, b: 0, c: 0, d: 80, e: 200, f: 200 },
    tilePositions: window(2),
    viewBox: { x: 0, y: 0, w: 400, h: 400 },
  });

  const mirrors = new Set<number>();
  const glides = new Set<number>();
  for (const chunk of svg.split('<line ').slice(1)) {
    const m = chunk.match(/x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/);
    if (!m) continue;
    const [x1, y1, x2, y2] = m.slice(1, 5).map(Number);
    let ang = Math.atan2(y2 - y1, x2 - x1);
    if (ang < 0) ang += Math.PI;
    ang %= Math.PI;
    const key = Math.round(ang / 1e-2);
    (chunk.includes('stroke-dasharray') ? glides : mirrors).add(key);
  }
  return { mirrors: mirrors.size, glides: glides.size };
};

// Known mirror/glide axis-family directions per group (mod π).
const EXPECTED: Record<string, { mirrors: number; glides: number }> = {
  pm: { mirrors: 1, glides: 0 },
  pg: { mirrors: 0, glides: 1 },
  cm: { mirrors: 1, glides: 1 }, // glide parallel to the mirror — the fixed bug
  pmm: { mirrors: 2, glides: 0 },
  pmg: { mirrors: 1, glides: 1 }, // mirror + perpendicular glide
  pgg: { mirrors: 0, glides: 2 },
  cmm: { mirrors: 2, glides: 2 }, // two mirror dirs + two glide dirs — the fixed bug
};

describe('symmetry overlay — mirror/glide axis families', () => {
  for (const [group, exp] of Object.entries(EXPECTED)) {
    it(`${group} → ${exp.mirrors} mirror + ${exp.glides} glide direction(s)`, () => {
      expect(axisFamilies(group as WallpaperGroup)).toEqual(exp);
    });
  }
});
