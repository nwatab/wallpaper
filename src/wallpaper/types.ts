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

  // How the motif layer composites this template's orbit copies:
  //   'clip'    → clip each copy to its fundamental region. For verification glyphs
  //               that must not spill past the region; prevents the spill-over copies
  //               of high-order groups (e.g. p4g) from overlapping and flickering.
  //   'overlap' → copies intentionally overlap (e.g. seigaiha); paint back-to-front
  //               by on-screen depth so symmetry-equivalent copies always stack alike.
  //   undefined → stamp in orbit order (design motifs already sized to their region).
  motifLayer?: 'clip' | 'overlap';

  defaultPose?: { scale: number; rotationDeg: number };
};

export type Pose = {
  // Similarity transform in xy (uniform scale + rotation + translation)
  scale: number;
  rotationDeg: number;
  translate?: Vec2;
};

export type DebugOptions = {
  // Pink: one representative fundamental region per lattice cell (the identity copy).
  showRegions: boolean;
  // Gray: the full fundamental-domain orbit (cosetReps × lattice) — the plane seen
  // partitioned into fundamental domains.
  showOrbit: boolean;
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
  // Geometry the motif-layer compositing strategies need (clip region / depth frame).
  basis: { a: Vec2; b: Vec2 };
  regionXy: Vec2[];
  // Compositing policy for the motif layer (see UnitTemplate.motifLayer).
  motifLayer?: 'clip' | 'overlap';
  // Intrinsic recede orientation for 'overlap' painter's depth (template.defaultPose.rotationDeg).
  // Pose-independent; shared with the seamless-cell baking so both stack copies identically.
  depthRotationDeg?: number;
};
