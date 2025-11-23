import { FundamentalRegion } from '@/lib/types';
import { WallpaperGroup } from '../WallpaperGroup';
import {
  Motif,
  RectanguleMotif,
  SquareMotif,
  Transformation,
  Vector2D,
} from '@/lib/models';

export class P1Group extends WallpaperGroup {
  constructor() {
    super('p1');
  }
  generateTransformations(): Transformation[] {
    return [];
  }
  computeTileVectors(
    motif: RectanguleMotif | SquareMotif,
  ): [Vector2D, Vector2D] {
    return motif.getIndependentVectors();
  }
  createFundamentalRegion(motif: Motif): FundamentalRegion {
    if (motif instanceof RectanguleMotif) {
      return {
        motifs: [motif],
        tileVectors: [
          new Vector2D(motif.width, 0),
          new Vector2D(0, motif.height),
        ],
        regionType: 'Rectangle',
      };
    } else if (motif instanceof SquareMotif) {
      return {
        motifs: [motif],
        tileVectors: [
          new Vector2D(motif.sideLength, 0),
          new Vector2D(0, motif.sideLength),
        ],
        regionType: 'Square',
      };
    } else {
      throw new Error(`Unknown motif: ${motif}`);
    }
  }
}
