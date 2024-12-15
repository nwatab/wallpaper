import { Matrix } from '../Matrix';
import { Shape } from './Shape';

import { Transformation } from '../Transformation';
export class Rectangle extends Shape {
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public fill: string,
    public transformMatrix: Matrix = Matrix.identity(),
  ) {
    super();
  }
  transform(transformation: Transformation): this {
    // 既存のtransformMatrixに新しい変換を合成する
    const newMatrix = transformation.getMatrix().multiply(this.transformMatrix);
    return new Rectangle(
      this.x,
      this.y,
      this.width,
      this.height,
      this.fill,
      newMatrix,
    ) as this;
  }
  clone(): this {
    return new Rectangle(
      this.x,
      this.y,
      this.width,
      this.height,
      this.fill,
      this.transformMatrix,
    ) as this;
  }
}
