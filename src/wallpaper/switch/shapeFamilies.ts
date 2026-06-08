import type { Affine2D, UnitTemplate, Vec2, WallpaperGroup } from '../types';
import {
  applyToPoint,
  applyToPolygon,
  basisToMatrix,
  conjugateByBasis,
  identity,
  invert,
} from '../affine';
import { asymmetricUnitUv } from '../regions';
import { unitTemplates } from '../unitTemplates';
import { motifs } from '../motifs';
import { motifToSvg, type GalleryMotif } from '../galleryMotifs';
import { switchMotifs } from './shapeMotifs';
import {
  congruenceClasses,
  discriminatorOf,
  maximalGroupByLattice,
  storedBasisOf,
  type Discriminator,
  type LatticeType,
} from './congruence';

// ─────────────────────────────────────────────────────────────────────────────
// SWITCH SETS, DERIVED (M1 refactor).
//
// Nothing here hand-lists which groups toggle together. The toggle-sets are exactly the
// congruence classes with ≥2 members (congruence.ts), organised by lattice. For each
// toggle-set the FIRST member is the reference: its uv asymmetric unit is the frame the
// shape-local motif (shapeMotifs.ts) is authored in, and every other member's placement
// is the ISOMETRY carrying that frame onto the member's own (congruent) region — derived
// from the stored region vertices, not authored. Singletons reuse their existing
// unitTemplate so they still render (with the overlay) but cannot toggle.
// ─────────────────────────────────────────────────────────────────────────────

type Basis = { a: Vec2; b: Vec2 };

// ── derive the isometry between two congruent regions ────────────────────────
const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

// Vertex order of `mem` that matches `ref`'s edge-length cycle (a true congruence).
// Returns the index order, or null if the polygons are not congruent.
const findCorrespondence = (ref: Vec2[], mem: Vec2[]): number[] | null => {
  const n = ref.length;
  if (mem.length !== n) return null;
  const refE = ref.map((p, i) => dist(p, ref[(i + 1) % n]));
  for (const dir of [1, -1]) {
    for (let s = 0; s < n; s++) {
      const order = Array.from({ length: n }, (_, k) => ((s + dir * k) % n + n) % n);
      const memE = order.map((idx, k) => dist(mem[idx], mem[order[(k + 1) % n]]));
      if (refE.every((e, k) => Math.abs(e - memE[k]) < 1e-6)) return order;
    }
  }
  return null;
};

// Unique affine sending src[k] ↦ dst[k] for the first three (non-collinear) corners.
const affineFromTriangle = (src: Vec2[], dst: Vec2[]): Affine2D => {
  const sx1 = src[1].x - src[0].x;
  const sy1 = src[1].y - src[0].y;
  const sx2 = src[2].x - src[0].x;
  const sy2 = src[2].y - src[0].y;
  const det = sx1 * sy2 - sx2 * sy1;
  const i00 = sy2 / det;
  const i01 = -sx2 / det;
  const i10 = -sy1 / det;
  const i11 = sx1 / det;
  const dx1 = dst[1].x - dst[0].x;
  const dy1 = dst[1].y - dst[0].y;
  const dx2 = dst[2].x - dst[0].x;
  const dy2 = dst[2].y - dst[0].y;
  const a = dx1 * i00 + dx2 * i10;
  const c = dx1 * i01 + dx2 * i11;
  const b = dy1 * i00 + dy2 * i10;
  const d = dy1 * i01 + dy2 * i11;
  const e = dst[0].x - (a * src[0].x + c * src[0].y);
  const f = dst[0].y - (b * src[0].x + d * src[0].y);
  return { a, b, c, d, e, f };
};

const isProper = (m: Affine2D): boolean => m.a * m.d - m.b * m.c > 0;

const transformMotif = (m: GalleryMotif, t: Affine2D): GalleryMotif => {
  const tf = (pts: Vec2[]): Vec2[] => pts.map((p) => applyToPoint(t, p));
  return {
    fills: m.fills?.map((fl) => ({ ...fl, pts: tf(fl.pts) })),
    strokes: m.strokes?.map((st) => ({ ...st, pts: tf(st.pts) })),
  };
};

// ── public types ─────────────────────────────────────────────────────────────
export type ToggleMember = {
  group: WallpaperGroup;
  // The shape-local motif placed (by isometry) into this member's uv asymmetric unit.
  placedMotif: GalleryMotif;
  // World-space view adjustment applied at render (after the user pose) so this member's
  // tile lands exactly where the REFERENCE member's tile is — undoing the placement's
  // rotation AND its (possibly half-cell) translation, so toggling keeps the same tile in
  // the same place and only the symmetry elements change. It is B·P⁻¹·B⁻¹ for the
  // placement P. Reflection-only placements (enantiomorphic tiles, e.g. p6↔p31m) get the
  // identity: pose cannot mirror, and that mirror difference is intrinsic.
  alignXy: Affine2D;
};

export type ToggleSet = {
  id: string;
  lattice: LatticeType;
  reference: WallpaperGroup;
  members: ToggleMember[];
  discriminator: Discriminator;
};

