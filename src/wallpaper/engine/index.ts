// Compile: extract geometric core from template
export { compileUnit } from './compile';

// Tiling: cover the viewport with orbit elements
export { buildOrbitElements } from './tiling';
export type { BuildOrbitElementsOptions } from './tiling';

// Render: SVG output (layered — motif layer first, overlay layer on top)
export {
  renderSvg,
  renderMotifLayer,
  renderOverlayLayer,
  createDebugPaths,
} from './render';

// Types
export type {
  CompiledUnit,
  OrbitElement,
  Scene,
  Mat2D,
  DebugOptions,
} from '../types';
