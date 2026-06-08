import type { Vec2 } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Gallery motifs as GEOMETRY DATA (not raw SVG). Persian / Chinese / porcelain
// geometric line-and-fill designs, each authored in cell-fractional (uv) space to
// span its fundamental region. Storing the geometry — rather than a hand-written SVG
// string plus a separate hand-written feature list — keeps the rendered SVG and the
// maximality test's "ink" derived from ONE source, so they can never drift apart.
//
//   • strokes → drawn as SVG strokes; for the maximality test each segment becomes a
//     thin quad so the inked network (with its chiral negative space) is sampled.
//   • fills   → drawn as filled paths; sampled as their polygon area.
//
// The wallpaper group is imposed by the engine; these motifs only fill the region.
// For the chiral groups (p4, p6, p3) the design carries a deliberate one-handed sweep
// so the pattern does not accidentally acquire a mirror (verified in maximality.test).
// ─────────────────────────────────────────────────────────────────────────────

const v = (x: number, y: number): Vec2 => ({ x, y });

export type Stroke = { pts: Vec2[]; width: number; color: string; closed?: boolean };
export type Fill = { pts: Vec2[]; color: string };
export type GalleryMotif = { fills?: Fill[]; strokes?: Stroke[] };

const STROKE_W = 0.045;

// ── INK COLOURS (porcelain blue-and-white + accents) ────────────────────────────
const INK = '#1c3f7a'; // cobalt line
const INK2 = '#2f6fb0'; // lighter cobalt fill
const ACCENT = '#b5402a'; // iron-red accent

// Polyline / polygon path data.
const pathD = (pts: Vec2[], closed: boolean): string =>
  `M ${pts.map((p) => `${+p.x.toFixed(4)} ${+p.y.toFixed(4)}`).join(' L ')}` +
  (closed ? ' Z' : '');

export const motifToSvg = (m: GalleryMotif): string => {
  const fills = (m.fills ?? []).map(
    (f) => `<path d="${pathD(f.pts, true)}" fill="${f.color}"/>`,
  );
  const strokes = (m.strokes ?? []).map(
    (s) =>
      `<path d="${pathD(s.pts, s.closed ?? false)}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-linejoin="round" stroke-linecap="round"/>`,
  );
  return `<g>${fills.join('')}${strokes.join('')}</g>`;
};

// A stroke segment → thin quad (for area-sampled ink).
const segQuad = (a: Vec2, b: Vec2, w: number): Vec2[] => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w / 2);
  const ny = (dx / len) * (w / 2);
  return [
    v(a.x + nx, a.y + ny),
    v(b.x + nx, b.y + ny),
    v(b.x - nx, b.y - ny),
    v(a.x - nx, a.y - ny),
  ];
};

// All ink polygons of a motif (fills + per-segment stroke quads), for sampleInk().
export const motifInk = (m: GalleryMotif): Vec2[][] => {
  const polys: Vec2[][] = (m.fills ?? []).map((f) => f.pts);
  for (const s of m.strokes ?? []) {
    const n = s.pts.length;
    const last = s.closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      polys.push(segQuad(s.pts[i], s.pts[(i + 1) % n], s.width));
    }
  }
  return polys;
};

// ─────────────────────────────────────────────────────────────────────────────
// THE MOTIFS
// ─────────────────────────────────────────────────────────────────────────────

// #1 p4m — Girih star wedge. Region {4,4,2} triangle (0,0),(0.5,0),(0.5,0.5).
// 1/8 sector of an 8-point star centred at (0,0): radial strap + the star point.
// p4m is the maximal square group, so any fill is automatically maximal.
const girihStar: GalleryMotif = {
  fills: [
    { pts: [v(0, 0), v(0.16, 0.03), v(0.13, 0.13), v(0.03, 0.16)], color: INK2 },
  ],
  strokes: [
    { pts: [v(0.5, 0.5), v(0, 0)], width: STROKE_W, color: INK },
    { pts: [v(0.5, 0), v(0.22, 0.22)], width: STROKE_W, color: INK },
    { pts: [v(0.16, 0.03), v(0.5, 0.18)], width: STROKE_W, color: INK },
    { pts: [v(0.03, 0.16), v(0.36, 0.36)], width: STROKE_W, color: INK },
    { pts: [v(0.32, 0), v(0.5, 0.32)], width: STROKE_W, color: INK },
  ],
};

