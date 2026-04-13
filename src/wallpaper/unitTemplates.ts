import { UnitTemplate, Vec2 } from './types';

const S3_2 = Math.sqrt(3) / 2; // sin(60°) = √3/2

const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export const unitTemplates: UnitTemplate[] = [
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
    opsInCellXy: [
      { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, // identity
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
    opsInCellXy: [
      { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, // identity
      // 180° rotation about cell center (a+b)/2 = (0.75, √3/4)
      { a: -1, b: 0, c: 0, d: -1, e: 1.5, f: S3_2 },
    ],
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
    opsInCellXy: [
      { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, // identity
      // reflection across x = 0.5: (x,y) -> (1-x, y)
      { a: -1, b: 0, c: 0, d: 1, e: 1, f: 0 },
    ],
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
    opsInCellXy: [
      { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, // identity
      // glide reflection: reflect across y = 0.5, translate by a/2
      // (x,y) -> (x + 0.5, 1 - y)
      { a: 1, b: 0, c: 0, d: -1, e: 0.5, f: 1 },
    ],
    motifId: 'motif-pg-arrow',
    defaultPose: { scale: 120, rotationDeg: 0 },
  },

  // cm: rhombic lattice, fundamental region = triangle, mirror across 60° axis
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
    opsInCellXy: [
      { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, // identity
      // reflection across line through origin at 60deg (direction of a+b)
      // R = [[cos120, sin120], [sin120, -cos120]] = [[-0.5, sqrt(3)/2], [sqrt(3)/2, 0.5]]
      { a: -0.5, b: S3_2, c: S3_2, d: 0.5, e: 0, f: 0 },
    ],
    motifId: 'motif-cm-seigaiha',
    defaultPose: { scale: 120, rotationDeg: 210 },
  },

  // pmm: rectangular lattice, fundamental region = quarter cell [0,0.5]x[0,0.5]
  // Point group D2: identity + reflect x=0.5 + reflect y=0.5 + 180° rotation about (0.5,0.5)
  {
    id: 'pmm-rectangular',
    group: 'pmm',
    label: 'Rectangular (pmm) -- two perpendicular mirrors',
    basis: { a: { x: 1, y: 0 }, b: { x: 0, y: 1 } },
    // quarter cell: top-left quadrant in SVG coords
    regionXy: [vec2(0, 0), vec2(0.5, 0), vec2(0.5, 0.5), vec2(0, 0.5)],
    opsInCellXy: [
      { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, // identity
      // reflection across x = 0.5: (x,y) → (1-x, y)
      { a: -1, b: 0, c: 0, d: 1, e: 1, f: 0 },
      // reflection across y = 0.5: (x,y) → (x, 1-y)
      { a: 1, b: 0, c: 0, d: -1, e: 0, f: 1 },
      // 180° rotation about (0.5, 0.5): (x,y) → (1-x, 1-y)
      { a: -1, b: 0, c: 0, d: -1, e: 1, f: 1 },
    ],
    motifId: 'motif-pmm-petal',
    defaultPose: { scale: 120, rotationDeg: 0 },
  },

  // pmg: rectangular lattice, fundamental region = quarter cell [0,0.5]x[0,0.5]
  // Point group D2: reflections in x only (vertical mirrors at x=0 and x=0.5),
  // glide reflections in y direction (horizontal glide axes at y=0 and y=0.5 with vector (0.5,0)),
  // and two 2-fold rotation centres on the glide axes.
  //
  // The four ops tile the unit cell as follows (F = fundamental region):
  //
  //   Op1 (identity)  |  Op2 (mirror x=0.5)      ⌐  |  ¬
  //   ─────────────────────────────────────     ──────────
  //   Op4 (rot 180°)  |  Op3 (glide)             ┐  |  ┌
  //
  // Op1 and Op2 are a mirror pair (vertical axis).
  // Op3 and Op4 are the glide-reflected row: horizontally offset by 0.5
  // relative to a pure horizontal reflection, so no horizontal mirror exists.
  {
    id: 'pmg-rectangular-vertical-mirrors',
    group: 'pmg',
    label: 'Rectangular (pmg) -- vertical mirrors, horizontal glides',
    basis: { a: { x: 1, y: 0 }, b: { x: 0, y: 1 } },
    // quarter cell: upper-left quadrant [0,0.5]x[0,0.5]
    regionXy: [vec2(0, 0), vec2(0.5, 0), vec2(0.5, 0.5), vec2(0, 0.5)],
    opsInCellXy: [
      { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, // identity
      // reflection across x=0.5: (x,y) → (1-x, y)
      { a: -1, b: 0, c: 0, d: 1, e: 1, f: 0 },
      // glide: reflect across y=0.5, translate x by +0.5: (x,y) → (x+0.5, 1-y)
      { a: 1, b: 0, c: 0, d: -1, e: 0.5, f: 1 },
      // 180° rotation about (0.25, 0.5): (x,y) → (0.5-x, 1-y)
      { a: -1, b: 0, c: 0, d: -1, e: 0.5, f: 1 },
    ],
    motifId: 'motif-pmg',
    defaultPose: { scale: 120, rotationDeg: 0 },
  },

  // pgg: rectangular lattice, fundamental region = right-angled isosceles triangle
  //
  // In y-up coords: apex (right angle) at (1/2,0), other vertices at (1,1/2) and (0,1/2).
  // In SVG (y-down):  apex at (1/2,1), vertices at (1,1/2) and (0,1/2).
  //
  // The four ops and where they place the triangle (SVG coords, clipped to [0,1]²):
  //
  //   Op1 identity          → centre-bottom diamond half  {(1/2,1),(1,1/2),(0,1/2)}
  //   Op2 horiz glide y=3/4 → bottom-right corner (cell 0,0) / bottom-left (cell -1,0)
  //   Op3 rot 180° (1/2,1/2)→ centre-top    diamond half  {(1/2,0),(0,1/2),(1,1/2)}
  //   Op4 vert glide x=1/4  → top-left corner (cell 0,0)   / top-right  (cell +1,0)
  //
  // Ops extend outside [0,1]²; clipToCells is required.
  {
    id: 'pgg-rectangular',
    group: 'pgg',
    label:
      'Rectangular (pgg) -- glide reflections in both directions, no mirrors',
    basis: { a: { x: 1, y: 0 }, b: { x: 0, y: 1 } },
    // right-angled isosceles triangle: right angle at (1/2,1) in SVG (= y_up apex (1/2,0))
    regionXy: [vec2(0.5, 1), vec2(1, 0.5), vec2(0, 0.5)],
    opsInCellXy: [
      { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, // identity
      // horizontal glide: reflect across y_svg=3/4 (y_up=1/4), translate x by +1/2
      // (x,y) → (x+1/2, 3/2-y)
      { a: 1, b: 0, c: 0, d: -1, e: 0.5, f: 1.5 },
      // 180° rotation about (1/2, 1/2): (x,y) → (1-x, 1-y)
      { a: -1, b: 0, c: 0, d: -1, e: 1, f: 1 },
      // vertical glide = rot ∘ horiz-glide: reflect across x=1/4, translate y by -1/2
      // (x,y) → (1/2-x, y-1/2)
      { a: -1, b: 0, c: 0, d: 1, e: 0.5, f: -0.5 },
    ],
    clipToCells: true,
    motifId: 'motif-pgg',
    defaultPose: { scale: 120, rotationDeg: 0 },
  },

  // cm: square lattice, houndstooth (千鳥格子)
  // fundamental region: right-angled isosceles triangle (0,0)-(0,1)-(1,1)
  // mirror across y=x: (x,y) → (y, x)  [= x+y=1 in y-up math coords]
  {
    id: 'cm-houndstooth',
    group: 'cm',
    label: 'Houndstooth (cm) -- right isosceles triangle fundamental region',
    basis: { a: { x: 1, y: 0 }, b: { x: 0, y: 1 } },
    regionXy: [vec2(0, 0), vec2(0, 1), vec2(1, 1)],
    opsInCellXy: [
      { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, // identity
      // reflection across y=x: (x,y) → (y, x)
      { a: 0, b: 1, c: 1, d: 0, e: 0, f: 0 },
    ],
    motifId: 'motif-cm-houndstooth',
    defaultPose: { scale: 120, rotationDeg: 0 },
  },
];
