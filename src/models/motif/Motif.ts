import { Shape } from '../shapes/Shape';
import { Transformation } from '../Transformation';

export abstract class Motif {
  shapes: Shape[];
  constructor(shapes: Shape[]) {
    this.shapes = shapes;
  }
  // モチーフ全体に変換を適用し、新しいMotifを返す
  applyTransformation(transformation: Transformation): this {
    const transformedShapes = this.shapes.map((shape) =>
      shape.transform(transformation),
    );
    return new (this.constructor as new (shapes: Shape[]) => this)(
      transformedShapes,
    );
  }
}
