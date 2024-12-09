import { Point } from '@/types';

export abstract class BaseShape {
  protected points: Point[];
  constructor(points: Point[]) {
    this.points = points;
    this.validate();
  }

  getPoints(): Point[] {
    return this.points;
  }

  protected abstract validate(): void;
  abstract draw(): void;
}

class Rectangle extends BaseShape {
  private width: number;
  private height: number;
  constructor(topLeft: Point, width: number, height: number) {
    super([
      topLeft,
      { x: topLeft.x, y: topLeft.y + height },
      { x: topLeft.x + width, y: topLeft.y },
      { x: topLeft.x + width, y: topLeft.y + height },
    ]);
    this.width = width;
    this.height = height;
  }
  validate(): void {
    if (this.points.length !== 4) {
      throw new Error('Rectangle must have 4 points');
    }
  }
  draw(): void {
    console.log('Drawing rectangle');
  }
}
