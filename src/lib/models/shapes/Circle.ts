import { Matrix } from '../Matrix';
import { Shape } from './Shape';

export class Circle extends Shape {
  constructor(
    public cx: number,
    public cy: number,
    public r: number,
    public fill: string,
    transformMatrix?: Matrix,
  ) {
    super(transformMatrix);
  }
  protected clone(): this {
    return new Circle(
      this.cx,
      this.cy,
      this.r,
      this.fill,
      this.transformMatrix,
    ) as this;
  }
  // その他のプロパティやメソッド
}
