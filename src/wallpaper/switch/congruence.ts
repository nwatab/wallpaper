import type { Affine2D, Vec2, WallpaperGroup } from '../types';
import { applyToPoint, basisToMatrix, compose, invert, translateXy } from '../affine';
import { asymmetricUnitUv } from '../regions';
import { getGroup } from '../groups';
import { unitTemplates } from '../unitTemplates';
import { compileUnit } from '../engine/compile';
import { analyzeGroup, highestRotationCentresOnMirrors } from '../verify/symmetry';

// ─────────────────────────────────────────────────────────────────────────────
// CONGRUENCE DERIVATION (M1 refactor, step 1).
//
// A toggle keeps the SAME tile and switches only the group, so its members must share
// a CONGRUENT fundamental region (same shape AND size) on the same lattice. We DERIVE
// these sets from the stored data — never hand-list them:
//
//   1. Each group's stored representative basis = the first unitTemplate for it (the
//      same rule symmetry.test.ts uses). Map asymmetricUnitUv[group] through it → XY.
//   2. Congruence signature = sorted edge-length multiset + polygon area (region
//      area = cell/order, so equal signature ⇒ equal order automatically).
//   3. Lattice (Bravais) type is derived from the group's symmetry (not the metric —
//      the stored rectangular cells are unit squares, so the metric alone can't tell
//      rectangular from square).
//   4. Cluster by (lattice, signature). A class with ≥2 members is a toggle-set.
//
// This module only READS groups.ts / regions.ts / unitTemplates / verify-symmetry.
// ─────────────────────────────────────────────────────────────────────────────

export type LatticeType =
  | 'oblique'
  | 'rectangular'
  | 'rhombic'
  | 'square'
  | 'hexagonal';

type Basis = { a: Vec2; b: Vec2 };

// First stored template per group → its representative basis (symmetry.test.ts rule).
const basisByGroup = (): Map<WallpaperGroup, Basis> => {
  const m = new Map<WallpaperGroup, Basis>();
  for (const t of unitTemplates) if (!m.has(t.group)) m.set(t.group, t.basis);
  return m;
};

// The stored representative basis for a group (its lattice realisation).
export const storedBasisOf = (group: WallpaperGroup): Basis => {
  const b = basisByGroup().get(group);
  if (!b) throw new Error(`No stored basis for group: ${group}`);
  return b;
};

// ── region congruence signature ─────────────────────────────────────────────
const round = (x: number, d = 4): number => Number(x.toFixed(d));

const regionSignature = (
  basis: Basis,
  uv: Vec2[],
): { sides: number[]; area: number } => {
  const B = basisToMatrix(basis);
  const p = uv.map((q) => applyToPoint(B, q));
  const sides = p
    .map((_, i) => {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      return Math.hypot(a.x - b.x, a.y - b.y);
    })
    .map((s) => round(s))
    .sort((x, y) => x - y);
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    s += p[i].x * p[j].y - p[j].x * p[i].y;
  }
  return { sides, area: round(Math.abs(s) / 2) };
};

const sigKey = (sig: { sides: number[]; area: number }): string =>
  `${sig.sides.join(',')}|${sig.area}`;

// ── lattice (Bravais) type from symmetry ─────────────────────────────────────
const det = (m: Affine2D): number => m.a * m.d - m.b * m.c;

const reflectionAxisAngle = (m: Affine2D): number => {
  const phi = Math.atan2(m.b, m.a) / 2; // axis at angle φ (linear part = reflection)
  let a = phi % Math.PI;
  if (a < 0) a += Math.PI;
  return a;
};

const latticeWindow = (r: number): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) out.push([i, j]);
  return out;
};

// Mirror vs glide axis ANGLES (mod π) over cosetReps × a small lattice window. A glide
// has a translation component along its own axis that is not a lattice vector.
const axisAngles = (
  opsXy: Affine2D[],
  basis: Basis,
): { mirrors: number[]; glides: number[] } => {
  const invB = invert(basisToMatrix(basis));
  const mirrors: number[] = [];
  const glides: number[] = [];
  for (const g of opsXy) {
    if (det(g) >= 0) continue;
    for (const [i, j] of latticeWindow(2)) {
      const t = { x: i * basis.a.x + j * basis.b.x, y: i * basis.a.y + j * basis.b.y };
      const m = compose(translateXy(t.x, t.y), g);
      const ang = reflectionAxisAngle(m);
      const u = { x: Math.cos(ang), y: Math.sin(ang) };
      const along = (m.e * u.x + m.f * u.y); // glide component magnitude
      const gv = { x: u.x * along, y: u.y * along };
      const f = { x: invB.a * gv.x + invB.c * gv.y, y: invB.b * gv.x + invB.d * gv.y };
      const isInt = (v: number): boolean => Math.abs(v - Math.round(v)) < 1e-4;
      (isInt(f.x) && isInt(f.y) ? mirrors : glides).push(round(ang, 4));
    }
  }
  return { mirrors, glides };
};

