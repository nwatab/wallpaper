// 新しい3層アーキテクチャのメインエクスポート

// Compile層: 対称性の計算
export { compileUnit } from './engine/compile';

// Tiling層: 画面を覆うように並べる計算
export { buildOrbitElements } from './engine/tiling';
export type { BuildOrbitElementsOptions } from './engine/tiling';

// Render層: バックエンド依存の描画
export {
  renderSvg,
  createDebugPaths,
  polygonUvToWorldPoints,
} from './engine/render';

// 共通型定義
export type { CompiledUnit, OrbitElement, Scene, Mat2D } from './types';
