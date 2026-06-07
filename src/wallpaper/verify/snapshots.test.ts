import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderWallpaperSvg } from '../renderSvg';
import { unitTemplates } from '../unitTemplates';

// Renders the five "look-alike" groups at a fixed view into __snapshots__/ for human
// visual approval. The other test suites prove the symmetry algebra; these images are
// the final eyeball check that the look-alikes are visibly distinct and correct.
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
const VIEW = { x: 0, y: 0, width: 600, height: 600 };
const SCALE = 110;

describe('look-alike snapshots', () => {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const group of LOOK_ALIKES) {
    it(`renders ${group}`, () => {
      const template = unitTemplates.find((t) => t.id === `test-${group}`);
      expect(template, `template test-${group} missing`).toBeDefined();

      const svg = renderWallpaperSvg({
        template: template!,
        viewport: VIEW,
        scale: SCALE,
        rotationDeg: 0,
      });
      expect(svg).toContain('<svg');
      expect(svg.length).toBeGreaterThan(200);

      // White backdrop so the glyphs read clearly when viewed.
      const withBg = svg.replace(
        /(<svg[^>]*>)/,
        `$1<rect x="0" y="0" width="${VIEW.width}" height="${VIEW.height}" fill="white"/>`,
      );
      writeFileSync(join(OUT_DIR, `${group}.svg`), withBg);
    });
  }
});
