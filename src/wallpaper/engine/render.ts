import type { Scene, Affine2D, Vec2, DebugOptions } from '../types';
import { toSvgMatrix, applyToPoint, compose, translateXy } from '../affine';

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
  opsInCellXy?: Affine2D[];
  basis: { a: Vec2; b: Vec2 };
  poseMatrix: Affine2D;
  tilePositions?: { i: number; j: number }[];
  debugOptions: DebugOptions;
}): string[] {
  const { regionXy, opsInCellXy, basis, poseMatrix, tilePositions, debugOptions } =
    args;
  const debugPaths: string[] = [];

  const tiles = tilePositions ?? [{ i: 0, j: 0 }];

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
        `<path d="${pointsToPathD(cellWorld)}" fill="none" stroke="navy" stroke-width="4" />`,
      );
    }
  }

  // Fundamental-region overlays. Both stamp the region through the same transform
  // path as the motif, minus the UV→XY basis adapter since regionXy is already in XY.
  //   showOrbit  → faint gray: the full orbit (cosetReps × lattice) partitioning the plane.
  //   showRegions → pink: one representative region per cell (the identity copy).
  // Gray is drawn first so pink sits on top.
  if ((debugOptions.showOrbit || debugOptions.showRegions) && regionXy) {
    const latticeTs = tiles.map(({ i, j }) =>
      translateXy(
        i * basis.a.x + j * basis.b.x,
        i * basis.a.y + j * basis.b.y,
      ),
    );

    if (debugOptions.showOrbit && opsInCellXy) {
      for (const latticeT of latticeTs) {
        for (const op of opsInCellXy) {
          // world = pose ∘ latticeTranslation ∘ symmetryOp  (regionXy is XY)
          const m = compose(poseMatrix, compose(latticeT, op));
          const regionWorld = regionXy.map((p) => applyToPoint(m, p));
          debugPaths.push(
            `<path d="${pointsToPathD(regionWorld)}" fill="none" stroke="gray" stroke-width="0.5" stroke-opacity="0.4" />`,
          );
        }
      }
    }

    if (debugOptions.showRegions) {
      for (const latticeT of latticeTs) {
        const m = compose(poseMatrix, latticeT);
        const regionWorld = regionXy.map((p) => applyToPoint(m, p));
        debugPaths.push(
          `<path d="${pointsToPathD(regionWorld)}" fill="none" stroke="magenta" stroke-width="1" />`,
        );
      }
    }
  }

  return debugPaths;
}

/**
 * Render a Scene to an SVG string.
 */
export function renderSvg(
  scene: Scene,
  debugOptions?: DebugOptions,
  debugData?: {
    regionXy?: Vec2[];
    opsInCellXy?: Affine2D[];
    basis: { a: Vec2; b: Vec2 };
    poseMatrix: Affine2D;
    tilePositions?: { i: number; j: number }[];
  },
): string {
  const { viewBox, orbitElements, motifSvg } = scene;
  const hasOverlay = (o: DebugOptions): boolean =>
    o.showRegions || o.showOrbit || o.showBravaisLattice;

  // Every orbit element is stamped at its true position (cosetReps × lattice). No
  // per-cell clipping — clipping would erase copies that origin-based ops place
  // outside their stamp cell, collapsing rotation groups to a p1-looking pattern.
  const groups = orbitElements
    .map((inst) => `<g transform="${toSvgMatrix(inst.transform)}">${motifSvg}</g>`)
    .join('\n');

  let debugPaths: string[] = [];
  if (debugOptions && debugData && hasOverlay(debugOptions)) {
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
      ${debugOptions && hasOverlay(debugOptions) ? debugPaths.join('\n') : ''}
    </svg>
  `.trim();

  return svg;
}
