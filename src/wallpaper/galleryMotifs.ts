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

// Map authored points through a pure transform (authoring-time only; the stored
// motif is still plain uv geometry).
const mapPts = (f: (p: Vec2) => Vec2, pts: Vec2[]): Vec2[] => pts.map(f);

// Author in XY, store in uv: uv = B⁻¹·xy. Used by motifs whose lattice basis is
// oblique — drawing upright shapes in XY and unshearing keeps the rendered art
// upright (the render transform re-applies B). The basis constants live here and
// are imported by unitTemplates.ts so motif and template can never disagree.
const fromXy =
  (basis: { a: Vec2; b: Vec2 }) =>
  (p: Vec2): Vec2 => {
    const det = basis.a.x * basis.b.y - basis.b.x * basis.a.y;
    return v(
      (p.x * basis.b.y - p.y * basis.b.x) / det,
      (p.y * basis.a.x - p.x * basis.a.y) / det,
    );
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

// ─────────────────────────────────────────────────────────────────────────────
// SECOND GALLERY DESIGN per single-entry group (#10–#16). Sources are the example
// patterns of Wikipedia "Wallpaper group": medieval wall diapering (p1), Hawaiian
// tapa cloth (p2), Egyptian tomb ornament (pm, pmg), the Salzburg herringbone
// pavement (pg), and Persian glazed tile (p3m1); pgg takes the Japanese yagasuri
// (arrow-fletching) cloth, the everyday glide-reflection pattern.
// ─────────────────────────────────────────────────────────────────────────────

// #10 p1 — Fleur-de-lis diaper ("Medieval wall diapering"). Region = the whole cell
// on a GENERIC oblique lattice (65°, |b| ≠ |a|), so no isometry beyond translation
// is even available — the staggered rows that make heraldic diapering read as p1.
// Authored upright in XY and unsheared into uv via the basis.
export const FLEUR_BASIS = {
  a: { x: 1, y: 0 },
  b: { x: 0.389, y: 0.834 },
};
const fleurXy = fromXy(FLEUR_BASIS);
const fleurDiaper: GalleryMotif = {
  fills: [
    // central lance petal
    {
      pts: mapPts(fleurXy, [
        v(0.711, 0.13), v(0.782, 0.33), v(0.711, 0.47), v(0.64, 0.33),
      ]),
      color: INK2,
    },
    // left petal curling outward
    {
      pts: mapPts(fleurXy, [
        v(0.64, 0.46), v(0.555, 0.42), v(0.495, 0.33), v(0.515, 0.22),
        v(0.565, 0.27), v(0.585, 0.35), v(0.64, 0.4),
      ]),
      color: INK2,
    },
    // right petal curling outward
    {
      pts: mapPts(fleurXy, [
        v(0.782, 0.46), v(0.867, 0.42), v(0.927, 0.33), v(0.907, 0.22),
        v(0.857, 0.27), v(0.837, 0.35), v(0.782, 0.4),
      ]),
      color: INK2,
    },
    // crossband
    {
      pts: mapPts(fleurXy, [
        v(0.62, 0.475), v(0.802, 0.475), v(0.802, 0.535), v(0.62, 0.535),
      ]),
      color: INK,
    },
    // lower tail petal
    {
      pts: mapPts(fleurXy, [
        v(0.684, 0.545), v(0.738, 0.545), v(0.748, 0.62), v(0.711, 0.71),
        v(0.674, 0.62),
      ]),
      color: INK2,
    },
    // interstitial diaper buds: two DIFFERENT fillers at generic (non-half-lattice)
    // spots — they break the half-cell translations a diaper filler could induce.
    {
      pts: mapPts(fleurXy, [
        v(0.32, 0.1), v(0.37, 0.16), v(0.32, 0.22), v(0.27, 0.16),
      ]),
      color: ACCENT,
    },
    {
      pts: mapPts(fleurXy, [
        v(1.07, 0.72), v(1.11, 0.76), v(1.07, 0.8), v(1.03, 0.76),
      ]),
      color: INK,
    },
  ],
  strokes: [
    // diaper frame on the cell boundary (uv): neighbours complete the half-width
    { pts: [v(0, 0), v(1, 0), v(1, 1), v(0, 1)], width: STROKE_W, color: INK, closed: true },
    // inner lozenge frame — the double rule of medieval wall diapering
    {
      pts: [v(0.07, 0.07), v(0.93, 0.07), v(0.93, 0.93), v(0.07, 0.93)],
      width: 0.03,
      color: INK,
      closed: true,
    },
    // feet flanking the tail
    { pts: mapPts(fleurXy, [v(0.665, 0.55), v(0.615, 0.61), v(0.575, 0.63)]), width: 0.025, color: INK },
    { pts: mapPts(fleurXy, [v(0.757, 0.55), v(0.807, 0.61), v(0.847, 0.63)]), width: 0.025, color: INK },
  ],
};

// #11 p2 — Tapa cloth zigzag ("Cloth, Sandwich Islands (Hawaii)"). Region = the
// (0,0),(1,0),(0,1) half-cell triangle on a generic oblique lattice; the C2 about
// the cell centre chains the bold Z-bends into barkcloth meanders. Authored in uv —
// the mild shear of the 72° basis is part of the tapa look.
export const TAPA_BASIS = {
  a: { x: 1, y: 0 },
  b: { x: 0.28, y: 0.86 },
};
const tapaZigzag: GalleryMotif = {
  strokes: [
    // bold Z-bend; its rot180 image completes a meander
    {
      pts: [v(0.06, 0.1), v(0.52, 0.1), v(0.16, 0.46), v(0.5, 0.46)],
      width: 0.06,
      color: INK,
    },
    // fine hatch wedge (kapa beater texture)
    { pts: [v(0.04, 0.62), v(0.26, 0.62)], width: 0.025, color: INK },
    { pts: [v(0.04, 0.7), v(0.22, 0.7)], width: 0.025, color: INK },
    { pts: [v(0.04, 0.78), v(0.16, 0.78)], width: 0.025, color: INK },
    { pts: [v(0.04, 0.86), v(0.1, 0.86)], width: 0.025, color: INK },
  ],
  fills: [
    // tooth row along the base
    { pts: [v(0.6, 0.04), v(0.74, 0.04), v(0.67, 0.16)], color: INK2 },
    { pts: [v(0.76, 0.04), v(0.9, 0.04), v(0.83, 0.16)], color: INK2 },
    // lone accent triangle
    { pts: [v(0.3, 0.22), v(0.42, 0.22), v(0.36, 0.33)], color: ACCENT },
  ],
};

// #12 pm — Egyptian lotus columns ("Dress of a figure in a tomb at Biban el Moluk").
// Region = the [0,1/2]×[0,1] half cell; the u=0 and u=1/2 mirror axes carry a lotus
// flower and a bud respectively, so reflection grows alternating flower/bud columns
// over register lines — the classic Nile frieze stacked as a wallpaper.
const lotusColumns: GalleryMotif = {
  fills: [
    // half flower bulb on the u=0 axis
    {
      pts: [v(0, 0.4), v(0.085, 0.37), v(0.115, 0.3), v(0.085, 0.235), v(0, 0.21)],
      color: INK2,
    },
    // three fan petals
    {
      pts: [
        v(0, 0.195), v(0.018, 0.115), v(0.048, 0.045), v(0.075, 0.075),
        v(0.045, 0.16), v(0.022, 0.2),
      ],
      color: INK2,
    },
    {
      pts: [
        v(0.075, 0.21), v(0.13, 0.13), v(0.195, 0.085), v(0.21, 0.135),
        v(0.15, 0.2), v(0.1, 0.235),
      ],
      color: INK2,
    },
    {
      pts: [
        v(0.115, 0.26), v(0.2, 0.22), v(0.285, 0.21), v(0.275, 0.26),
        v(0.2, 0.275), v(0.14, 0.295),
      ],
      color: INK2,
    },
    // half bud on the u=1/2 axis, red-tipped
    {
      pts: [v(0.5, 0.56), v(0.44, 0.615), v(0.425, 0.7), v(0.46, 0.76), v(0.5, 0.785)],
      color: INK2,
    },
    { pts: [v(0.5, 0.52), v(0.462, 0.575), v(0.5, 0.61)], color: ACCENT },
  ],
  strokes: [
    // stems sit ON the mirror axes; the reflected copy completes them seamlessly
    { pts: [v(0, 0.4), v(0, 0.97)], width: 0.05, color: INK },
    { pts: [v(0.5, 0.785), v(0.5, 0.97)], width: 0.05, color: INK },
    // sepal rays between the petals
    { pts: [v(0.02, 0.2), v(0.06, 0.06)], width: 0.025, color: INK },
    { pts: [v(0.09, 0.225), v(0.2, 0.1)], width: 0.025, color: INK },
    { pts: [v(0.125, 0.27), v(0.27, 0.235)], width: 0.025, color: INK },
    // register (ground) lines of the frieze
    { pts: [v(0, 0.97), v(0.5, 0.97)], width: 0.045, color: INK },
    { pts: [v(0, 0.905), v(0.5, 0.905)], width: 0.022, color: INK2 },
  ],
};

// #13 pg — Herringbone parquet ("Pavement with herringbone pattern in Salzburg").
// Region = the [0,1]×[0,1/2] strip = one 45°-slanted plank; the horizontal glide
// lays the next course slanting the other way with the half-period offset that is
// the herringbone signature. Wood grain keeps the glide honest (no mirror, no C2).
const herringbone: GalleryMotif = {
  strokes: [
    // course seams (top edge of the strip; the glide supplies v = 1/2 courses)
    { pts: [v(0, 0), v(1, 0)], width: 0.04, color: INK },
    { pts: [v(0, 0.5), v(1, 0.5)], width: 0.04, color: INK },
    // butt seam between consecutive planks of this course
    { pts: [v(0, 0), v(0.5, 0.5)], width: 0.04, color: INK },
    // wood grain, parallel to the butt seam
    { pts: [v(0.3, 0.02), v(0.76, 0.48)], width: 0.022, color: INK },
    { pts: [v(0.55, 0.02), v(1.0, 0.47)], width: 0.022, color: INK },
    { pts: [v(0.8, 0.03), v(1.22, 0.45)], width: 0.022, color: INK },
  ],
  fills: [
    // knot in the plank face
    { pts: [v(0.4, 0.28), v(0.445, 0.295), v(0.43, 0.335), v(0.385, 0.32)], color: ACCENT },
  ],
};

// #14 pmg — Egyptian water bands ("Ceiling of Egyptian tomb"; the n-water 𓈖 sign).
// Region = the [0,1/2]² quarter cell. Three strands descend from the u=0 mirror to
// the u=1/2 mirror; reflection makes zigzag bands and the horizontal glide stacks
// them half-period out of phase — in-phase stacking would be the pmm over-promotion.
const waterBands: GalleryMotif = {
  strokes: [
    { pts: [v(0, 0.07), v(0.5, 0.25)], width: 0.045, color: INK },
    { pts: [v(0, 0.16), v(0.5, 0.34)], width: 0.045, color: INK2 },
    { pts: [v(0, 0.25), v(0.5, 0.43)], width: 0.045, color: INK },
  ],
  fills: [
    // little lotus float between strands — marks the flow direction
    { pts: [v(0.3, 0.455), v(0.33, 0.475), v(0.3, 0.495), v(0.27, 0.475)], color: ACCENT },
  ],
};

// #15 pgg — Yagasuri arrow fletching (矢絣, the Meiji schoolgirl kimono cloth; the
// everyday cousin of Wikipedia's pgg pavements). Region = the (0,1/2),(1,1/2),(1/2,1)
// triangle. One V-fletch is authored whole; the vertical glide stacks a column whose
// feathers alternate their dark half (染め分け), and the C2 turns neighbouring
// columns into descending arrows. The unequal barbs are what keep pgg from pmg.
//
// The fletch overhangs the region into the glide image's territory, so the motif
// also carries its g1-preimage (g1⁻¹ = (u+1/2, 3/2−v) mod lattice): each op then
// finds, inside the region, exactly the piece it must place — the orbit reassembles
// the COMPLETE fletch with no manual polygon splitting (kaleidoscope-fold authoring).
const fletchPts = {
  // left barb, broad and dark
  barbL: [v(0.25, 0.8), v(0.03, 0.58), v(0.03, 0.69), v(0.25, 0.91)],
  // right barb, narrower and shorter — breaks the would-be column mirror
  barbR: [v(0.25, 0.8), v(0.44, 0.61), v(0.44, 0.68), v(0.25, 0.87)],
  // nested inner V, stroked
  vL: [v(0.25, 0.68), v(0.08, 0.51)],
  vR: [v(0.25, 0.68), v(0.42, 0.51)],
};
const g1Pre = (p: Vec2): Vec2 => v(p.x + 0.5, 1.5 - p.y);
const yagasuri: GalleryMotif = {
  fills: [
    { pts: fletchPts.barbL, color: INK },
    { pts: fletchPts.barbR, color: INK2 },
    { pts: mapPts(g1Pre, fletchPts.barbL), color: INK },
    { pts: mapPts(g1Pre, fletchPts.barbR), color: INK2 },
  ],
  strokes: [
    { pts: fletchPts.vL, width: 0.035, color: INK },
    { pts: fletchPts.vR, width: 0.035, color: INK },
    { pts: mapPts(g1Pre, fletchPts.vL), width: 0.035, color: INK },
    { pts: mapPts(g1Pre, fletchPts.vR), width: 0.035, color: INK },
  ],
};

// #16 p3m1 — Persian glazed triangles ("Persian glazed tile — ignoring colors:
// p6m"). Region = the *333 kaleidoscope triangle (0,0),(2/3,1/3),(1/3,2/3); all
// three edges are mirrors, so the border strokes weave the equilateral net of the
// tile. A rosette blooms only at the up-triangle centre (2/3,1/3) and a small star
// at the lattice corner — the empty down-centre is exactly what keeps the two
// triangle families distinct (rot60 / the p31m mirrors would swap them → p6m).
const glazedTriangles: GalleryMotif = {
  strokes: [
    // kaleidoscope frame on the mirror edges
    { pts: [v(0, 0), v(2 / 3, 1 / 3), v(1 / 3, 2 / 3)], width: 0.04, color: INK, closed: true },
    // short arabesque stem from mid-region toward the rosette
    { pts: [v(0.3, 0.22), v(0.44, 0.3)], width: 0.035, color: INK },
  ],
  fills: [
    // almond petal pointing at the up-triangle centre — D3-kaleidoscoped into a
    // six-lobe rosette there
    {
      pts: [
        v(0.46, 0.333), v(0.52, 0.295), v(0.6, 0.31), v(0.648, 0.333),
        v(0.6, 0.357), v(0.52, 0.371),
      ],
      color: INK2,
    },
    // small star piece at the lattice corner
    { pts: [v(0.07, 0.045), v(0.135, 0.085), v(0.085, 0.115)], color: ACCENT },
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
  'p1-fleur-diaper': fleurDiaper,
  'p2-tapa-zigzag': tapaZigzag,
  'pm-lotus-columns': lotusColumns,
  'pg-herringbone': herringbone,
  'pmg-water-bands': waterBands,
  'pgg-yagasuri': yagasuri,
  'p3m1-glazed-rosette': glazedTriangles,
};

export const galleryMotifSvg: Record<string, string> = Object.fromEntries(
  Object.entries(galleryMotifDefs).map(([id, m]) => [id, motifToSvg(m)]),
);
