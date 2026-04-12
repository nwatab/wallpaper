export type WallpaperGroup =
  | 'p1'
  | 'p2'
  | 'pm'
  | 'pg'
  | 'cm'
  | 'pmm'
  | 'pmg'
  | 'pgg'
  | 'cmm'
  | 'p4'
  | 'p4m'
  | 'p4g'
  | 'p3'
  | 'p3m1'
  | 'p31m'
  | 'p6'
  | 'p6m';

export type Vec2 = { x: number; y: number };

export type Rect = { x: number; y: number; width: number; height: number };

// SVG matrix(a b c d e f)
export type Affine2D = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

export type UnitTemplate = {
  id: string;
  group: WallpaperGroup;
  label: string;

  // unit cell basis vectors (XY space)
  basis: { a: Vec2; b: Vec2 };

  // fundamental region vertices (XY space)
  regionXy: Vec2[];

  // point group ops mapping the fundamental region within one unit cell (XY space)
  opsInCellXy: Affine2D[];

  // motif SVG fragment drawn in the fundamental region's XY space
  motifId: string;

  defaultPose?: { scale: number; rotationDeg: number };
};

export type Pose = {
  // Similarity transform in xy (uniform scale + rotation + translation)
  scale: number;
  rotationDeg: number;
  translate?: Vec2;
};

export type DebugOptions = {
  showRegions: boolean;
  showBravaisLattice: boolean;
};

export type Mat2D = Affine2D;

export type CompiledUnit = {
  basis: { a: Vec2; b: Vec2 };
  opsInCellXy: Mat2D[];
  regionXy: Vec2[];
};

export type OrbitElement = {
  transform: Mat2D;
};

export type Scene = {
  viewBox: { x: number; y: number; w: number; h: number };
  orbitElements: OrbitElement[];
  motifSvg: string;
};
