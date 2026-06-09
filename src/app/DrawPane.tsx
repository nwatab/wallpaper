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
const MAX_PEN_POINTS = 240;
const MIN_STEP = 0.006; // min uv distance between captured pen samples

type Tool = 'pen' | 'line' | 'rect' | 'ellipse';

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
        showSymmetryElements,
        debugOptions,
      }),
    [referenceGroup, motif, showSymmetryElements, debugOptions],
  );

  // Cell ops (reference uv) for the live draft reflections.
  const cellOps = useMemo(
    () => getGroup(referenceGroup as WallpaperGroup).cosetReps,
    [referenceGroup],
  );

  const toUv = preview.toUv;
  const toCanvas = preview.toCanvas;

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

  const commit = (next: GalleryMotif) => {
    history.current.push(motif);
    onMotifChange(next);
  };

  const commitShape = (pts: Vec2[]) => {
    if (pts.length < 2) return;
    const closed = tool === 'rect' || tool === 'ellipse';
    if (closed && fillMode) {
      const fill: Fill = { pts, color };
      commit({ ...motif, fills: [...(motif.fills ?? []), fill] });
    } else {
      const stroke: Stroke = { pts, width, color, closed };
      commit({ ...motif, strokes: [...(motif.strokes ?? []), stroke] });
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    svgRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    setDraft([pointerUv(e)]);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const p = pointerUv(e);
    setDraft((prev) => {
      if (!prev) return [p];
      if (tool === 'pen') {
        const last = prev[prev.length - 1];
        if (prev.length >= MAX_PEN_POINTS || dist(last, p) < MIN_STEP) return prev;
        return [...prev, p];
      }
      // line / rect / ellipse: anchor + moving endpoint
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
      const pts = tool === 'rect' ? rectPts(d[0], d[1]) : ellipsePts(d[0], d[1]);
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
    const closed = tool === 'rect' || tool === 'ellipse';
    const draftUv =
      tool === 'pen' || tool === 'line'
        ? draft
        : draft.length >= 2
          ? tool === 'rect'
            ? rectPts(draft[0], draft[1])
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
  }, [draft, tool, toCanvas, cellOps]);

  const TOOLS: { id: Tool; label: string }[] = [
    { id: 'pen', label: '✎ Pen' },
    { id: 'line', label: '╱ Line' },
    { id: 'rect', label: '▭ Rect' },
    { id: 'ellipse', label: '◯ Ellipse' },
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
