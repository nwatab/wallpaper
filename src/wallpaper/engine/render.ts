import type { Scene, Affine2D, Vec2, DebugOptions } from '../types';
import {
  toSvgMatrix,
  applyToPoint,
  applyToPolygon,
  compose,
  translateXy,
  invert,
  identity,
  rotateDeg,
  basisToMatrix,
} from '../affine';
import { toSVG } from '@/lib/coords/surfaces';
import { extentCenter, viewTransform } from '@/lib/coords/view';

const pointsToPathD = (pts: Vec2[]): string => {
  if (pts.length === 0) return '';
  const [p0, ...rest] = pts;
  return (
    `M ${p0.x} ${p0.y} ` + rest.map((p) => `L ${p.x} ${p.y}`).join(' ') + ' Z'
  );
};

/**
 * Generate debug overlay paths for fundamental regions and unit cells.
 */
export function createDebugPaths(args: {
  regionXy?: Vec2[];
  opsInCellXy?: Affine2D[];
  basis: { a: Vec2; b: Vec2 };
  poseMatrix: Affine2D;
  tilePositions?: { i: number; j: number }[];
  debugOptions: DebugOptions;
}): string[] {
  const { regionXy, opsInCellXy, basis, poseMatrix, tilePositions, debugOptions } =
    args;
  const debugPaths: string[] = [];

  const tiles = tilePositions ?? [{ i: 0, j: 0 }];

  if (debugOptions.showBravaisLattice) {
    const { a, b: bv } = basis;
    for (const { i, j } of tiles) {
      // Unit cell parallelogram corners at lattice position (i,j)
      const corners = [
        { x: i * a.x + j * bv.x, y: i * a.y + j * bv.y },
        { x: (i + 1) * a.x + j * bv.x, y: (i + 1) * a.y + j * bv.y },
        {
          x: (i + 1) * a.x + (j + 1) * bv.x,
          y: (i + 1) * a.y + (j + 1) * bv.y,
        },
        { x: i * a.x + (j + 1) * bv.x, y: i * a.y + (j + 1) * bv.y },
      ];
      const cellWorld = corners.map((p) => applyToPoint(poseMatrix, p));
      debugPaths.push(
        `<path d="${pointsToPathD(cellWorld)}" fill="none" stroke="navy" stroke-width="4" />`,
      );
    }
  }

  // Fundamental-region overlays. Both stamp the region through the same transform
  // path as the motif, minus the UV→XY basis adapter since regionXy is already in XY.
  //   showOrbit  → pink: every region (cosetReps × lattice) partitioning the plane.
  //   showRegions → pink: one representative region per cell (the identity copy).
  if ((debugOptions.showOrbit || debugOptions.showRegions) && regionXy) {
    const latticeTs = tiles.map(({ i, j }) =>
      translateXy(
        i * basis.a.x + j * basis.b.x,
        i * basis.a.y + j * basis.b.y,
      ),
    );

    if (debugOptions.showOrbit && opsInCellXy) {
      for (const latticeT of latticeTs) {
        for (const op of opsInCellXy) {
          // world = pose ∘ latticeTranslation ∘ symmetryOp  (regionXy is XY)
          const m = compose(poseMatrix, compose(latticeT, op));
          const regionWorld = regionXy.map((p) => applyToPoint(m, p));
          debugPaths.push(
            `<path d="${pointsToPathD(regionWorld)}" fill="none" stroke="magenta" stroke-width="1" />`,
          );
        }
      }
    }

    if (debugOptions.showRegions) {
      for (const latticeT of latticeTs) {
        const m = compose(poseMatrix, latticeT);
        const regionWorld = regionXy.map((p) => applyToPoint(m, p));
        debugPaths.push(
          `<path d="${pointsToPathD(regionWorld)}" fill="none" stroke="magenta" stroke-width="1" />`,
        );
      }
    }
  }

  return debugPaths;
}

const MOTIF_CENTRE: Vec2 = { x: 0.5, y: 0.5 };

// Painter's-order depth of an overlap copy, in the pattern's INTRINSIC recede frame: the y of
// the copy's motif centre after rotating to the design orientation (depthRotationDeg, from the
// template's defaultPose). This is POSE-INDEPENDENT by construction and the SINGLE source of
// overlap order — shared with the seamless-cell baking (exportSvg.buildCellLayers) so the
// gallery and the warped cell stack identically. At a template's default pose it is
// order-equivalent to the old screen-y sort (uniform scale + that rotation is a positive-affine
// map of this), so the on-screen look is unchanged; it only fixes stacking under other
// rotations and, crucially, in the baked cell that the warp tiles. centreXy is the CANONICAL
// (pose-stripped) motif centre in XY.
export const overlapDepth = (centreXy: Vec2, depthRotationDeg = 0): number =>
  applyToPoint(rotateDeg(depthRotationDeg), centreXy).y;

// A deterministic id derived from the clip region's path. Many of these SVGs share one
// HTML document (the full wallpaper plus a grid of gallery swatches), and duplicate
// element ids make every `url(#id)` resolve to the FIRST match in document order — so a
// fixed id would clip every swatch to whichever region happened to render first (blank
// for non-overlapping regions). Keying the id by region geometry means identical regions
// safely share one clipPath while distinct regions never collide. Pure (no counter/RNG).
const djb2 = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

