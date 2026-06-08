import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderWallpaperSvg } from '../renderSvg';
import { unitTemplates } from '../unitTemplates';

// One snapshot per new gallery pattern, into __snapshots__/gallery/ for human visual
// approval of fill + aesthetics. The symmetry/region/maximality suites prove the math;
// these images are only the fill/look check. (Do NOT judge symmetry by eye.)
const GALLERY_IDS = [
  'test-p4m-girih',
  'test-p4-cracked-ice',
  'test-p6m-shamsa',
  'test-pmm-leiwen',
  'test-p6-whirl',
  'test-cmm-quatrefoil',
  'test-p4g-pinwheel',
  'test-p3-trefoil',
  'test-p31m-medallion',
] as const;

const OUT_DIR = join(process.cwd(), '__snapshots__', 'gallery');
const VIEW = { x: 0, y: 0, width: 600, height: 600 };
const SCALE = 110;

describe('gallery snapshots', () => {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const id of GALLERY_IDS) {
    it(`renders ${id}`, () => {
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

      const withBg = svg.replace(
        /(<svg[^>]*>)/,
        `$1<rect x="0" y="0" width="${VIEW.width}" height="${VIEW.height}" fill="#f7f3ea"/>`,
      );
      writeFileSync(join(OUT_DIR, `${id}.svg`), withBg);
    });
  }
});
