import { WallpaperGroup } from '../WallpaperGroup';
import {
  Motif,
  RectanguleMotif,
  SquareMotif,
  Transformation,
  Vector2D,
} from '@/models';

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
}
