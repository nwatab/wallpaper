// ─────────────────────────────────────────────────────────────────────────────
// IMAGE COMPARISON HELPERS for the warp E2E guards (warp-affine-D, warp-flip-axis).
//
// Two direction-resolved (mod-360) comparators of rendered pixels, both blind to the cell-uv
// pipeline (they read only the IMAGE, so they cannot launder a basis bug):
//   • matchFlip   — which of {identity, x-flip, y-flip} of the gallery best matches the warp, via
//     a cyclic (translation-invariant) cross-correlation. Names the warp's reflection axis / proves
//     no reflection (chirality preserved).
//   • glyphFacing — the single-cell glyph's lean quadrant (mod 360), to read a baked-cell flip.
// The earlier autocorrelation lattice-extraction + structure-tensor orientation helpers were
// retired with the warp-lattice / warp-inject-aniso / warp-content-shear specs (subsumed by the
// affine-D oracle); only the FFT machinery matchFlip needs remains.
// ─────────────────────────────────────────────────────────────────────────────

export type V2 = { x: number; y: number };
export type Image = { width: number; height: number; data: Uint8Array | number[] }; // RGBA

const lum = (r: number, g: number, b: number): number =>
  0.299 * r + 0.587 * g + 0.114 * b;

// in-place iterative radix-2 FFT (n is a power of two)
const fft1d = (re: Float64Array, im: Float64Array, n: number, inverse: boolean) => {
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len >> 1; k++) {
        const a = i + k;
        const b = a + (len >> 1);
        const vr = re[b] * cr - im[b] * ci;
        const vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr;
        im[b] = im[a] - vi;
        re[a] += vr;
        im[a] += vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
};

const fft2d = (re: Float64Array, im: Float64Array, N: number, inverse: boolean) => {
  const r = new Float64Array(N);
  const m = new Float64Array(N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) { r[x] = re[y * N + x]; m[x] = im[y * N + x]; }
    fft1d(r, m, N, inverse);
    for (let x = 0; x < N; x++) { re[y * N + x] = r[x]; im[y * N + x] = m[x]; }
  }
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) { r[y] = re[y * N + x]; m[y] = im[y * N + x]; }
    fft1d(r, m, N, inverse);
    for (let y = 0; y < N; y++) { re[y * N + x] = r[y]; im[y * N + x] = m[y]; }
  }
};

// ── Direction-preserving flip-axis discrimination ─────────────────────────────
// ORIENTATION (mod 180) cannot tell an x-flip from a y-flip — BOTH map θ→180−θ. To localise the
// WARP's reflection AXIS we compare the warp image against the gallery image under each of
// {identity, x-flip, y-flip} using a DIRECTION-preserving (mod 360) cyclic cross-correlation.
// Because both images are periodic tilings of the SAME chiral glyph, "warp == flip(gallery) up to
// a lattice translation" ⇒ the cyclic correlation peak for the correct flip ≈ 1 (a cyclic shift
// preserves the L2 norm of a zero-mean unit field, so the FFT correlation peak IS the cosine
// similarity at the best alignment). The chiral F has no mirror symmetry, so identity / flipX /
// flipY are mutually distinct and the winning candidate names the reflection axis.

// Centre-square crop → M×M ink field (255−lum), area-averaged; optional source row-flip.
const grayField = (img: Image, M: number, flipY = false): Float64Array => {
  const { width: w, height: h, data } = img;
  const side = Math.min(w, h);
  const ox = Math.floor((w - side) / 2);
  const oy = Math.floor((h - side) / 2);
  const f = new Float64Array(M * M);
  for (let Y = 0; Y < M; Y++)
    for (let X = 0; X < M; X++) {
      const sx0 = ox + Math.floor((X * side) / M);
      const sx1 = ox + Math.floor(((X + 1) * side) / M);
      const sy0 = oy + Math.floor((Y * side) / M);
      const sy1 = oy + Math.floor(((Y + 1) * side) / M);
      let acc = 0;
      let cnt = 0;
      for (let sy = sy0; sy < Math.max(sy0 + 1, sy1); sy++)
        for (let sx = sx0; sx < Math.max(sx0 + 1, sx1); sx++) {
          const o = (sy * w + sx) * 4;
          acc += 255 - lum(data[o], data[o + 1], data[o + 2]);
          cnt++;
        }
      const row = flipY ? M - 1 - Y : Y;
      f[row * M + X] = acc / Math.max(1, cnt);
    }
  return f;
};

const flipFieldX = (f: Float64Array, M: number): Float64Array => {
  const o = new Float64Array(M * M);
  for (let y = 0; y < M; y++)
    for (let x = 0; x < M; x++) o[y * M + x] = f[y * M + (M - 1 - x)];
  return o;
};
const flipFieldY = (f: Float64Array, M: number): Float64Array => {
  const o = new Float64Array(M * M);
  for (let y = 0; y < M; y++)
    for (let x = 0; x < M; x++) o[y * M + x] = f[(M - 1 - y) * M + x];
  return o;
};