const opsXyOf = (group: WallpaperGroup, basis: Basis): Affine2D[] =>
  compileUnit({ id: 'x', group, label: 'x', basis, regionXy: [], motifId: 'x' })
    .opsInCellXy;

export type GroupSymmetry = {
  order: number;
  maxRot: number;
  mirrorDirs: number; // pure-mirror directions (0 ⇒ no mirror, i.e. chiral)
  hasMirror: boolean;
  hasGlide: boolean;
  // Do ALL highest-order rotation centres lie on a pure mirror? (the p4m/p4g and
  // p3m1/p31m incidence discriminator). Defined here, derived from verify/symmetry.
  centresOnMirrors: boolean;
};

// All symmetry facts about a group, derived from its compiled XY ops. Cached per group.
const symCache = new Map<WallpaperGroup, GroupSymmetry>();
export const groupSymmetry = (group: WallpaperGroup): GroupSymmetry => {
  const cached = symCache.get(group);
  if (cached) return cached;
  const basis = basisByGroup().get(group)!;
  const opsXy = opsXyOf(group, basis);
  const a = analyzeGroup(opsXy, basis);
  const info: GroupSymmetry = {
    order: a.order,
    maxRot: a.maxRotationOrder,
    mirrorDirs: a.mirrorDirections,
    hasMirror: a.mirrorDirections > 0,
    hasGlide: a.hasGlide,
    // Incidence is only defined when there are rotations (order ≥ 2); for the
    // rotation-free groups (p1, pm, pg, cm) there is no highest-order centre to place.
    centresOnMirrors:
      a.maxRotationOrder >= 2 && highestRotationCentresOnMirrors(opsXy, basis),
  };
  symCache.set(group, info);
  return info;
};

const latticeOf = (group: WallpaperGroup, basis: Basis): LatticeType => {
  const opsXy = opsXyOf(group, basis);
  const a = analyzeGroup(opsXy, basis);
  if (a.maxRotationOrder === 4) return 'square';
  if (a.maxRotationOrder === 3 || a.maxRotationOrder === 6) return 'hexagonal';
  const { mirrors, glides } = axisAngles(opsXy, basis);
  if (mirrors.length === 0 && glides.length === 0) return 'oblique';
  // Centered (rhombic) ⇔ a glide axis runs parallel to a mirror axis (cm, cmm). In
  // primitive rectangular groups the glides are perpendicular to the mirrors (pmg) or
  // there are no mirrors (pg, pgg).
  const parallel = glides.some((g) =>
    mirrors.some((mm) => Math.abs(g - mm) < 1e-3),
  );
  return parallel ? 'rhombic' : 'rectangular';
};

export type GroupGeom = {
  group: WallpaperGroup;
  lattice: LatticeType;
  order: number;
  mirrorDirs: number;
  sides: number[];
  area: number;
  sigKey: string;
};

export const groupGeoms = (): GroupGeom[] => {
  const bases = basisByGroup();
  const groups = Object.keys(asymmetricUnitUv) as WallpaperGroup[];
  return groups.map((group) => {
    const basis = bases.get(group)!;
    const sig = regionSignature(basis, asymmetricUnitUv[group]);
    return {
      group,
      lattice: latticeOf(group, basis),
      order: getGroup(group).cosetReps.length,
      mirrorDirs: groupSymmetry(group).mirrorDirs,
      sides: sig.sides,
      area: sig.area,
      sigKey: sigKey(sig),
    };
  });
};

export type CongruenceClass = {
  lattice: LatticeType;
  sigKey: string;
  members: WallpaperGroup[];
};

