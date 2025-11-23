import { Shape } from '../shapes';
import { Vector2D } from '../Vector2D';
import { Motif } from './Motif';

export class RectanguleMotif extends Motif {
  width: number;
  height: number;
  constructor(width: number, height: number, shapes: Shape[]) {
    super([]);
    this.width = width;
    this.height = height;
  }
  getIndependentVectors(): [Vector2D, Vector2D] {
    return [new Vector2D(this.width, 0), new Vector2D(0, this.height)];
  }
}
