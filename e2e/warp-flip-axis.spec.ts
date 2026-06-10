import * as fs from 'fs';
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { selectTemplate, enterWarp, screenshotWallpaper } from './harness';
import { matchFlip, glyphFacing, type Image, type FlipCandidate } from './lattice';

// ─────────────────────────────────────────────────────────────────────────────
// FLIP-AXIS + UNIFORMITY. The prior content-shear probe used a vertical arrow + structure-tensor
// ORIENTATION (mod 180), which CANNOT separate an x-flip from a y-flip (both map θ→180−θ). Here we
// use a CHIRAL "F" (motif-dev-f) and a DIRECTION-preserving (mod 360) matcher to pin down:
//   (axis)        is the warp's reflection about x or y?  — matchFlip(warp, gallery) ∈ {id,fX,fY}
//   (uniformity)  same flip on ALL bases, or only on oblique ones? — compare across rect/obl/hex
// Identification:
//   • all bases flipY → uniform y-origin convention reflection  (the standing hypothesis)
//   • all bases flipX → uniform x-handedness reflection
//   • rect=identity, oblique=flip → genuinely oblique-dependent (needs more digging)
// PART C: the baked cell texture's F FACING (mod 360). NB the dump is FBO-readback (bottom-up) of a
// texture uploaded with UNPACK_FLIP_Y=true ⇒ it is the SVG content flipped ONCE vertically by
// convention alone — so the authored top-left-leaning F should read bottom-left in the dump if the
// bake/upload added NO extra flip. A different facing would mean a bake-side flip.
// ─────────────────────────────────────────────────────────────────────────────

const savePng = (img: Image, path: string) => {
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data as number[]);
  fs.mkdirSync('test-results', { recursive: true });
  fs.writeFileSync(path, PNG.sync.write(png));
};

const CASES = [
  { title: 'DEV F rect', tag: 'rect', kind: 'rectangular' },
  { title: 'DEV F p1 70', tag: 'p1-70', kind: 'oblique 70°' },
  { title: 'DEV F hex 60', tag: 'hex-60', kind: 'hex 60°' },
];

const fetchCellTexture = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const c = (
      globalThis as unknown as {
        __warpDebug?: { cellTexture?: { width: number; height: number; data: number[] } };
      }
    ).__warpDebug?.cellTexture;
    return c ? { width: c.width, height: c.height, data: Array.from(c.data) } : null;
  }) as Promise<Image | null>;

test('flip axis + uniformity: warp-vs-gallery (chiral F), all lattices', async ({
  page,
}) => {
  page.on('console', (m) => console.log('[browser]', m.text()));

  const verdicts: {
    kind: string;
    best: FlipCandidate;
    margin: number;
    bestScore: number;
  }[] = [];

  for (const { title, tag, kind } of CASES) {
    // Gallery (truth): SVG render of the chiral F.
    await selectTemplate(page, title);
    const galleryImg = await screenshotWallpaper(page);
    savePng(galleryImg, `test-results/flip-gallery-${tag}.png`);

    // Warp (GL): same template, empty pipeline. Screenshot the canvas ON-SCREEN, top-down, exactly
    // like the gallery — apples-to-apples, no readPixels flip.
    await enterWarp(page);
    const cell = await fetchCellTexture(page);
    if (cell) savePng(cell, `test-results/flip-cellTexture-${tag}.png`);
    await page
      .locator('label:has-text("Show lattice frame") input[type=checkbox]')
      .uncheck();
    await page.waitForTimeout(150);
    const warpImg = await screenshotWallpaper(page);
    savePng(warpImg, `test-results/flip-warp-${tag}.png`);

    // PART B — direction-preserving 3-candidate match.
    const m = matchFlip(warpImg, galleryImg);
    verdicts.push({ kind, best: m.best, margin: m.margin, bestScore: m.scores[m.best] });
    console.log(
      `flip-axis ${kind}: best=${m.best}  scores={id:${m.scores.identity.toFixed(3)}, ` +
        `fX:${m.scores.flipX.toFixed(3)}, fY:${m.scores.flipY.toFixed(3)}}  margin=${m.margin.toFixed(3)}`,
    );

    // PART C — baked cell texture F facing (mod 360). Expected ≈ bottom-left from convention alone.
    if (cell) {
      const fc = glyphFacing(cell);
      console.log(
        `  cellTexture(${kind}) F facing = ${fc.quadrant}  ` +
          `(cxRel=${fc.cxRel.toFixed(2)}, cyRel=${fc.cyRel.toFixed(2)})`,
      );
    } else {
      console.log(`  cellTexture(${kind}) = MISSING`);
    }
  }

  // Identification summary. A CLEAN global image flip scores high (rect's true match ≈ 0.99); a
  // best candidate that wins only weakly (≲ 0.8) means NO global identity/flipX/flipY explains the
  // warp — i.e. the discrepancy is not a whole-image reflection (e.g. a content reflection that
  // leaves the ORIGINAL lattice in place, so no translation aligns it).
  const CLEAN = 0.85;
  const bests = verdicts.map((v) => v.best);
  const allSame = bests.every((b) => b === bests[0]);
  const allClean = verdicts.every((v) => v.bestScore >= CLEAN);
  const rect = verdicts.find((v) => v.kind === 'rectangular')!;
  const obliques = verdicts.filter((v) => v.kind !== 'rectangular');
  let verdict: string;
  if (allSame && allClean && bests[0] === 'flipY')
    verdict = 'UNIFORM Y-FLIP (clean y-origin convention reflection)';
  else if (allSame && allClean && bests[0] === 'flipX')
    verdict = 'UNIFORM X-FLIP (clean x-handedness reflection)';
  else if (allSame && allClean && bests[0] === 'identity')
    verdict = 'NO FLIP (warp matches gallery on all bases)';
  else if (rect.best === 'identity' && rect.bestScore >= CLEAN && obliques.every((o) => o.best !== 'identity'))
    verdict =
      `OBLIQUE-DEPENDENT (rect faithful @${rect.bestScore.toFixed(2)}; oblique best=` +
      `${obliques.map((o) => `${o.best}@${o.bestScore.toFixed(2)}`).join(',')}) — ` +
      (obliques.every((o) => o.bestScore < CLEAN)
        ? 'NO clean global flip on oblique ⇒ content reflected within the UNFLIPPED lattice (shear-frame), not a whole-image x/y mirror'
        : 'oblique is a clean whole-image flip');
  else verdict = `MIXED: ${verdicts.map((v) => `${v.kind}=${v.best}@${v.bestScore.toFixed(2)}`).join(', ')}`;
  console.log(`\nFLIP-AXIS VERDICT: ${verdict}`);

  // Teeth, not a "fixed" claim: every base must discriminate its winner unambiguously.
  for (const v of verdicts)
    expect(v.margin, `${v.kind}: flip-candidate discrimination margin`).toBeGreaterThan(0.05);
});
