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
export type UV = { u: number; v: number };
export type PolygonUV = UV[];

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

  // unit cell basis (xy space)
  basis: { a: Vec2; b: Vec2 };

  // fundamental region in uv space
  regionUv: PolygonUV;

  // ops that map region -> other copies inside a single cell (uv space)
  opsInCellUv: Affine2D[];

  // pre-baked motif drawn in uv space of the fundamental region
  motifId: string;

  defaultPose?: { scale: number; rotationDeg: number };
};

export type Pose = {
  // Similarity transform in xy (uniform scale + rotation + translation)
  scale: number;
  rotationDeg: number;
  translate?: Vec2;
};

// 3層アーキテクチャ用の型定義
export type Mat2D = Affine2D; // エイリアス（既存のAffine2Dと同じ）

export type CompiledUnit = {
  basis: { a: Vec2; b: Vec2 };
  opsInCell: Mat2D[];
  regionUv?: PolygonUV; // デバッグ用（optional）
};

export type OrbitElement = {
  transform: Mat2D;
};

export type Scene = {
  viewBox: { x: number; y: number; w: number; h: number };
  orbitElements: OrbitElement[];
  motifSvg: string;
};
