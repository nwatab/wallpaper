// ─────────────────────────────────────────────────────────────────────────────
// WEBGL2 ADAPTER — the only stateful, GL-touching module of the conformal path. It wraps the
// external WebGL system (the allowed exception to "no classes / no mutation"): GL objects and
// uniform locations are captured in a closure rather than a class, and mutated through the
// returned handle. All the actual MATH it drives is the pure, tested code in mobius.ts /
// lattice.ts / shader.ts — this file only uploads it and issues one draw call.
//
// One fullscreen triangle (no vertex buffer — gl_VertexID), one fragment shader, one texture
// (the seamless cell, REPEAT-wrapped with mipmaps). Raw WebGL2, zero dependencies.
// ─────────────────────────────────────────────────────────────────────────────

import { FRAGMENT_SRC, VERTEX_SRC } from './shader';
import { type Basis2 } from './lattice';
import { type Card } from './primitives';
import { encodePipeline, MAX_CARDS, DEFAULT_POLE_EPS } from './pipeline';

export type RgbaColor = [number, number, number, number];

// ── DEV-ONLY measurement hook (Part A) ────────────────────────────────────────
// Captures the ACTUAL size-chain + uploaded matrices each draw into window.__warpDebug, so an
// E2E harness (e2e/) can read the real WebGL state + readPixels the drawing buffer. Pure
// measurement: rendering logic/order/values are unchanged. Gated to non-production builds; in
// dev the context also keeps preserveDrawingBuffer so readPixels works after the frame.
const DEBUG = process.env.NODE_ENV !== 'production';

export type WarpDebug = {
  Rx: number; // resolution / drawing-buffer width  (= canvas.width)
  Ry: number; // resolution / drawing-buffer height (= canvas.height)
  Hx: number; // world half-extent x (viewHalfExtents)
  Hy: number; // world half-extent y
  canvasW: number;
  canvasH: number;
  cssW: number; // canvas.clientWidth  (displayed CSS px)
  cssH: number; // canvas.clientHeight
  dpr: number;
  viewport: number[]; // gl.getParameter(gl.VIEWPORT) → [x,y,w,h]
  B: Float32Array; // forward basis (column-major), inverse of Binv
  Binv: Float32Array; // uploaded u_invBasis (column-major), == the array handed to uniformMatrix2fv
  programId: number; // identifies the shader program instance (same path ⇒ same id)
  count: number; // u_count = pipeline length uploaded this draw (0 = empty passthrough)
  blend: { enabled: boolean; srcRGB: number; dstRGB: number; srcA: number; dstA: number };
  sampling: {
    wrapS: number;
    wrapT: number;
    minFilter: number;
    magFilter: number;
  } | null;
  // The BAKED cell texture (FBO readback, downsampled, RGBA) — to inspect whether the content is
  // baked axis-aligned/"upright" in uv or pre-sheared into lattice coords. May be y-flipped.
  cellTexture: { width: number; height: number; data: number[] } | null;
  gl: WebGL2RenderingContext; // for readPixels (stays in-page; not serialized)
};

// Module counter so the harness can tell whether the empty (0/8) and with-cards draws use the
// SAME shader program instance (i.e. the same render path) — dev only.
let warpProgramCounter = 0;

declare global {
  var __warpDebug: WarpDebug | undefined;
  // DEV-ONLY fidelity gate: inject a known axis-aligned anisotropic scale into the display
  // transform so the E2E harness can prove it detects (not hides) such a distortion. Dead-code
  // in production (DEBUG === false). kx/ky scale the displayed pattern along screen x/y.
  var __warpInjectAniso: { kx: number; ky: number } | undefined;
}

// COLUMN-MAJOR packing for gl.uniformMatrix2fv(loc, /*transpose*/ false, …). WebGL wants the
// array column-by-column: [col0.x, col0.y, col1.x, col1.y]. Our Affine2D/Basis2 {a,b,c,d} (and
// SVG matrix(a b c d)) represents the matrix [[a,c],[b,d]] — applyToPoint does x'=a·x+c·y,
// y'=b·x+d·y — whose columns are exactly (a,b) and (c,d). So the correct column-major array IS
// [a,b,c,d], and GLSL reads it back as that SAME matrix (no transpose). Exported so the
// serialization audit (warp-serialization.test.ts) checks the REAL bytes uploaded, interpreted
// the way GLSL will — the one test the geometry oracle (correct-TS-matrix) cannot perform.
export const mat2ColumnMajor = (m: Basis2): number[] => [m.a, m.b, m.c, m.d];

