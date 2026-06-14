import { UnitTemplate, Vec2, WallpaperGroup } from './types';
import { basisToMatrix, applyToPolygon } from './affine';
import { asymmetricUnitUv } from './regions';
import { FLEUR_BASIS, TAPA_BASIS } from './galleryMotifs';

const S3_2 = Math.sqrt(3) / 2; // sin(60°) = √3/2

const vec2 = (x: number, y: number): Vec2 => ({ x, y });

// Each template references a wallpaper group (see groups.ts) for its symmetry ops;
// here we only declare the concrete lattice (basis), the fundamental region, and the
// motif. The group's fractional cosetReps are conjugated by `basis` at compile time.
const designTemplates: UnitTemplate[] = [
  // p1: oblique lattice, fundamental region = full unit cell
  {
    id: 'p1-parallelogram-70deg',
    group: 'p1',
    label: 'Parallelogram (70°)',
    basis: {
      a: { x: 1, y: 0 },
      b: {
        x: Math.cos((70 * Math.PI) / 180),
        y: Math.sin((70 * Math.PI) / 180),
      },
    },
    // full parallelogram: origin, a, a+b, b
    regionXy: [
      vec2(0, 0),
      vec2(1, 0),
      vec2(1 + Math.cos((70 * Math.PI) / 180), Math.sin((70 * Math.PI) / 180)),
      vec2(Math.cos((70 * Math.PI) / 180), Math.sin((70 * Math.PI) / 180)),
    ],
    motifId: 'motif-a',
    defaultPose: { scale: 120, rotationDeg: 0 },
  },

  // p2: hexagonal lattice, fundamental region = triangle, 180° rotation
  {
    id: 'p2-hex-equilateral-triangle',
    group: 'p2',
    label: 'Equilateral triangle on hex lattice',
    basis: { a: { x: 1, y: 0 }, b: { x: 0.5, y: S3_2 } },
    // triangle: origin, a, b
    regionXy: [vec2(0, 0), vec2(1, 0), vec2(0.5, S3_2)],
    motifId: 'motif-b',
    defaultPose: { scale: 120, rotationDeg: 0 },
  },

  // pm: rectangular lattice, fundamental region = left half, vertical mirror
  {
    id: 'pm-rectangular-vertical-mirrors',
    group: 'pm',
    label: 'Rectangular with vertical mirrors',
    basis: { a: { x: 1, y: 0 }, b: { x: 0, y: 1 } },
    regionXy: [vec2(0, 0), vec2(0.5, 0), vec2(0.5, 1), vec2(0, 1)],
    motifId: 'motif-pm-leaf',
    defaultPose: { scale: 120, rotationDeg: 0 },
  },

  // pg: rectangular lattice, fundamental region = top half, horizontal glide
  {
    id: 'pg-rectangular-horizontal-glides',
    group: 'pg',
    label: 'Rectangular with horizontal glide reflections',
    basis: { a: { x: 1, y: 0 }, b: { x: 0, y: 1 } },
    regionXy: [vec2(0, 0), vec2(1, 0), vec2(1, 0.5), vec2(0, 0.5)],
    motifId: 'motif-pg-arrow',
    defaultPose: { scale: 120, rotationDeg: 0 },
  },

  // cm: rhombic lattice, fundamental region = triangle, mirror across the rhombus axis.
  // basis is rhombic (|a| = |b| = 1) so the group's `swap` op is an isometry.
  {
    id: 'cm-seigaiha-equilateral-triangle',
    group: 'cm',
    label: 'Seigaiha -- equilateral triangle fundamental region',
    basis: {
      a: { x: 1, y: 0 },
      b: { x: -0.5, y: S3_2 },
    },
    // equilateral triangle: origin, a=(1,0), a+b=(0.5, sqrt(3)/2)
    regionXy: [vec2(0, 0), vec2(1, 0), vec2(0.5, S3_2)],
    motifId: 'motif-cm-seigaiha',
    // Seigaiha arcs deliberately overflow the region and overlap neighbouring copies.
    motifLayer: 'overlap',
    defaultPose: { scale: 120, rotationDeg: 210 },
  },

  // pmm: rectangular lattice, fundamental region = quarter cell [0,0.5]x[0,0.5]
  {
    id: 'pmm-rectangular',
    group: 'pmm',
    label: 'Rectangular -- two perpendicular mirrors',
    basis: { a: { x: 1, y: 0 }, b: { x: 0, y: 1 } },
    // quarter cell: top-left quadrant in SVG coords
    regionXy: [vec2(0, 0), vec2(0.5, 0), vec2(0.5, 0.5), vec2(0, 0.5)],
    motifId: 'motif-pmm-petal',
    defaultPose: { scale: 120, rotationDeg: 0 },
  },

  // pmg: rectangular lattice, fundamental region = quarter cell [0,0.5]x[0,0.5].
  // Vertical mirrors + horizontal glides + 2-fold rotation centres on the glide axes.
  {
    id: 'pmg-rectangular-vertical-mirrors',
    group: 'pmg',
    label: 'Rectangular -- vertical mirrors, horizontal glides',
    basis: { a: { x: 1, y: 0 }, b: { x: 0, y: 1 } },
    // quarter cell: upper-left quadrant [0,0.5]x[0,0.5]
    regionXy: [vec2(0, 0), vec2(0.5, 0), vec2(0.5, 0.5), vec2(0, 0.5)],
    motifId: 'motif-pmg',
    defaultPose: { scale: 120, rotationDeg: 0 },
  },

  // pgg: rectangular lattice, fundamental region = right-angled isosceles triangle.
  // Glides in both directions, no mirrors.
  {
    id: 'pgg-rectangular',
    group: 'pgg',
    label:
      'Rectangular -- glide reflections in both directions, no mirrors',
    basis: { a: { x: 1, y: 0 }, b: { x: 0, y: 1 } },
    // right-angled isosceles triangle: right angle at (1/2,1) in SVG (= y_up apex (1/2,0))
    regionXy: [vec2(0.5, 1), vec2(1, 0.5), vec2(0, 0.5)],
    motifId: 'motif-pgg',
    defaultPose: { scale: 120, rotationDeg: 0 },
  },

  // cm: square lattice, houndstooth (千鳥格子). Mirror across y=x (the group's `swap`
  // op under a square basis). fundamental region = right isosceles triangle.
  {
    id: 'cm-houndstooth',
    group: 'cm',
    label: 'Houndstooth -- right isosceles triangle fundamental region',
    basis: { a: { x: 1, y: 0 }, b: { x: 0, y: 1 } },
    regionXy: [vec2(0, 0), vec2(0, 1), vec2(1, 1)],
    motifId: 'motif-cm-houndstooth',
    defaultPose: { scale: 120, rotationDeg: 0 },
  },
];