// #2 p4 — Chinese cracked-ice pinwheel (chiral). Region triangle (0,0),(1,0),(0.5,0.5).
// One handed L-bend of lattice bars: its C4 orbit whirls one way → NO mirror.
const crackedIce: GalleryMotif = {
  strokes: [
    { pts: [v(0.06, 0.04), v(0.78, 0.04), v(0.5, 0.32)], width: STROKE_W, color: INK },
    { pts: [v(0.5, 0.04), v(0.5, 0.2), v(0.28, 0.2)], width: STROKE_W, color: INK },
    { pts: [v(0.2, 0.04), v(0.36, 0.2)], width: STROKE_W, color: INK },
  ],
  fills: [{ pts: [v(0.86, 0.05), v(0.94, 0.05), v(0.7, 0.29)], color: ACCENT }],
};

// #3 p6m — Shamsa rosette wedge. Region {6,2,3} triangle (0,0),(0.5,0),(2/3,1/3).
// 1/12 wedge of a 12-fold rosette at (0,0): radial petal ribs + a filled petal lobe.
const shamsa: GalleryMotif = {
  fills: [
    { pts: [v(0.18, 0.05), v(0.42, 0.18), v(0.3, 0.25), v(0.12, 0.12)], color: INK2 },
  ],
  strokes: [
    { pts: [v(0, 0), v(0.62, 0.31)], width: STROKE_W, color: INK },
    { pts: [v(0.5, 0), v(0.6, 0.2)], width: STROKE_W, color: INK },
    { pts: [v(0.1, 0.02), v(0.5, 0.22)], width: STROKE_W, color: INK },
    { pts: [v(0.5, 0), v(0.18, 0.05)], width: STROKE_W, color: INK },
  ],
};

// #4 pmm — Chinese cloud-meander (回紋) key fret. Region quarter cell [0,0.5]².
// A right-angled Greek key spiral filling the quadrant. Deliberately NOT symmetric
// under the diagonal swap (which would make it 4-fold → p4m). Only the two cell
// mirrors are intended.
const leiwen: GalleryMotif = {
  strokes: [
    {
      pts: [
        v(0.04, 0.46), v(0.04, 0.08), v(0.4, 0.08), v(0.4, 0.34),
        v(0.18, 0.34), v(0.18, 0.2), v(0.3, 0.2),
      ],
      width: STROKE_W,
      color: INK,
    },
    { pts: [v(0.04, 0.46), v(0.46, 0.46)], width: STROKE_W, color: INK },
  ],
  fills: [{ pts: [v(0.42, 0.38), v(0.48, 0.38), v(0.48, 0.46), v(0.42, 0.46)], color: ACCENT }],
};

// #5 p6 — Whirling-blade rosette (chiral). Region 30-30-120 triangle (0,0),(1/3,2/3),(1,1).
// A one-handed comma-blade sweeping toward the apex; the C6 orbit makes a pinwheel
// with NO mirror.
const whirlBlade: GalleryMotif = {
  fills: [
    {
      pts: [v(0.06, 0.08), v(0.34, 0.58), v(0.7, 0.78), v(0.5, 0.5), v(0.2, 0.18)],
      color: INK2,
    },
  ],
  strokes: [
    { pts: [v(0.06, 0.08), v(0.95, 0.97)], width: STROKE_W, color: INK },
    { pts: [v(0.34, 0.62), v(0.66, 0.74)], width: STROKE_W, color: INK },
  ],
};

