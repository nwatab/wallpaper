import type { Affine2D, WallpaperGroup, WallpaperGroupDef } from './types';

// Coset representatives are written in the unit cell's *fractional* (lattice-basis)
// coordinates, where the cell is the unit square [0,1]² spanned by (a, b). They are
// the point-group elements / coset reps of the translation lattice. Conjugating these
// by a concrete template basis (compileUnit) yields the XY ops the engine applies.
//
// Keeping symmetry here — not inlined per pattern — is what makes the group swappable
// data: two patterns of the same group (e.g. both cm variants) reference one definition,
// and M1 group-switching becomes a data swap rather than re-authoring matrices.
//
// Affine convention matches src/wallpaper/affine.ts: applyToPoint does
//   x' = a·u + c·v + e,  y' = b·u + d·v + f.

const I: Affine2D = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

// Reflection across the vertical mid-line u = 1/2: (u,v) ↦ (1-u, v).
const mirrorU: Affine2D = { a: -1, b: 0, c: 0, d: 1, e: 1, f: 0 };
// Reflection across the horizontal mid-line v = 1/2: (u,v) ↦ (u, 1-v).
const mirrorV: Affine2D = { a: 1, b: 0, c: 0, d: -1, e: 0, f: 1 };
// 180° rotation about the cell centre (1/2,1/2): (u,v) ↦ (1-u, 1-v).
const rot180: Affine2D = { a: -1, b: 0, c: 0, d: -1, e: 1, f: 1 };
// Diagonal mirror (swap of the two lattice directions): (u,v) ↦ (v, u).
// In XY this becomes a mirror across the rhombus axis bisecting a and b.
const swap: Affine2D = { a: 0, b: 1, c: 1, d: 0, e: 0, f: 0 };
// Glide: reflect across v = 1/2 then translate u by +1/2: (u,v) ↦ (u+1/2, 1-v).
const glideU: Affine2D = { a: 1, b: 0, c: 0, d: -1, e: 0.5, f: 1 };

// --- Square lattice, 4-fold about the cell centre (1/2,1/2) ---
const rot90c: Affine2D = { a: 0, b: 1, c: -1, d: 0, e: 1, f: 0 }; // (u,v) ↦ (1-v, u)
const rot270c: Affine2D = { a: 0, b: -1, c: 1, d: 0, e: 0, f: 1 }; // (u,v) ↦ (v, 1-u)
// Diagonal mirror (u,v) ↦ (v,u) and anti-diagonal (u,v) ↦ (1-v,1-u), both through the centre.
const diag: Affine2D = swap;
const antiDiag: Affine2D = { a: 0, b: -1, c: -1, d: 0, e: 1, f: 1 };

// --- Square lattice, 4-fold about the origin + offset mirrors/glides (p4g) ---
const rot90o: Affine2D = { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 }; // (-v, u)
const rot180o: Affine2D = { a: -1, b: 0, c: 0, d: -1, e: 0, f: 0 }; // (-u, -v)
const rot270o: Affine2D = { a: 0, b: -1, c: 1, d: 0, e: 0, f: 0 }; // (v, -u)
const glideAxialU: Affine2D = { a: -1, b: 0, c: 0, d: 1, e: 0.5, f: 0.5 }; // (1/2-u, 1/2+v)
const glideAxialV: Affine2D = { a: 1, b: 0, c: 0, d: -1, e: 0.5, f: 0.5 }; // (1/2+u, 1/2-v)
const mirrorDiagO: Affine2D = { a: 0, b: 1, c: 1, d: 0, e: 0.5, f: 0.5 }; // (1/2+v, 1/2+u)
const mirrorAntiO: Affine2D = { a: 0, b: -1, c: -1, d: 0, e: 0.5, f: 0.5 }; // (1/2-v, 1/2-u)

// --- Hexagonal lattice (basis a, b at 120°) ---
// Rotations are integer matrices in the lattice basis. R6 = 60° about the origin;
// its powers give all rotations of p3/p6. R3 = R6² (120°), etc.
const rot60: Affine2D = { a: 1, b: 1, c: -1, d: 0, e: 0, f: 0 }; // R6
const rot120: Affine2D = { a: 0, b: 1, c: -1, d: -1, e: 0, f: 0 }; // R6² = R3
const rot180h: Affine2D = { a: -1, b: 0, c: 0, d: -1, e: 0, f: 0 }; // R6³
const rot240: Affine2D = { a: -1, b: -1, c: 1, d: 0, e: 0, f: 0 }; // R6⁴ = R3²
const rot300: Affine2D = { a: 0, b: -1, c: 1, d: 1, e: 0, f: 0 }; // R6⁵

