import { Vector2D } from '@/models';

export class Tiling {
  constructor(private width: number, private height: number) {}
  generateWallpaperMotif(vectorA: Vector2D, vectorB: Vector2D): Vector2D[] {
    const vectors: Vector2D[] = [];
    const tileCountX = Math.ceil(
      this.width / Math.abs(vectorA.add(vectorB).projectToX()),
    );
    const tileCountY = Math.ceil(
      this.height / Math.abs(vectorA.add(vectorB).projectToY()),
    );
    for (let i = -1; i <= tileCountX; i++) {
      for (let j = -1; j <= tileCountY; j++) {
        const vec = vectorA.scale(i).add(vectorB.scale(j));
        vectors.push(vec);
      }
    }
    return vectors;
  }
}
