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

  // cm: square lattice, houndstooth (千鳥格子)
  // fundamental region: right-angled isosceles triangle (0,0)-(0,1)-(1,1)
  // mirror across y=x: (x,y) → (y, x)  [= x+y=1 in y-up math coords]
  {
    id: 'cm-houndstooth',
    group: 'cm',
    label: 'Houndstooth (千鳥格子)',
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