export const groups: Partial<Record<WallpaperGroup, WallpaperGroupDef>> = {
  // Oblique lattice, no point symmetry beyond translation.
  p1: { name: 'p1', cosetReps: [I] },

  // 2-fold rotation about the cell centre.
  p2: { name: 'p2', cosetReps: [I, rot180] },

  // Vertical mirror (rectangular lattice).
  pm: { name: 'pm', cosetReps: [I, mirrorU] },

  // Horizontal glide (rectangular lattice).
  pg: { name: 'pg', cosetReps: [I, glideU] },

  // Single diagonal mirror (rhombic / centred-rectangular lattice). The template
  // basis must be rhombic (|a| = |b|) for `swap` to act as an isometry.
  cm: { name: 'cm', cosetReps: [I, swap] },

  // D2: two perpendicular mirrors + their product (a 2-fold rotation).
  pmm: { name: 'pmm', cosetReps: [I, mirrorU, mirrorV, rot180] },

  // Vertical mirror + horizontal glide + a 2-fold rotation off the mirror.
  // 180° rotation about (1/4,1/2): (u,v) ↦ (1/2-u, 1-v).
  pmg: {
    name: 'pmg',
    cosetReps: [I, mirrorU, glideU, { a: -1, b: 0, c: 0, d: -1, e: 0.5, f: 1 }],
  },

  // Glides in both directions, no mirrors. Ops extend outside [0,1]², so templates
  // referencing pgg must set clipToCells.
  //   glide (horizontal): (u,v) ↦ (u+1/2, 3/2-v)
  //   rot180 about (1/2,1/2): (u,v) ↦ (1-u, 1-v)
  //   glide (vertical) = rot ∘ glide: (u,v) ↦ (1/2-u, v-1/2)
  pgg: {
    name: 'pgg',
    cosetReps: [
      I,
      { a: 1, b: 0, c: 0, d: -1, e: 0.5, f: 1.5 },
      { a: -1, b: 0, c: 0, d: -1, e: 1, f: 1 },
      { a: -1, b: 0, c: 0, d: 1, e: 0.5, f: -0.5 },
    ],
  },

  // D2 on a centred-rectangular (rhombic) lattice: two perpendicular mirrors (the
  // rhombus axes) + a 2-fold rotation. Template basis must be rhombic with the two
  // basis vectors mirror images across the conventional rectangular axes — then
  // `swap` is the horizontal mirror and the other is the vertical mirror.
  cmm: {
    name: 'cmm',
    cosetReps: [I, swap, { a: 0, b: -1, c: -1, d: 0, e: 0, f: 0 }, rot180o],
  },

  // C4: four rotations about the cell centre (square lattice).
  p4: { name: 'p4', cosetReps: [I, rot90c, rot180, rot270c] },

  // D4 about the cell centre: 4 rotations + 4 mirrors (axial + diagonal), all through
  // the centre (square lattice).
  p4m: {
    name: 'p4m',
    cosetReps: [I, rot90c, rot180, rot270c, mirrorU, mirrorV, diag, antiDiag],
  },

  // D4 with 4-fold centres at the origin and mirror/glide lines offset by 1/2, so the
  // mirrors miss the rotation centres (square lattice). Ops leave [0,1]²; needs clip.
  p4g: {
    name: 'p4g',
    cosetReps: [
      I,
      rot180o,
      rot90o,
      rot270o,
      glideAxialU,
      glideAxialV,
      mirrorDiagO,
      mirrorAntiO,
    ],
  },

  // C3: three rotations about the origin (hexagonal lattice).
  p3: { name: 'p3', cosetReps: [I, rot120, rot240] },

  // C6: six rotations about the origin (hexagonal lattice).
  p6: {
    name: 'p6',
    cosetReps: [I, rot60, rot120, rot180h, rot240, rot300],
  },

  // D3, Conway *333: ALL three 3-fold centres lie on mirror lines. Verified by the
  // incidence check — this requires the y-axis family of mirrors (not `swap`), whose
  // axes pass through the deep-hole 3-fold centres (hexagonal lattice).
  p3m1: {
    name: 'p3m1',
    cosetReps: [
      I,
      rot120,
      rot240,
      { a: -1, b: 0, c: 1, d: 1, e: 0, f: 0 }, // mirror across y-axis
      { a: 0, b: -1, c: -1, d: 0, e: 0, f: 0 }, // R3 ∘ m
      { a: 1, b: 1, c: 0, d: -1, e: 0, f: 0 }, // R3² ∘ m
    ],
  },

  // D3, Conway 3*3: only the lattice-point 3-fold centres lie on mirrors; the deep-hole
  // centres do not. This is the `swap`-mirror family (hexagonal lattice).
  p31m: {
    name: 'p31m',
    cosetReps: [
      I,
      rot120,
      rot240,
      swap,
      { a: -1, b: -1, c: 0, d: 1, e: 0, f: 0 }, // R3 ∘ swap
      { a: 1, b: 0, c: -1, d: -1, e: 0, f: 0 }, // R3² ∘ swap
    ],
  },

  // D6: the full dihedral symmetry of the hexagonal lattice — 6 rotations + 6 mirrors.
  p6m: {
    name: 'p6m',
    cosetReps: [
      I,
      rot60,
      rot120,
      rot180h,
      rot240,
      rot300,
      { a: 1, b: 0, c: -1, d: -1, e: 0, f: 0 }, // mirror across x-axis (m)
      { a: 1, b: 1, c: 0, d: -1, e: 0, f: 0 }, // R6 ∘ m
      { a: 0, b: 1, c: 1, d: 0, e: 0, f: 0 }, // R6² ∘ m
      { a: -1, b: 0, c: 1, d: 1, e: 0, f: 0 }, // R6³ ∘ m
      { a: -1, b: -1, c: 0, d: 1, e: 0, f: 0 }, // R6⁴ ∘ m
      { a: 0, b: -1, c: -1, d: 0, e: 0, f: 0 }, // R6⁵ ∘ m
    ],
  },
};

export const getGroup = (name: WallpaperGroup): WallpaperGroupDef => {
  const def = groups[name];
  if (!def) {
    throw new Error(`Wallpaper group not defined: ${name}`);
  }
  return def;
};
