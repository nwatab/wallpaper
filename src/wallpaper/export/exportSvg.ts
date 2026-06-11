import type { Affine2D, Vec2, UnitTemplate, WallpaperGroup, Pose, Rect } from '../types';
import {
  basisToMatrix,
  compose,
  invert,
  applyToPoint,
  applyToPolygon,
  toSvgMatrix,
  translateXy,
} from '../affine';
import { tile } from '../engine/tile';
import { overlapDepth } from '../engine/render';
import { motifs } from '../motifs';
import type { GalleryMotif } from '../galleryMotifs';
import { placeUserMotif, renderableByGroup } from '../switch/shapeFamilies';

// ─────────────────────────────────────────────────────────────────────────────
// SVG EXPORT — pure builders that turn the on-screen pattern into a standalone,
// downloadable SVG. Two targets:
//   • snapshot — the pattern exactly as displayed (current pose/viewport). Built by
//     cleaning the live SVG string (strip the teaching overlays) and painting a backdrop.
//   • tileable — a CANONICAL (un-posed) single repeating unit that tiles infinitely: one
//     <pattern> whose tile is the primitive cell in uv space, with patternTransform = the
//     basis. The basis carries the lattice skew/scale, so this is seamless for ALL five
//     lattices (square / rectangular / rhombic / hexagonal / oblique) with NO supercell.
//
// This module only READS the engine's outputs (tile(), motif geometry, the rendered
// string) — it never mutates the engine, the group action, or the region/maximality data.
// ─────────────────────────────────────────────────────────────────────────────

export type ExportBackground = 'white' | 'transparent';

const WHITE = '#ffffff';

const parseViewBox = (
  svg: string,
): { x: number; y: number; w: number; h: number } | null => {
  const m = svg.match(/viewBox="([^"]+)"/);
  if (!m) return null;
  const [x, y, w, h] = m[1].trim().split(/\s+/).map(Number);
  if ([x, y, w, h].some((n) => !Number.isFinite(n))) return null;
  return { x, y, w, h };
};

/**
 * Paint a backdrop behind the pattern. Default WHITE (correction #2): several patterns
 * depend on the white showing through as part of the design — seigaiha's white scales are
 * the background, not drawn ink, so a transparent file makes them vanish on a non-white
 * viewer. 'transparent' is offered for users compositing on their own colour. Pure string
 * op: inserts a viewBox-sized rect immediately after the opening <svg> tag (so it is behind
 * every later layer).
 */
export const withBackground = (
  svg: string,
  background: ExportBackground,
): string => {
  if (background === 'transparent') return svg;
  const vb = parseViewBox(svg);
  const rect = vb
    ? `<rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="${WHITE}"/>`
    : `<rect x="0" y="0" width="100%" height="100%" fill="${WHITE}"/>`;
  return svg.replace(/(<svg[^>]*>)/, `$1${rect}`);
};

// The teaching-overlay layers, identified by their <g data-layer> markers. Keying on the
// MARKERS (not colours) is deliberate (correction #1): overlay colours may collide with
// motif colours — e.g. the Bravais navy is the cobalt-ink family (#1c3f7a) — so "string
// contains no navy" would false-fail on any pattern that uses them. Each overlay <g>
// contains only <path>/<line>/<circle>/<polygon> (no nested <g>), so a non-greedy match
// to the first </g> is exact.
const OVERLAY_LAYERS = ['overlay', 'symmetry-elements'] as const;

/** Strip the teaching overlays so the export is the PATTERN only. */
export const stripOverlays = (svg: string): string =>
  OVERLAY_LAYERS.reduce(
    (s, layer) =>
      s.replace(new RegExp(`<g data-layer="${layer}">[\\s\\S]*?</g>`, 'g'), ''),
    svg,
  );

// ── Seamless tileable builder ────────────────────────────────────────────────

export type TileableGeometry = {
  basis: { a: Vec2; b: Vec2 };
  // The XY coset ops at cell (0,0) — tile()'s opsInCellXy (pose-independent).
  opsInCellXy: Affine2D[];
  // Motif SVG fragment authored in cell-fractional (uv) space.
  motifSvg: string;
  // Fundamental region (XY), used to clip self-contained copies.
  regionXy: Vec2[];
  motifLayer?: 'clip' | 'overlap';
  // Intrinsic recede orientation for 'overlap' depth (template.defaultPose.rotationDeg). Shared
  // with the gallery renderer (engine/render.overlapDepth) so the baked cell stacks identically.
  depthRotationDeg?: number;
  // A drawn motif's layer:'overlap' shapes (placeUserMotif split), baked as a second
  // depth-sorted layer ON TOP of the base layer; overlapReach (cells, ≥1) sets how far
  // the neighbour wrap must stamp for the baked cell to stay seamless, and
  // overlapDepthRotationDeg its depth orientation (derived per group by overlapGate —
  // distinct from the template's own depthRotationDeg).
  overlapMotifSvg?: string;
  overlapReach?: number;
  overlapDepthRotationDeg?: number;
};