// #6 cmm — Talavera quatrefoil interlace. Region triangle (0,0),(1,0),(0.5,0.5) on a
// RHOMBIC basis. Interlaced diagonal straps; cmm is maximal for the rhombic lattice.
const quatrefoil: GalleryMotif = {
  fills: [{ pts: [v(0.42, 0.06), v(0.58, 0.06), v(0.5, 0.34)], color: ACCENT }],
  strokes: [
    { pts: [v(0.04, 0.04), v(0.5, 0.4), v(0.96, 0.04)], width: STROKE_W, color: INK },
    { pts: [v(0.24, 0.04), v(0.5, 0.24), v(0.76, 0.04)], width: STROKE_W, color: INK },
    { pts: [v(0.5, 0.04), v(0.5, 0.42)], width: STROKE_W, color: INK },
  ],
};

// #7 p4g — Pinwheel pavement (the basketweave/linoleum tiling). Region {4,2,2}
// triangle (0,0),(0.5,0),(0,0.5). Half of a whirling rectangle: its p4g orbit pinwheels
// the rectangles around the 4-fold centre. NOT symmetric under the centred axial mirror
// (that distinction is exactly p4g vs p4m).
const pinwheel: GalleryMotif = {
  fills: [
    { pts: [v(0.05, 0.05), v(0.45, 0.05), v(0.45, 0.22), v(0.05, 0.22)], color: INK2 },
  ],
  strokes: [
    {
      pts: [v(0.05, 0.05), v(0.45, 0.05), v(0.45, 0.45), v(0.05, 0.45)],
      width: STROKE_W,
      color: INK,
      closed: true,
    },
    { pts: [v(0.05, 0.28), v(0.38, 0.28)], width: STROKE_W, color: INK },
  ],
};

// #8 p3 — Seljuk trefoil knot (chiral). Region 333 rhombus (0,0),(2/3,1/3),(1,1),(1/3,2/3).
// A one-handed knot strand looping through the rhombus; C3 orbit links into a trefoil
// with NO mirror.
const trefoilKnot: GalleryMotif = {
  strokes: [
    {
      pts: [v(0.12, 0.18), v(0.55, 0.2), v(0.7, 0.6), v(0.45, 0.78), v(0.62, 0.5)],
      width: STROKE_W * 1.2,
      color: INK,
    },
    { pts: [v(0.3, 0.32), v(0.5, 0.55)], width: STROKE_W, color: INK },
  ],
  fills: [{ pts: [v(0.5, 0.3), v(0.62, 0.36), v(0.5, 0.44)], color: ACCENT }],
};

// #9 p31m — Three-petal medallion. Region {3,3,3} triangle (0,0),(2/3,1/3),(1,1).
// A petal whose lone mirror is the region's edge mirror (the p31m `swap` axis); NOT
// symmetric under a 60° rotation (which would make it p6m).
const medallion: GalleryMotif = {
  fills: [
    { pts: [v(0.2, 0.16), v(0.62, 0.42), v(0.5, 0.6), v(0.26, 0.3)], color: INK2 },
  ],
  strokes: [
    { pts: [v(0, 0), v(0.9, 0.92)], width: STROKE_W, color: INK },
    { pts: [v(0.2, 0.16), v(0.6, 0.42)], width: STROKE_W, color: INK },
    { pts: [v(0.64, 0.32), v(0.45, 0.58)], width: STROKE_W, color: ACCENT },
  ],
};

export const galleryMotifDefs: Record<string, GalleryMotif> = {
  'p4m-girih-star': girihStar,
  'p4-cracked-ice': crackedIce,
  'p6m-shamsa': shamsa,
  'pmm-leiwen': leiwen,
  'p6-whirl': whirlBlade,
  'cmm-quatrefoil': quatrefoil,
  'p4g-pinwheel': pinwheel,
  'p3-trefoil-knot': trefoilKnot,
  'p31m-medallion': medallion,
};

export const galleryMotifSvg: Record<string, string> = Object.fromEntries(
  Object.entries(galleryMotifDefs).map(([id, m]) => [id, motifToSvg(m)]),
);
