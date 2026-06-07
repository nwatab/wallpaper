import { UnitTemplate, Vec2, WallpaperGroup } from './types';
import { basisToMatrix, applyToPolygon } from './affine';
import { asymmetricUnitUv } from './regions';

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
    label: 'Seigaiha (cm) -- equilateral triangle fundamental region',
    basis: {
      a: { x: 1, y: 0 },
      b: { x: -0.5, y: S3_2 },
    },
    // equilateral triangle: origin, a=(1,0), a+b=(0.5, sqrt(3)/2)
    regionXy: [vec2(0, 0), vec2(1, 0), vec2(0.5, S3_2)],
    motifId: 'motif-cm-seigaiha',
    defaultPose: { scale: 120, rotationDeg: 210 },
  },

  // pmm: rectangular lattice, fundamental region = quarter cell [0,0.5]x[0,0.5]
  {
    id: 'pmm-rectangular',
    group: 'pmm',
    label: 'Rectangular (pmm) -- two perpendicular mirrors',
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
    label: 'Rectangular (pmg) -- vertical mirrors, horizontal glides',
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
      'Rectangular (pgg) -- glide reflections in both directions, no mirrors',
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
    label: 'Houndstooth (cm) -- right isosceles triangle fundamental region',
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
  id: `test-${spec.group}`,
  group: spec.group,
  label: `TEST · ${spec.group}`,
  basis: spec.basis,
  // Standard asymmetric unit (fractional uv) mapped into XY by the basis.
  regionXy: applyToPolygon(basisToMatrix(spec.basis), asymmetricUnitUv[spec.group]),
  motifId: 'motif-test-glyph',
  defaultPose: { scale: 120, rotationDeg: 0 },
}));

export const unitTemplates: UnitTemplate[] = [
  ...designTemplates,
  ...coverageTemplates,
];