export type TileableOptions = {
  background?: ExportBackground; // default 'white'
  repeats?: number; // cells per side shown in the finite preview rect, default 8
  targetPx?: number; // longest output side in px, default 1024
};

const CENTRE: Vec2 = { x: 0.5, y: 0.5 };
const OFFSETS = [-1, 0, 1];
const NEIGHBORS = OFFSETS.flatMap((di) => OFFSETS.map((dj) => ({ di, dj })));

const round = (n: number): number => +n.toFixed(4);

const pointsToPathD = (pts: Vec2[]): string =>
  pts.length === 0
    ? ''
    : `M ${pts[0].x} ${pts[0].y} ` +
      pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ') +
      ' Z';

// Canonical (un-posed) XY centre of a stamped copy: the motif centre after its uv transform
// and the basis. Fed to the SHARED overlapDepth (engine/render) so the baked cell stacks
// overlap copies in exactly the gallery's painter's order.
const stampCentre = (basisMatrix: Affine2D, uv: Affine2D): Vec2 =>
  applyToPoint(compose(basisMatrix, uv), CENTRE);

// The uv-space transforms whose images the cell stamps: each coset op conjugated to uv
// (opUv = B⁻¹ ∘ opXY ∘ B) AND each of its lattice-neighbour copies (NEIGHBORS). The neighbour
// wrap is essential, not cosmetic: the cell content must fill the WHOLE unit square so that
// translation-tiling it reproduces the full group. For PRIMITIVE lattices the coset-rep copies
// already partition the cell, so the t=0 copies suffice and the neighbours fall outside (and are
// clipped away). For CENTERED lattices (cm, cmm) some coset-rep copies land OUTSIDE [0,1]² at
// their raw position — their in-cell halves arrive only via a lattice neighbour. Without the
// wrap those copies are dropped and the tiling is sparse (the cmm bug). The cell-clip below
// trims everything back to the unit square so the result is exactly one period either way.
// Exported for verify/cell-tiling.test.ts, which checks this reproduces every group's orbit.
export const cellStampTransforms = (
  basis: { a: Vec2; b: Vec2 },
  opsInCellXy: Affine2D[],
  // Neighbour wrap radius in cells. The default ±1 suffices for region-sized motifs;
  // overlap drawings can reach further (their overlapReach), and every copy whose ink
  // touches the unit square must be stamped or the baked cell loses that ink.
  reach = 1,
): Affine2D[] => {
  const B = basisToMatrix(basis);
  const Binv = invert(B);
  const opsUv = opsInCellXy.map((op) => compose(Binv, compose(op, B)));
  const offsets = Array.from({ length: 2 * reach + 1 }, (_, k) => k - reach);
  const neighbors =
    reach === 1
      ? NEIGHBORS
      : offsets.flatMap((di) => offsets.map((dj) => ({ di, dj })));
  return neighbors.flatMap(({ di, dj }) =>
    opsUv.map((uv) => compose(translateXy(di, dj), uv)),
  );
};

// The defs + body of ONE seamless cell, authored in the unit-square (uv) frame. Every coset op
// (and its lattice neighbours) stamps the motif, all clipped to the unit cell — so the cell
// holds one complete period for EVERY lattice (the basis skew/scale is carried by the caller:
// patternTransform for the tileable SVG, B⁻¹ in the warp shader). This is the SINGLE source of
// the cell's ink, shared by buildTileableSvg and buildCellSvg, so the warped texture is the
// same cell the tile export emits.
const CELL_CLIP = `<clipPath id="cell-clip" clipPathUnits="userSpaceOnUse"><rect x="0" y="0" width="1" height="1"/></clipPath>`;

