import type { Rect, UnitTemplate, Pose, DebugOptions } from './types';
import { createSvgRenderer } from './render/svgRenderer';

export type { PatternRenderer, RenderInput } from './render/PatternRenderer';
export { createSvgRenderer } from './render/svgRenderer';

// Default backend. Stateless, so a single shared instance is fine.
const svgRenderer = createSvgRenderer();

/**
 * Public API: render a wallpaper template into a viewport as an SVG string.
 * Thin wrapper over the SVG PatternRenderer backend (scale/rotation → Pose).
 */
export const renderWallpaperSvg = (args: {
  template: UnitTemplate;
  viewport: Rect;
  scale: number;
  rotationDeg: number;
  debugOptions?: DebugOptions;
}): string => {
  const pose: Pose = {
    scale: args.scale,
    rotationDeg: args.rotationDeg,
    translate: { x: 0, y: 0 },
  };

  return svgRenderer.render({
    template: args.template,
    viewport: args.viewport,
    pose,
    debugOptions: args.debugOptions,
  });
};