// Y-FRAME (see warp-parity.test.ts). The cell SVG is authored y-DOWN; the GL path renders
// clip-space y-UP. Those are TWO y-flips in DIFFERENT frames around the B⁻¹ sampling: an UNPACK
// flip lives in the TEXEL/uv frame (after B⁻¹), the clip-y-up lives in the WORLD frame (before
// B⁻¹). "Even parity" (the old reasoning) only preserves HANDEDNESS — it does NOT cancel: flips on
// opposite sides of B⁻¹ CONJUGATE it (J·B⁻¹·J), flipping the off-diagonal for any sheared/rotated
// basis (harmless only on an axis-aligned rect at rotation 0). Fix: keep BOTH y-flips on the WORLD
// side so they cancel for every B — i.e. do NOT UNPACK-flip (texture stays SVG-oriented) and undo
// the clip-y-up by negating world-y just before B⁻¹ in the shader (SHADER_FLIPS_WORLD_Y_BEFORE_BASIS).
// Exported so the parity test guards this flag against silent change.
export const TEXTURE_FLIP_Y = false;

// World half-extents per axis. The viewport maps clip [-1,1]² onto the (non-square) canvas, so
// to keep world→PIXEL ISOTROPIC the world half-extents must carry the canvas aspect (the longer
// axis gets the larger half-extent). Exported + pure so warp-isotropy.test.ts can assert
// sx == sy on a NON-SQUARE canvas — the test a square canvas would hide.
export const viewHalfExtents = (
  viewHalf: number,
  canvasW: number,
  canvasH: number,
): { halfX: number; halfY: number } => {
  const aspect = canvasW / canvasH;
  return aspect >= 1
    ? { halfX: viewHalf * aspect, halfY: viewHalf }
    : { halfX: viewHalf, halfY: viewHalf / aspect };
};

// px-per-world-unit along each screen axis: clip [-1,1] (span 2·half world) → canvas dimension.
export const worldPixelScale = (
  viewHalf: number,
  canvasW: number,
  canvasH: number,
): { sx: number; sy: number } => {
  const { halfX, halfY } = viewHalfExtents(viewHalf, canvasW, canvasH);
  return { sx: canvasW / (2 * halfX), sy: canvasH / (2 * halfY) };
};

export type DrawParams = {
  cards: Card[]; // the warp pipeline; encoded (reversed + inverse-baked) on upload
  invBasis: Basis2; // B⁻¹ (columns a,b then c,d) from lattice.inverseBasis2
  // Clip [-1,1]² → world. center = world point at screen centre; half = world half-extent
  // (longer screen axis); rotationDeg rotates the world frame. Aspect handled internally.
  view: { center: [number, number]; half: number; rotationDeg: number };
  background: RgbaColor;
  poleEps?: number;
};

export type WarpRenderer = {
  setPattern: (source: TexImageSource) => void;
  draw: (params: DrawParams) => void;
  resize: (cssWidth: number, cssHeight: number, dpr: number) => void;
  dispose: () => void;
};

