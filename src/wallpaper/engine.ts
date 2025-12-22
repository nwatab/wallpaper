import type {
  Affine2D,
  MotifInstance,
  Pose,
  Rect,
  UnitTemplate,
  UV,
  Vec2,
  CompiledUnit,
  Instance,
} from './types';
import {
  compose,
  identity,
  invert,
  rotateDeg,
  scaleUniform,
  translateUv,
  translateXy,
  applyToPoint,
} from './affine';

// 新しいアーキテクチャの関数をインポート
import { compileUnit } from './engine/compile';
import { buildInstances, BuildInstancesOptions } from './engine/tiling';

// 後方互換性のため、既存のインターフェースを維持
export type GenerateOptions = {
  overscanCells?: number;
};

// 後方互換性のためのラッパー関数
export const generateInstances = (args: {
  template: UnitTemplate;
  viewport: Rect;
  pose?: Partial<Pose>;
  options?: GenerateOptions;
}): { instances: MotifInstance[]; uvToWorld: Affine2D } => {
  const { template, viewport } = args;

  const basePose: Pose = {
    scale: template.defaultPose?.scale ?? 120,
    rotationDeg: template.defaultPose?.rotationDeg ?? 0,
    translate: { x: 0, y: 0 },
    ...args.pose,
  };

  // 新しいアーキテクチャを使用
  const compiled = compileUnit(template);
  const { instances, uvToWorld } = buildInstances({
    compiled,
    viewport,
    pose: basePose,
    options: args.options,
  });

  // 後方互換性のため、InstanceをMotifInstanceに変換
  const motifInstances: MotifInstance[] = instances.map((instance, index) => ({
    transform: instance.transform,
    cell: { i: 0, j: 0 }, // セル情報は簡略化（既存コードで使用されていない場合）
    opIndex: index % compiled.opsInCell.length,
  }));

  return { instances: motifInstances, uvToWorld };
};

// デバッグ用：uv polygon（region/cell）を world polyline に変換
// renderモジュールに移行
export { polygonUvToWorldPoints } from './engine/render';

// 新しいアーキテクチャの関数をエクスポート
export { compileUnit } from './engine/compile';
export { buildInstances } from './engine/tiling';
export { renderSvg, createDebugPaths } from './engine/render';
export type { CompiledUnit, Instance, Scene } from './types';
