import * as fs from 'fs';
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { selectTemplate, enterWarp, screenshotWallpaper, readWarpDebug, setRange } from './harness';
import { matchFlip, type Image } from './lattice';
import {
  strokeDirections,
  fitD,
  assignByTargets,
  barStemAngle,
  predictBarStemAngle,
  D_transpose,
  D_sign,
  matResidual,
  fmtMat,
  type Mat2,
} from './affineD';

// ─────────────────────────────────────────────────────────────────────────────
// MEASURE the gallery-F → warp-F affine D per base (rect / oblique70 / hex60) and decide
// TRANSPOSE vs SIGN-ERROR. Two independent, frame-robust discriminants + one chirality check:
//
//  (1) BAR–STEM ANGLE  (frame-INVARIANT: rotation/scale/reflection-proof). gallery bar∥a, stem∥b
//      ⇒ gallery angle = γ. Predicted warp angle:  correct→γ, transpose→acos(c/√(1+c²))≈γ,
//      sign→180−γ. So the sign-error OPENS the F up; transpose barely moves it. The judge.
//  (2) BAR TILT  D[1][0]: transpose tilts the bar (=c≠0); sign keeps it level (=0). |·| is
//      reflection-robust. Refutes transpose outright if the bar stays level.
//  (3) CHIRALITY  matchFlip (mod-360): a sign-error is a det=+1 shear (chirality preserved); a
//      v-flip would be det=−1. rect must read identity (NOT flipY) ⇒ det=+1 ⇒ the shear, not a
//      reflection. (rect c=0 is the only base where det-sign is orientation-visible.)
//
// READ-ONLY: screenshots the two existing render paths + reads the dev __warpDebug dump; changes
// no drawing logic. Goal is IDENTIFYING D, not a green bar.
// ─────────────────────────────────────────────────────────────────────────────

const savePng = (img: Image, path: string) => {
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data as number[]);
  fs.mkdirSync('test-results', { recursive: true });
  fs.writeFileSync(path, PNG.sync.write(png));
};

// γ per base (matches buildDevGlyphTemplates in unitTemplates.ts).
const CASES = [
  { title: 'DEV F rect', tag: 'rect', kind: 'rectangular', gammaDeg: 90 },
  { title: 'DEV F p1 70', tag: 'p1-70', kind: 'oblique 70°', gammaDeg: 70 },
  { title: 'DEV F hex 60', tag: 'hex-60', kind: 'hex 60°', gammaDeg: 60 },
];

const closest = (x: number, opts: { name: string; v: number }[]): string =>
  opts.reduce((best, o) =>
    Math.abs(x - o.v) < Math.abs(x - best.v) ? o : best,
  ).name;

