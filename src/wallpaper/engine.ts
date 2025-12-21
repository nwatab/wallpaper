import type {
  Affine2D,
  MotifInstance,
  Pose,
  Rect,
  UnitTemplate,
  UV,
  Vec2,
} from './types';
import {
  compose,
  identity,
  invert,
  rotateDeg,
  scaleUniform,
  translateUv,
  translateXy,
  applyToPoint,
} from './affine';

const basisToUvToXy = (basis: UnitTemplate['basis']): Affine2D => ({
  // x = ax*u + bx*v
  // y = ay*u + by*v
  a: basis.a.x,
  b: basis.a.y,
  c: basis.b.x,
  d: basis.b.y,
  e: 0,
  f: 0,
});

const poseToMatrix = (pose: Pose): Affine2D => {
  const t = pose.translate
    ? translateXy(pose.translate.x, pose.translate.y)
    : identity();
  // similarity: T ∘ R ∘ S
  return compose(
    t,
    compose(rotateDeg(pose.rotationDeg), scaleUniform(pose.scale)),
  );
};

const rectCorners = (r: Rect): Vec2[] => [
  { x: r.x, y: r.y },
  { x: r.x + r.width, y: r.y },
  { x: r.x + r.width, y: r.y + r.height },
  { x: r.x, y: r.y + r.height },
];

const uvBoundsOfViewport = (
  worldToUv: Affine2D,
  viewport: Rect,
): { uMin: number; uMax: number; vMin: number; vMax: number } => {
  const corners = rectCorners(viewport).map((p) => applyToPoint(worldToUv, p)); // treat as (x,y) -> (u,v) using Vec2
  // applyToPoint returns Vec2; interpret x->u, y->v here
  const us = corners.map((p) => p.x);
  const vs = corners.map((p) => p.y);
  return {
    uMin: Math.min(...us),
    uMax: Math.max(...us),
    vMin: Math.min(...vs),
    vMax: Math.max(...vs),
  };
};

export type GenerateOptions = {
  overscanCells?: number; // viewport外に余分に何セル敷くか
};

export const generateInstances = (args: {
  template: UnitTemplate;
  viewport: Rect;
  pose?: Partial<Pose>; // override
  options?: GenerateOptions;
}): { instances: MotifInstance[]; uvToWorld: Affine2D } => {
  const { template, viewport } = args;
  const overscan = args.options?.overscanCells ?? 1;

  const basePose: Pose = {
    scale: template.defaultPose?.scale ?? 120,
    rotationDeg: template.defaultPose?.rotationDeg ?? 0,
    translate: { x: 0, y: 0 },
    ...args.pose,
  };

  const uvToXy = basisToUvToXy(template.basis);
  const poseM = poseToMatrix(basePose);

  // uv -> world (xy)
  const uvToWorld = compose(poseM, uvToXy);
  const worldToUv = invert(uvToWorld);

  // viewport を uv に写して、必要な (i,j) 範囲を見積もる
  const b = uvBoundsOfViewport(worldToUv, viewport);
  const iMin = Math.floor(b.uMin) - overscan;
  const iMax = Math.ceil(b.uMax) + overscan;
  const jMin = Math.floor(b.vMin) - overscan;
  const jMax = Math.ceil(b.vMax) + overscan;

  const instances: MotifInstance[] = [];

  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      const tUv = translateUv(i, j); // (u,v)->(u+i,v+j)

      for (let opIndex = 0; opIndex < template.opsInCellUv.length; opIndex++) {
        const op = template.opsInCellUv[opIndex];

        // uv local -> uv in that cell: T(i,j) ∘ op
        const uvLocalToUv = compose(tUv, op);

        // uv local -> world
        const transform = compose(uvToWorld, uvLocalToUv);

        instances.push({
          transform,
          cell: { i, j },
          opIndex,
        });
      }
    }
  }

  return { instances, uvToWorld };
};

// デバッグ用：uv polygon（region/cell）を world polyline に変換
export const polygonUvToWorldPoints = (
  polygon: { u: number; v: number }[],
  uvToWorld: Affine2D,
): Vec2[] => polygon.map((p) => applyToPoint(uvToWorld, { x: p.u, y: p.v }));