// The depth-sorted stamp body of one overlap-composited layer (shared painter's order
// with the gallery renderer via overlapDepth), clipped to the unit cell.
const overlapLayerBody = (
  basis: { a: Vec2; b: Vec2 },
  opsInCellXy: Affine2D[],
  motifSvg: string,
  depthRotationDeg: number,
  reach: number,
): string => {
  const B = basisToMatrix(basis);
  const ordered = [...cellStampTransforms(basis, opsInCellXy, reach)].sort(
    (p, q) =>
      overlapDepth(stampCentre(B, p), depthRotationDeg) -
      overlapDepth(stampCentre(B, q), depthRotationDeg),
  );
  return (
    `<g clip-path="url(#cell-clip)">` +
    ordered
      .map((uv) => `<g transform="${toSvgMatrix(uv)}">${motifSvg}</g>`)
      .join('') +
    `</g>`
  );
};

const buildCellLayers = (
  geometry: TileableGeometry,
): { defs: string; body: string } => {
  const { basis, opsInCellXy, motifSvg, regionXy, motifLayer } = geometry;

  const B = basisToMatrix(basis);
  const stamps = cellStampTransforms(basis, opsInCellXy);

  // A drawn motif's overlap layer bakes on top of whatever the base layer is.
  const overlapExtra = geometry.overlapMotifSvg
    ? overlapLayerBody(
        basis,
        opsInCellXy,
        geometry.overlapMotifSvg,
        geometry.overlapDepthRotationDeg ?? 0,
        geometry.overlapReach ?? 1,
      )
    : '';

  if (motifLayer === 'overlap') {
    // Paint back-to-front by the SHARED intrinsic recede depth (engine/render.overlapDepth) so
    // copies stack in exactly the gallery's painter's order — across the 3×3 neighbourhood too,
    // so arcs are continuous across the cell seam.
    const body = overlapLayerBody(
      basis,
      opsInCellXy,
      motifSvg,
      geometry.depthRotationDeg ?? 0,
      1,
    );
    return { defs: CELL_CLIP, body: body + overlapExtra };
  }
  if (motifLayer === 'clip') {
    // Each copy is additionally clipped to its own fundamental region (region in uv =
    // B⁻¹·regionXy) so spill-prone glyphs don't overlap their neighbours.
    const regionUv = applyToPolygon(invert(B), regionXy);
    const frClip = `<clipPath id="fr-clip" clipPathUnits="userSpaceOnUse"><path d="${pointsToPathD(
      regionUv,
    )}"/></clipPath>`;
    const body =
      `<g clip-path="url(#cell-clip)">` +
      stamps
        .map(
          (uv) =>
            `<g clip-path="url(#fr-clip)" transform="${toSvgMatrix(uv)}">${motifSvg}</g>`,
        )
        .join('') +
      `</g>`;
    return { defs: CELL_CLIP + frClip, body: body + overlapExtra };
  }
  // Default: design motifs already sized to their region; stamp the cell orbit, clipped to cell.
  const body =
    `<g clip-path="url(#cell-clip)">` +
    stamps
      .map((uv) => `<g transform="${toSvgMatrix(uv)}">${motifSvg}</g>`)
      .join('') +
    `</g>`;
  return { defs: CELL_CLIP, body: body + overlapExtra };
};

/**
 * Build a seamless, canonical (un-posed) tileable SVG from one cell's geometry. patternTransform
 * is the bare basis matrix — unit scale, no rotation, no user pose — so the downloaded tile is a
 * reusable repeating unit independent of the on-screen sliders. A finite rect (repeats×repeats
 * cells) is filled with the pattern so the file previews as an image; the display size lives in
 * the svg width/height, leaving the pattern geometry exactly periodic.
 *
 * NOTE: a patternTransform carrying a SKEW (hexagonal / oblique lattices) can produce sub-pixel
 * seams in some SVG renderers when the tile is rasterised at certain zooms — a known renderer
 * limitation, not a geometry error; the tile is an exact lattice period.
 */
