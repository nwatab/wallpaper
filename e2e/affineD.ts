// ─────────────────────────────────────────────────────────────────────────────
// AFFINE-D MEASUREMENT (Part A/B/C of the sampling-basis disambiguation).
//
// Goal: measure the 2×2 linear map D such that  warp-F ≈ D · gallery-F  (in a common screen
// frame, rotation 0, only a benign global uniform scale between the two renders). The chiral F
// (motif-dev-f) carries TWO independent, LABELLED stroke directions:
//   • bar  — the two horizontal arms (gallery: ‖ +x, the lattice a-axis)
//   • stem — the vertical spine     (gallery: ‖ +y)
// so we recover D's two columns without the lattice's ± / swap ambiguity. Each stroke direction
// is the gradient-energy-weighted (least-squares) dominant edge orientation over ALL ink edges of
// that family — not a single feature — which is exactly the "least squares over the F's features"
// the task asks for.
//
// DISCRIMINANT (closed forms, c=cosγ, s=sinγ):
//   transpose   B_used = Bᵀ :  D_t = Bᵀ B⁻¹ = [[1, −c/s],[ c , 1−c²/s ]]   → D[1][0]=c   (bar tilts)
//   sign-error  b.x → −b.x  :  D_s =          [[1, −2c/s],[ 0 ,   1    ]]   → D[1][0]=0   (bar level)
// Both tilt the STEM, so the stem alone cannot separate them. The BAR's tilt is the judge:
//   measured D[1][0] = tan(Δθ_bar)  ≈ cosγ → TRANSPOSE ;  ≈ 0 → SIGN-ERROR.
// rect (c=0) ⇒ both predict D≈I (control).
// ─────────────────────────────────────────────────────────────────────────────

import type { Image, V2 } from './lattice';

const lum = (r: number, g: number, b: number): number =>
  0.299 * r + 0.587 * g + 0.114 * b;

export type Orientation = { deg: number; weight: number };
export type StrokeDirs = {
  bar: Orientation; // the more-horizontal stroke family (gallery ≈ 0°/180°)
  stem: Orientation; // the more-vertical stroke family   (gallery ≈ 90°)
  peaks: [Orientation, Orientation]; // the two raw peaks (unlabelled) — for rotation-aware relabelling
  hist: number[]; // 1°-binned, smoothed orientation histogram (for diagnostics)
};

// Centre-square crop → grayscale ink field (255 − lum), area-averaged, optional source row-flip.
const inkField = (
  img: Image,
  M: number,
  flipY = false,
): { f: Float64Array; M: number } => {
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
  return { f, M };
};

// Circular (mod 180°) Gaussian smoothing of a 180-bin orientation histogram.
const smooth180 = (h: number[], sigma: number): number[] => {
  const r = Math.ceil(3 * sigma);
  const k: number[] = [];
  for (let i = -r; i <= r; i++) k.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
  const out = new Array<number>(180).fill(0);
  for (let b = 0; b < 180; b++) {
    let s = 0;
    let wsum = 0;
    for (let i = -r; i <= r; i++) {
      s += h[(b + i + 180) % 180] * k[i + r];
      wsum += k[i + r];
    }
    out[b] = s / wsum;
  }
  return out;
};

// Parabolic sub-bin peak refinement around integer bin b (mod 180), returns fractional degree.
const refine = (h: number[], b: number): number => {
  const y0 = h[(b - 1 + 180) % 180];
  const y1 = h[b];
  const y2 = h[(b + 1) % 180];
  const denom = y0 - 2 * y1 + y2;
  const delta = Math.abs(denom) < 1e-9 ? 0 : (0.5 * (y0 - y2)) / denom;
  return (((b + delta) % 180) + 180) % 180;
};

/**
 * The F's two dominant stroke orientations via a gradient-energy-weighted orientation histogram.
 * Edges of a stroke run ALONG it, so stroke-direction = grad-direction + 90°. Two strokes ⇒ two
 * peaks; we take the strongest and the strongest one ≥ MIN_SEP away. Labelled bar/stem by which is
 * nearer the horizontal (gallery bar ≈ 0–27°, stem ≈ 90–130° in both bug hypotheses).
 */
