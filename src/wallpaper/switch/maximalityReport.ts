import type { GalleryMotif } from '../galleryMotifs';
import type { WallpaperGroup } from '../types';
import { motifInk } from '../galleryMotifs';
import { asymmetricUnitUv } from '../regions';
import { getGroup } from '../groups';
import {
  sampleInk,
  patternFingerprint,
  isInvariantUnder,
} from '../verify/maximality';
import { groupGeoms, groupSymmetry, type GroupGeom } from './congruence';

// ─────────────────────────────────────────────────────────────────────────────
// EDUCATIONAL MAXIMALITY REPORT (M2).
//
// For a USER drawing, symmetry is REPORTED, not enforced: the engine still imposes the
// selected group, but a free drawing may carry hidden extra symmetry that makes the
// rendered pattern's TRUE group larger (a chiral-looking mark that is actually mirror
// symmetric → "you drew p4m, not p4g"). This detects that, reusing the verified
// maximality machinery (sampleInk / patternFingerprint / isInvariantUnder) exactly as
// the gallery's maximality test does.
//
// METHOD (principled, no hand-coded supergroup table): the candidate groups are the
// OTHER groups on the SAME lattice — only there are their fractional coset reps genuine
// isometries of this basis. The rendered pattern (orbit of the clipped ink under the
// declared group) is invariant under a candidate group G′ iff EVERY coset rep of G′ maps
// its fingerprint onto itself. Because each group's reps encode its own mirror placement,
// testing them directly distinguishes p4m from p4g and p3m1 from p31m for free. The
// maximal passing group (by point-group order, then pure-mirror-direction count) is the
// drawing's true wallpaper group. The declared group always passes, so the result is
// itself when the drawing is honest.
// ─────────────────────────────────────────────────────────────────────────────

const N = 100;

export type MaximalityReport = {
  declared: WallpaperGroup;
  maximal: WallpaperGroup;
  isMaximal: boolean;
  // Human-readable extra symmetry elements the drawing turned out to have.
  gained: string[];
  caption: string;
};

// Higher order wins; tie broken by more pure-mirror directions, then name (deterministic).
const richer = (a: GroupGeom, b: GroupGeom): GroupGeom => {
  if (a.order !== b.order) return a.order > b.order ? a : b;
  if (a.mirrorDirs !== b.mirrorDirs) return a.mirrorDirs > b.mirrorDirs ? a : b;
  return a.group <= b.group ? a : b;
};

const describeGain = (
  declared: WallpaperGroup,
  maximal: WallpaperGroup,
): string[] => {
  const d = groupSymmetry(declared);
  const m = groupSymmetry(maximal);
  const gained: string[] = [];
  if (m.maxRot > d.maxRot) gained.push(`${m.maxRot}-fold rotation`);
  if (!d.hasMirror && m.hasMirror) gained.push('a mirror line');
  else if (d.hasMirror && m.hasMirror && !d.centresOnMirrors && m.centresOnMirrors)
    gained.push('mirror lines through the rotation centres');
  else if (m.mirrorDirs > d.mirrorDirs) gained.push('extra mirror lines');
  return gained;
};

/**
 * Detect the true maximal wallpaper group of a motif rendered under `declared`. The
 * motif must be expressed in `declared`'s own cell-fractional (uv) coordinates (the
 * placed motif), so the ink is clipped to `declared`'s region — matching the rendered,
 * clipped pattern.
 */
export const detectMaximalGroup = (
  motifInDeclaredUv: GalleryMotif,
  declared: WallpaperGroup,
): MaximalityReport => {
  const geoms = groupGeoms();
  const geomOf = new Map(geoms.map((g) => [g.group, g]));
  const declaredGeom = geomOf.get(declared);
  if (!declaredGeom) throw new Error(`Unknown group: ${declared}`);

  const ink = sampleInk(motifInk(motifInDeclaredUv), N, asymmetricUnitUv[declared]);
  const declaredReps = getGroup(declared).cosetReps;
  const fingerprint = patternFingerprint(ink, declaredReps);

  const passing = geoms.filter(
    (g) =>
      g.lattice === declaredGeom.lattice &&
      getGroup(g.group).cosetReps.every((h) =>
        isInvariantUnder(fingerprint, ink, declaredReps, h),
      ),
  );

  // `declared` is always invariant under its own reps, so `passing` is non-empty.
  const maximalGeom = passing.reduce(richer);
  const maximal = maximalGeom.group;
  const isMaximal = maximal === declared;
  const gained = isMaximal ? [] : describeGain(declared, maximal);

  const caption = isMaximal
    ? `This drawing realises ${declared} fully — no hidden symmetry.`
    : `This drawing actually has ${
        gained.length ? gained.join(' and ') : 'extra symmetry'
      }, so its true symmetry is ${maximal} (you selected ${declared}).`;

  return { declared, maximal, isMaximal, gained, caption };
};