const compile = (
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('createShader failed');
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader compile failed: ${log}`);
  }
  return shader;
};

/**
 * Create a Warp renderer over a canvas, or null if WebGL2 is unavailable (caller falls back
 * to a message). Compiles the program and looks up uniforms once; the returned handle drives
 * texture upload, per-frame uniforms, resize, and teardown.
 */
export const createWarpRenderer = (
  canvas: HTMLCanvasElement,
): WarpRenderer | null => {
  const gl = canvas.getContext('webgl2', {
    premultipliedAlpha: false,
    antialias: false,
    // Dev only: keep the buffer readable after the frame so the E2E harness can readPixels. No
    // effect on rendered values (only whether the buffer is preserved post-composite). Spread
    // conditionally so the attribute — and its name — is DEAD-CODE-ELIMINATED in prod (DEBUG=false
    // ⇒ `...({})`), not merely set false; verified by the prod-clean grep.
    ...(DEBUG ? { preserveDrawingBuffer: true } : {}),
  });
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SRC);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    throw new Error(`program link failed: ${log}`);
  }
  // Shaders live in the program after link; the standalone objects can go.
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  const programId = DEBUG ? ++warpProgramCounter : 0;

  const u = {
    tex: gl.getUniformLocation(program, 'u_tex'),
    viewCenter: gl.getUniformLocation(program, 'u_viewCenter'),
    viewMatrix: gl.getUniformLocation(program, 'u_viewMatrix'),
    invBasis: gl.getUniformLocation(program, 'u_invBasis'),
    poleEps: gl.getUniformLocation(program, 'u_poleEps'),
    background: gl.getUniformLocation(program, 'u_background'),
    count: gl.getUniformLocation(program, 'u_count'),
    tag: gl.getUniformLocation(program, 'u_tag'),
    p0: gl.getUniformLocation(program, 'u_p0'),
    p1: gl.getUniformLocation(program, 'u_p1'),
    p2: gl.getUniformLocation(program, 'u_p2'),
    p3: gl.getUniformLocation(program, 'u_p3'),
  };

  // Empty VAO — the fullscreen triangle is generated from gl_VertexID, no attributes.
  const vao = gl.createVertexArray();

  let texture: WebGLTexture | null = null;
  let cellTextureDump: WarpDebug['cellTexture'] = null;

  const setPattern = (source: TexImageSource): void => {
    if (!texture) texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // The cell SVG is rasterised top-left origin; flip so uv (0,0) is the cell's XY origin.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, TEXTURE_FLIP_Y);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      source,
    );
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    // REPEAT so a single cell tiles the plane; mipmaps + trilinear so textureGrad can pick a
    // coarse LOD in compressed regions near the pole (anti-aliasing). WebGL2 allows REPEAT +
    // mipmaps on NPOT, but the cell is authored square/POT anyway.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);

    // DEV-ONLY: read the baked texture back via an FBO and downsample, so the harness can inspect
    // whether the cell content is baked upright (uv/axis-aligned) or pre-sheared. Not the render
    // path (it never runs in prod).
    if (DEBUG) {
      const src = source as { naturalWidth?: number; width?: number; naturalHeight?: number; height?: number };
      const tw = src.naturalWidth ?? src.width ?? 1024;
      const th = src.naturalHeight ?? src.height ?? 1024;
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
        const full = new Uint8Array(tw * th * 4);
        gl.readPixels(0, 0, tw, th, gl.RGBA, gl.UNSIGNED_BYTE, full);
        const N = 256;
        const fx = Math.max(1, Math.floor(tw / N));
        const fy = Math.max(1, Math.floor(th / N));
        const nw = Math.floor(tw / fx);
        const nh = Math.floor(th / fy);
        const out = new Array<number>(nw * nh * 4);
        for (let y = 0; y < nh; y++)
          for (let x = 0; x < nw; x++) {
            const o = (y * fy * tw + x * fx) * 4;
            const oo = (y * nw + x) * 4;
            out[oo] = full[o];
            out[oo + 1] = full[o + 1];
            out[oo + 2] = full[o + 2];
            out[oo + 3] = full[o + 3];
          }
        cellTextureDump = { width: nw, height: nh, data: out };
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fb);
      gl.bindTexture(gl.TEXTURE_2D, texture);
    }
  };

  const resize = (cssWidth: number, cssHeight: number, dpr: number): void => {
    const w = Math.max(1, Math.round(cssWidth * dpr));
    const h = Math.max(1, Math.round(cssHeight * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    gl.viewport(0, 0, w, h);
  };

  const draw = (params: DrawParams): void => {
    const { cards, invBasis, view, background } = params;
    // Möbius pole eps (shader: |C·w+D|² below this → background), in world units².
    const poleEps = params.poleEps ?? DEFAULT_POLE_EPS;

    // Aspect: carry the canvas aspect into the world half-extents so world→pixel is isotropic
    // (clip [-1,1]² is stretched onto the non-square canvas). canvas.width/height are device px.
    const { halfX, halfY } = viewHalfExtents(view.half, canvas.width, canvas.height);
    const r = (view.rotationDeg * Math.PI) / 180;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    // M = R(θ)·diag(halfX,halfY), column-major: [m00,m10,m01,m11].
    const viewMatrix = [cos * halfX, sin * halfX, -sin * halfY, cos * halfY];

    // DEV-ONLY: inject a known anisotropic display scale (fidelity-gate test). Scaling the
    // clip→world view matrix by diag(1/kx,1/ky) stretches the DISPLAYED pattern by (kx,ky) along
    // the screen axes. Dead-code in production (DEBUG === false).
    if (DEBUG && typeof window !== 'undefined' && globalThis.__warpInjectAniso) {
      const { kx, ky } = globalThis.__warpInjectAniso;
      viewMatrix[0] /= kx;
      viewMatrix[1] /= kx;
      viewMatrix[2] /= ky;
      viewMatrix[3] /= ky;
    }

    // Encode the pipeline (reverse + bake each inverse) and flatten into the uniform arrays.
    // Always upload MAX entries (identity-padded) so stale tail slots can't be read; u_count
    // bounds the shader loop anyway. Over-long pipelines are clamped to MAX.
    const ops = encodePipeline(cards).slice(0, MAX_CARDS);
    const count = ops.length;
    const tags = new Int32Array(MAX_CARDS);
    const p0 = new Float32Array(MAX_CARDS * 2);
    const p1 = new Float32Array(MAX_CARDS * 2);
    const p2 = new Float32Array(MAX_CARDS * 2);
    const p3 = new Float32Array(MAX_CARDS * 2);
    ops.forEach((op, i) => {
      tags[i] = op.tag;
      p0[i * 2] = op.p0.re; p0[i * 2 + 1] = op.p0.im;
      p1[i * 2] = op.p1.re; p1[i * 2 + 1] = op.p1.im;
      p2[i * 2] = op.p2.re; p2[i * 2 + 1] = op.p2.im;
      p3[i * 2] = op.p3.re; p3[i * 2 + 1] = op.p3.im;
    });

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    gl.uniform2f(u.viewCenter, view.center[0], view.center[1]);
    gl.uniformMatrix2fv(u.viewMatrix, false, viewMatrix);
    gl.uniformMatrix2fv(u.invBasis, false, mat2ColumnMajor(invBasis));
    gl.uniform1f(u.poleEps, poleEps);
    gl.uniform4f(u.background, ...background);
    gl.uniform1i(u.count, count);
    gl.uniform1iv(u.tag, tags);
    gl.uniform2fv(u.p0, p0);
    gl.uniform2fv(u.p1, p1);
    gl.uniform2fv(u.p2, p2);
    gl.uniform2fv(u.p3, p3);

    if (texture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(u.tex, 0);
    }

    gl.clearColor(background[0], background[1], background[2], background[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    // Dev-only capture of the ACTUAL uploaded size-chain + matrices (Part A). After drawArrays
    // so the viewport reflects this frame; values are exactly what was used above.
    if (DEBUG && typeof window !== 'undefined') {
      const det =
        invBasis.a * invBasis.d - invBasis.c * invBasis.b || 1;
      globalThis.__warpDebug = {
        Rx: canvas.width,
        Ry: canvas.height,
        Hx: halfX,
        Hy: halfY,
        canvasW: canvas.width,
        canvasH: canvas.height,
        cssW: canvas.clientWidth,
        cssH: canvas.clientHeight,
        dpr: window.devicePixelRatio || 1,
        viewport: Array.from(gl.getParameter(gl.VIEWPORT) as Int32Array),
        // forward basis B = (u_invBasis)⁻¹, column-major [m00,m10,m01,m11].
        B: new Float32Array([
          invBasis.d / det,
          -invBasis.b / det,
          -invBasis.c / det,
          invBasis.a / det,
        ]),
        Binv: new Float32Array([
          invBasis.a,
          invBasis.b,
          invBasis.c,
          invBasis.d,
        ]),
        programId,
        count,
        blend: {
          enabled: gl.getParameter(gl.BLEND) as boolean,
          srcRGB: gl.getParameter(gl.BLEND_SRC_RGB) as number,
          dstRGB: gl.getParameter(gl.BLEND_DST_RGB) as number,
          srcA: gl.getParameter(gl.BLEND_SRC_ALPHA) as number,
          dstA: gl.getParameter(gl.BLEND_DST_ALPHA) as number,
        },
        sampling: texture
          ? {
              wrapS: gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S) as number,
              wrapT: gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T) as number,
              minFilter: gl.getTexParameter(
                gl.TEXTURE_2D,
                gl.TEXTURE_MIN_FILTER,
              ) as number,
              magFilter: gl.getTexParameter(
                gl.TEXTURE_2D,
                gl.TEXTURE_MAG_FILTER,
              ) as number,
            }
          : null,
        cellTexture: cellTextureDump,
        gl,
      };
    }
  };

  const dispose = (): void => {
    if (texture) gl.deleteTexture(texture);
    if (vao) gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
  };

  return { setPattern, draw, resize, dispose };
};
