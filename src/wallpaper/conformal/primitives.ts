// ─────────────────────────────────────────────────────────────────────────────
// CONFORMAL PRIMITIVES — the registry of elementary maps a Warp pipeline composes.
//
// Each primitive ships: a forward `f`, an inverse `f⁻¹` (both pure, tested), and an
// `encodeInverseOp` that bakes f⁻¹ into a flat OP the shader interpreter applies (with
// degenerate maps baked to identity — never NaN). The renderer INVERSE-maps, so only the
// inverse reaches the GPU; the forward exists for the f∘f⁻¹=id and composition tests.
//
// Redundancies are deliberate (see proposal): affine ⊂ möbius (c=0,d=1); power ≡ log→
// multiply→exp. Kept as distinct cards for ergonomics and a pole-free, cheap affine inverse.
//
// INVARIANT: the OP semantics here are the twins of shader.ts's interpreter; only this TS is
// tested (no GL in node). Change one ⇒ change the other.
// ─────────────────────────────────────────────────────────────────────────────

import {
  type Complex,
  complex,
  cAbs2,
  cNeg,
  cMul,
  cInv,
  determinant,
  inverseCoeffs,
  DEFAULT_EPS,
  type MobiusCoeffs,
} from './mobius';

// Shader op tags — the OPERATION the interpreter applies (a card's inverse maps to one op).
// Must match the #defines in shader.ts.
export const OP_AFFINE = 0;
export const OP_MOBIUS = 1;
export const OP_LOG = 2;
export const OP_EXP = 3;
export const OP_POWER = 4;

// exp overflow guard: |Re| above this ⇒ the op reports background instead of Inf. Mirrored in
// shader.ts. ~e^60 is already astronomically beyond any sane texture coordinate.
export const EXP_MAX_RE = 60;

export type PrimitiveType = 'affine' | 'mobius' | 'log' | 'exp' | 'power';

export type Card =
  | { type: 'affine'; c: Complex; b: Complex }
  | { type: 'mobius'; a: Complex; b: Complex; c: Complex; d: Complex }
  | { type: 'log' }
  | { type: 'exp' }
  | { type: 'power'; alpha: Complex };

// THE canonical Möbius default, used everywhere a Möbius card is created (the "+ Möbius"
// button, the Inversion preset, any reset): inversion z↦1/z (a=0,b=1,c=1,d=0). The algebraic
// identity Möbius (1,0,0,1) does nothing, so a fresh card must default to this visible map.
export const MOBIUS_INVERSION: Card = {
  type: 'mobius',
  a: complex(0),
  b: complex(1),
  c: complex(1),
  d: complex(0),
};

// A flat op the interpreter applies. tag selects the operation; p0..p3 are its (pre-baked)
// complex params. Affine uses p0,p1; Möbius uses p0..p3; log/exp use none; power uses p0.
export type EncodedOp = {
  tag: number;
  p0: Complex;
  p1: Complex;
  p2: Complex;
  p3: Complex;
};

const ZERO = complex(0);
const ONE = complex(1);
const IDENTITY_AFFINE: EncodedOp = { tag: OP_AFFINE, p0: ONE, p1: ZERO, p2: ZERO, p3: ZERO };

// ── Forward f and inverse f⁻¹ (pure math — NO guards; sampled off singularities in tests) ──

export const forwardCard = (card: Card, z: Complex): Complex => {
  switch (card.type) {
    case 'affine':
      return { re: card.c.re * z.re - card.c.im * z.im + card.b.re, im: card.c.re * z.im + card.c.im * z.re + card.b.im };
    case 'mobius': {
      const num = { re: card.a.re * z.re - card.a.im * z.im + card.b.re, im: card.a.re * z.im + card.a.im * z.re + card.b.im };
      const den = { re: card.c.re * z.re - card.c.im * z.im + card.d.re, im: card.c.re * z.im + card.c.im * z.re + card.d.im };
      const q = cAbs2(den);
      return { re: (num.re * den.re + num.im * den.im) / q, im: (num.im * den.re - num.re * den.im) / q };
    }
    case 'log':
      return { re: Math.log(Math.hypot(z.re, z.im)), im: Math.atan2(z.im, z.re) };
    case 'exp': {
      const r = Math.exp(z.re);
      return { re: r * Math.cos(z.im), im: r * Math.sin(z.im) };
    }
    case 'power': {
      const lg = { re: Math.log(Math.hypot(z.re, z.im)), im: Math.atan2(z.im, z.re) };
      const e = cMul(card.alpha, lg);
      const r = Math.exp(e.re);
      return { re: r * Math.cos(e.im), im: r * Math.sin(e.im) };
    }
  }
};

