// ─────────────────────────────────────────────────────────────────────────────
// CONFORMAL WARP — GLSL (WebGL2, #version 300 es). One fullscreen triangle, one fragment
// shader that INVERSE-maps each output pixel through a COMPOSED pipeline, then samples the
// seamless cell texture.
//
// ╔══ DRIFT GAP (read this) ═══════════════════════════════════════════════════╗
// ║ No GL context exists in node, so this GLSL is NOT unit-tested. The op loop    ║
// ║ below is the line-for-line twin of pipeline.ts `applyEncodedOps` / `applyOp`  ║
// ║ (same op tags, same singularity/overflow guards) and the complex helpers are  ║
// ║ twins of mobius.ts (cMul/cDiv/cExp/cLog). Lattice reduction matches           ║
// ║ lattice.ts. The TS is the source of truth; if you change a formula in one,    ║
// ║ change it in the other.                                                       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
//
// Per pixel w (complex, world coords):
//   1. w = viewCenter + viewMatrix · clipPos                        (pixel → world)
//   2. z = f₁⁻¹(…fₙ⁻¹(w)): run the pre-baked inverse OPS front-to-back. The CPU already
//      reversed the cards and baked each inverse (encodePipeline), so this is a plain loop.
//      Any op at its singularity (Möbius pole, log/power at 0, exp overflow) ⇒ background.
//   3. uvC = B⁻¹ · z                                                (CONTINUOUS cell coords)
//   4. textureGrad(tex, fract(uvC), dFdx(uvC), dFdy(uvC))           (LOD from CONTINUOUS uv:
//      kills the wrap-seam blur AND anti-aliases compressed/pole regions in one move)
// ─────────────────────────────────────────────────────────────────────────────

// Must match pipeline.ts MAX_CARDS and primitives.ts OP_* tags / EXP_MAX_RE / LOG_EPS2.
export const SHADER_MAX_CARDS = 8;

// Y-FRAME bookkeeping (see warp-parity.test.ts). Two independent knobs, on OPPOSITE sides of the
// B⁻¹ sampling — they must each be balanced WITHIN their own frame, never summed across frames:
//   • SHADER_SAMPLES_V_FLIPPED — TEXEL/uv frame (AFTER B⁻¹): does the fetch use 1−v? (no).
//   • SHADER_FLIPS_WORLD_Y_BEFORE_BASIS — WORLD frame (BEFORE B⁻¹): does it negate z.y before B⁻¹
//     to undo the clip-space y-UP (so the cell is sampled in the SVG y-DOWN frame)? (yes).
// The world-side negate cancels the inherent clip-y-up flip for EVERY basis/rotation (both are in
// the world frame ⇒ J·J=I, no conjugation of B⁻¹). Pairs with TEXTURE_FLIP_Y=false (no uv-frame flip).
export const SHADER_SAMPLES_V_FLIPPED = false;
export const SHADER_FLIPS_WORLD_Y_BEFORE_BASIS = true;

// Fullscreen triangle: 3 verts covering clip space, no vertex buffer needed (gl_VertexID).
export const VERTEX_SRC = `#version 300 es
out vec2 v_pos;
void main() {
  vec2 p = vec2((gl_VertexID == 1) ? 3.0 : -1.0, (gl_VertexID == 2) ? 3.0 : -1.0);
  v_pos = p;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

export const FRAGMENT_SRC = `#version 300 es
precision highp float;

#define MAX 8
#define OP_AFFINE 0
#define OP_MOBIUS 1
#define OP_LOG 2
#define OP_EXP 3
#define OP_POWER 4
#define EXP_MAX_RE 60.0
#define LOG_EPS2 1e-12

in vec2 v_pos;
out vec4 outColor;

uniform sampler2D u_tex;
uniform vec2 u_viewCenter;   // world point at clip (0,0)
uniform mat2 u_viewMatrix;   // clip [-1,1]² → world: rotation × half-extent (aspect baked in)
uniform mat2 u_invBasis;     // B⁻¹ (columns a,b then c,d) — matches lattice.ts inverseBasis2
uniform float u_poleEps;     // |C·w+D|² below this ⇒ Möbius pole ⇒ background
uniform vec4 u_background;    // colour at a pole / singularity / z=∞

// Pre-baked inverse ops (encodePipeline): tag selects the op; p0..p3 are its complex params.
uniform int u_count;
uniform int u_tag[MAX];
uniform vec2 u_p0[MAX];
uniform vec2 u_p1[MAX];
uniform vec2 u_p2[MAX];
uniform vec2 u_p3[MAX];

// — twins of mobius.ts —
vec2 cMul(vec2 z, vec2 w) {
  return vec2(z.x * w.x - z.y * w.y, z.x * w.y + z.y * w.x);
}
vec2 cDiv(vec2 z, vec2 w) {
  float denom = dot(w, w);
  return vec2(z.x * w.x + z.y * w.y, z.y * w.x - z.x * w.y) / denom;
}
vec2 cExp(vec2 z) {
  float r = exp(z.x);
  return vec2(r * cos(z.y), r * sin(z.y));
}
vec2 cLog(vec2 z) {            // principal branch: arg ∈ (−π,π] via atan(y,x)
  return vec2(log(length(z)), atan(z.y, z.x));
}

void main() {
  vec2 w = u_viewCenter + u_viewMatrix * v_pos; // (1) pixel → world
  vec2 z = w;
  bool bg = false;

  // (2) run the inverse ops. CONSTANT MAX bound + early break (portable across ES 3.00 drivers).
  for (int i = 0; i < MAX; i++) {
    if (i >= u_count) break;
    int tag = u_tag[i];
    if (tag == OP_AFFINE) {
      z = cMul(u_p0[i], z) + u_p1[i];
    } else if (tag == OP_MOBIUS) {
      vec2 denom = cMul(u_p2[i], z) + u_p3[i];
      if (dot(denom, denom) < u_poleEps) { bg = true; break; }
      z = cDiv(cMul(u_p0[i], z) + u_p1[i], denom);
    } else if (tag == OP_LOG) {
      if (dot(z, z) < LOG_EPS2) { bg = true; break; }
      z = cLog(z);
    } else if (tag == OP_EXP) {
      if (z.x > EXP_MAX_RE) { bg = true; break; }
      z = cExp(z);
    } else if (tag == OP_POWER) {
      if (dot(z, z) < LOG_EPS2) { bg = true; break; }
      vec2 e = cMul(u_p0[i], cLog(z));       // w^p0 = exp(p0·log w)
      if (e.x > EXP_MAX_RE) { bg = true; break; }
      z = cExp(e);
    }
  }

  if (bg) { outColor = u_background; return; }

  // (3) continuous cell coords. Negate world y FIRST: the render frame is clip-y-UP but the cell
  // texture (TEXTURE_FLIP_Y=false) is SVG y-DOWN, so map world→SVG-y here, BEFORE B⁻¹. Doing the
  // flip in the WORLD frame (not the texel frame) makes it cancel the clip-y-up for every basis/
  // rotation — flips on the same side of B⁻¹ compose as J·J=I, with no conjugation of B⁻¹.
  vec2 uvC = u_invBasis * vec2(z.x, -z.y);
  vec2 duvdx = dFdx(uvC);                      // (4) LOD from CONTINUOUS uv (not fract!)
  vec2 duvdy = dFdy(uvC);
  outColor = textureGrad(u_tex, fract(uvC), duvdx, duvdy);
}`;