// zero-mean, unit-L2 (so a cyclic cross-correlation peak = cosine similarity ∈ [−1,1])
const normalizeField = (f: Float64Array): Float64Array => {
  let mean = 0;
  for (let i = 0; i < f.length; i++) mean += f[i];
  mean /= f.length;
  const o = new Float64Array(f.length);
  let ss = 0;
  for (let i = 0; i < f.length; i++) {
    o[i] = f[i] - mean;
    ss += o[i] * o[i];
  }
  const norm = Math.sqrt(ss) || 1;
  for (let i = 0; i < o.length; i++) o[i] /= norm;
  return o;
};

// max over all cyclic 2D shifts of <a, shift(b)> via FFT: IFFT(FFT(a)·conj(FFT(b))).
const maxCyclicCorr = (a: Float64Array, b: Float64Array, M: number): number => {
  const ar = Float64Array.from(a);
  const ai = new Float64Array(M * M);
  const br = Float64Array.from(b);
  const bi = new Float64Array(M * M);
  fft2d(ar, ai, M, false);
  fft2d(br, bi, M, false);
  const pr = new Float64Array(M * M);
  const pi = new Float64Array(M * M);
  for (let i = 0; i < M * M; i++) {
    pr[i] = ar[i] * br[i] + ai[i] * bi[i]; // A · conj(B)
    pi[i] = ai[i] * br[i] - ar[i] * bi[i];
  }
  fft2d(pr, pi, M, true);
  let mx = -Infinity;
  for (let i = 0; i < M * M; i++) if (pr[i] > mx) mx = pr[i];
  return mx;
};

export type FlipCandidate = 'identity' | 'flipX' | 'flipY';
export type FlipMatch = {
  best: FlipCandidate;
  scores: Record<FlipCandidate, number>;
  margin: number; // best − 2nd-best (discrimination confidence)
};

// Which of {identity, x-flip, y-flip} of the gallery best matches the warp (direction-preserving).
export const matchFlip = (
  warp: Image,
  gallery: Image,
  opts: { M?: number; warpFlipY?: boolean; galleryFlipY?: boolean } = {},
): FlipMatch => {
  const M = opts.M ?? 128;
  const W = normalizeField(grayField(warp, M, opts.warpFlipY));
  const G = grayField(gallery, M, opts.galleryFlipY);
  const scores: Record<FlipCandidate, number> = {
    identity: maxCyclicCorr(W, normalizeField(G), M),
    flipX: maxCyclicCorr(W, normalizeField(flipFieldX(G, M)), M),
    flipY: maxCyclicCorr(W, normalizeField(flipFieldY(G, M)), M),
  };
  const ranked = (['identity', 'flipX', 'flipY'] as FlipCandidate[]).sort(
    (p, q) => scores[q] - scores[p],
  );
  return { best: ranked[0], scores, margin: scores[ranked[0]] - scores[ranked[1]] };
};

// ── Single-cell glyph FACING (mod 360) ────────────────────────────────────────
// For a single baked cell: ink-weighted centroid relative to the ink BBOX centre. The sign of
// (cxRel, cyRel) names the quadrant the glyph "leans" into, distinguishing identity / flipX /
// flipY / rot180 — a DIRECTION measure (mod 360). The authored F (SVG y-down) leans top-left.
export type Facing = { cxRel: number; cyRel: number; quadrant: string };
export const glyphFacing = (
  img: Image,
  opts: { flipY?: boolean; darkThreshold?: number } = {},
): Facing => {
  const { width: w, height: h, data } = img;
  const darkT = opts.darkThreshold ?? 140;
  let sx = 0;
  let sy = 0;
  let sw = 0;
  let minx = w;
  let maxx = 0;
  let miny = h;
  let maxy = 0;
  for (let Y = 0; Y < h; Y++) {
    const srcY = opts.flipY ? h - 1 - Y : Y;
    for (let x = 0; x < w; x++) {
      const o = (srcY * w + x) * 4;
      if (lum(data[o], data[o + 1], data[o + 2]) >= darkT) continue; // not ink
      const ink = 255 - lum(data[o], data[o + 1], data[o + 2]);
      sx += x * ink;
      sy += Y * ink;
      sw += ink;
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (Y < miny) miny = Y;
      if (Y > maxy) maxy = Y;
    }
  }
  if (sw === 0) return { cxRel: 0, cyRel: 0, quadrant: 'none' };
  const cx = sx / sw;
  const cy = sy / sw;
  const bcx = (minx + maxx) / 2;
  const bcy = (miny + maxy) / 2;
  const cxRel = (cx - bcx) / Math.max(1, (maxx - minx) / 2);
  const cyRel = (cy - bcy) / Math.max(1, (maxy - miny) / 2);
  return {
    cxRel,
    cyRel,
    quadrant: `${cyRel < 0 ? 'top' : 'bottom'}-${cxRel < 0 ? 'left' : 'right'}`,
  };
};
