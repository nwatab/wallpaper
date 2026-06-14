import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { renderWallpaperSvg } from '../renderSvg';
import { unitTemplates } from '../unitTemplates';

// One snapshot per new gallery pattern. Full SVG → __snapshots__/gallery/ (gitignored)
// for human visual approval of fill + aesthetics; a committed content HASH
// (__goldens__/<id>.sha256) is the ENFORCED regression lock (see snapshots.test.ts).
// The symmetry/region/maximality suites prove the math; these are only the fill/look check.
const GALLERY_IDS = [
  'gen-p4m-girih',
  'gen-p4m-clover',
  'gen-p4-cracked-ice',
  'gen-p6m-shamsa',
  'gen-pmm-leiwen',
  'gen-p6-whirl',
  'gen-cmm-quatrefoil',
  'gen-p4g-pinwheel',
  'gen-p3-trefoil',
  'gen-p31m-medallion',
  'gen-p1-fleur-diaper',
  'gen-p2-tapa',
  'gen-pm-lotus',
  'gen-pg-herringbone',
  'gen-pmg-water-bands',
  'gen-pgg-yagasuri',
  'gen-p3m1-glazed',
] as const;

const OUT_DIR = join(process.cwd(), '__snapshots__', 'gallery');
const GOLDEN_DIR = join(process.cwd(), 'src', 'wallpaper', 'verify', '__goldens__');
const VIEW = { x: 0, y: 0, width: 600, height: 600 };
const SCALE = 110;

describe('gallery snapshots', () => {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const id of GALLERY_IDS) {
    it(`renders ${id}`, async () => {
      const template = unitTemplates.find((t) => t.id === id);
      expect(template, `template ${id} missing`).toBeDefined();

      const svg = renderWallpaperSvg({
        template: template!,
        viewport: VIEW,
        scale: SCALE,
        rotationDeg: 0,
      });
      expect(svg).toContain('<svg');
      expect(svg.length).toBeGreaterThan(200);

      // Cream backdrop, centred to match the centred viewBox (coords/ view stage).
      const withBg = svg.replace(
        /(<svg[^>]*>)/,
        `$1<rect x="${-VIEW.width / 2}" y="${-VIEW.height / 2}" width="${VIEW.width}" height="${VIEW.height}" fill="#f7f3ea"/>`,
      );
      writeFileSync(join(OUT_DIR, `${id}.svg`), withBg);

      const hash = createHash('sha256').update(withBg).digest('hex');
      await expect(hash).toMatchFileSnapshot(join(GOLDEN_DIR, `${id}.sha256`));
    });
  }
});
