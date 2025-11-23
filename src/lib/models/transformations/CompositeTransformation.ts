import { Transformation } from '../Transformation';
import { Matrix } from '../Matrix';
import { Point } from '../Point';

export class CompositeTransformation implements Transformation {
  private transformations: Transformation[];

  constructor(transformations: Transformation[]) {
    this.transformations = transformations;
  }

  applyToPoint(point: Point): Point {
    return this.transformations.reduce((p, transformation) => {
      return transformation.applyToPoint(p);
    }, point);
  }

  getMatrix(): Matrix {
    // 逆順に行列を合成する（最初の変換が右側に来る）
    return this.transformations
      .map((t) => t.getMatrix())
      .reduceRight(
        (accMatrix, matrix) => accMatrix.multiply(matrix),
        Matrix.identity(),
      );
  }
}