export const strokeDirections = (
  img: Image,
  opts: { M?: number; flipY?: boolean; minSepDeg?: number } = {},
): StrokeDirs => {
  const M = opts.M ?? 256;
  const minSep = opts.minSepDeg ?? 30;
  const { f } = inkField(img, M, opts.flipY);

  const hist = new Array<number>(180).fill(0);
  let magMax = 0;
  const mag = new Float64Array(M * M);
  const ang = new Float64Array(M * M);
  for (let y = 1; y < M - 1; y++)
    for (let x = 1; x < M - 1; x++) {
      const gx =
        f[(y - 1) * M + x + 1] + 2 * f[y * M + x + 1] + f[(y + 1) * M + x + 1] -
        f[(y - 1) * M + x - 1] - 2 * f[y * M + x - 1] - f[(y + 1) * M + x - 1];
      const gy =
        f[(y + 1) * M + x - 1] + 2 * f[(y + 1) * M + x] + f[(y + 1) * M + x + 1] -
        f[(y - 1) * M + x - 1] - 2 * f[(y - 1) * M + x] - f[(y - 1) * M + x + 1];
      const m = Math.hypot(gx, gy);
      mag[y * M + x] = m;
      // stroke orientation = gradient direction + 90°, folded to [0,180)
      let o = (Math.atan2(gy, gx) * 180) / Math.PI + 90;
      o = ((o % 180) + 180) % 180;
      ang[y * M + x] = o;
      if (m > magMax) magMax = m;
    }
  // Weight by magnitude² above a noise floor (suppresses AA fringes; emphasises true edges).
  const floor = 0.15 * magMax;
  for (let i = 0; i < M * M; i++) {
    const m = mag[i];
    if (m < floor) continue;
    const o = ang[i];
    const b = Math.floor(o);
    const frac = o - b;
    hist[b % 180] += m * m * (1 - frac);
    hist[(b + 1) % 180] += m * m * frac;
  }
  const sm = smooth180(hist, 2.5);

  // peak1 = global max; peak2 = strongest bin ≥ minSep away (mod 180).
  let b1 = 0;
  for (let b = 1; b < 180; b++) if (sm[b] > sm[b1]) b1 = b;
  let b2 = -1;
  for (let b = 0; b < 180; b++) {
    const d = Math.min(Math.abs(b - b1), 180 - Math.abs(b - b1));
    if (d < minSep) continue;
    if (b2 < 0 || sm[b] > sm[b2]) b2 = b;
  }
  if (b2 < 0) b2 = (b1 + 90) % 180;
  const p1: Orientation = { deg: refine(sm, b1), weight: sm[b1] };
  const p2: Orientation = { deg: refine(sm, b2), weight: sm[b2] };

  // Label by horizontality: distance to the 0/180 axis (mod 180).
  const horizDist = (d: number) => Math.min(d, 180 - d);
  const [bar, stem] =
    horizDist(p1.deg) <= horizDist(p2.deg) ? [p1, p2] : [p2, p1];
  return { bar, stem, peaks: [p1, p2], hist: sm };
};

// Re-label the two raw peaks as {bar, stem} by NEAREST orientation to given targets — rotation-aware
// (the horizontality default breaks once the lattice is rotated ≥45°). 2×2 optimal assignment.
export const assignByTargets = (
  dirs: StrokeDirs,
  barTargetDeg: number,
  stemTargetDeg: number,
): { bar: Orientation; stem: Orientation } => {
  const [p, q] = dirs.peaks;
  const cost = (x: Orientation, t: number) => Math.abs(lineDiff(x.deg, t));
  const straight =
    cost(p, barTargetDeg) + cost(q, stemTargetDeg);
  const swapped = cost(q, barTargetDeg) + cost(p, stemTargetDeg);
  return straight <= swapped ? { bar: p, stem: q } : { bar: q, stem: p };
};

// Smallest signed line-orientation difference a−b, in (−90, 90].
export const lineDiff = (a: number, b: number): number => {
  let d = ((a - b + 90) % 180) - 90;
  if (d <= -90) d += 180;
  return d;
};

// Unit direction vector (x,y) for a line orientation in degrees (screen coords, y-down).
const dirVec = (deg: number): V2 => ({
  x: Math.cos((deg * Math.PI) / 180),
  y: Math.sin((deg * Math.PI) / 180),
});

// SIGNED angle (degrees, [0,180]) from the bar to the stem, with stroke SENSES resolved by the F's
// geometry (bar→+x, stem→+y/down-page). Frame-robust to global rotation & uniform scale. gallery
// bar∥a, stem∥b ⇒ gallery angle = γ (acute). The judge: a sign-error makes the stem lean the OTHER
// way ⇒ the angle OPENS to 180−γ (obtuse); transpose keeps it ≈γ (acute). Senses are valid only
// when the warp is NOT globally flipped — corroborate with matchFlip (det=+1). NB: an UNSIGNED |cos|
// angle is degenerate here (108° and 72° both read 72° from horizontal) and cannot discriminate.
export const barStemAngle = (s: StrokeDirs): number => {
  const b = dirVec(s.bar.deg);
  const t = dirVec(s.stem.deg);
  const bx = b.x < 0 ? -b.x : b.x; // bar → +x
  const by = b.x < 0 ? -b.y : b.y;
  const tx = t.y < 0 ? -t.x : t.x; // stem → +y
  const ty = t.y < 0 ? -t.y : t.y;
  const dot = bx * tx + by * ty; // signed cos (unit vectors)
  return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
};

