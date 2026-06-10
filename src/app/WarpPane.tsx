'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  createWarpRenderer,
  type WarpRenderer,
} from '@/wallpaper/conformal/glRenderer';
import { inverseBasis2, rotateBasis } from '@/wallpaper/conformal/lattice';
import { latticeFrameSvg } from '@/wallpaper/conformal/latticeOverlay';
import type { Card } from '@/wallpaper/conformal/primitives';
import type { Vec2 } from '@/wallpaper/types';

// Scale slider (20–400) → world half-extent on the longer screen axis. Larger scale = more
// zoom = smaller world window. K chosen so the default (120) frames several unit cells.
const HALF_EXTENT_K = 360;

// Default framing offset (fraction of the half-extent): nudge the world origin off screen
// centre so a pole/singularity at the origin (e.g. inversion, exp) does not sit dead-centre as
// a flat mip blur — it reads cleaner slightly off to one side.
const CENTER_OFFSET = 0.4;

// White, opaque — matches the SVG export's white default (patterns rely on white showing
// through) and keeps the warped pattern readable. Also the pole / singularity colour.
const BACKGROUND: [number, number, number, number] = [1, 1, 1, 1];

type Props = {
  cellSvg: string;
  basis: { a: Vec2; b: Vec2 };
  cards: Card[];
  scale: number;
  rotationDeg: number;
  // Debug: overlay the lattice basis frame (a/b vectors + chiral marker) so a shear/rotation/
  // reflection in the GL render shows directly as the pattern diverging from the drawn frame.
  showLattice?: boolean;
};

export default function WarpPane({
  cellSvg,
  basis,
  cards,
  scale,
  rotationDeg,
  showLattice = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WarpRenderer | null>(null);
  const textureReadyRef = useRef(false);
  // Always points at the latest drawNow so the mount-time ResizeObserver redraws with current
  // props (not the closure captured on first render).
  const drawRef = useRef<() => void>(() => {});
  const [unsupported, setUnsupported] = useState(false);
  const [cssSize, setCssSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Create the renderer once, wire a ResizeObserver, tear down on unmount.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: WarpRenderer | null = null;
    try {
      renderer = createWarpRenderer(canvas);
    } catch {
      renderer = null;
    }
    if (!renderer) {
      setUnsupported(true);
      return;
    }
    rendererRef.current = renderer;

    const ro = new ResizeObserver(() => {
      const r = rendererRef.current;
      if (!r) return;
      const dpr = window.devicePixelRatio || 1;
      r.resize(canvas.clientWidth, canvas.clientHeight, dpr);
      setCssSize({ w: canvas.clientWidth, h: canvas.clientHeight });
      if (textureReadyRef.current) drawRef.current();
    });
    ro.observe(canvas);
    setCssSize({ w: canvas.clientWidth, h: canvas.clientHeight });

    return () => {
      ro.disconnect();
      renderer?.dispose();
      rendererRef.current = null;
      textureReadyRef.current = false;
    };
  }, []);

  // Draw with the CURRENT props. Pulled out so the texture-load and the param effects both
  // call the same path. Reads refs + the latest props in scope (re-created each render).
  const drawNow = () => {
    const renderer = rendererRef.current;
    if (!renderer || !textureReadyRef.current) return;
    const canvas = canvasRef.current;
    // Sync the internal buffer to the CURRENT display box BEFORE drawing. The GL math is
    // isotropic only if the canvas buffer aspect == its CSS-displayed aspect; if the box
    // changed since the last ResizeObserver fire (or the buffer is still the 300×150 default),
    // the browser CSS-stretches the buffer anisotropically — non-rectangular lattices then
    // skew (b's angle distorts) while a stays horizontal. Resizing here makes buffer==display
    // every frame, so the displayed pattern is isotropic.
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      renderer.resize(canvas.clientWidth, canvas.clientHeight, dpr);
    }
    // Density match (secondary): the gallery's pose scale = px per cell, so it shows
    // shorterPx/scale cells across; with the cell ≈ 1 world unit the warp matches at world
    // half-extent = shorterPx/(2·scale). Falls back to the fixed constant if size unknown.
    const shorter = canvas
      ? Math.min(canvas.clientWidth, canvas.clientHeight)
      : 0;
    const half = (shorter > 0 ? shorter / 2 : HALF_EXTENT_K) / Math.max(1, scale);
    // Rotate the BASE lattice by the LIVE rotation (gallery-pose sense), so warp-empty
    // matches the gallery main view. Rotation lives in world→uv (the basis), NOT the view
    // frame — the view stays axis-aligned like the gallery's viewport.
    renderer.draw({
      cards,
      invBasis: inverseBasis2(rotateBasis(basis, rotationDeg)),
      view: {
        center: [half * CENTER_OFFSET, half * CENTER_OFFSET],
        half,
        rotationDeg: 0,
      },
      background: BACKGROUND,
    });
  };
  drawRef.current = drawNow;

  // (Re)rasterise the cell to a texture whenever the pattern changes, then draw.
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !cellSvg) return;
    let cancelled = false;
    const blob = new Blob([cellSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        renderer.resize(canvas.clientWidth, canvas.clientHeight, dpr);
      }
      renderer.setPattern(img);
      textureReadyRef.current = true;
      drawNow();
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellSvg]);

  // Redraw on any uniform change. Key on card CONTENT (not array identity) so every edit —
  // including removing the last card (→ empty = identity, u_count=0) — reliably re-fires the
  // GL draw in the same frame, with no stale warped output.
  const cardsKey = JSON.stringify(cards);
  useEffect(() => {
    drawNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardsKey, scale, rotationDeg, basis]);

  if (unsupported) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white text-black/70 text-sm">
        WebGL2 is required for the Warp view and is unavailable in this browser.
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full block" />
      {showLattice && cssSize.w > 0 && (
        <div
          className="absolute inset-0 pointer-events-none"
          dangerouslySetInnerHTML={{
            __html: latticeFrameSvg(basis, rotationDeg, cssSize.w, cssSize.h),
          }}
        />
      )}
    </div>
  );
}
