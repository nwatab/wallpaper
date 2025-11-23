import { Point } from '@/lib/types';
import { Matrix } from './Matrix';
export interface Transformation {
  applyToPoint(point: Point): Point;
  getMatrix(): Matrix;
}
