import { describe, it, expect } from 'vitest';
import type { Vec2 } from '../types';
import { applyToPoint } from '../affine';
import { asymmetricUnitUv } from '../regions';
import { galleryMotifDefs } from '../galleryMotifs';
import { renderRegionPreview } from './renderSwitch';

// ─────────────────────────────────────────────────────────────────────────────
// DRAW-PANE PREVIEW integration (M2 verification steps 1 & 4).
//   • condition 4: the preview composites with the SAME motifLayer:'clip' policy as the
//     wallpaper, so preview and tiled output match — assert the clip path is emitted.
//   • capture round-trip at the render level: the returned toUv/toCanvas affines are
//     mutual inverses, and a uv point inside the region lands inside the canvas.
// ─────────────────────────────────────────────────────────────────────────────

const canvas = { width: 360, height: 360, padding: 28 };
const close = (a: Vec2, b: Vec2, eps = 1e-6): boolean =>
  Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;

describe('renderRegionPreview', () => {
  it('emits a clip path (same clip policy as the wallpaper) and a motif layer', () => {
    const r = renderRegionPreview({
      group: 'p4m',
      motif: galleryMotifDefs['p4m-girih-star'],
      canvas,
      showSymmetryElements: true,
    });
    expect(r.svg).toContain('<clipPath');
    expect(r.svg).toContain('data-layer="motif"');
    expect(r.svg).toContain('data-layer="symmetry-elements"');
  });

  it('does not crash on an empty drawing', () => {
    const r = renderRegionPreview({ group: 'p6', motif: {}, canvas });
    expect(r.svg).toContain('<svg');
    expect(r.svg).toContain('<clipPath');
  });

  it('draws region (pink) and Bravais-lattice overlays when requested', () => {
    const r = renderRegionPreview({
      group: 'p4m',
      motif: {},
      canvas,
      debugOptions: { showRegions: true, showOrbit: false, showBravaisLattice: true },
    });
    expect(r.svg).toContain('magenta'); // fundamental-region overlay (pink)
    expect(r.svg).toContain('navy'); // unit-cell / Bravais lattice
  });

  it('omits the overlays when debugOptions are all off', () => {
    const r = renderRegionPreview({
      group: 'p4m',
      motif: {},
      canvas,
      debugOptions: { showRegions: false, showOrbit: false, showBravaisLattice: false },
    });
    expect(r.svg).not.toContain('magenta');
    expect(r.svg).not.toContain('navy');
  });

  it('toUv / toCanvas are mutual inverses (capture round-trip)', () => {
    const r = renderRegionPreview({ group: 'pmm', motif: {}, canvas });
    for (const px of [
      { x: 40, y: 50 },
      { x: 180, y: 200 },
      { x: 333, y: 91 },
    ]) {
      const back = applyToPoint(r.toCanvas, applyToPoint(r.toUv, px));
      expect(close(px, back)).toBe(true);
    }
  });

  it('maps a region uv point into the canvas bounds', () => {
    const r = renderRegionPreview({ group: 'p4m', motif: {}, canvas });
    // Centroid of the reference region (uv) → should sit well inside the canvas.
    const region = asymmetricUnitUv.p4m;
    const c = region.reduce(
      (s, p) => ({ x: s.x + p.x / region.length, y: s.y + p.y / region.length }),
      { x: 0, y: 0 },
    );
    const px = applyToPoint(r.toCanvas, c);
    expect(px.x).toBeGreaterThan(0);
    expect(px.x).toBeLessThan(canvas.width);
    expect(px.y).toBeGreaterThan(0);
    expect(px.y).toBeLessThan(canvas.height);
  });
});