test('measure gallery→warp affine D and disambiguate transpose vs sign-error', async ({
  page,
}) => {
  page.on('console', (m) => console.log('[browser]', m.text()));

  type Row = {
    kind: string;
    c: number;
    Draw: Mat2;
    d10: number;
    phiG: number;
    phiW: number;
    pred: ReturnType<typeof predictBarStemAngle>;
    resT: number;
    resS: number;
    flipBest: string;
    flipScore: number;
    angleVerdict: string;
    barVerdict: string;
  };
  const rows: Row[] = [];

  for (const { title, tag, kind, gammaDeg } of CASES) {
    const c = Math.cos((gammaDeg * Math.PI) / 180);
    const s = Math.sin((gammaDeg * Math.PI) / 180);

    // Gallery (truth): SVG render of the chiral F.
    await selectTemplate(page, title);
    const galleryImg = await screenshotWallpaper(page);
    savePng(galleryImg, `test-results/D-gallery-${tag}.png`);
    const gDirs = strokeDirections(galleryImg);

    // Warp (GL): same template, empty pipeline. Uncheck the lattice overlay so only the F ink is
    // measured, then screenshot top-down (same frame as the gallery shot).
    await enterWarp(page);
    const dbg = (await readWarpDebug(page)) as Record<string, number[]>;
    await page
      .locator('label:has-text("Show lattice frame") input[type=checkbox]')
      .uncheck();
    await page.waitForTimeout(150);
    const warpImg = await screenshotWallpaper(page);
    savePng(warpImg, `test-results/D-warp-${tag}.png`);
    const wDirs = strokeDirections(warpImg);

    // (3) chirality / det sign — does any whole-image flip explain the warp?
    const flip = matchFlip(warpImg, galleryImg);

    const { Draw, dBar, dStem } = fitD(gDirs, wDirs);
    const Dt = D_transpose(c, s);
    const Ds = D_sign(c, s);
    const resT = matResidual(Draw, Dt);
    const resS = matResidual(Draw, Ds);

    // (1) bar–stem angle (frame-invariant).
    const phiG = barStemAngle(gDirs);
    const phiW = barStemAngle(wDirs);
    const pred = predictBarStemAngle(c, s);
    const angleVerdict =
      Math.abs(c) < 1e-6
        ? 'CONTROL'
        : closest(phiW, [
            { name: 'CORRECT', v: pred.identity },
            { name: 'TRANSPOSE', v: pred.transpose },
            { name: 'SIGN-ERROR', v: pred.sign },
          ]);

    // (2) bar tilt D[1][0] (normalised D[0][0]=1).
    const d10 = Draw[0] !== 0 ? Draw[2] / Draw[0] : Draw[2];
    const barVerdict =
      Math.abs(c) < 1e-6
        ? 'CONTROL'
        : Math.abs(Math.abs(d10) - Math.abs(c)) < Math.abs(d10)
          ? 'TRANSPOSE'
          : 'SIGN-ERROR';

    const Binv = dbg.Binv as unknown as number[]; // column-major [a,b,c,d]
    const binvOff = Binv ? Binv[2] : NaN;

    console.log(
      `\n── ${kind} (γ=${gammaDeg}°, c=cosγ=${c.toFixed(3)}, s=${s.toFixed(3)}) ──`,
    );
    console.log(
      `  gallery: bar=${gDirs.bar.deg.toFixed(1)}° stem=${gDirs.stem.deg.toFixed(1)}°  | warp: bar=${wDirs.bar.deg.toFixed(1)}° stem=${wDirs.stem.deg.toFixed(1)}°`,
    );
    console.log(`  stroke tilts vs gallery: Δbar=${dBar.toFixed(1)}° Δstem=${dStem.toFixed(1)}°`);
    console.log(`  measured D (fit)   = ${fmtMat(Draw)}    D[1][0]/D[0][0]=${d10.toFixed(3)}`);
    console.log(`  closed D_transpose = ${fmtMat(Dt)}    (D[1][0]=c=${c.toFixed(3)})`);
    console.log(`  closed D_sign      = ${fmtMat(Ds)}    (D[1][0]=0)`);
    console.log(`  Frobenius residual: vs transpose=${resT.toFixed(3)}   vs sign=${resS.toFixed(3)}`);
    console.log(
      `  (1) bar–stem angle: gallery=${phiG.toFixed(1)}° warp=${phiW.toFixed(1)}°  ` +
        `predict {correct=${pred.identity.toFixed(1)}, transpose=${pred.transpose.toFixed(1)}, sign=${pred.sign.toFixed(1)}}  ⇒ ${angleVerdict}`,
    );
    console.log(`  (2) bar tilt D[1][0]=${d10.toFixed(3)} (transpose→${c.toFixed(3)} / sign→0)  ⇒ ${barVerdict}`);
    console.log(
      `  (3) matchFlip: best=${flip.best}@${flip.scores[flip.best].toFixed(3)} {id:${flip.scores.identity.toFixed(2)},fX:${flip.scores.flipX.toFixed(2)},fY:${flip.scores.flipY.toFixed(2)}}  ` +
        `⇒ ${flip.best === 'identity' && flip.scores.identity > 0.85 ? 'det=+1 (no flip ⇒ shear)' : 'no clean global flip'}`,
    );
    console.log(
      `  uploaded Binv off-diag=${Number.isNaN(binvOff) ? 'n/a' : binvOff.toFixed(3)} (correct −c/s=${(-c / s).toFixed(3)}) ⇒ ${Math.abs(binvOff + c / s) < 0.05 ? 'Binv LOOKS CORRECT — bug is in the APPLIED frame, not the uploaded number' : 'Binv WRONG'}`,
    );

    rows.push({
      kind, c, Draw, d10, phiG, phiW, pred, resT, resS,
      flipBest: flip.best, flipScore: flip.scores[flip.best], angleVerdict, barVerdict,
    });
  }

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  const oblique = rows.filter((r) => Math.abs(r.c) > 1e-6);
  console.log('\n══════════════ AFFINE-D SUMMARY ══════════════');
  for (const r of rows)
    console.log(
      `${r.kind.padEnd(13)} D=${fmtMat(r.Draw)}  φ_warp=${r.phiW.toFixed(1)}° (sign→${r.pred.sign.toFixed(0)}/trans→${r.pred.transpose.toFixed(0)})  ` +
        `resT=${r.resT.toFixed(2)} resS=${r.resS.toFixed(2)}  → angle:${r.angleVerdict} bar:${r.barVerdict}`,
    );

  // Fidelity = D≈I (the clean check the arbiter uses). NB the bar–stem ANGLE cannot separate
  // CORRECT (γ) from TRANSPOSE (acos(c/√(1+c²)), within ~1° of γ) — only the bar TILT D[1][0] does
  // that — so confirm fidelity via |D−I| + D[1][0]≈0, not via angleVerdict.
  const I0: Mat2 = [1, 0, 0, 1];
  const distToI = (r: Row) => matResidual(r.Draw, I0);
  const allCorrect = oblique.every(
    (r) => distToI(r) < 0.1 && Math.abs(r.d10) < 0.1 && r.flipBest === 'identity',
  );
  const allSign = oblique.every(
    (r) => r.angleVerdict === 'SIGN-ERROR' && r.barVerdict === 'SIGN-ERROR',
  );
  const allTranspose = oblique.every(
    (r) => r.angleVerdict === 'TRANSPOSE' && r.barVerdict === 'TRANSPOSE',
  );
  const conclusion = allCorrect
    ? `CORRECT — warp ≈ gallery (D ≈ I, φ_warp ≈ γ). The historical D_sign shear is gone. The bug ` +
      `WAS a frame-split y-flip: UNPACK_FLIP_Y (texel/uv frame) sandwiched B⁻¹ against the clip-y-up ` +
      `(world frame), conjugating it (J·B⁻¹·J) to flip b.x for sheared bases. Fixed by keeping both ` +
      `y-flips in the WORLD frame (TEXTURE_FLIP_Y=false + SHADER_FLIPS_WORLD_Y_BEFORE_BASIS).`
    : allSign
      ? `SIGN-ERROR (D_sign=[[1,−2c/s],[0,1]], det=+1 shear): bar level, stem shears so b acts as (−cosγ,sinγ).`
      : allTranspose
        ? 'TRANSPOSE (D_t = Bᵀ B⁻¹): the bar tilts by cosγ.'
        : 'INCONCLUSIVE — the discriminants disagree across bases; investigate.';
  console.log(`\nCONCLUSION: ${conclusion}`);
  console.log('  (closed forms above show what the historical TRANSPOSE / SIGN-ERROR bugs would read.)');
  console.log('═══════════════════════════════════════════════\n');

  // Teeth — post-fix fidelity at rotation 0 (the rotation-swept test covers all rotations):
  // every base must read CORRECT — bar level, stem un-sheared (φ_warp≈γ), no reflection.
  const rect = rows.find((r) => r.kind === 'rectangular')!;
  expect(Math.abs(rect.d10), 'rect: bar level').toBeLessThan(0.1);
  expect(rect.flipBest, 'rect: warp == gallery (det=+1, no reflection)').toBe('identity');
  for (const r of oblique) {
    expect(distToI(r), `${r.kind}: D ≈ I (warp faithful)`).toBeLessThan(0.1);
    expect(Math.abs(r.d10), `${r.kind}: bar level (no transpose tilt)`).toBeLessThan(0.1);
    expect(r.flipBest, `${r.kind}: no reflection`).toBe('identity');
    const dCorrect = Math.abs(r.phiW - r.pred.identity);
    const dSign = Math.abs(r.phiW - r.pred.sign);
    expect(dCorrect, `${r.kind}: φ_warp≈γ(${r.pred.identity.toFixed(0)}) not sign(${r.pred.sign.toFixed(0)})`).toBeLessThan(dSign);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROTATION-SWEPT ARBITER. The y-frame fix must hold at EVERY rotation (the world-frame flip
// composes with rotateBasis, so rotation 0 alone is insufficient). For each base × rotation we
// drive BOTH the gallery and the warp to the SAME rotation and require:
//   • D → I   (the D_sign shear is gone)          — measured affine, rotation-aware stroke labels
//   • no reflection (det = +1)                    — matchFlip best = identity @ high score
// This is the arbiter: green only when warp reproduces gallery as the identity, at all conditions.
// ─────────────────────────────────────────────────────────────────────────────
const ROTATIONS = [0, 30, 45, 90];
const setRotation = (page: import('@playwright/test').Page, deg: number) =>
  setRange(page.locator('input[type=range][min="0"]'), deg);
const I_MAT: Mat2 = [1, 0, 0, 1];

test('rotation-swept arbiter: warp reproduces gallery as identity (D→I, det+1) at all rotations', async ({
  page,
}) => {
  page.on('console', (m) => console.log('[browser]', m.text()));
  type R = { kind: string; rot: number; D: Mat2; distI: number; detD: number; flip: string; score: number; ok: boolean };
  const rows: R[] = [];

  for (const { title, kind, gammaDeg } of CASES) {
    for (const rot of ROTATIONS) {
      await selectTemplate(page, title);
      await setRotation(page, rot);
      await page.waitForTimeout(120);
      const gImg = await screenshotWallpaper(page);
      const g = strokeDirections(gImg);

      await enterWarp(page);
      await setRotation(page, rot);
      await page
        .locator('label:has-text("Show lattice frame") input[type=checkbox]')
        .uncheck();
      await page.waitForTimeout(150);
      const wImg = await screenshotWallpaper(page);
      const w = strokeDirections(wImg);

      // Rotation-aware labels. The Rotation slider is CCW-positive (coords/canonical):
      // a slider value `rot` renders at internal angle (360−rot)%360, so the gallery bar
      // appears on screen at `shownDeg`, stem at `shownDeg+γ`. (rot=0 ⇒ shownDeg=0,
      // unchanged.) The warp is matched relative to the labelled gallery, so only the
      // gallery's absolute target uses the convention.
      const shownDeg = (360 - rot) % 360;
      const gl = assignByTargets(g, shownDeg, shownDeg + gammaDeg);
      const wl = assignByTargets(w, gl.bar.deg, gl.stem.deg);
      const D = fitD({ ...g, ...gl }, { ...w, ...wl }).Draw;
      const distI = matResidual(D, I_MAT);
      const detD = D[0] * D[3] - D[1] * D[2];
      const flip = matchFlip(wImg, gImg);
      const ok = distI < 0.2 && flip.best === 'identity' && flip.scores.identity > 0.85;
      rows.push({ kind, rot, D, distI, detD, flip: flip.best, score: flip.scores.identity, ok });
      console.log(
        `${kind.padEnd(13)} rot=${String(rot).padStart(2)}°  D=${fmtMat(D)}  |D−I|=${distI.toFixed(3)}  det=${detD.toFixed(3)}  ` +
          `matchFlip=${flip.best}@${flip.scores.identity.toFixed(2)}  ⇒ ${ok ? 'OK' : 'BROKEN'}`,
      );
    }
  }

  console.log('\n══════════ ROTATION-SWEPT SUMMARY ══════════');
  for (const r of rows)
    console.log(
      `${r.kind.padEnd(13)} rot=${String(r.rot).padStart(2)}°  |D−I|=${r.distI.toFixed(3)} det=${r.detD.toFixed(3)} flip=${r.flip}@${r.score.toFixed(2)} → ${r.ok ? 'OK' : 'BROKEN'}`,
    );
  const broken = rows.filter((r) => !r.ok);
  console.log(broken.length ? `\n${broken.length}/${rows.length} BROKEN` : `\nALL ${rows.length} OK — warp == gallery (identity) at every base × rotation`);

  for (const r of rows) {
    expect(r.distI, `${r.kind}@${r.rot}°: D→I (no residual shear)`).toBeLessThan(0.2);
    expect(r.flip, `${r.kind}@${r.rot}°: no reflection (det=+1)`).toBe('identity');
    expect(r.score, `${r.kind}@${r.rot}°: warp matches gallery cleanly`).toBeGreaterThan(0.85);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEETH (consolidated from the retired autocorrelation fidelity-gate). Inject a KNOWN anisotropic
// stretch into the GL display (dev-only __warpInjectAniso, dead-code in prod). The gallery (SVG) is
// untouched, so warp ≠ gallery and the affine-D oracle MUST report D ≠ I. On an OBLIQUE lattice an
// x-stretch rotates the (diagonal) stem while leaving the bar level, so the orientation D-fit sees
// it. Proves the arbiter is NOT vacuous (it fails on a real distortion). Probe value logged.
// ─────────────────────────────────────────────────────────────────────────────
test('teeth: the affine-D arbiter detects an injected distortion (not vacuous)', async ({
  page,
}) => {
  page.on('console', (m) => console.log('[browser]', m.text()));
  const kx = 2.0; // an x-stretch big enough that the rotated stem pushes |D−I| past the arbiter's
  await page.addInitScript((k) => {
    (globalThis as unknown as { __warpInjectAniso: { kx: number; ky: number } }).__warpInjectAniso =
      { kx: k, ky: 1 };
  }, kx);
  await selectTemplate(page, 'DEV F p1 70'); // oblique: stem is diagonal ⇒ x-stretch rotates it
  const g = strokeDirections(await screenshotWallpaper(page)); // gallery (SVG) — injection-free
  await enterWarp(page);
  await page
    .locator('label:has-text("Show lattice frame") input[type=checkbox]')
    .uncheck();
  await page.waitForTimeout(150);
  const w = strokeDirections(await screenshotWallpaper(page)); // warp (GL) — stretched
  const D = fitD({ ...g, ...assignByTargets(g, 0, 70) }, { ...w, ...assignByTargets(w, 0, 70) }).Draw;
  const distI = matResidual(D, [1, 0, 0, 1]);
  console.log(`teeth: injected kx=${kx} → measured D=${fmtMat(D)}  |D−I|=${distI.toFixed(3)} (clean baseline ≈0.005)`);
  // The clean (faithful) oblique residual is ≈0.005; the injected stretch must push it past the
  // 0.2 "fixed" threshold the arbiter uses — i.e. the arbiter would FAIL on this real distortion.
  expect(distI, 'arbiter detects the injected anisotropy (D departs from I past the 0.2 gate)').toBeGreaterThan(0.2);
});