// Coverage templates: one per group that has no bespoke design yet, displaying the
// chiral test glyph under the group's full symmetry. Each uses the standard asymmetric
// unit (regions.ts) mapped through the basis — the same region object the overlay and
// verification tests use. tile() (cosetReps × lattice, no clipping) renders the full
// orbit, so one cell shows point-group-order copies in their correct orientations.
const HEX120 = { a: { x: 1, y: 0 }, b: { x: -0.5, y: S3_2 } };
const SQUARE = { a: { x: 1, y: 0 }, b: { x: 0, y: 1 } };
const RHOMBIC = { a: { x: 1, y: 0.5 }, b: { x: 1, y: -0.5 } };

const coverageSpecs: { group: WallpaperGroup; basis: { a: Vec2; b: Vec2 } }[] = [
  { group: 'cmm', basis: RHOMBIC },
  { group: 'p4', basis: SQUARE },
  { group: 'p4m', basis: SQUARE },
  { group: 'p4g', basis: SQUARE },
  { group: 'p3', basis: HEX120 },
  { group: 'p3m1', basis: HEX120 },
  { group: 'p31m', basis: HEX120 },
  { group: 'p6', basis: HEX120 },
  { group: 'p6m', basis: HEX120 },
];

const coverageTemplates: UnitTemplate[] = coverageSpecs.map((spec) => ({
  id: `gen-${spec.group}`,
  group: spec.group,
  label: `Computer-generated · ${spec.group}`,
  basis: spec.basis,
  // Standard asymmetric unit (fractional uv) mapped into XY by the basis.
  regionXy: applyToPolygon(basisToMatrix(spec.basis), asymmetricUnitUv[spec.group]),
  motifId: 'motif-gen-glyph',
  // The test glyph spills past tight regions (e.g. p4g's {4,2,2} triangle); clip each
  // copy to its region so the overlap-driven flicker disappears and each region shows
  // exactly one glyph fragment in its correct orientation.
  motifLayer: 'clip',
  defaultPose: { scale: 120, rotationDeg: 0 },
}));

