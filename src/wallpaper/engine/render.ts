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
  uvToWorld: Mat2D
): Vec2[] => polygon.map((p) => applyToPoint(uvToWorld, { x: p.u, y: p.v }));

/**
 * デバッグ用のパスを生成
 */
export function createDebugPaths(args: {
  regionUv?: PolygonUV;
  uvToWorld: Mat2D;
}): string[] {
  const { regionUv, uvToWorld } = args;
  const debugPaths: string[] = [];

  if (regionUv) {
    // fundamental region boundary (origin cell only)
    const regionWorld = polygonUvToWorldPoints(regionUv, uvToWorld);
    debugPaths.push(
      `<path d="${pointsToPathD(
        regionWorld,
      )}" fill="none" stroke="magenta" stroke-width="2" />`
    );
  }

  // unit cell boundary (origin cell only)
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
    )}" fill="none" stroke="navy" stroke-width="1" />`
  );

  return debugPaths;
}

/**
 * Render層: バックエンド依存の描画
 * SceneからSVG文字列を生成する（SVGの都合のみを担当）
 */
export function renderSvg(scene: Scene, debug?: boolean, debugData?: {
  regionUv?: PolygonUV;
  uvToWorld: Mat2D;
}): string {
  const { viewBox, instances, motifSvg } = scene;

  // インスタンスをSVGグループに変換
  const groups = instances
    .map((inst) => `<g transform="${toSvgMatrix(inst.transform)}">${motifSvg}</g>`)
    .join('\n');

  // デバッグパスの生成
  let debugPaths: string[] = [];
  if (debug && debugData) {
    debugPaths = createDebugPaths(debugData);
  }

  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}"
      width="${viewBox.w}"
      height="${viewBox.h}"
    >
      ${groups}
      ${debug ? debugPaths.join('\n') : ''}
    </svg>
  `.trim();

  return svg;
}