import { Circle, Rectangle, SquareMotif } from '@/models';

export const randomSquareMotif = new SquareMotif(1, [
  new Rectangle(0.1, 0.1, 0.3, 0.3, 'red'),
  new Rectangle(0.4, 0.5, 0.4, 0.4, 'green'),
  new Circle(0.6, 0.6, 0.2, 'blue'),
]);
