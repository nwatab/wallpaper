import type { Rect, UnitTemplate, Scene, Pose, DebugOptions } from './types';
import { compileUnit, buildOrbitElements, renderSvg } from './engine';
import { motifs } from './motifs';

export const renderWallpaperSvg = (args: {
  template: UnitTemplate;
  viewport: Rect;
  debugOptions?: DebugOptions;
}): string => {
  const { template, viewport, debugOptions } = args;

  const motif = motifs[template.motifId];
  if (!motif) {
    throw new Error(`Unknown motifId: ${template.motifId}`);
  }

  // 1. Compile: extract geometric core
  const compiled = compileUnit(template);

  // 2. Tiling: cover viewport with orbit elements
  const pose: Pose = {
    scale: template.defaultPose?.scale ?? 120,
    rotationDeg: template.defaultPose?.rotationDeg ?? 0,
    translate: { x: 0, y: 0 },
  };

  const { orbitElements, poseMatrix, tilePositions } = buildOrbitElements({
    compiled,
    viewport,
    pose,
    options: { overscanCells: 1 },
  });

  // 3. Render: SVG output
  const scene: Scene = {
    viewBox: {
      x: viewport.x,
      y: viewport.y,
      w: viewport.width,
      h: viewport.height,
    },
    orbitElements,
    motifSvg: motif,
  };

  return renderSvg(scene, debugOptions, {
    regionXy: compiled.regionXy,
    basis: compiled.basis,
    poseMatrix,
    tilePositions,
  });
};
