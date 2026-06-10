import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { renderWallpaperSvg } from '../renderSvg';
import { unitTemplates } from '../unitTemplates';

// Renders the five "look-alike" groups at a fixed view. Two artifacts:
//   • the full SVG → __snapshots__/ (gitignored, regenerated every run) for HUMAN visual
//     approval that the look-alikes are visibly distinct and correct (don't judge symmetry
//     by eye — the symmetry/region suites prove that).
//   • a committed content HASH (__goldens__/<group>.sha256, tiny) asserted via
//     toMatchFileSnapshot — the ENFORCED regression lock. Any change to rendered output
//     fails CI until the hash is regenerated (`vitest -u`) and reviewed in the PR diff.
//     (Hashing, not committing the 14 MB of SVG: the artifacts are gitignored.)
const LOOK_ALIKES = [
  'p3',
  'p31m',
  'p3m1',
  'cmm',
  'p4',
  'p4m',
  'p4g',
  'p6',
  'p6m',
] as const;
const OUT_DIR = join(process.cwd(), '__snapshots__');
const GOLDEN_DIR = join(process.cwd(), 'src', 'wallpaper', 'verify', '__goldens__');
const VIEW = { x: 0, y: 0, width: 600, height: 600 };
const SCALE = 110;

describe('look-alike snapshots', () => {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const group of LOOK_ALIKES) {
    it(`renders ${group}`, async () => {
      const template = unitTemplates.find((t) => t.id === `gen-${group}`);
      expect(template, `template gen-${group} missing`).toBeDefined();

      const svg = renderWallpaperSvg({
        template: template!,
        viewport: VIEW,
        scale: SCALE,
        rotationDeg: 0,
      });
      expect(svg).toContain('<svg');
      expect(svg.length).toBeGreaterThan(200);

      // White backdrop so the glyphs read clearly when viewed. The viewBox is centred
      // (coords/ view stage), so the backdrop is centred too.
      const withBg = svg.replace(
        /(<svg[^>]*>)/,
        `$1<rect x="${-VIEW.width / 2}" y="${-VIEW.height / 2}" width="${VIEW.width}" height="${VIEW.height}" fill="white"/>`,
      );
      writeFileSync(join(OUT_DIR, `${group}.svg`), withBg);

      const hash = createHash('sha256').update(withBg).digest('hex');
      await expect(hash).toMatchFileSnapshot(join(GOLDEN_DIR, `${group}.sha256`));
    });
  }
});
