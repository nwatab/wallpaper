import { Matrix } from '../Matrix';
import { Point } from '../Point';
import { Transformation } from '../Transformation';

export class Translation implements Transformation {
  private dx: number;
  private dy: number;
  constructor(dx: number, dy: number) {
    this.dx = dx;
    this.dy = dy;
  }
  getMatrix(): Matrix {
    return Matrix.translation(this.dx, this.dy);
  }
  applyToPoint(point: Point): Point {
    return new Point(point.x + this.dx, point.y + this.dy);
  }
}
