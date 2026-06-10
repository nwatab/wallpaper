import { describe, it, expect } from 'vitest';
import {
  type Complex,
  complex,
  cSub,
  cAbs2,
} from './mobius';
import {
  type Card,
  forwardCard,
  inverseCard,
  encodeInverseOp,
  isDegenerate,
  OP_AFFINE,
  OP_MOBIUS,
  OP_LOG,
  OP_EXP,
  OP_POWER,
} from './primitives';

const near = (z: Complex, w: Complex, eps = 1e-7) =>
  expect(cAbs2(cSub(z, w))).toBeLessThan(eps * eps);

// Right half-plane points, off the origin and the negative-real-axis branch cut, with
// |arg| < π/2 so principal-branch round-trips through log/power compose cleanly.
const PTS: Complex[] = [
  complex(0.7, 0.4),
  complex(1.3, -0.6),
  complex(2.0, 0.3),
  complex(0.9, 0.9),
];

// One representative non-degenerate card per primitive (power uses REAL α for clean round-trip).
const CARDS: Record<string, Card> = {
  affine: { type: 'affine', c: complex(1.5, -0.5), b: complex(0.3, 0.8) },
  mobius: { type: 'mobius', a: complex(2, -1), b: complex(0.5, 0.3), c: complex(-1, 0.25), d: complex(1, 1) },
  log: { type: 'log' },
  exp: { type: 'exp' },
  power: { type: 'power', alpha: complex(2) },
};

describe('primitive round-trip f(f⁻¹(w)) = w and f⁻¹(f(z)) = z', () => {
  for (const [name, card] of Object.entries(CARDS)) {
    it(name, () => {
      for (const p of PTS) {
        near(forwardCard(card, inverseCard(card, p)), p);
        near(inverseCard(card, forwardCard(card, p)), p);
      }
    });
  }
});

describe('primitive conformality — Jacobian is a scaled rotation (Cauchy–Riemann)', () => {
  const h = 1e-6;
  for (const [name, card] of Object.entries(CARDS)) {
    it(name, () => {
      for (const z of PTS) {
        const fx0 = forwardCard(card, { re: z.re - h, im: z.im });
        const fx1 = forwardCard(card, { re: z.re + h, im: z.im });
        const fy0 = forwardCard(card, { re: z.re, im: z.im - h });
        const fy1 = forwardCard(card, { re: z.re, im: z.im + h });
        const ux = (fx1.re - fx0.re) / (2 * h);
        const vx = (fx1.im - fx0.im) / (2 * h);
        const uy = (fy1.re - fy0.re) / (2 * h);
        const vy = (fy1.im - fy0.im) / (2 * h);
        // Cauchy–Riemann: u_x = v_y, u_y = −v_x
        expect(Math.abs(ux - vy)).toBeLessThan(1e-4);
        expect(Math.abs(uy + vx)).toBeLessThan(1e-4);
      }
    });
  }
});

describe('inverse-op encoding (degenerate ⇒ identity affine, never NaN)', () => {
  it('affine encodes to an AFFINE op; c≈0 ⇒ identity', () => {
    expect(encodeInverseOp(CARDS.affine).tag).toBe(OP_AFFINE);
    const degen: Card = { type: 'affine', c: complex(0), b: complex(3) };
    expect(isDegenerate(degen)).toBe(true);
    const op = encodeInverseOp(degen);
    expect(op.tag).toBe(OP_AFFINE);
    near(op.p0, complex(1)); // identity
    near(op.p1, complex(0));
  });

  it('möbius encodes its adjugate; ad−bc≈0 ⇒ identity', () => {
    const op = encodeInverseOp(CARDS.mobius);
    expect(op.tag).toBe(OP_MOBIUS);
    near(op.p0, (CARDS.mobius as { d: Complex }).d); // A = d
    const degen: Card = { type: 'mobius', a: complex(1), b: complex(2), c: complex(2), d: complex(4) };
    expect(isDegenerate(degen)).toBe(true);
    expect(encodeInverseOp(degen).tag).toBe(OP_AFFINE); // baked to identity affine
  });

  it('log↔exp encode to the opposite op; power encodes 1/α; α≈0 ⇒ identity', () => {
    expect(encodeInverseOp({ type: 'log' }).tag).toBe(OP_EXP);
    expect(encodeInverseOp({ type: 'exp' }).tag).toBe(OP_LOG);
    const op = encodeInverseOp(CARDS.power);
    expect(op.tag).toBe(OP_POWER);
    near(op.p0, complex(0.5)); // 1/α = 1/2
    const degen: Card = { type: 'power', alpha: complex(0) };
    expect(isDegenerate(degen)).toBe(true);
    expect(encodeInverseOp(degen).tag).toBe(OP_AFFINE);
  });
});

describe('principal branch (log)', () => {
  it('arg ∈ (−π, π] at sample points', () => {
    for (const p of PTS) {
      const a = forwardCard({ type: 'log' }, p).im;
      expect(a).toBeGreaterThan(-Math.PI);
      expect(a).toBeLessThanOrEqual(Math.PI);
    }
  });

  it('jumps by ≈2π across the negative real axis (the cut — expected, not a bug)', () => {
    const above = forwardCard({ type: 'log' }, complex(-1, 1e-6)).im; // ≈ +π
    const below = forwardCard({ type: 'log' }, complex(-1, -1e-6)).im; // ≈ −π
    expect(Math.abs(above - below)).toBeCloseTo(2 * Math.PI, 4);
  });
});
