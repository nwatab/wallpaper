import type { Affine2D, DebugOptions, Pose, Rect, Scene, UnitTemplate, Vec2, WallpaperGroup } from '../types';
import { tile } from '../engine/tile';
import { applyToPoint, basisToMatrix, compose, invert, rotateDeg, scaleUniform, toSvgMatrix } from '../affine';
import { toSVG } from '@/lib/coords/surfaces';
import { extentCenter, viewTransform } from '@/lib/coords/view';
import type { GalleryMotif } from '../galleryMotifs';
import { renderMotifLayer, renderOverlayLayer } from '../engine/render';
import { placeUserMotif, renderableByGroup } from './shapeFamilies';
import { renderSymmetryElements } from './symmetryElements';
import { buildCanvasMapping, type CanvasRect, type CanvasMapping } from '../draw/canvasMapping';

// ─────────────────────────────────────────────────────────────────────────────
// renderSwitchSvg — the M1 render entry point. A NEW path layered on the verified
// core: it drives the SAME tile() the gallery uses, stamps a supplied motif, and
// composites the engine debug overlay plus the symmetry-element overlay. The motif is
// passed in (a placed shape-local motif for a toggle member, or an existing template's
// motif for a singleton), so switching the group is purely a data swap — tile(),
// compileUnit(), and the group action are untouched.
// ─────────────────────────────────────────────────────────────────────────────

// Decompose a similarity matrix into the Pose the engine consumes.
const poseFromMatrix = (m: Affine2D): Pose => ({
  scale: Math.hypot(m.a, m.b),
  rotationDeg: (Math.atan2(m.b, m.a) * 180) / Math.PI,
  translate: { x: m.e, y: m.f },
});

const renderTemplateSvg = (args: {
  template: UnitTemplate;
  motifSvg: string;
  // The motif's as-drawn layer:'overlap' shapes (placeUserMotif split): the same orbit,
  // composited painter-style by per-copy depth ON TOP of the clipped base layer — the
  // only compositing that lets a whole copy occlude the copy behind it (seigaiha).
  overlapMotifSvg?: string;
  // Depth orientation for that layer (derived per group by overlapGate).
  overlapDepthRotationDeg?: number;
  viewport: Rect;
  pose: Pose;
  debugOptions?: DebugOptions;
  showSymmetryElements?: boolean;
  // Center the viewBox on the displayed extent (coords/ view stage) — true for the main
  // wallpaper view (matches the gallery, gives the conformal layer 0 at centre). The
  // draw-pane preview passes false: its pointer↔uv mapping is canvas-pixel based and
  // independent of the viewBox, so it stays a top-left box to keep input aligned.
  centered?: boolean;
}): string => {
  const pose = args.pose;

  const {
    orbitElements,
    poseMatrix,
    tilePositions,
    regionXy,
    opsInCellXy,
    basis,
  } = tile({ template: args.template, viewport: args.viewport, pose });

  const viewBox = {
    x: args.viewport.x,
    y: args.viewport.y,
    w: args.viewport.width,
    h: args.viewport.height,
  };

  const scene: Scene = {
    viewBox,
    orbitElements,
    motifSvg: args.motifSvg,
    basis,
    regionXy,
    motifLayer: 'clip',
  };

  const motif = renderMotifLayer(scene, poseMatrix);
  const overlapMotif = args.overlapMotifSvg
    ? renderMotifLayer(
        {
          ...scene,
          motifSvg: args.overlapMotifSvg,
          motifLayer: 'overlap',
          depthRotationDeg: args.overlapDepthRotationDeg ?? 0,
        },
        poseMatrix,
      )
    : null;
  const overlay = renderOverlayLayer(args.debugOptions, {
    opsInCellXy,
    poseMatrix,
    tilePositions,
    basis,
    regionXy,
  });
  const symmetry = args.showSymmetryElements
    ? renderSymmetryElements({ opsInCellXy, basis, poseMatrix, viewBox })
    : '';

  const defs = `${motif.defs}${overlapMotif?.defs ?? ''}`;
  const inner = `${defs ? `<defs>${defs}</defs>` : ''}
      <g data-layer="motif">${motif.body}</g>
      ${overlapMotif ? `<g data-layer="motif-overlap">${overlapMotif.body}</g>` : ''}
      ${overlay ? `<g data-layer="overlay">${overlay}</g>` : ''}
      ${symmetry}`;

  if (!args.centered) {
    return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}"
      width="${viewBox.w}"
      height="${viewBox.h}"
    >
      ${inner}
    </svg>
  `.trim();
  }

  const surface = toSVG({ w: viewBox.w, h: viewBox.h });
  const view = compose(surface.forward, viewTransform({ center: extentCenter(viewBox) }));
  const vb = surface.viewBox;
  return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}"
      width="${vb.w}"
      height="${vb.h}"
    >
      ${defs ? `<defs>${defs}</defs>` : ''}
      <g data-layer="view" transform="${toSvgMatrix(view)}">
        <g data-layer="motif">${motif.body}</g>
        ${overlapMotif ? `<g data-layer="motif-overlap">${overlapMotif.body}</g>` : ''}
        ${overlay ? `<g data-layer="overlay">${overlay}</g>` : ''}
        ${symmetry}
      </g>
    </svg>
  `.trim();
};

