// ─────────────────────────────────────────────────────────────────────────────
// LATTICE-FRAME OVERLAY — a debug observation tool for the Warp (not part of the render path).
//
// It draws the warp's lattice basis a (red) / b (blue), the unit cell, and a CHIRAL corner
// marker, in SCREEN space using the SAME conventions the GL view uses (rotation baked into the
// basis like the shader; world→screen y-DOWN, matching how both the SVG gallery and a
// correctly-parity'd GL pattern display). So if the GL pipeline is faithful, this overlay lines
// up with the rendered pattern's lattice. If the pattern is sheared/rotated/MIRRORED relative to
// this frame, the discrepancy is visible directly — a reflection shows as the pattern's cells
// running opposite-handed to the drawn a→b corner marker.
// ─────────────────────────────────────────────────────────────────────────────

import type { Vec2 } from '../types';
import { rotateBasis } from './lattice';

const OFFSETS = [-1, 0, 1];

/**
 * SVG markup for the lattice frame at the given canvas size. The cell is drawn at ~28% of the
 * shorter side, centred, with a 3×3 faint neighbourhood so the lattice reads clearly. Pure.
 */
export const latticeFrameSvg = (
  basis: { a: Vec2; b: Vec2 },
  rotationDeg: number,
  width: number,
  height: number,
): string => {
  if (width <= 0 || height <= 0) return '';
  const B = rotateBasis(basis, rotationDeg); // rotation in the basis, exactly like WarpPane
  const cx = width / 2;
  const cy = height / 2;
  const s = Math.min(width, height) * 0.28;

  // Screen position of the lattice point (i,j) plus fractional cell coords (u,v). y-DOWN: SVG/screen
  // y grows downward (screen y = cy + fy·s), matching the gallery and the parity-correct GL view —
  // so basis b=(cosγ,sinγ) reads DOWN-right exactly as the rendered pattern places it. (A `cy − fy·s`
  // here draws the frame y-UP, which only lined up with the OLD y-flip-buggy warp; see warp-parity.)
  const pt = (i: number, j: number, u = 0, v = 0): Vec2 => {
    const fx = (i + u) * B.a.x + (j + v) * B.b.x;
    const fy = (i + u) * B.a.y + (j + v) * B.b.y;
    return { x: cx + fx * s, y: cy + fy * s };
  };
  const L = (p: Vec2, q: Vec2, stroke: string, w: number, opacity = 1) =>
    `<line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}" stroke="${stroke}" stroke-width="${w}" stroke-opacity="${opacity}"/>`;

  // Faint 3×3 cell grid.
  const grid = OFFSETS.flatMap((i) =>
    OFFSETS.map((j) => {
      const o = pt(i, j);
      const a = pt(i, j, 1, 0);
      const ab = pt(i, j, 1, 1);
      const b = pt(i, j, 0, 1);
      return (
        L(o, a, '#ffffff', 1, 0.25) +
        L(a, ab, '#ffffff', 1, 0.25) +
        L(ab, b, '#ffffff', 1, 0.25) +
        L(b, o, '#ffffff', 1, 0.25)
      );
    }),
  ).join('');

  // Highlighted central cell: chiral corner marker + a (red) and b (blue) vectors.
  const o = pt(0, 0);
  const a = pt(0, 0, 1, 0);
  const b = pt(0, 0, 0, 1);
  const ca = pt(0, 0, 0.3, 0);
  const cb = pt(0, 0, 0, 0.3);
  const marker = `<polygon points="${o.x.toFixed(1)},${o.y.toFixed(1)} ${ca.x.toFixed(1)},${ca.y.toFixed(1)} ${cb.x.toFixed(1)},${cb.y.toFixed(1)}" fill="rgba(255,255,255,0.3)"/>`;
  const aArrow = L(o, a, '#e5484d', 3);
  const bArrow = L(o, b, '#3b82f6', 3);
  const dot = `<circle cx="${o.x.toFixed(1)}" cy="${o.y.toFixed(1)}" r="3" fill="#ffffff"/>`;
  const aLabel = `<text x="${a.x.toFixed(1)}" y="${a.y.toFixed(1)}" fill="#e5484d" font-size="14" font-family="monospace">a</text>`;
  const bLabel = `<text x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" fill="#3b82f6" font-size="14" font-family="monospace">b</text>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    grid +
    marker +
    aArrow +
    bArrow +
    dot +
    aLabel +
    bLabel +
    `</svg>`
  );
};
