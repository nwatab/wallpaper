import type { UnitTemplate, CompiledUnit, Mat2D } from '../types';

/**
 * Compile層: 対称性の計算
 * UnitTemplateから群論・対称性の知識を使ってCompiledUnitを生成する
 */
export function compileUnit(template: UnitTemplate): CompiledUnit {
  // opsInCellUvは既にMat2D（Affine2D）形式で定義されているので、
  // そのまま使用できる
  const opsInCell: Mat2D[] = template.opsInCellUv;

  return {
    basis: template.basis,
    opsInCell,
    regionUv: template.regionUv, // デバッグ用
  };
}