// Gallery: Persian / Chinese / porcelain geometric designs that FILL their fundamental
// region (motifs in galleryMotifs.ts). Each uses the standard asymmetric unit + canonical
// basis, so the symmetry/region tests pass by construction; the motif is free art inside
// the region. ids are `gen-`-prefixed (the completeness-pin exemption marks them as
// computer-generated) because they also serve as the fixtures the maximality test checks —
// the user sees `label`, not the id.
//   motifLayer 'clip' → each copy is trimmed to its region, so motif art may overhang.
const gallerySpecs: {
  id: string;
  group: WallpaperGroup;
  label: string;
  motifId: string;
  basis: { a: Vec2; b: Vec2 };
}[] = [
  { id: 'gen-p4m-girih', group: 'p4m', label: 'Girih star & cross', motifId: 'p4m-girih-star', basis: SQUARE },
  { id: 'gen-p4m-clover', group: 'p4m', label: 'Four-leaf clover', motifId: 'p4m-clover', basis: SQUARE },
  { id: 'gen-p4-cracked-ice', group: 'p4', label: 'Cracked-ice lattice', motifId: 'p4-cracked-ice', basis: SQUARE },
  { id: 'gen-p6m-shamsa', group: 'p6m', label: 'Shamsa rosette', motifId: 'p6m-shamsa', basis: HEX120 },
  { id: 'gen-pmm-leiwen', group: 'pmm', label: 'Cloud-meander key fret', motifId: 'pmm-leiwen', basis: SQUARE },
  { id: 'gen-p6-whirl', group: 'p6', label: 'Whirling-blade rosette', motifId: 'p6-whirl', basis: HEX120 },
  { id: 'gen-cmm-quatrefoil', group: 'cmm', label: 'Talavera quatrefoil interlace', motifId: 'cmm-quatrefoil', basis: RHOMBIC },
  { id: 'gen-p4g-pinwheel', group: 'p4g', label: 'Pinwheel pavement', motifId: 'p4g-pinwheel', basis: SQUARE },
  { id: 'gen-p3-trefoil', group: 'p3', label: 'Seljuk trefoil knot', motifId: 'p3-trefoil-knot', basis: HEX120 },
  { id: 'gen-p31m-medallion', group: 'p31m', label: 'Three-petal medallion', motifId: 'p31m-medallion', basis: HEX120 },
  // Second design per single-entry group, after the example plates of Wikipedia's
  // "Wallpaper group" article (see galleryMotifs.ts #10–#16). The two oblique bases
  // are deliberately generic (|a| ≠ |b|) so no reflection/rotation beyond the
  // declared group is even an isometry of the lattice.
  { id: 'gen-p1-fleur-diaper', group: 'p1', label: 'Fleur-de-lis diaper', motifId: 'p1-fleur-diaper', basis: FLEUR_BASIS },
  { id: 'gen-p2-tapa', group: 'p2', label: 'Tapa cloth zigzag', motifId: 'p2-tapa-zigzag', basis: TAPA_BASIS },
  { id: 'gen-pm-lotus', group: 'pm', label: 'Egyptian lotus columns', motifId: 'pm-lotus-columns', basis: SQUARE },
  { id: 'gen-pg-herringbone', group: 'pg', label: 'Herringbone parquet', motifId: 'pg-herringbone', basis: SQUARE },
  { id: 'gen-pmg-water-bands', group: 'pmg', label: 'Egyptian water bands', motifId: 'pmg-water-bands', basis: SQUARE },
  { id: 'gen-pgg-yagasuri', group: 'pgg', label: 'Yagasuri arrow feathers', motifId: 'pgg-yagasuri', basis: SQUARE },
  { id: 'gen-p3m1-glazed', group: 'p3m1', label: 'Persian glazed triangles', motifId: 'p3m1-glazed-rosette', basis: HEX120 },
];

