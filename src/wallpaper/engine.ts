// Compile: extract geometric core from template
export { compileUnit } from './engine/compile';

// Tiling: cover the viewport with orbit elements
export { buildOrbitElements } from './engine/tiling';
export type { BuildOrbitElementsOptions } from './engine/tiling';

// Render: SVG output
export { renderSvg, createDebugPaths } from './engine/render';

// Types
export type { CompiledUnit, OrbitElement, Scene, Mat2D } from './types';
