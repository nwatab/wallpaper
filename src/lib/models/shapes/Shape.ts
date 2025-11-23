import { Matrix } from '../Matrix';
import { Transformation } from '../Transformation';

/** Basic shape class that is used inside a motif */
export abstract class Shape {
  public transformMatrix: Matrix;
  constructor(transformMatrix?: Matrix) {
    this.transformMatrix = transformMatrix ?? Matrix.identity();
  }
  transform(transformation: Transformation): this {
    const newMatrix = this.transformMatrix.multiply(transformation.getMatrix());
    const clonedShape = this.clone();
    clonedShape.transformMatrix = newMatrix;
    return clonedShape;
  }
  protected abstract clone(): this;
}
