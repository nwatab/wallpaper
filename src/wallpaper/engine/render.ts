import type { Scene, Mat2D, PolygonUV, Vec2 } from '../types';
import { toSvgMatrix, applyToPoint } from '../affine';

/**
 * ポイント配列をSVGのpath要素のd属性用の文字列に変換
 */
const pointsToPathD = (pts: Vec2[]): string => {
  if (pts.length === 0) return '';
  const [p0, ...rest] = pts;
  return (
    `M ${p0.x} ${p0.y} ` + rest.map((p) => `L ${p.x} ${p.y}`).join(' ') + ' Z'
  );
};

/**
 * UV座標のポリゴンをワールド座標のポイント配列に変換
 */
export const polygonUvToWorldPoints = (
  polygon: PolygonUV,
  uvToWorld: Mat2D,
): Vec2[] => polygon.map((p) => applyToPoint(uvToWorld, { x: p.u, y: p.v }));

/**
 * デバッグ用のパスを生成
 */
export function createDebugPaths(args: {
  regionUv?: PolygonUV;
  uvToWorld: Mat2D;
  tilePositions?: { i: number; j: number }[];
  debugOptions: { showRegions: boolean; showBravaisLattice: boolean };
}): string[] {
  const { regionUv, uvToWorld, tilePositions, debugOptions } = args;
  const debugPaths: string[] = [];

  if (debugOptions.showRegions && regionUv) {
    if (tilePositions && tilePositions.length > 0) {
      // fundamental region boundaries for all tiles
      for (const { i, j } of tilePositions) {
        // 各タイルのfundamental regionを描画（regionUvを各タイル位置に変換）
        const regionInTile: PolygonUV = regionUv.map((p) => ({
          u: p.u + i,
          v: p.v + j,
        }));
        const regionWorld = polygonUvToWorldPoints(regionInTile, uvToWorld);
        debugPaths.push(
          `<path d="${pointsToPathD(
            regionWorld,
          )}" fill="none" stroke="magenta" stroke-width="2" />`,
        );
      }
    } else {
      // fallback: fundamental region boundary (origin cell only)
      const regionWorld = polygonUvToWorldPoints(regionUv, uvToWorld);
      debugPaths.push(
        `<path d="${pointsToPathD(
          regionWorld,
        )}" fill="none" stroke="magenta" stroke-width="2" />`,
      );
    }
  }

  // unit cell boundaries for all tiles
  if (debugOptions.showBravaisLattice) {
    if (tilePositions && tilePositions.length > 0) {
      // すべてのタイル位置にunit cellの境界線を描画
      for (const { i, j } of tilePositions) {
        const cellUv: PolygonUV = [
          { u: i, v: j },
          { u: i + 1, v: j },
          { u: i + 1, v: j + 1 },
          { u: i, v: j + 1 },
        ];
        const cellWorld = polygonUvToWorldPoints(cellUv, uvToWorld);
        debugPaths.push(
          `<path d="${pointsToPathD(
            cellWorld,
          )}" fill="none" stroke="navy" stroke-width="1" />`,
        );
      }
    } else {
      // fallback: origin cell only
      const cellUv: PolygonUV = [
        { u: 0, v: 0 },
        { u: 1, v: 0 },
        { u: 1, v: 1 },
        { u: 0, v: 1 },
      ];
      const cellWorld = polygonUvToWorldPoints(cellUv, uvToWorld);
      debugPaths.push(
        `<path d="${pointsToPathD(
          cellWorld,
        )}" fill="none" stroke="navy" stroke-width="1" />`,
      );
    }
  }
  return debugPaths;
}

/**
 * Render層: バックエンド依存の描画
 * SceneからSVG文字列を生成する（SVGの都合のみを担当）
 */
export function renderSvg(
  scene: Scene,
  debugOptions?: { showRegions: boolean; showBravaisLattice: boolean },
  debugData?: {
    regionUv?: PolygonUV;
    uvToWorld: Mat2D;
    tilePositions?: { i: number; j: number }[];
  },
): string {
  const { viewBox, orbitElements, motifSvg } = scene;

  // インスタンスをSVGグループに変換
  const groups = orbitElements
    .map(
      (inst) => `<g transform="${toSvgMatrix(inst.transform)}">${motifSvg}</g>`,
    )
    .join('\n');

  // デバッグパスの生成
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
