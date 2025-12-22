// 新しい3層アーキテクチャのメインエクスポート

// Compile層: 対称性の計算
export { compileUnit } from './compile';

// Tiling層: 画面を覆うように並べる計算
export { buildOrbitElements } from './tiling';
export type { BuildOrbitElementsOptions } from './tiling';

// Render層: バックエンド依存の描画
export { renderSvg, createDebugPaths, polygonUvToWorldPoints } from './render';

// 共通型定義
export type {
  CompiledUnit,
  OrbitElement,
  Scene,
  Mat2D,
  DebugOptions,
} from '../types';
