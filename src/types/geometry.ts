export type Point = {
  x: number;
  y: number;
};

export type MotifType =
  | 'Parallelogram'
  | 'Rectangle'
  | 'Square'
  | 'IsoscelesTriangle' // 二等辺三角形
  | 'EquilateralTriangle' // 正三角形
  | '1/2Rectangle'; // 辺の比が1:2の長方形
