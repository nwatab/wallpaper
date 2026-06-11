'use client';

import React, { useMemo, useRef, useState } from 'react';
import type { Affine2D, DebugOptions, Vec2, WallpaperGroup } from '@/wallpaper/types';
import { applyToPoint } from '@/wallpaper/affine';
import {
  type GalleryMotif,
  type Stroke,
  type Fill,
} from '@/wallpaper/galleryMotifs';
import { getGroup } from '@/wallpaper/groups';
import {
  foldFillUv,
  foldLatticeWindow,
  foldShapeUv,
} from '@/wallpaper/draw/foldIntoRegion';
import { snapTargetsUv, snapToTargets } from '@/wallpaper/draw/snapTargets';
import { renderRegionPreview } from '@/wallpaper/switch/renderSwitch';

// ─────────────────────────────────────────────────────────────────────────────
// DRAW PANE (M2). A fixed, un-posed view of one fundamental region (true XY geometry)
// where the user draws in the toggle-set's REFERENCE frame. The committed drawing tiles
// — with the group's symmetry overlay and the same motifLayer:'clip' policy as the
// wallpaper (renderRegionPreview) — so each mark is seen reflected/rotated. The live
// in-progress stroke is previewed cheaply on an overlay (with its immediate orbit under
// the cell ops) without re-tiling, so drawing stays responsive; the full re-tile happens
// only on commit (pointer up).
//
// Captured geometry is stored as a GalleryMotif in reference-frame uv — the same data the
// engine consumes — so a drawing is just a new SOURCE of the verified pipeline.
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS = { width: 360, height: 360, padding: 28 };
const MAX_PEN_POINTS = 480;
const MIN_STEP_PX = 3; // min canvas-px distance between captured pen samples
const SNAP_PX = 12; // snap radius, in internal canvas px

type Tool = 'pen' | 'line' | 'rect' | 'ellipse' | 'circle';

// Canvas window: which uv neighbourhood the canvas shows. 'region' (the fundamental
// region's bbox, the original close-up) for single-unit detail; 'cell' / '2×2' zoom out
// so one gesture can span copy and cell boundaries (a multi-cell arc folds into the
// unit just like any stroke — the fold's lattice window is derived from the window).
type Zoom = 'region' | 'cell' | 'cell4';

const ZOOMS: { id: Zoom; label: string }[] = [
  { id: 'region', label: 'Region' },
  { id: 'cell', label: 'Cell' },
  { id: 'cell4', label: '2×2' },
];

// The fitted uv polygon per zoom (undefined ⇒ the region itself, the default fit).
// 2×2 is centred on the home cell so the unit stays in the middle of the canvas.
const zoomWindowUv = (zoom: Zoom): Vec2[] | undefined =>
  zoom === 'cell'
    ? [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ]
    : zoom === 'cell4'
      ? [
          { x: -0.5, y: -0.5 },
          { x: 1.5, y: -0.5 },
          { x: 1.5, y: 1.5 },
          { x: -0.5, y: 1.5 },
        ]
      : undefined;

const PALETTE = ['#1c3f7a', '#2f6fb0', '#b5402a', '#1f7a52', '#222222'];

const hasInk = (m: GalleryMotif): boolean =>
  (m.fills?.length ?? 0) > 0 || (m.strokes?.length ?? 0) > 0;

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

// Axis-aligned (in uv) rectangle / ellipse polygon between two corner points.
const rectPts = (a: Vec2, b: Vec2): Vec2[] => [
  { x: a.x, y: a.y },
  { x: b.x, y: a.y },
  { x: b.x, y: b.y },
  { x: a.x, y: b.y },
];

const ellipsePts = (a: Vec2, b: Vec2, n = 28): Vec2[] => {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
  });
};

