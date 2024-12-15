import { Transformation } from '../Transformation';
import { CompositeTransformation } from './CompositeTransformation';

export function composeTransformations(
  transformations: Transformation[],
): Transformation {
  return new CompositeTransformation(transformations);
}
