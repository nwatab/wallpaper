import type { GalleryMotif } from '../galleryMotifs';
import { galleryMotifDefs } from '../galleryMotifs';
import type { Vec2, WallpaperGroup } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// SHAPE-LOCAL MOTIFS for the group switcher (M1).
//
// One motif per TOGGLE-SET, authored in the set's REFERENCE region — the uv asymmetric
// unit of the set's first member (shapeFamilies.ts derives the set + reference). Because
// a toggle-set's members have CONGRUENT regions, each other member's placement is an
// isometry (no distortion): the same drawing is carried, unchanged, into each group's
// own tile, and only the group's symmetry elements differ.
//
// Every mark is CHIRAL / asymmetric so the honest-maximality check passes: under the
// lower-symmetry / chiral member (p4g, pg, pmg, the chiral p6) the rendered pattern must
// NOT pick up a mirror it shouldn't have. Keyed by the reference member's group.
// ─────────────────────────────────────────────────────────────────────────────

const v = (x: number, y: number): Vec2 => ({ x, y });
const INK = '#1c3f7a';
const ACCENT = '#b5402a';
const W = 0.04;

// {p4m, p4g} — reference p4m, region triangle (0,0),(½,0),(½,½): 0 ≤ y ≤ x ≤ ½.
// A chiral "F" hugging the right edge / hypotenuse.
const squareMark: GalleryMotif = {
  strokes: [
    { pts: [v(0.46, 0.06), v(0.46, 0.34)], width: W, color: INK },
    { pts: [v(0.46, 0.06), v(0.14, 0.06)], width: W, color: INK },
    { pts: [v(0.46, 0.2), v(0.26, 0.2)], width: W, color: INK },
  ],
  fills: [{ pts: [v(0.38, 0.26), v(0.46, 0.26), v(0.42, 0.33)], color: ACCENT }],
};

// {pm, pg} — reference pm, region rectangle [0,½]×[0,1]. A chiral "F".
const rectMark: GalleryMotif = {
  strokes: [
    { pts: [v(0.12, 0.12), v(0.12, 0.88)], width: W, color: INK },
    { pts: [v(0.12, 0.12), v(0.42, 0.12)], width: W, color: INK },
    { pts: [v(0.12, 0.45), v(0.32, 0.45)], width: W, color: INK },
  ],
  fills: [{ pts: [v(0.24, 0.66), v(0.38, 0.66), v(0.3, 0.8)], color: ACCENT }],
};

// {pmm, pmg} — reference pmm, region square [0,½]². A chiral hook (no mirror/diagonal).
const quarterMark: GalleryMotif = {
  strokes: [
    { pts: [v(0.1, 0.1), v(0.4, 0.1), v(0.4, 0.4), v(0.2, 0.4)], width: W, color: INK },
  ],
  fills: [{ pts: [v(0.12, 0.22), v(0.24, 0.22), v(0.16, 0.32)], color: ACCENT }],
};

// {p6, p31m} — reference p6, region 30-30-120 triangle (0,0),(⅓,⅔),(1,1). Reuse the
// polished chiral whirling-blade authored for exactly this region (galleryMotifs.ts):
// under p6 it pinwheels (chiral), under p31m the group's mirrors reflect it.
const hexMark: GalleryMotif = galleryMotifDefs['p6-whirl'];

// Keyed by the toggle-set's reference member (its first member in groupGeoms order).
export const switchMotifs: Partial<Record<WallpaperGroup, GalleryMotif>> = {
  p4m: squareMark,
  pm: rectMark,
  pmm: quarterMark,
  p6: hexMark,
};
