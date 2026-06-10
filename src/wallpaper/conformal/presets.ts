// ─────────────────────────────────────────────────────────────────────────────
// WARP PRESETS — named, EDITABLE card lists. Each loads into the pipeline so the user sees
// (and can tweak) the decomposition. Composition-only (no sums like Joukowski z+1/z).
//
// Honesty (same family as the Droste note): the exp/spiral presets (Power, Polar, Loxodrome,
// the Droste steps) are seamless around the circle only when the wallpaper period is tuned
// (via Scale) so one turn = a whole number of periods; otherwise a faint angular seam shows —
// inherent, removed only by the lattice-tuned refinement. Flagged via `spiralSeamHint`.
// ─────────────────────────────────────────────────────────────────────────────

import { complex } from './mobius';
import { type Card, MOBIUS_INVERSION } from './primitives';

export type Preset = {
  id: string;
  label: string;
  note?: string;
  cards: Card[];
};

// foci for the two-centre / loxodromic maps
const P = complex(-0.5);
const Q = complex(0.5);
// loxodromic multiplier: |λ|≠1 (zoom) and arg≠0 (rotate) ⇒ a double spiral between the foci
const LAMBDA = complex(1, 0.3);

export const PRESETS: Preset[] = [
  { id: 'identity', label: 'Identity', cards: [] },
  {
    id: 'inversion',
    label: 'Inversion · 1/z',
    note: 'A single Möbius map — the canonical first conformal warp.',
    cards: [{ ...MOBIUS_INVERSION }],
  },
  {
    id: 'power',
    label: 'Power spiral · z²',
    note: 'A single power card (real α). zᵅ = exp(α·log z).',
    cards: [{ type: 'power', alpha: complex(2) }],
  },
  {
    id: 'power-steps',
    label: 'Power spiral · log→×→exp',
    note: 'The same z² map, expanded into its primitives so you can retune each step.',
    cards: [
      { type: 'log' },
      { type: 'affine', c: complex(2), b: complex(0) },
      { type: 'exp' },
    ],
  },
  {
    id: 'twist',
    label: 'Twist (Escher) · zᵅ, complex α',
    note: 'Complex α adds rotation per zoom — the Print-Gallery "twist". Tune α.im.',
    cards: [{ type: 'power', alpha: complex(1, 0.3) }],
  },
  {
    id: 'polar',
    label: 'Polar (rose) · exp',
    note: 'A single exp card — the lattice coils into concentric rotational rings.',
    cards: [{ type: 'exp' }],
  },
  {
    id: 'bipolar',
    label: 'Two centers (bipolar)',
    note: 'Möbius sending two foci to 0/∞, then log — flow between two centres.',
    cards: [
      { type: 'mobius', a: complex(1), b: { re: -P.re, im: -P.im }, c: complex(1), d: { re: -Q.re, im: -Q.im } },
      { type: 'log' },
    ],
  },
  {
    id: 'loxodrome',
    label: 'Loxodrome (double spiral) · advanced',
    note: 'Möbius → complex scale → inverse Möbius: a double spiral between two foci.',
    cards: [
      // send p→0, q→∞ :  (z−p)/(z−q)
      { type: 'mobius', a: complex(1), b: { re: -P.re, im: -P.im }, c: complex(1), d: { re: -Q.re, im: -Q.im } },
      // loxodromic multiply
      { type: 'affine', c: LAMBDA, b: complex(0) },
      // inverse Möbius: send 0→p, ∞→q :  (q·w − p)/(w − 1)
      { type: 'mobius', a: Q, b: { re: -P.re, im: -P.im }, c: complex(1), d: complex(-1) },
    ],
  },
];

// The Warp stage opens on IDENTITY (unwarped): empty = the original pattern, and "remove all"
// returns to this start state. Inversion is one click away in the presets menu.
export const DEFAULT_PRESET_ID = 'identity';

/** Does a card list contain an exp/log/power step (⇒ the angular-seam hint applies)? */
export const hasSpiralSeam = (cards: Card[]): boolean =>
  cards.some((c) => c.type === 'log' || c.type === 'exp' || c.type === 'power');
