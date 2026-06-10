import { describe, it, expect } from 'vitest';
import { basisToMatrix } from '../affine';
import { TEXTURE_FLIP_Y } from './glRenderer';
import { SHADER_SAMPLES_V_FLIPPED, SHADER_FLIPS_WORLD_Y_BEFORE_BASIS } from './shader';

// ─────────────────────────────────────────────────────────────────────────────
// WARP Y-FRAME AUDIT — PER-SIDE parity around the B⁻¹ sampling.
//
// The OLD audit summed every y-flip and required the TOTAL even ("handedness preserved"). That was
// a TRAP: it passed while the warp was visibly sheared on oblique/hex lattices. Why — the flips do
// NOT all live in the same frame. The sampling is  uv = B⁻¹ · z, and a y-flip can sit on either:
//   • the WORLD side (BEFORE B⁻¹): clip-space is y-UP while the SVG cell/world is y-DOWN; plus an
//     optional shader negate of z.y before B⁻¹.
//   • the UV/TEXEL side (AFTER B⁻¹): the texture UNPACK_FLIP_Y, and/or sampling 1−v.
// A flip on the world side and a flip on the uv side sandwich B⁻¹ → they CONJUGATE it: J·B⁻¹·J.
// J commutes with a diagonal B⁻¹ (rect) but NOT with a sheared/rotated one, so the conjugation
// flips B⁻¹'s OFF-DIAGONAL sign for every non-axis-aligned basis (the measured D_sign shear,
// det=+1, growing with cot γ). "Total even" only tracked the DETERMINANT (reflection), missing the
// frame split entirely.
//
// CORRECT invariant: each SIDE's flip count is EVEN on its own. Same-side flips compose as J·J=I
// (no conjugation of B⁻¹) for ALL bases & rotations; the two sides being independently balanced ⇒
// B⁻¹ is applied verbatim ⇒ warp == gallery. (Verified end-to-end by e2e/warp-affine-D.spec.ts:
// D→I, det+1 across {rect,oblique,hex} × rotations.)
//
//   WORLD side : f_clipYUp (inherent, fixed 1) ⊕ SHADER_FLIPS_WORLD_Y_BEFORE_BASIS
//   UV side    : TEXTURE_FLIP_Y (UNPACK)        ⊕ SHADER_SAMPLES_V_FLIPPED (1−v fetch)
// ─────────────────────────────────────────────────────────────────────────────

// Inherent: WebGL NDC y is up; the cell SVG and the on-screen render are y-down. Always 1 flip,
// on the WORLD side (it acts on the world point before B⁻¹).
const GL_CLIP_IS_Y_UP_VS_SVG_Y_DOWN = true;

const worldSideFlips =
  (GL_CLIP_IS_Y_UP_VS_SVG_Y_DOWN ? 1 : 0) +
  (SHADER_FLIPS_WORLD_Y_BEFORE_BASIS ? 1 : 0);
const uvSideFlips =
  (TEXTURE_FLIP_Y ? 1 : 0) + (SHADER_SAMPLES_V_FLIPPED ? 1 : 0);

const sign = (x: number): number => (x > 0 ? 1 : x < 0 ? -1 : 0);
const detSign = (basis: { a: { x: number; y: number }; b: { x: number; y: number } }) => {
  const B = basisToMatrix(basis);
  return sign(B.a * B.d - B.b * B.c);
};

const S3_2 = Math.sqrt(3) / 2;
// Chiral / sheared test lattices: a left-over flip or conjugation skews/reflects exactly these.
const CHIRAL_BASES: Record<string, { a: { x: number; y: number }; b: { x: number; y: number } }> = {
  'p1 70° oblique': {
    a: { x: 1, y: 0 },
    b: { x: Math.cos((70 * Math.PI) / 180), y: Math.sin((70 * Math.PI) / 180) },
  },
  'hex 120°': { a: { x: 1, y: 0 }, b: { x: -0.5, y: S3_2 } },
  rhombic: { a: { x: 1, y: 0.5 }, b: { x: 1, y: -0.5 } },
  square: { a: { x: 1, y: 0 }, b: { x: 0, y: 1 } },
};

describe('warp y-frame: each side of B⁻¹ is independently balanced (no conjugation, no reflection)', () => {
  it('WORLD-side y-flips are EVEN (clip-y-up undone before B⁻¹)', () => {
    expect(worldSideFlips % 2).toBe(0);
  });

  it('UV-side y-flips are EVEN (texture/sample orientation matches the cell)', () => {
    expect(uvSideFlips % 2).toBe(0);
  });

  // With both sides even there is no net flip sandwiching B⁻¹, so warp handedness == gallery for
  // every basis (no reflection) AND no off-diagonal conjugation (no shear).
  for (const [name, basis] of Object.entries(CHIRAL_BASES)) {
    it(`${name}: warp handedness sign == gallery (no net reflection)`, () => {
      const reflected = worldSideFlips % 2 !== 0 || uvSideFlips % 2 !== 0;
      const warp = detSign(basis) * (reflected ? -1 : 1);
      expect(warp).toBe(detSign(basis));
    });
  }

  it('teeth: toggling ANY single y-flip makes its side ODD → conjugation/reflection returns', () => {
    // The historical bug was world-side=1 (odd) & uv-side=1 (odd): TOTAL even (old test passed) but
    // each side odd ⇒ B⁻¹ conjugated. Flipping any one knob here re-creates an odd side.
    expect((worldSideFlips + 1) % 2).toBe(1); // would-be odd world side
    expect((uvSideFlips + 1) % 2).toBe(1); // would-be odd uv side
    // The current config must be the balanced one (both even), not the old total-even-but-split one.
    expect(worldSideFlips % 2 === 0 && uvSideFlips % 2 === 0).toBe(true);
  });
});
