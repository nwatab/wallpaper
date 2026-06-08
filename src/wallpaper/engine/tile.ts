import type {
  Rect,
  Pose,
  UnitTemplate,
  OrbitElement,
  Affine2D,
  Vec2,
} from '../types';
import { compileUnit } from './compile';
import { buildOrbitElements } from './tiling';

// Overscan must be large enough that copies thrown outside their stamp cell by
// origin-based ops (rotations/glides about a corner) still cover the viewport.
export const TILE_OVERSCAN = 2;

export type TileResult = {
  orbitElements: OrbitElement[];
  poseMatrix: Affine2D;
  cellToWorld: Affine2D;
  tilePositions: { i: number; j: number }[];
  regionXy: Vec2[];
  // Point-group ops in XY (the verified cosetReps). The overlay applies these to
  // regionXy to draw the fundamental-domain orbit through the same path as the motif.
  opsInCellXy: Affine2D[];
  basis: { a: Vec2; b: Vec2 };
};

/**
 * THE single source of truth for the group action: instances = cosetReps × lattice.
 * Both the renderer and the symmetry tests call this so the rendered pattern and the
 * verified pattern can never diverge. No per-cell clipping — every copy is emitted at
 * its true position and the lattice overscan guarantees coverage.
 */
export const tile = (args: {
  template: UnitTemplate;
  viewport: Rect;
  pose: Pose;
}): TileResult => {
  const compiled = compileUnit(args.template);
  const { orbitElements, cellToWorld, poseMatrix, tilePositions } =
    buildOrbitElements({
      compiled,
      viewport: args.viewport,
      pose: args.pose,
      options: { overscanCells: TILE_OVERSCAN },
    });
  return {
    orbitElements,
    poseMatrix,
    cellToWorld,
    tilePositions,
    regionXy: compiled.regionXy,
    opsInCellXy: compiled.opsInCellXy,
    basis: compiled.basis,
  };
};