// Classes keyed by (lattice, signature). ≥2 members ⇒ a toggle-set.
export const congruenceClasses = (): CongruenceClass[] => {
  const byKey = new Map<string, CongruenceClass>();
  for (const g of groupGeoms()) {
    const key = `${g.lattice}::${g.sigKey}`;
    const cls = byKey.get(key) ?? { lattice: g.lattice, sigKey: g.sigKey, members: [] };
    cls.members.push(g.group);
    byKey.set(key, cls);
  }
  return [...byKey.values()];
};

// Groups whose region signatures coincide ACROSS different lattices (e.g. p4 vs pgg).
// Not toggle-sets (different lattice), but worth surfacing.
export const crossLatticeCollisions = (): {
  sigKey: string;
  members: { group: WallpaperGroup; lattice: LatticeType }[];
}[] => {
  const bySig = new Map<string, { group: WallpaperGroup; lattice: LatticeType }[]>();
  for (const g of groupGeoms()) {
    const arr = bySig.get(g.sigKey) ?? [];
    arr.push({ group: g.group, lattice: g.lattice });
    bySig.set(g.sigKey, arr);
  }
  return [...bySig.entries()]
    .map(([sigKey, members]) => ({ sigKey, members }))
    .filter((e) => new Set(e.members.map((m) => m.lattice)).size > 1);
};

// The maximal (holohedral) group of a lattice. Primary key = highest point-group
// order; the order ties on square (p4m/p4g = 8) and rectangular (pmm/pmg/pgg = 4), so
// the tie-break is the SYMMORPHIC holohedral group = the one with the most pure-mirror
// directions (p4m: 4 > p4g: 2; pmm: 2 > pmg: 1 > pgg: 0). This is principled — the
// holohedry is the group whose mirrors realise the lattice's full point symmetry — not
// an accident of iteration order. A final name tie-break keeps it deterministic.
const better = (a: GroupGeom, b: GroupGeom): GroupGeom => {
  if (a.order !== b.order) return a.order > b.order ? a : b;
  if (a.mirrorDirs !== b.mirrorDirs) return a.mirrorDirs > b.mirrorDirs ? a : b;
  return a.group < b.group ? a : b;
};

export const maximalGroupByLattice = (): Map<LatticeType, WallpaperGroup> => {
  const out = new Map<LatticeType, GroupGeom>();
  for (const g of groupGeoms()) {
    const cur = out.get(g.lattice);
    out.set(g.lattice, cur ? better(cur, g) : g);
  }
  return new Map([...out.entries()].map(([k, v]) => [k, v.group]));
};

// ── per-toggle-set discriminator, DERIVED from the overlay/symmetry data ─────────
// Two cases, decided by mirror PRESENCE across the members:
//   • members differ in whether they have any mirror at all  → 'mirror-presence'
//     (chiral vs reflected — e.g. {p6, p31m}, {pm, pg})
//   • all members have mirrors, so they differ only in mirror PLACEMENT → 'incidence'
//     (highestRotationCentresOnMirrors — e.g. {p4m, p4g}, {pmm, pmg})
export type Discriminator = {
  kind: 'incidence' | 'mirror-presence';
  caption: string;
};

export const discriminatorOf = (members: WallpaperGroup[]): Discriminator => {
  const info = members.map((g) => ({ g, ...groupSymmetry(g) }));
  const allHaveMirror = info.every((m) => m.hasMirror);

  if (!allHaveMirror) {
    const chiral = info.find((m) => !m.hasMirror)!;
    const mirrored = info.find((m) => m.hasMirror);
    const chiralShape =
      chiral.maxRot >= 2
        ? `a chiral, ${chiral.maxRot}-fold pinwheel`
        : `glides/translations only`;
    const lead = `${chiral.g} has no mirror lines — the same tile repeats as ${chiralShape}`;
    return {
      kind: 'mirror-presence',
      caption: mirrored
        ? `${lead}; ${mirrored.g} adds mirror lines, so the identical drawing becomes a reflected pattern.`
        : `${lead}.`,
    };
  }

  const onMirror = info.find((m) => m.centresOnMirrors);
  const offMirror = info.find((m) => !m.centresOnMirrors);
  const maxRot = info[0].maxRot;
  if (onMirror && offMirror) {
    return {
      kind: 'incidence',
      caption: `Same mirrors, different placement: in ${onMirror.g} every ${maxRot}-fold centre lies on a mirror line; in ${offMirror.g} the ${maxRot}-fold centres sit off the mirrors.`,
    };
  }
  return {
    kind: 'incidence',
    caption: `${members.join(' vs ')}: same fundamental tile, different symmetry-element placement.`,
  };
};
