import { Shape } from '../shapes';
import { Vector2D } from '../Vector2D';
import { Motif } from './Motif';

/** Square with viewbox [0, 1] x [0, 1] */
export class SquareMotif extends Motif {
  sideLength: number;
  constructor(sideLength: number, shapes: Shape[]) {
    super(shapes);
    this.sideLength = sideLength;
  }
  getIndependentVectors(): [Vector2D, Vector2D] {
    return [new Vector2D(this.sideLength, 0), new Vector2D(0, this.sideLength)];
  }
}