// Closed-form predicted bar–stem angle for each hypothesis, applied to gallery (a=(1,0), b=(c,s)).
//   correct/identity → γ ;  transpose → acos(c/√(1+c²)) ;  sign-error → 180−γ.
export const predictBarStemAngle = (
  c: number,
  s: number,
): { identity: number; transpose: number; sign: number } => {
  const deg = (r: number) => (r * 180) / Math.PI;
  return {
    identity: deg(Math.acos(c)), // = γ
    transpose: deg(Math.acos(c / Math.sqrt(1 + c * c))),
    sign: deg(Math.acos(-c)), // = 180 − γ
  };
};

export type Mat2 = [number, number, number, number]; // [d00, d01, d10, d11] row-major

const invertG = (g: Mat2): Mat2 => {
  const [a, b, c, d] = g;
  const det = a * d - b * c;
  return [d / det, -b / det, -c / det, a / det];
};
const mul2 = (a: Mat2, b: Mat2): Mat2 => [
  a[0] * b[0] + a[1] * b[2],
  a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2],
  a[2] * b[1] + a[3] * b[3],
];

/**
 * Recover D (warp ≈ D·gallery) from the two LABELLED stroke directions of each image.
 *   G = [bar_g | stem_g],  W = [bar_w | stem_w]  (unit columns) ⇒  D_dir = W · G⁻¹.
 * The columns are unit (direction only), so global per-axis scale is not fixed; we report:
 *   • D (normalised so D[0][0]=1) — strips the benign global uniform scale; D[1][0]=tan(Δθ_bar) is
 *     the assumption-free discriminant.
 *   • the raw stroke tilts (Δbar, Δstem) relative to the gallery, for the closed-form residuals.
 * worldFrame: negate the screen-y of every direction (screen is y-down) so the result is comparable
 * to the maths-convention (y-up) closed forms D_t / D_s.
 */
export const fitD = (
  gallery: StrokeDirs,
  warp: StrokeDirs,
): { D: Mat2; Draw: Mat2; dBar: number; dStem: number } => {
  // Native y-down (authoring/SVG/basis) frame — the SAME frame the closed forms D_t/D_s live in.
  // Lines are signless (mod 180); resolve each warp stroke's sense to ALIGN with its gallery
  // counterpart (dot ≥ 0). This is rotation-robust (a fixed +x/+y rule mislabels once the lattice
  // is rotated ≥45°) and yields the closest ORIENTATION-PRESERVING D, so |D−I| measures the SHEAR
  // cleanly with no spurious det<0. Reflection/handedness (det sign) is NOT inferable from mod-180
  // orientations — detect it separately with matchFlip (mod-360). At rotation 0 this reduces to the
  // bar→+x / stem→+y senses, so the transpose-vs-sign closed-form match is unchanged.
  const align = (v: V2, ref: V2): V2 =>
    v.x * ref.x + v.y * ref.y < 0 ? { x: -v.x, y: -v.y } : v;
  const bg = dirVec(gallery.bar.deg);
  const sg = dirVec(gallery.stem.deg);
  const bw = align(dirVec(warp.bar.deg), bg);
  const sw = align(dirVec(warp.stem.deg), sg);

  const G: Mat2 = [bg.x, sg.x, bg.y, sg.y]; // [a | b]  (≈ [[1,c],[0,s]])
  const W: Mat2 = [bw.x, sw.x, bw.y, sw.y]; // warp [a' | b']
  const Draw = mul2(W, invertG(G)); // unit-column D = W · G⁻¹  (already in the right frame)
  // Normalise so D[0][0]=1 (strips the benign global uniform scale); D[1][0] = bar-tilt discriminant.
  const k = Draw[0] !== 0 ? 1 / Draw[0] : 1;
  const D: Mat2 = [Draw[0] * k, Draw[1] * k, Draw[2] * k, Draw[3] * k];

  // Signed stroke tilts relative to the gallery, native frame, (−90,90].
  const dBar = lineDiff(warp.bar.deg, gallery.bar.deg);
  const dStem = lineDiff(warp.stem.deg, gallery.stem.deg);
  return { D, Draw, dBar, dStem };
};

// Closed-form hypotheses.
export const D_transpose = (c: number, s: number): Mat2 => [
  1,
  -c / s,
  c,
  1 - (c * c) / s,
];
export const D_sign = (c: number, s: number): Mat2 => [1, (-2 * c) / s, 0, 1];

export const matResidual = (a: Mat2, b: Mat2): number =>
  Math.sqrt(
    a.reduce((acc, _v, i) => acc + (a[i] - b[i]) * (a[i] - b[i]), 0),
  );

export const fmtMat = (m: Mat2): string =>
  `[[${m[0].toFixed(3)}, ${m[1].toFixed(3)}], [${m[2].toFixed(3)}, ${m[3].toFixed(3)}]]`;
