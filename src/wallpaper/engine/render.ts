import type { Scene, Affine2D, Vec2 } from '../types';
import { toSvgMatrix, applyToPoint } from '../affine';

const pointsToPathD = (pts: Vec2[]): string => {
  if (pts.length === 0) return '';
  const [p0, ...rest] = pts;
  return (
    `M ${p0.x} ${p0.y} ` + rest.map((p) => `L ${p.x} ${p.y}`).join(' ') + ' Z'
  );
};

/**
 * Generate debug overlay paths for fundamental regions and unit cells.
 */
export function createDebugPaths(args: {
  regionXy?: Vec2[];
  basis: { a: Vec2; b: Vec2 };
  poseMatrix: Affine2D;
  tilePositions?: { i: number; j: number }[];
  debugOptions: { showRegions: boolean; showBravaisLattice: boolean };
}): string[] {
  const { regionXy, basis, poseMatrix, tilePositions, debugOptions } = args;
  const debugPaths: string[] = [];

  const tiles = tilePositions ?? [{ i: 0, j: 0 }];

  if (debugOptions.showRegions && regionXy) {
    for (const { i, j } of tiles) {
      // Translate region by lattice vector i·a + j·b, then apply pose
      const dx = i * basis.a.x + j * basis.b.x;
      const dy = i * basis.a.y + j * basis.b.y;
      const regionWorld = regionXy.map((p) =>
        applyToPoint(poseMatrix, { x: p.x + dx, y: p.y + dy }),
      );
      debugPaths.push(
        `<path d="${pointsToPathD(regionWorld)}" fill="none" stroke="magenta" stroke-width="2" />`,
      );
    }
  }

  if (debugOptions.showBravaisLattice) {
    const { a, b: bv } = basis;
    for (const { i, j } of tiles) {
      // Unit cell parallelogram corners at lattice position (i,j)
      const corners = [
        { x: i * a.x + j * bv.x, y: i * a.y + j * bv.y },
        { x: (i + 1) * a.x + j * bv.x, y: (i + 1) * a.y + j * bv.y },
        {
          x: (i + 1) * a.x + (j + 1) * bv.x,
          y: (i + 1) * a.y + (j + 1) * bv.y,
        },
        { x: i * a.x + (j + 1) * bv.x, y: i * a.y + (j + 1) * bv.y },
      ];
      const cellWorld = corners.map((p) => applyToPoint(poseMatrix, p));
      debugPaths.push(
        `<path d="${pointsToPathD(cellWorld)}" fill="none" stroke="navy" stroke-width="1" />`,
      );
    }
  }

  return debugPaths;
}

/**
 * Render a Scene to an SVG string.
 */
export function renderSvg(
  scene: Scene,
  debugOptions?: { showRegions: boolean; showBravaisLattice: boolean },
  debugData?: {
    regionXy?: Vec2[];
    basis: { a: Vec2; b: Vec2 };
    poseMatrix: Affine2D;
    tilePositions?: { i: number; j: number }[];
  },
): string {
  const { viewBox, orbitElements, motifSvg } = scene;

  const groups = orbitElements
    .map(
      (inst) => `<g transform="${toSvgMatrix(inst.transform)}">${motifSvg}</g>`,
    )
    .join('\n');

  let debugPaths: string[] = [];
  if (
    debugOptions &&
    debugData &&
    (debugOptions.showRegions || debugOptions.showBravaisLattice)
  ) {
    debugPaths = createDebugPaths({ ...debugData, debugOptions });
  }

  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}"
      width="${viewBox.w}"
      height="${viewBox.h}"
    >
      ${groups}
      ${
        debugOptions &&
        (debugOptions.showRegions || debugOptions.showBravaisLattice)
          ? debugPaths.join('\n')
          : ''
      }
    </svg>
  `.trim();

  return svg;
}
