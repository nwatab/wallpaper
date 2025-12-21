// expandInCell.ts
import { Affine2D, PolygonUV } from '../types';

/**
 * Expand the fundamental region (minimum symmetry unit) within a unit cell
 * to construct bravais lattice unit.
 */
export type ExpandInCell = (args: {
  regionUv: PolygonUV;
  opsInCellUv: Affine2D[];
}) => PolygonUV[];
