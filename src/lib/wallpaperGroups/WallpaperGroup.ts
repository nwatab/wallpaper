import { Transformation, Motif, Shape, Vector2D } from '@/lib/models';
import { FundamentalRegion, WallpaperGroupType } from '@/lib/types';

export abstract class WallpaperGroup {
  constructor(public groupType: WallpaperGroupType) {}
  public tileVectors!: [Vector2D, Vector2D];

  abstract generateTransformations(): Transformation[];
  abstract computeTileVectors(motif: Motif): [Vector2D, Vector2D];
  abstract createFundamentalRegion(motif: Motif): FundamentalRegion;
  //  {
  //   const transformations = this.generateTransformations();
  //   let fundamentalShapes: Shape[] = [];
  //   transformations.forEach((transformation) => {
  //     const transformedMotif = motif.applyTransformation(transformation);
  //     fundamentalShapes = fundamentalShapes.concat(transformedMotif.shapes);
  //   });
  //   return new Motif(fundamentalShapes);
  // }
}