const galleryTemplates: UnitTemplate[] = gallerySpecs.map((spec) => ({
  id: spec.id,
  group: spec.group,
  label: spec.label,
  basis: spec.basis,
  regionXy: applyToPolygon(basisToMatrix(spec.basis), asymmetricUnitUv[spec.group]),
  motifId: spec.motifId,
  motifLayer: 'clip',
  defaultPose: { scale: 120, rotationDeg: 0 },
}));

// DEV-ONLY warp probe (only under `next dev`, so Vitest/prod are unaffected): the chiral F
// (motif-dev-f) on a PURE-TRANSLATION lattice (group p1 → one glyph per cell, no reflection/
// rotation), so the warp E2E guards can tile it and read the full gallery→warp affine D + its
// chirality. Three lattices: rectangular control, oblique p1 70°, hex 60°.
// Defined INSIDE the dev-only branch (IIFE) so the whole block — glyph templates and the
// 'motif-dev-f' reference — is dead-code-eliminated from the production bundle, not merely
// left unspread. Verified absent from `.next` prod chunks (warp-affine-D / prod-grep).
const buildDevGlyphTemplates = (): UnitTemplate[] => {
  const C70 = Math.cos((70 * Math.PI) / 180);
  const S70 = Math.sin((70 * Math.PI) / 180);
  const lattices: { tag: string; suffix: string; basis: { a: Vec2; b: Vec2 } }[] = [
    { tag: 'rect', suffix: 'rect', basis: { a: { x: 1, y: 0 }, b: { x: 0, y: 1 } } },
    { tag: 'p1-70', suffix: 'p1 70', basis: { a: { x: 1, y: 0 }, b: { x: C70, y: S70 } } },
    { tag: 'hex-60', suffix: 'hex 60', basis: { a: { x: 1, y: 0 }, b: { x: 0.5, y: S3_2 } } },
  ];
  // The chiral F (direction/flip-axis probe) on the same three lattices — the fixture the warp
  // E2E guards (warp-affine-D, warp-flip-axis) tile and compare gallery↔warp. Dev-gated, so it
  // never appears in the production gallery.
  const glyphs: { idPrefix: string; labelPrefix: string; motifId: string }[] = [
    { idPrefix: 'dev-glyph-f', labelPrefix: 'DEV F', motifId: 'motif-dev-f' },
  ];
  return glyphs.flatMap((g) =>
    lattices.map((l) => ({
      id: `${g.idPrefix}-${l.tag}`,
      group: 'p1' as const,
      label: `${g.labelPrefix} ${l.suffix}`,
      basis: l.basis,
      regionXy: applyToPolygon(basisToMatrix(l.basis), asymmetricUnitUv.p1),
      motifId: g.motifId,
      defaultPose: { scale: 120, rotationDeg: 0 },
    })),
  );
};

export const unitTemplates: UnitTemplate[] = [
  ...designTemplates,
  ...coverageTemplates,
  ...galleryTemplates,
  // Appended LAST so unitTemplates[0] (the default selection) is unchanged.
  ...(process.env.NODE_ENV === 'development' ? buildDevGlyphTemplates() : []),
];
