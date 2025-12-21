import type { Rect, UnitTemplate } from './types';
import { toSvgMatrix } from './affine';
import { generateInstances, polygonUvToWorldPoints } from './engine';
import { motifs } from './motifs';

const pointsToPathD = (pts: { x: number; y: number }[]): string => {
  if (pts.length === 0) return '';
  const [p0, ...rest] = pts;
  return (
    `M ${p0.x} ${p0.y} ` + rest.map((p) => `L ${p.x} ${p.y}`).join(' ') + ' Z'
  );
};

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

  const { instances, uvToWorld } = generateInstances({
    template,
    viewport,
    options: { overscanCells: 1 },
  });

  // optional debug overlay: unit cell boundary in uv is always the unit square
  const cellUv = [
    { u: 0, v: 0 },
    { u: 1, v: 0 },
    { u: 1, v: 1 },
    { u: 0, v: 1 },
  ];

  const debugPaths: string[] = [];
  if (debug) {
    // region boundary (in the origin cell only)
    const regionWorld = polygonUvToWorldPoints(template.regionUv, uvToWorld);
    debugPaths.push(
      `<path d="${pointsToPathD(
        regionWorld,
      )}" fill="none" stroke="magenta" stroke-width="2" />`,
    );

    // unit cell boundary (in the origin cell only)
    const cellWorld = polygonUvToWorldPoints(cellUv, uvToWorld);
    debugPaths.push(
      `<path d="${pointsToPathD(
        cellWorld,
      )}" fill="none" stroke="navy" stroke-width="1" />`,
    );
  }

  const groups = instances
    .map((inst) => `<g transform="${toSvgMatrix(inst.transform)}">${motif}</g>`)
    .join('\n');

  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}"
      width="${viewport.width}"
      height="${viewport.height}"
    >
      ${groups}
      ${debug ? debugPaths.join('\n') : ''}
    </svg>
  `.trim();

  return svg;
};