// What the renderer needs for any group (toggle member OR singleton).
export type Renderable = {
  template: UnitTemplate;
  motifSvg: string;
  alignXy: Affine2D;
};

const switchTemplate = (
  group: WallpaperGroup,
  basis: Basis,
  regionXy: Vec2[],
): UnitTemplate => ({
  id: `switch-${group}`,
  group,
  label: `switch · ${group}`,
  basis,
  regionXy,
  motifId: `switch-${group}`,
  motifLayer: 'clip',
});

// Build the toggle-sets (congruence classes with ≥2 members), placements derived.
const buildToggleSets = (): ToggleSet[] => {
  const sets: ToggleSet[] = [];
  for (const cls of congruenceClasses()) {
    if (cls.members.length < 2) continue;
    const reference = cls.members[0];
    const refMotif = switchMotifs[reference];
    if (!refMotif) continue; // no shape-local art authored for this class yet
    const basis = storedBasisOf(reference);
    const B = basisToMatrix(basis);
    const refUv = asymmetricUnitUv[reference];
    const refXy = applyToPolygon(B, refUv);

    const members: ToggleMember[] = cls.members.map((group) => {
      const memUv = asymmetricUnitUv[group];
      const memXy = applyToPolygon(basisToMatrix(storedBasisOf(group)), memUv);
      const order = findCorrespondence(refXy, memXy);
      if (!order) {
        throw new Error(`No congruence ${reference}→${group} (class derivation bug)`);
      }
      // reference corner k ↦ member corner order[k]
      const placement = affineFromTriangle(
        [refUv[0], refUv[1], refUv[2]],
        [memUv[order[0]], memUv[order[1]], memUv[order[2]]],
      );
      // Align this member's tile back onto the reference's: world transform B·P⁻¹·B⁻¹.
      // Only when P is proper (a rotation+translation) — a reflection can't be undone by
      // the similarity pose, and that mirror difference is intrinsic (p6 ↔ p31m).
      const alignXy = isProper(placement)
        ? conjugateByBasis(B, invert(placement))
        : identity();
      return { group, placedMotif: transformMotif(refMotif, placement), alignXy };
    });

    sets.push({
      id: `toggle-${cls.lattice}-${reference}`,
      lattice: cls.lattice,
      reference,
      members,
      discriminator: discriminatorOf(cls.members),
    });
  }
  return sets;
};

let _toggleSets: ToggleSet[] | null = null;
export const toggleSets = (): ToggleSet[] => (_toggleSets ??= buildToggleSets());

// First existing unitTemplate for a group (for singleton rendering / reuse).
const existingTemplate = (group: WallpaperGroup): UnitTemplate | undefined =>
  unitTemplates.find((t) => t.group === group);

// Renderable for every group: toggle members use the placed shape-local motif; any other
// group reuses its existing template + motif so it can still be shown with the overlay.
let _renderables: Map<WallpaperGroup, Renderable> | null = null;
export const renderableByGroup = (): Map<WallpaperGroup, Renderable> => {
  if (_renderables) return _renderables;
  const map = new Map<WallpaperGroup, Renderable>();
  for (const set of toggleSets()) {
    for (const m of set.members) {
      const basis = storedBasisOf(m.group);
      const regionXy = applyToPolygon(basisToMatrix(basis), asymmetricUnitUv[m.group]);
      map.set(m.group, {
        template: switchTemplate(m.group, basis, regionXy),
        motifSvg: motifToSvg(m.placedMotif),
        alignXy: m.alignXy,
      });
    }
  }
  for (const group of Object.keys(asymmetricUnitUv) as WallpaperGroup[]) {
    if (map.has(group)) continue;
    const t = existingTemplate(group);
    if (t)
      map.set(group, {
        template: t,
        motifSvg: motifs[t.motifId] ?? '',
        alignXy: identity(),
      });
  }
  _renderables = map;
  return map;
};

// ── UI structure: lattice → classes (toggle | single), each headed by its maximal group
export type ClassEntry =
  | { kind: 'toggle'; set: ToggleSet }
  | { kind: 'single'; group: WallpaperGroup };

export type LatticeSection = {
  lattice: LatticeType;
  maximalGroup: WallpaperGroup;
  classes: ClassEntry[];
};

const LATTICE_ORDER: LatticeType[] = [
  'square',
  'hexagonal',
  'rectangular',
  'rhombic',
  'oblique',
];

export const latticeSections = (): LatticeSection[] => {
  const maxg = maximalGroupByLattice();
  const sets = toggleSets();
  const classes = congruenceClasses();
  return LATTICE_ORDER.map((lattice) => {
    const entries: ClassEntry[] = [];
    for (const cls of classes.filter((c) => c.lattice === lattice)) {
      if (cls.members.length >= 2) {
        const set = sets.find(
          (s) => s.lattice === lattice && s.reference === cls.members[0],
        );
        if (set) {
          entries.push({ kind: 'toggle', set });
          continue;
        }
      }
      for (const group of cls.members) entries.push({ kind: 'single', group });
    }
    return { lattice, maximalGroup: maxg.get(lattice)!, classes: entries };
  });
};
