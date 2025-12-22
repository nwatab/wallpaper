import { UnitTemplate } from './types';

export const unitTemplates: UnitTemplate[] = [
  // p1: 一般平行四辺形（例として1つ）
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
    regionUv: [
      { u: 0, v: 0 },
      { u: 1, v: 0 },
      { u: 1, v: 1 },
      { u: 0, v: 1 },
    ],
    opsInCellUv: [
      { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, // identity
    ],
    motifId: 'motif-a',
    defaultPose: { scale: 120, rotationDeg: 0 },
  },

  // p2: hexagonal の unit cell（60°菱形）を2つの正三角形に分ける例
  {
    id: 'p2-hex-equilateral-triangle',
    group: 'p2',
    label: 'Equilateral triangle on hex lattice',
    basis: { a: { x: 1, y: 0 }, b: { x: 0.5, y: Math.sqrt(3) / 2 } },
    regionUv: [
      { u: 0, v: 0 },
      { u: 1, v: 0 },
      { u: 0, v: 1 },
    ],
    opsInCellUv: [
      { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, // identity
      // 180°回転（セル中心まわり）をuvで表す： (u,v)->(1-u,1-v)
      { a: -1, b: 0, c: 0, d: -1, e: 1, f: 1 },
    ],
    motifId: 'motif-b',
    defaultPose: { scale: 120, rotationDeg: 0 },
  },

  // pm: rectangular lattice with parallel mirror lines
  {
    id: 'pm-rectangular-vertical-mirrors',
    group: 'pm',
    label: 'Rectangular with vertical mirrors',
    basis: { a: { x: 1, y: 0 }, b: { x: 0, y: 1 } }, // rectangular lattice
    regionUv: [
      { u: 0, v: 0 },
      { u: 0.5, v: 0 }, // fundamental region is half the unit cell
      { u: 0.5, v: 1 },
      { u: 0, v: 1 },
    ],
    opsInCellUv: [
      { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, // identity
      // vertical reflection across u = 0.5: (u,v) -> (1-u,v)
      { a: -1, b: 0, c: 0, d: 1, e: 1, f: 0 },
    ],
    motifId: 'motif-pm-leaf',
    defaultPose: { scale: 120, rotationDeg: 0 },
  },

  // pg: rectangular lattice with parallel glide reflections
  {
    id: 'pg-rectangular-horizontal-glides',
    group: 'pg',
    label: 'Rectangular with horizontal glide reflections',
    basis: { a: { x: 1, y: 0 }, b: { x: 0, y: 1 } }, // rectangular lattice
    regionUv: [
      { u: 0, v: 0 },
      { u: 1, v: 0 },
      { u: 1, v: 0.5 }, // fundamental region is half the unit cell (horizontal)
      { u: 0, v: 0.5 },
    ],
    opsInCellUv: [
      { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, // identity
      // glide reflection: reflect across v = 0.5 and translate by (0.5, 0)
      // (u,v) -> (u + 0.5, 1 - v)
      { a: 1, b: 0, c: 0, d: -1, e: 0.5, f: 1 },
    ],
    motifId: 'motif-pg-arrow',
    defaultPose: { scale: 120, rotationDeg: 0 },
  },
];
