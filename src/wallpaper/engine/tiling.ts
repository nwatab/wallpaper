import type {
  CompiledUnit,
  OrbitElement,
  Affine2D,
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
  translateXy,
  applyToPoint,
} from '../affine';

// Basis vectors → matrix that maps lattice coords (i,j) to XY
const basisToMatrix = (basis: { a: Vec2; b: Vec2 }): Affine2D => ({
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

// Project viewport into lattice coordinates to find required (i,j) range
const cellBoundsOfViewport = (
  worldToCell: Affine2D,
  viewport: Rect,
): { iMin: number; iMax: number; jMin: number; jMax: number } => {
  const corners = rectCorners(viewport).map((p) =>
    applyToPoint(worldToCell, p),
  );
  const is = corners.map((p) => p.x);
  const js = corners.map((p) => p.y);
  return {
    iMin: Math.min(...is),
    iMax: Math.max(...is),
    jMin: Math.min(...js),
    jMax: Math.max(...js),
  };
};

export type BuildOrbitElementsOptions = {
  overscanCells?: number;
};

/**
 * Tiling: cover the viewport with orbit elements.
 * For each lattice cell (i,j) and each point group op g_k:
 *   transform = pose ∘ translate(i·a + j·b) ∘ g_k
 */
export function buildOrbitElements(args: {
  compiled: CompiledUnit;
  viewport: Rect;
  pose: Pose;
  options?: BuildOrbitElementsOptions;
}): {
  orbitElements: OrbitElement[];
  cellToWorld: Affine2D;
  poseMatrix: Affine2D;
  tilePositions: { i: number; j: number }[];
} {
  const { compiled, viewport, pose } = args;
  const overscan = args.options?.overscanCells ?? 1;
  const { basis, opsInCellXy } = compiled;

  // Lattice coords → world: pose ∘ basisMatrix
  const basisMatrix = basisToMatrix(basis);
  const poseM = poseToMatrix(pose);
  const cellToWorld = compose(poseM, basisMatrix);
  const worldToCell = invert(cellToWorld);

  // Find (i,j) range that covers the viewport
  const bounds = cellBoundsOfViewport(worldToCell, viewport);
  const iMin = Math.floor(bounds.iMin) - overscan;
  const iMax = Math.ceil(bounds.iMax) + overscan;
  const jMin = Math.floor(bounds.jMin) - overscan;
  const jMax = Math.ceil(bounds.jMax) + overscan;

  const orbitElements: OrbitElement[] = [];
  const tilePositions: { i: number; j: number }[] = [];

  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      tilePositions.push({ i, j });

      // Lattice translation: i·a + j·b in XY
      const tx = i * basis.a.x + j * basis.b.x;
      const ty = i * basis.a.y + j * basis.b.y;
      const latticeT = translateXy(tx, ty);

      for (const op of opsInCellXy) {
        // transform = pose ∘ latticeTranslation ∘ symmetryOp ∘ basis
        // basisMatrix maps motif UV coords → XY before ops are applied
        const transform = compose(poseM, compose(latticeT, compose(op, basisMatrix)));
        orbitElements.push({ transform });
      }
    }
  }

  return { orbitElements, cellToWorld, poseMatrix: poseM, tilePositions };
}