export const inverseCard = (card: Card, w: Complex): Complex => {
  switch (card.type) {
    case 'affine':
      // (w − b)/c
      return cMul(cInv(card.c), { re: w.re - card.b.re, im: w.im - card.b.im });
    case 'mobius':
      return forwardCard(
        { type: 'mobius', a: card.d, b: cNeg(card.b), c: cNeg(card.c), d: card.a },
        w,
      );
    case 'log':
      // inverse of log is exp
      return forwardCard({ type: 'exp' }, w);
    case 'exp':
      // inverse of exp is log
      return forwardCard({ type: 'log' }, w);
    case 'power':
      // w^(1/α)
      return forwardCard({ type: 'power', alpha: cInv(card.alpha) }, w);
  }
};

// ── Degeneracy — a card whose inverse does not exist (baked to identity, flagged in the UI) ──

export const isDegenerate = (card: Card, eps = DEFAULT_EPS): boolean => {
  switch (card.type) {
    case 'affine':
      return cAbs2(card.c) <= eps * eps;
    case 'mobius':
      return (
        cAbs2(determinant(card as unknown as MobiusCoeffs)) <= eps * eps
      );
    case 'power':
      return cAbs2(card.alpha) <= eps * eps;
    default:
      return false;
  }
};

// ── Encode a card's INVERSE as a single shader op (degenerate ⇒ identity affine) ──

export const encodeInverseOp = (card: Card, eps = DEFAULT_EPS): EncodedOp => {
  if (isDegenerate(card, eps)) return IDENTITY_AFFINE;
  switch (card.type) {
    case 'affine': {
      // f⁻¹(w) = (1/c)·w + (−b/c) — itself an affine op.
      const invC = cInv(card.c);
      return {
        tag: OP_AFFINE,
        p0: invC,
        p1: cNeg(cMul(invC, card.b)),
        p2: ZERO,
        p3: ZERO,
      };
    }
    case 'mobius': {
      const inv = inverseCoeffs(card as unknown as MobiusCoeffs); // adjugate A=d,B=−b,C=−c,D=a
      return { tag: OP_MOBIUS, p0: inv.a, p1: inv.b, p2: inv.c, p3: inv.d };
    }
    case 'log':
      return { tag: OP_EXP, p0: ZERO, p1: ZERO, p2: ZERO, p3: ZERO };
    case 'exp':
      return { tag: OP_LOG, p0: ZERO, p1: ZERO, p2: ZERO, p3: ZERO };
    case 'power':
      return { tag: OP_POWER, p0: cInv(card.alpha), p1: ZERO, p2: ZERO, p3: ZERO };
  }
};

// ── UI metadata: complex params per primitive + a default-constructed card ──

export type ParamSpec = { key: string; label: string };

export const PRIMITIVE_SPECS: Record<
  PrimitiveType,
  { label: string; params: ParamSpec[]; create: () => Card }
> = {
  affine: {
    label: 'Affine · c·z + b',
    params: [
      { key: 'c', label: 'c' },
      { key: 'b', label: 'b' },
    ],
    // Non-identity by default (a small rotate+scale) so a freshly-added card visibly warps.
    create: () => ({ type: 'affine', c: complex(1.2, 0.3), b: complex(0) }),
  },
  mobius: {
    label: 'Möbius · (a·z+b)/(c·z+d)',
    params: [
      { key: 'a', label: 'a' },
      { key: 'b', label: 'b' },
      { key: 'c', label: 'c' },
      { key: 'd', label: 'd' },
    ],
    create: () => ({ ...MOBIUS_INVERSION }),
  },
  log: { label: 'Log', params: [], create: () => ({ type: 'log' }) },
  exp: { label: 'Exp', params: [], create: () => ({ type: 'exp' }) },
  power: {
    label: 'Power · zᵅ',
    params: [{ key: 'alpha', label: 'α' }],
    create: () => ({ type: 'power', alpha: complex(2) }),
  },
};

export const PRIMITIVE_ORDER: PrimitiveType[] = [
  'affine',
  'mobius',
  'log',
  'exp',
  'power',
];