// Render any group (toggle member or singleton). The motif comes from the stored
// shape-motif (renderableByGroup) unless a user motif is supplied — a drawing or chosen
// preset authored in the toggle-set's reference frame — in which case it is placed into
// this group's region through the same isometry (placeUserMotif). Everything downstream
// (tile, clip, group action) is identical, so the user motif tiles and toggles like the
// stored art.
export const renderGroupSvg = (args: {
  group: string;
  viewport: Rect;
  scale: number;
  rotationDeg: number;
  motif?: GalleryMotif;
  debugOptions?: DebugOptions;
  showSymmetryElements?: boolean;
}): string => {
  const r = args.motif
    ? placeUserMotif(args.group as WallpaperGroup, args.motif)
    : renderableByGroup().get(args.group as never);
  if (!r) return '';
  // Effective pose = userPose ∘ alignXy: align this member's tile onto its toggle-set
  // reference (rotation + translation), then apply the user's scale/rotation.
  const userPose = compose(rotateDeg(args.rotationDeg), scaleUniform(args.scale));
  const pose = poseFromMatrix(compose(userPose, r.alignXy));
  return renderTemplateSvg({
    template: r.template,
    motifSvg: r.motifSvg,
    overlapMotifSvg: r.overlapMotifSvg,
    overlapDepthRotationDeg: r.overlapDepthRotationDeg,
    viewport: args.viewport,
    pose,
    debugOptions: args.debugOptions,
    showSymmetryElements: args.showSymmetryElements,
    centered: true, // main wallpaper view — matches the gallery's centred viewBox
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// DRAW-PANE PREVIEW. A fixed, un-posed view of one fundamental region in true XY
// geometry, fitted to the canvas, showing the group's immediate cell orbit of the
// (placed) motif so the user SEES each mark reflected/rotated as they draw. It reuses
// renderTemplateSvg — and therefore the SAME motifLayer:'clip' policy as the wallpaper
// (so preview and tiled output match) and the same symmetry overlay. Returns the SVG
// plus the px↔uv affines the capture UI needs:
//   toUv    — canvas pixel → reference-frame uv (append to the stored stroke)
//   toCanvas — reference-frame uv → canvas pixel (draw the in-progress stroke)
// ─────────────────────────────────────────────────────────────────────────────
export const renderRegionPreview = (args: {
  group: string;
  motif: GalleryMotif;
  canvas: CanvasRect;
  // Optional uv polygon fitted to the canvas instead of the fundamental region —
  // the draw pane's zoom levels (unit cell, 2×2 cells). Default: the region.
  windowUv?: Vec2[];
  showSymmetryElements?: boolean;
  debugOptions?: DebugOptions;
}): {
  svg: string;
  mapping: CanvasMapping;
  // The placed template's lattice basis — the uv↔XY adapter snap-target derivation needs.
  basis: { a: Vec2; b: Vec2 };
  toUv: Affine2D;
  toCanvas: Affine2D;
} => {
  const r = placeUserMotif(args.group as WallpaperGroup, args.motif);
  const B = basisToMatrix(r.template.basis);
  // Fit the window (XY) into the canvas → a uniform similarity (scale + translate).
  const windowXy = args.windowUv
    ? args.windowUv.map((p) => applyToPoint(B, p))
    : r.template.regionXy;
  const mapping = buildCanvasMapping(windowXy, args.canvas);
  const pose: Pose = {
    scale: mapping.toCanvas.a,
    rotationDeg: 0,
    translate: { x: mapping.toCanvas.e, y: mapping.toCanvas.f },
  };
  const viewport: Rect = {
    x: 0,
    y: 0,
    width: args.canvas.width,
    height: args.canvas.height,
  };
  const svg = renderTemplateSvg({
    template: r.template,
    motifSvg: r.motifSvg,
    overlapMotifSvg: r.overlapMotifSvg,
    overlapDepthRotationDeg: r.overlapDepthRotationDeg,
    viewport,
    pose,
    debugOptions: args.debugOptions,
    showSymmetryElements: args.showSymmetryElements,
    centered: false, // draw-pane preview: top-left box keeps the canvas-pixel pointer map aligned
  });
  return {
    svg,
    mapping,
    basis: r.template.basis,
    // canvas → XY → uv  and  uv → XY → canvas.
    toUv: compose(invert(B), mapping.fromCanvas),
    toCanvas: compose(mapping.toCanvas, B),
  };
};
