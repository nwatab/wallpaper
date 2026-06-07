import type { Scene } from '../types';
import { renderSvg } from '../engine';
import { tile } from '../engine/tile';
import { motifs } from '../motifs';
import type { PatternRenderer, RenderInput } from './PatternRenderer';

/**
 * SVG backend: the forward orbit-element stamp over tile() (cosetReps × lattice).
 * No per-cell clipping — every copy is drawn at its true position. This is the M0–M3
 * backend; M4 may add a WebGL backend behind the same PatternRenderer interface.
 */
export const createSvgRenderer = (): PatternRenderer<string> => ({
  render(input: RenderInput): string {
    const { template, viewport, pose, debugOptions } = input;

    const motif = motifs[template.motifId];
    if (!motif) {
      throw new Error(`Unknown motifId: ${template.motifId}`);
    }

    const { orbitElements, poseMatrix, tilePositions, regionXy, basis } = tile({
      template,
      viewport,
      pose,
    });

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
      regionXy,
      basis,
      poseMatrix,
      tilePositions,
    });
  },
});
