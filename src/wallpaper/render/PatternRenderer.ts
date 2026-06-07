import type { UnitTemplate, Rect, Pose, DebugOptions } from '../types';

/**
 * Everything a renderer needs to draw one wallpaper into one viewport.
 * The group's symmetry is reached through `template.group` (groups.ts) — backends
 * receive the pattern as data and choose their own rendering strategy.
 */
export type RenderInput = {
  template: UnitTemplate;
  viewport: Rect;
  pose: Pose;
  debugOptions?: DebugOptions;
};

/**
 * A rendering backend. Parameterised by output type so backends can differ in how
 * they emit:
 *   - the SVG backend returns markup (TOutput = string),
 *   - a future M4 WebGL backend would hold a GL context and draw to it (TOutput = void),
 *     using inverse per-pixel sampling rather than the forward orbit-element stamp.
 *
 * The interface deliberately takes the whole RenderInput (not a pre-built Scene) so
 * each backend owns its strategy end to end.
 */
export interface PatternRenderer<TOutput = string> {
  render(input: RenderInput): TOutput;
}