// A true circle in XY through the canvas px frame (the canvas is a similarity of XY —
// a uv "circle" would render as an ellipse on the skewed lattices), centre→radius-point.
// With snapped anchors, "concentric arcs about a lattice point" is exact by construction.
const circlePts = (
  centre: Vec2,
  edge: Vec2,
  toCanvas: Affine2D,
  toUv: Affine2D,
  n = 48,
): Vec2[] => {
  const cPx = applyToPoint(toCanvas, centre);
  const ePx = applyToPoint(toCanvas, edge);
  const r = Math.hypot(ePx.x - cPx.x, ePx.y - cPx.y);
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return applyToPoint(toUv, {
      x: cPx.x + r * Math.cos(t),
      y: cPx.y + r * Math.sin(t),
    });
  });
};

const pathD = (pts: Vec2[], closed: boolean): string =>
  pts.length === 0
    ? ''
    : `M ${pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')}` +
      (closed ? ' Z' : '');

export type DrawPaneProps = {
  // The toggle-set reference group (the stable frame the user draws in).
  referenceGroup: string;
  motif: GalleryMotif;
  onMotifChange: (m: GalleryMotif) => void;
  showSymmetryElements: boolean;
  // Region (pink) / Bravais-lattice overlays — same options as the wallpaper.
  debugOptions?: DebugOptions;
};

