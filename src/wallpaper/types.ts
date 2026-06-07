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

// A wallpaper group as swappable data: the coset representatives of the translation
// lattice (= point group elements), expressed in the unit cell's fractional
// (lattice-basis) coordinates. Conjugating these by a template's basis yields the
// XY ops the engine applies. See src/wallpaper/groups.ts.
export type WallpaperGroupDef = {
  name: WallpaperGroup;
  cosetReps: Affine2D[];
};

export type UnitTemplate = {
  id: string;
  // Key into the group registry (groups.ts). Supplies the symmetry ops.
  group: WallpaperGroup;
  label: string;

  // unit cell basis vectors (XY space)
  basis: { a: Vec2; b: Vec2 };

  // fundamental region vertices (XY space)
  regionXy: Vec2[];

  // motif SVG fragment drawn in the fundamental region's uv (fractional) space
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
  cellPos: { i: number; j: number };
};

export type Scene = {
  viewBox: { x: number; y: number; w: number; h: number };
  orbitElements: OrbitElement[];
  motifSvg: string;
};