export const buildTileableSvg = (
  geometry: TileableGeometry,
  options: TileableOptions = {},
): string => {
  const { basis } = geometry;
  const background = options.background ?? 'white';
  const repeats = options.repeats ?? 8;
  const targetPx = options.targetPx ?? 1024;

  const B = basisToMatrix(basis);
  const { defs, body } = buildCellLayers(geometry);

  // viewBox = bounding box of an N×N block of cells, so the finite preview shows several
  // repeats at the motif's native size. Display scale lives in svg width/height (presentation
  // only) so patternTransform stays EXACTLY the basis — the proof that the tile is a period.
  const cornerIJ = [
    { i: 0, j: 0 },
    { i: repeats, j: 0 },
    { i: 0, j: repeats },
    { i: repeats, j: repeats },
  ];
  const cornersXy = cornerIJ.map(({ i, j }) => ({
    x: i * basis.a.x + j * basis.b.x,
    y: i * basis.a.y + j * basis.b.y,
  }));
  const xs = cornersXy.map((p) => p.x);
  const ys = cornersXy.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const vbW = Math.max(...xs) - minX;
  const vbH = Math.max(...ys) - minY;
  const longest = Math.max(vbW, vbH) || 1;
  const px = (v: number): number => round((v * targetPx) / longest);

  const patternMatrix = toSvgMatrix(B);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${round(
    minX,
  )} ${round(minY)} ${round(vbW)} ${round(vbH)}" width="${px(vbW)}" height="${px(
    vbH,
  )}"><defs><pattern id="tile" patternUnits="userSpaceOnUse" width="1" height="1" patternTransform="${patternMatrix}">${body}</pattern>${defs}</defs><rect x="${round(
    minX,
  )}" y="${round(minY)}" width="${round(vbW)}" height="${round(
    vbH,
  )}" fill="url(#tile)"/></svg>`;

  return withBackground(svg, background);
};

// ── Seamless single-cell SVG (Möbius texture source) ─────────────────────────

/**
 * The ONE seamless cell, drawn in the unit-square (uv) frame as a standalone SVG with
 * viewBox="0 0 1 1". This is the texture source for the Möbius (WebGL) mode: rasterised to an
 * N×N image and REPEAT-wrapped, it reproduces the lattice exactly, with the basis skew/scale
 * applied separately in the shader (B⁻¹·z). It reuses buildCellLayers — the SAME ink the
 * tileable <pattern> stamps — so the warped texture equals the exported tile's cell.
 *
 * No basis is baked in (that is the point: uv is the square the shader samples). Display size
 * lives only in width/height; the geometry stays the unit square.
 */
export const buildCellSvg = (
  geometry: TileableGeometry,
  options: { background?: ExportBackground; targetPx?: number } = {},
): string => {
  const background = options.background ?? 'white';
  const targetPx = options.targetPx ?? 1024;
  const { defs, body } = buildCellLayers(geometry);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="${targetPx}" height="${targetPx}">` +
    (defs ? `<defs>${defs}</defs>` : '') +
    body +
    `</svg>`;
  return withBackground(svg, background);
};

// ── Adapters: collect canonical tile geometry for each app mode ───────────────

const PROBE_VIEWPORT: Rect = { x: 0, y: 0, width: 1, height: 1 };
const IDENTITY_POSE: Pose = { scale: 1, rotationDeg: 0, translate: { x: 0, y: 0 } };

/** Gallery mode: a tileable SVG for one authored template. */
export const tileableFromTemplate = (
  template: UnitTemplate,
  options?: TileableOptions,
): string => {
  const motifSvg = motifs[template.motifId];
  if (!motifSvg) throw new Error(`Unknown motifId: ${template.motifId}`);
  const { opsInCellXy, basis, regionXy } = tile({
    template,
    viewport: PROBE_VIEWPORT,
    pose: IDENTITY_POSE,
  });
  return buildTileableSvg(
    {
      basis,
      opsInCellXy,
      regionXy,
      motifSvg,
      motifLayer: template.motifLayer,
      depthRotationDeg: template.defaultPose?.rotationDeg ?? 0,
    },
    options,
  );
};

/** Switcher / Draw mode: a tileable SVG for a group (+ optional user/preset motif). */
export const tileableFromGroup = (
  group: string,
  motif: GalleryMotif | undefined,
  options?: TileableOptions,
): string => {
  const r = motif
    ? placeUserMotif(group as WallpaperGroup, motif)
    : renderableByGroup().get(group as WallpaperGroup);
  if (!r) return '';
  const { opsInCellXy, basis, regionXy } = tile({
    template: r.template,
    viewport: PROBE_VIEWPORT,
    pose: IDENTITY_POSE,
  });
  return buildTileableSvg(
    {
      basis,
      opsInCellXy,
      regionXy,
      motifSvg: r.motifSvg,
      motifLayer: r.template.motifLayer ?? 'clip',
      depthRotationDeg: r.template.defaultPose?.rotationDeg ?? 0,
      overlapMotifSvg: r.overlapMotifSvg,
      overlapReach: r.overlapReach,
      overlapDepthRotationDeg: r.overlapDepthRotationDeg,
    },
    options,
  );
};

// ── Cell-source adapters for the Möbius texture (cell SVG + the basis B) ───────
// The shader needs both the rasterised cell and B (to reduce world z → frac(B⁻¹·z)). These
// mirror the tileable adapters above but emit the bare cell instead of the <pattern> wrapper.

// The CANONICAL (un-posed) basis. The warp must NOT bake the per-template defaultPose — the
// gallery MAIN VIEW (what the user compares against) uses the live global pose, not defaultPose.
// The live view rotation is applied downstream by WarpPane (lattice.rotateBasis) so warp-empty
// tracks the main view; baking defaultPose here rotated seigaiha 210° away from it.
export type CellSource = { cellSvg: string; basis: { a: Vec2; b: Vec2 } };

/** Gallery mode: the seamless cell + basis for one authored template. */
export const cellFromTemplate = (
  template: UnitTemplate,
  options?: { background?: ExportBackground; targetPx?: number },
): CellSource => {
  const motifSvg = motifs[template.motifId];
  if (!motifSvg) throw new Error(`Unknown motifId: ${template.motifId}`);
  const { opsInCellXy, basis, regionXy } = tile({
    template,
    viewport: PROBE_VIEWPORT,
    pose: IDENTITY_POSE,
  });
  return {
    cellSvg: buildCellSvg(
      {
        basis,
        opsInCellXy,
        regionXy,
        motifSvg,
        motifLayer: template.motifLayer,
        depthRotationDeg: template.defaultPose?.rotationDeg ?? 0,
      },
      options,
    ),
    basis,
  };
};

/** Switcher / Draw mode: the seamless cell + basis for a group (+ optional user/preset motif). */
export const cellFromGroup = (
  group: string,
  motif: GalleryMotif | undefined,
  options?: { background?: ExportBackground; targetPx?: number },
): CellSource | null => {
  const r = motif
    ? placeUserMotif(group as WallpaperGroup, motif)
    : renderableByGroup().get(group as WallpaperGroup);
  if (!r) return null;
  const { opsInCellXy, basis, regionXy } = tile({
    template: r.template,
    viewport: PROBE_VIEWPORT,
    pose: IDENTITY_POSE,
  });
  return {
    cellSvg: buildCellSvg(
      {
        basis,
        opsInCellXy,
        regionXy,
        motifSvg: r.motifSvg,
        motifLayer: r.template.motifLayer ?? 'clip',
        depthRotationDeg: r.template.defaultPose?.rotationDeg ?? 0,
        overlapMotifSvg: r.overlapMotifSvg,
        overlapReach: r.overlapReach,
        overlapDepthRotationDeg: r.overlapDepthRotationDeg,
      },
      options,
    ),
    basis,
  };
};

// ── Export actions: one named function per download button ────────────────────
// Each button's action is a pure ExportState → SVG function, so the wiring is unambiguous
// (the two targets are STRUCTURALLY different — see export.test.ts) and can't silently swap.

export type ExportState = {
  // The pattern exactly as displayed: current pose, the actual viewport rect, overlays as
  // toggled on screen. The snapshot target operates on THIS string — it is not re-derived.
  displaySvg: string;
  includeGuides: boolean;
  // Geometry for the canonical (un-posed) tileable build.
  mode: 'gallery' | 'switch' | 'draw';
  template?: UnitTemplate;
  group: string;
  motif?: GalleryMotif;
  // Shared.
  background: ExportBackground;
};

/**
 * SNAPSHOT action — the CURRENT on-screen pattern (current scale/rotation, actual viewport,
 * as-displayed pose), with the teaching overlays stripped (unless guides are requested) and
 * the backdrop painted. NOT a <pattern>/canonical tile.
 */
export const snapshotExportSvg = (s: ExportState): string => {
  if (!s.displaySvg) return '';
  const clean = s.includeGuides ? s.displaySvg : stripOverlays(s.displaySvg);
  return withBackground(clean, s.background);
};

/**
 * TILEABLE action — a canonical (un-posed) single repeating unit: one <pattern> with
 * patternTransform = basis. Ignores the user pose and viewport by design.
 */
export const tileableExportSvg = (s: ExportState): string => {
  const options = { background: s.background };
  if (s.mode === 'gallery') {
    return s.template ? tileableFromTemplate(s.template, options) : '';
  }
  return tileableFromGroup(
    s.group,
    s.mode === 'draw' ? s.motif : undefined,
    options,
  );
};
