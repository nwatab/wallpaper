// ─────────────────────────────────────────────────────────────────────────────
// CONFORMAL PIPELINE — compose a variable-length list of primitive cards.
//
// A pipeline of cards [f₁, f₂, …, fₙ] denotes f = fₙ∘…∘f₁ applied to a SOURCE point. The
// renderer inverse-maps: for an output pixel w it needs z = f₁⁻¹(f₂⁻¹(…fₙ⁻¹(w))) — each card's
// inverse, in REVERSE order. `encodePipeline` does exactly that: reverse the cards and bake
// each one's inverse into a flat OP, so the shader (and `applyEncodedOps`, its TS twin) just
// runs the ops front-to-back.
//
// INVARIANT: `applyEncodedOps` is the line-for-line mirror of shader.ts's interpreter loop —
// same op semantics, same singularity/overflow guards. It is the tested source of truth.
// ─────────────────────────────────────────────────────────────────────────────

import {
  type Complex,
  cAbs2,
  cAdd,
  cMul,
  cDiv,
  cExp,
  cLog,
} from './mobius';
import {
  type Card,
  type EncodedOp,
  encodeInverseOp,
  forwardCard,
  inverseCard,
  OP_AFFINE,
  OP_MOBIUS,
  OP_LOG,
  OP_EXP,
  OP_POWER,
  EXP_MAX_RE,
} from './primitives';

// Max pipeline length — the shader's uniform arrays are sized to this; the UI caps "Add" here.
export const MAX_CARDS = 8;

// |w|² below this ⇒ log/power at (essentially) the origin ⇒ background. Mirrored in shader.ts.
export const LOG_EPS2 = 1e-12;
// Default Möbius pole eps (|c·w+d|² in world units²). Mirrored as the u_poleEps default.
export const DEFAULT_POLE_EPS = 1e-6;

// ── Pure math composition (no guards; for the f∘f⁻¹=id and reverse-composition tests) ──

/** f = fₙ∘…∘f₁ applied to a source point z (cards in list order). */
export const composedForward = (cards: Card[], z: Complex): Complex =>
  cards.reduce((acc, card) => forwardCard(card, acc), z);

/** f⁻¹(w) = f₁⁻¹(…fₙ⁻¹(w)) — each card's inverse applied in REVERSE order. */
export const composedInverse = (cards: Card[], w: Complex): Complex =>
  [...cards].reverse().reduce((acc, card) => inverseCard(card, acc), w);

// ── Encode for the shader: reverse the cards, bake each inverse into an op ──

export const encodePipeline = (cards: Card[]): EncodedOp[] =>
  [...cards].reverse().map((card) => encodeInverseOp(card));

// ── Interpreter (TS twin of the shader loop) ──

export type WarpResult = { ok: true; z: Complex } | { ok: false };
const BG: WarpResult = { ok: false };

/** Apply ONE op to w; returns background ({ok:false}) at a singularity/overflow. */
export const applyOp = (
  op: EncodedOp,
  w: Complex,
  poleEps: number,
): WarpResult => {
  switch (op.tag) {
    case OP_AFFINE:
      return { ok: true, z: cAdd(cMul(op.p0, w), op.p1) };
    case OP_MOBIUS: {
      const denom = cAdd(cMul(op.p2, w), op.p3);
      if (cAbs2(denom) < poleEps) return BG; // pole → background
      return { ok: true, z: cDiv(cAdd(cMul(op.p0, w), op.p1), denom) };
    }
    case OP_LOG:
      if (cAbs2(w) < LOG_EPS2) return BG; // log singularity at 0
      return { ok: true, z: cLog(w) };
    case OP_EXP:
      if (w.re > EXP_MAX_RE) return BG; // overflow → background
      return { ok: true, z: cExp(w) };
    case OP_POWER: {
      if (cAbs2(w) < LOG_EPS2) return BG; // shares log's singularity at 0
      const e = cMul(op.p0, cLog(w)); // w^p0 = exp(p0·log w)
      if (e.re > EXP_MAX_RE) return BG; // overflow → background
      return { ok: true, z: cExp(e) };
    }
    default:
      return { ok: true, z: w };
  }
};

/** Run the full op list front-to-back (= the shader's reverse-inverse map). */
export const applyEncodedOps = (
  ops: EncodedOp[],
  w: Complex,
  poleEps = DEFAULT_POLE_EPS,
): WarpResult => {
  let acc = w;
  for (const op of ops) {
    const r = applyOp(op, acc, poleEps);
    if (!r.ok) return BG;
    acc = r.z;
  }
  return { ok: true, z: acc };
};
