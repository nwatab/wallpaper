import { describe, it, expect } from 'vitest';
import { type Complex, complex, cSub, cAbs2, cPow, cExp, cLog, cMul } from './mobius';
import { forwardCard, type Card } from './primitives';
import {
  composedForward,
  composedInverse,
  encodePipeline,
  applyEncodedOps,
} from './pipeline';

const near = (z: Complex, w: Complex, eps = 1e-6) =>
  expect(cAbs2(cSub(z, w))).toBeLessThan(eps * eps);

const PTS: Complex[] = [
  complex(0.7, 0.4),
  complex(1.3, -0.5),
  complex(2.0, 0.3),
  complex(0.9, 0.8),
];

// A composable multi-card pipeline (no exp/log so round-trips compose cleanly anywhere).
const PIPE: Card[] = [
  { type: 'affine', c: complex(1.2, 0.3), b: complex(-0.4, 0.1) },
  { type: 'mobius', a: complex(1, 0.2), b: complex(0.1, -0.3), c: complex(0.2, 0), d: complex(1, 0) },
  { type: 'affine', c: complex(0.8, -0.6), b: complex(0.2, 0.2) },
];

describe('composition round-trip', () => {
  it('f(f⁻¹(w)) = w for a multi-card pipeline', () => {
    for (const w of PTS) near(composedForward(PIPE, composedInverse(PIPE, w)), w);
  });

  it('f⁻¹ is the reverse-composition of per-card inverses (definition holds)', () => {
    // composedInverse applies cards in reverse; rebuild it by hand and compare.
    for (const w of PTS) {
      const byHand = PIPE.reduceRight(
        (acc, card) => {
          // inverse of one card via the forward of its analytic inverse
          if (card.type === 'affine')
            return cMul(
              { re: acc.re - card.b.re, im: acc.im - card.b.im },
              { re: card.c.re / cAbs2(card.c), im: -card.c.im / cAbs2(card.c) },
            );
          return composedInverse([card], acc);
        },
        w,
      );
      near(composedInverse(PIPE, w), byHand);
    }
  });
});

describe('encoded interpreter mirrors the math (TS twin of the shader loop)', () => {
  it('applyEncodedOps(encodePipeline(cards), w) = composedInverse(cards, w)', () => {
    const ops = encodePipeline(PIPE);
    for (const w of PTS) {
      const r = applyEncodedOps(ops, w);
      expect(r.ok).toBe(true);
      if (r.ok) near(r.z, composedInverse(PIPE, w));
    }
  });

  it('empty pipeline is exactly identity (z = w) — the unwarped base', () => {
    const ops = encodePipeline([]);
    expect(ops.length).toBe(0);
    for (const w of PTS) {
      const r = applyEncodedOps(ops, w);
      expect(r.ok).toBe(true);
      if (r.ok) near(r.z, w);
    }
  });

  it('reports background (never NaN) when a log card hits the origin', () => {
    const ops = encodePipeline([{ type: 'exp' }]); // inverse of exp is log → singular at 0
    const r = applyEncodedOps(ops, complex(0, 0));
    expect(r.ok).toBe(false);
  });

  it('a degenerate card is a no-op (identity), not a crash', () => {
    const ops = encodePipeline([{ type: 'affine', c: complex(0), b: complex(2, 1) }]);
    for (const w of PTS) {
      const r = applyEncodedOps(ops, w);
      expect(r.ok).toBe(true);
      if (r.ok) near(r.z, w); // identity passthrough
    }
  });
});

describe('Droste preset: log → multiply(α) → exp equals zᵅ', () => {
  // The pipeline [log, affine(c=α,b=0), exp] is the forward map w ↦ exp(α·log w) = w^α.
  const alpha = complex(1.0, 0.3);
  const droste: Card[] = [
    { type: 'log' },
    { type: 'affine', c: alpha, b: complex(0) },
    { type: 'exp' },
  ];

  it('composedForward(droste, z) = z^α = exp(α·log z) at sample points', () => {
    for (const z of PTS) {
      const viaPipe = composedForward(droste, z);
      near(viaPipe, cPow(z, alpha));
      near(viaPipe, cExp(cMul(alpha, cLog(z))));
    }
  });

  it('equals a single power card with the same α', () => {
    for (const z of PTS) {
      near(composedForward(droste, z), forwardCard({ type: 'power', alpha }, z));
    }
  });
});
