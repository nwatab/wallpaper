import type {
  CompiledUnit,
  OrbitElement,
  Mat2D,
  Rect,
  Vec2,
  Pose,
} from '../types';
import {
  compose,
  identity,
  invert,
  rotateDeg,
  scaleUniform,
  translateUv,
  translateXy,
  applyToPoint,
} from '../affine';

// UVからワールド座標への変換行列を作成
const basisToUvToXy = (basis: CompiledUnit['basis']): Mat2D => ({
  a: basis.a.x,
  b: basis.a.y,
  c: basis.b.x,
  d: basis.b.y,
  e: 0,
  f: 0,
});

// ポーズ（スケール・回転・移動）を行列に変換
const poseToMatrix = (pose: Pose): Mat2D => {
  const t = pose.translate
    ? translateXy(pose.translate.x, pose.translate.y)
    : identity();
  return compose(
    t,
    compose(rotateDeg(pose.rotationDeg), scaleUniform(pose.scale)),
  );
};

// 矩形の四隅の座標を取得
const rectCorners = (r: Rect): Vec2[] => [
  { x: r.x, y: r.y },
  { x: r.x + r.width, y: r.y },
  { x: r.x + r.width, y: r.y + r.height },
  { x: r.x, y: r.y + r.height },
];

// ビューポートをUV座標系での境界に変換
const uvBoundsOfViewport = (
  worldToUv: Mat2D,
  viewport: Rect,
): { uMin: number; uMax: number; vMin: number; vMax: number } => {
  const corners = rectCorners(viewport).map((p) => applyToPoint(worldToUv, p));
  const us = corners.map((p) => p.x);
  const vs = corners.map((p) => p.y);
  return {
    uMin: Math.min(...us),
    uMax: Math.max(...us),
    vMin: Math.min(...vs),
    vMax: Math.max(...vs),
  };
};

export type BuildOrbitElementsOptions = {
  overscanCells?: number; // viewport外に余分に何セル敷くか
};

/**
 * Tiling層: 画面を覆うように並べる計算
 * CompiledUnitとviewport情報からOrbitElementsを生成する
 */
export function buildOrbitElements(args: {
  compiled: CompiledUnit;
  viewport: Rect;
  pose: Pose;
  options?: BuildOrbitElementsOptions;
}): { orbitElements: OrbitElement[]; uvToWorld: Mat2D } {
  const { compiled, viewport, pose } = args;
  const overscan = args.options?.overscanCells ?? 1;

  const uvToXy = basisToUvToXy(compiled.basis);
  const poseM = poseToMatrix(pose);

  // uv -> world (xy)
  const uvToWorld = compose(poseM, uvToXy);
  const worldToUv = invert(uvToWorld);

  // viewport を uv に写して、必要な (i,j) 範囲を見積もる
  const b = uvBoundsOfViewport(worldToUv, viewport);
  const iMin = Math.floor(b.uMin) - overscan;
  const iMax = Math.ceil(b.uMax) + overscan;
  const jMin = Math.floor(b.vMin) - overscan;
  const jMax = Math.ceil(b.vMax) + overscan;

  const orbitElements: OrbitElement[] = [];

  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      const tUv = translateUv(i, j); // (u,v)->(u+i,v+j)

      for (let opIndex = 0; opIndex < compiled.opsInCell.length; opIndex++) {
        const op = compiled.opsInCell[opIndex];

        // uv local -> uv in that cell: T(i,j) ∘ op
        const uvLocalToUv = compose(tUv, op);

        // uv local -> world
        const transform = compose(uvToWorld, uvLocalToUv);

        orbitElements.push({
          transform,
        });
      }
    }
  }

  return { orbitElements, uvToWorld };
}
