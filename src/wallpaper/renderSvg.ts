import type { Rect, UnitTemplate, Scene, Pose } from './types';
import { compileUnit, buildOrbitElements, renderSvg } from './engine';
import { motifs } from './motifs';

export const renderWallpaperSvg = (args: {
  template: UnitTemplate;
  viewport: Rect;
  debug?: boolean;
}): string => {
  const { template, viewport, debug } = args;

  const motif = motifs[template.motifId];
  if (!motif) {
    throw new Error(`Unknown motifId: ${template.motifId}`);
  }

  // 1. Compile: 対称性の計算
  const compiled = compileUnit(template);

  // 2. Tiling: 画面を覆うように並べる計算
  const pose: Pose = {
    scale: template.defaultPose?.scale ?? 120,
    rotationDeg: template.defaultPose?.rotationDeg ?? 0,
    translate: { x: 0, y: 0 },
  };

  const { orbitElements, uvToWorld, tilePositions } = buildOrbitElements({
    compiled,
    viewport,
    pose,
    options: { overscanCells: 1 },
  });

  // 3. Render: SVG描画
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

  return renderSvg(scene, debug, {
    regionUv: compiled.regionUv,
    uvToWorld,
    tilePositions,
  });
};