export default function DrawPane({
  referenceGroup,
  motif,
  onMotifChange,
  showSymmetryElements,
  debugOptions,
}: DrawPaneProps) {
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(PALETTE[0]);
  const [width, setWidth] = useState(0.04);
  const [fillMode, setFillMode] = useState(false);
  const [snapOn, setSnapOn] = useState(true);
  const [zoom, setZoom] = useState<Zoom>('region');
  const [draft, setDraft] = useState<Vec2[] | null>(null);

  const drawing = useRef(false);
  const history = useRef<GalleryMotif[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  // The preview (tiled, clipped, with symmetry overlay) + the px↔uv affines.
  const preview = useMemo(
    () =>
      renderRegionPreview({
        group: referenceGroup,
        motif,
        canvas: CANVAS,
        windowUv: zoomWindowUv(zoom),
        showSymmetryElements,
        debugOptions,
      }),
    [referenceGroup, motif, zoom, showSymmetryElements, debugOptions],
  );

  // Cell ops (reference uv) for the live draft reflections.
  const cellOps = useMemo(
    () => getGroup(referenceGroup as WallpaperGroup).cosetReps,
    [referenceGroup],
  );

  const toUv = preview.toUv;
  const toCanvas = preview.toCanvas;

  // The uv window the canvas can reach (its corners through toUv) — the domain the
  // snap targets and the fold's lattice window are derived over.
  const uvWindow = useMemo(() => {
    const corners = [
      { x: 0, y: 0 },
      { x: CANVAS.width, y: 0 },
      { x: CANVAS.width, y: CANVAS.height },
      { x: 0, y: CANVAS.height },
    ].map((p) => applyToPoint(toUv, p));
    return {
      min: {
        x: Math.min(...corners.map((p) => p.x)),
        y: Math.min(...corners.map((p) => p.y)),
      },
      max: {
        x: Math.max(...corners.map((p) => p.x)),
        y: Math.max(...corners.map((p) => p.y)),
      },
    };
  }, [toUv]);

  // Snap targets (lattice points / rotation centres / mirror axes / unit vertices)
  // over the canvas window. Memoised per (group, window) inside snapTargetsUv, so
  // this recompute on commit is a cache hit.
  const snapTargets = useMemo(
    () =>
      snapTargetsUv({
        group: referenceGroup as WallpaperGroup,
        basis: preview.basis,
        window: uvWindow,
      }),
    [referenceGroup, preview.basis, uvWindow],
  );

  // Candidate lattice window for the fold — wide enough for whatever the current
  // canvas window can reach (zoomed-out windows need more than the ±2 baseline).
  const latticeWindow = useMemo(
    () => foldLatticeWindow(referenceGroup as WallpaperGroup, uvWindow),
    [referenceGroup, uvWindow],
  );

  // Pen sampling density is px-based (MIN_STEP_PX on the canvas), so zooming out
  // keeps strokes smooth instead of stretching a fixed uv step.
  const minStepUv = useMemo(() => {
    const sx = Math.hypot(toCanvas.a, toCanvas.b);
    const sy = Math.hypot(toCanvas.c, toCanvas.d);
    return MIN_STEP_PX / Math.max(sx, sy);
  }, [toCanvas]);

  // Pointer → internal canvas coords (handles CSS scaling of the fixed-size svg).
  const pointerCanvas = (e: React.PointerEvent): Vec2 => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS.width,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS.height,
    };
  };
  const pointerUv = (e: React.PointerEvent): Vec2 =>
    applyToPoint(toUv, pointerCanvas(e));
  // Anchor positions (stroke starts, shape corners, circle centre/radius) snap;
  // freehand pen SAMPLES stay raw so the pen never feels sticky mid-stroke.
  const pointerUvSnapped = (e: React.PointerEvent): Vec2 => {
    const raw = pointerUv(e);
    if (!snapOn) return raw;
    return (
      snapToTargets({ uv: raw, targets: snapTargets, toCanvas, radiusPx: SNAP_PX })
        ?.uv ?? raw
    );
  };


  const commit = (next: GalleryMotif) => {
    history.current.push(motif);
    onMotifChange(next);
  };

  // Fold the gesture into the asymmetric unit (kaleidoscope capture): the stored motif
  // must live inside the unit (the renderer clips each orbit copy to its region), and
  // folding — rather than clipping — keeps ink drawn anywhere on the canvas visible
  // exactly where it was drawn. One gesture may fold into several pieces; it stays a
  // single commit so Undo removes it atomically.
  const commitShape = (pts: Vec2[]) => {
    if (pts.length < 2) return;
    const closed = tool === 'rect' || tool === 'ellipse' || tool === 'circle';
    const group = referenceGroup as WallpaperGroup;
    if (closed && fillMode) {
      const fills: Fill[] = foldFillUv(pts, group, latticeWindow).map((pp) => ({
        pts: pp,
        color,
      }));
      if (fills.length === 0) return;
      commit({ ...motif, fills: [...(motif.fills ?? []), ...fills] });
    } else {
      const strokes: Stroke[] = foldShapeUv(pts, closed, group, latticeWindow).map((s) => ({
        pts: s.pts,
        width,
        color,
        closed: s.closed,
      }));
      if (strokes.length === 0) return;
      commit({ ...motif, strokes: [...(motif.strokes ?? []), ...strokes] });
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    svgRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    setDraft([pointerUvSnapped(e)]);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const p = tool === 'pen' ? pointerUv(e) : pointerUvSnapped(e);
    setDraft((prev) => {
      if (!prev) return [p];
      if (tool === 'pen') {
        const last = prev[prev.length - 1];
        if (prev.length >= MAX_PEN_POINTS || dist(last, p) < minStepUv) return prev;
        return [...prev, p];
      }
      // line / rect / ellipse / circle: anchor + moving endpoint
      return [prev[0], p];
    });
  };

  const onPointerUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const d = draft;
    setDraft(null);
    if (!d || d.length === 0) return;
    if (tool === 'pen' || tool === 'line') {
      commitShape(d);
    } else if (d.length >= 2) {
      const pts =
        tool === 'rect'
          ? rectPts(d[0], d[1])
          : tool === 'circle'
            ? circlePts(d[0], d[1], toCanvas, toUv)
            : ellipsePts(d[0], d[1]);
      commitShape(pts);
    }
  };

  const undo = () => {
    const prev = history.current.pop();
    if (prev) onMotifChange(prev);
  };
  const clear = () => {
    if (!hasInk(motif)) return;
    history.current.push(motif);
    onMotifChange({});
  };

  // Draft geometry in canvas coords: the in-progress shape + its immediate orbit under
  // the cell ops, so reflections appear live without a re-tile.
  const draftCanvasPaths = useMemo(() => {
    if (!draft || draft.length === 0) return [];
    const closed = tool === 'rect' || tool === 'ellipse' || tool === 'circle';
    const draftUv =
      tool === 'pen' || tool === 'line'
        ? draft
        : draft.length >= 2
          ? tool === 'rect'
            ? rectPts(draft[0], draft[1])
            : tool === 'circle'
              ? circlePts(draft[0], draft[1], toCanvas, toUv)
              : ellipsePts(draft[0], draft[1])
          : draft;
    const mapPts = (pts: Vec2[], op?: Affine2D): Vec2[] =>
      pts.map((p) => applyToPoint(toCanvas, op ? applyToPoint(op, p) : p));
    // The drawn shape (solid) plus orbit copies (faint), to show reflection/rotation.
    return [
      { d: pathD(mapPts(draftUv), closed), faint: false },
      ...cellOps
        .slice(1)
        .map((op) => ({ d: pathD(mapPts(draftUv, op), closed), faint: true })),
    ];
  }, [draft, tool, toCanvas, toUv, cellOps]);

  const TOOLS: { id: Tool; label: string }[] = [
    { id: 'pen', label: '✎ Pen' },
    { id: 'line', label: '╱ Line' },
    { id: 'rect', label: '▭ Rect' },
    { id: 'ellipse', label: '◯ Ellipse' },
    { id: 'circle', label: '◎ Circle' },
  ];

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTool(t.id)}
            aria-pressed={tool === t.id}
            className={`rounded px-2 py-1 text-[11px] transition-colors ${
              tool === t.id
                ? 'bg-white/90 text-black'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            {t.label}
          </button>
        ))}
        {/* Canvas window: zoom between the region close-up and multi-cell views. */}
        <div className="ml-auto flex items-center gap-0.5 rounded bg-white/6 p-0.5">
          {ZOOMS.map((z) => (
            <button
              key={z.id}
              type="button"
              onClick={() => setZoom(z.id)}
              aria-pressed={zoom === z.id}
              title="canvas window — how many cells the canvas shows"
              className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                zoom === z.id
                  ? 'bg-white/90 text-black'
                  : 'text-white/70 hover:bg-white/15'
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`colour ${c}`}
              aria-pressed={color === c}
              style={{ background: c }}
              className={`h-5 w-5 rounded-full border ${
                color === c ? 'border-white' : 'border-white/30'
              }`}
            />
          ))}
        </div>
        <label className="flex items-center gap-1 text-[11px] opacity-80">
          w
          <input
            type="range"
            min={0.02}
            max={0.09}
            step={0.005}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="w-16 cursor-pointer accent-white"
          />
        </label>
        <label className="flex items-center gap-1 text-[11px] opacity-80">
          <input
            type="checkbox"
            checked={fillMode}
            onChange={(e) => setFillMode(e.target.checked)}
          />
          fill
        </label>
        <button
          type="button"
          onClick={() => setSnapOn((s) => !s)}
          aria-pressed={snapOn}
          title="snap anchors to lattice points, rotation centres and mirror axes"
          className={`rounded px-2 py-1 text-[11px] transition-colors ${
            snapOn
              ? 'bg-white/90 text-black'
              : 'bg-white/10 text-white/80 hover:bg-white/20'
          }`}
        >
          ⌖ Snap
        </button>
        <button
          type="button"
          onClick={undo}
          className="rounded px-2 py-1 text-[11px] bg-white/10 text-white/80 hover:bg-white/20"
        >
          ↶ Undo
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded px-2 py-1 text-[11px] bg-white/10 text-white/80 hover:bg-white/20"
        >
          ✕ Clear
        </button>
      </div>

      {/* Drawing surface: preview (tiled + symmetry) behind, capture overlay on top */}
      <div
        className="relative rounded-lg overflow-hidden bg-white ring-1 ring-white/20"
        style={{ width: '100%', aspectRatio: '1 / 1' }}
      >
        <div
          className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: preview.svg }}
        />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
          className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {draftCanvasPaths.map((p, i) => (
            <path
              key={i}
              d={p.d}
              fill={fillMode && (tool === 'rect' || tool === 'ellipse') ? color : 'none'}
              stroke={color}
              strokeOpacity={p.faint ? 0.35 : 0.9}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