/**
 * MOTIF LAYER — stamp the full tile() orbit (cosetReps × lattice). Every copy is
 * drawn at its true position; no per-cell clipping that would erase copies thrown
 * outside their stamp cell by origin-based ops. The `motifLayer` policy chooses how
 * overlapping copies composite:
 *   'overlap' → painter's order by on-screen depth, so symmetry-equivalent copies
 *               always stack identically (seigaiha: back rows first, front rows last).
 *   'clip'    → clip each copy to its fundamental region (verification glyphs).
 *   default   → orbit order, as authored.
 * Returns the layer body plus any <defs> (clip paths) it depends on.
 */
export function renderMotifLayer(
  scene: Scene,
  poseMatrix?: Affine2D,
): { defs: string; body: string } {
  const { orbitElements, motifSvg, motifLayer, basis, regionXy } = scene;

  if (motifLayer === 'overlap') {
    // Strip the pose to recover each copy's CANONICAL motif centre, then sort by the intrinsic
    // recede depth — pose-independent and identical to the cell baking's key.
    const poseInv = poseMatrix ? invert(poseMatrix) : identity();
    const depthRot = scene.depthRotationDeg ?? 0;
    const depthOf = (el: (typeof orbitElements)[number]): number =>
      overlapDepth(
        applyToPoint(poseInv, applyToPoint(el.transform, MOTIF_CENTRE)),
        depthRot,
      );
    const ordered = [...orbitElements].sort((p, q) => depthOf(p) - depthOf(q));
    const body = ordered
      .map((el) => `<g transform="${toSvgMatrix(el.transform)}">${motifSvg}</g>`)
      .join('\n');
    return { defs: '', body };
  }

  if (motifLayer === 'clip') {
    // The region in motif-local uv space is fixed; each copy's own transform places it,
    // so a single clipPath (userSpaceOnUse) clips every copy to its own region.
    const regionUv = applyToPolygon(invert(basisToMatrix(basis)), regionXy);
    const dPath = pointsToPathD(regionUv);
    const clipId = `fr-clip-${djb2(dPath)}`;
    const defs = `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><path d="${dPath}"/></clipPath>`;
    const body = orbitElements
      .map(
        (el) =>
          `<g clip-path="url(#${clipId})" transform="${toSvgMatrix(el.transform)}">${motifSvg}</g>`,
      )
      .join('\n');
    return { defs, body };
  }

  const body = orbitElements
    .map((el) => `<g transform="${toSvgMatrix(el.transform)}">${motifSvg}</g>`)
    .join('\n');
  return { defs: '', body };
}

/**
 * OVERLAY LAYER — the lattice / fundamental-region guides, drawn on top of the whole
 * motif layer. Thin wrapper over createDebugPaths; returns '' when nothing is enabled.
 */
export function renderOverlayLayer(
  debugOptions: DebugOptions | undefined,
  overlayData:
    | {
        regionXy?: Vec2[];
        opsInCellXy?: Affine2D[];
        basis: { a: Vec2; b: Vec2 };
        poseMatrix: Affine2D;
        tilePositions?: { i: number; j: number }[];
      }
    | undefined,
): string {
  const hasOverlay =
    debugOptions &&
    (debugOptions.showRegions ||
      debugOptions.showOrbit ||
      debugOptions.showBravaisLattice);
  if (!hasOverlay || !overlayData) return '';
  return createDebugPaths({ ...overlayData, debugOptions }).join('\n');
}

/**
 * Render a Scene to an SVG string by stacking the motif layer, then the overlay layer
 * on top of it. The two layers are sibling <g data-layer> groups so the overlay (and
 * its rotation-centre / lattice / region guides) is always composited last.
 */
export function renderSvg(
  scene: Scene,
  debugOptions?: DebugOptions,
  debugData?: {
    opsInCellXy?: Affine2D[];
    poseMatrix: Affine2D;
    tilePositions?: { i: number; j: number }[];
  },
): string {
  const { viewBox } = scene;

  const motif = renderMotifLayer(scene, debugData?.poseMatrix);
  const overlay = renderOverlayLayer(
    debugOptions,
    debugData && {
      ...debugData,
      basis: scene.basis,
      regionXy: scene.regionXy,
    },
  );

  // VIEW STAGE (coords/): recenter the displayed extent's centre onto canonical 0 and
  // emit a centred viewBox. Output-preserving (same pixels as the old top-left box) and
  // the insertion point for the future conformal layer (0 at the viewport centre). The
  // recenter wraps motif + overlay as one <g> so clips (userSpaceOnUse, an ancestor
  // transform) stay aligned with their content.
  const surface = toSVG({ w: viewBox.w, h: viewBox.h });
  const view = compose(surface.forward, viewTransform({ center: extentCenter(viewBox) }));
  const vb = surface.viewBox;

  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}"
      width="${vb.w}"
      height="${vb.h}"
    >
      ${motif.defs ? `<defs>${motif.defs}</defs>` : ''}
      <g data-layer="view" transform="${toSvgMatrix(view)}">
        <g data-layer="motif">${motif.body}</g>
        ${overlay ? `<g data-layer="overlay">${overlay}</g>` : ''}
      </g>
    </svg>
  `.trim();

  return svg;
}
