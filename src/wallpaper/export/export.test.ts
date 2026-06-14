import { describe, it, expect } from 'vitest';
import { renderWallpaperSvg } from '../renderSvg';
import { renderGroupSvg } from '../switch/renderSwitch';
import { unitTemplates } from '../unitTemplates';
import { basisToMatrix, toSvgMatrix } from '../affine';
import { tile } from '../engine/tile';
import {
  stripOverlays,
  withBackground,
  buildTileableSvg,
  tileableFromTemplate,
  snapshotExportSvg,
  tileableExportSvg,
  type ExportState,
} from './exportSvg';

const VIEW = { x: 0, y: 0, width: 400, height: 400 };
const templateById = (id: string) => {
  const t = unitTemplates.find((x) => x.id === id);
  if (!t) throw new Error(`fixture template ${id} missing`);
  return t;
};

const ALL_DEBUG = { showRegions: true, showOrbit: true, showBravaisLattice: true };
const countMatrixGroups = (svg: string): number =>
  (svg.match(/transform="matrix\(/g) ?? []).length;

// ── stripOverlays — clean export keys on LAYER MARKERS, not colour ───────────
describe('stripOverlays', () => {
  it('removes the region/lattice overlay layer but keeps the motif and its ink', () => {
    const svg = renderWallpaperSvg({
      template: templateById('gen-p4-cracked-ice'),
      viewport: VIEW,
      scale: 110,
      rotationDeg: 0,
      debugOptions: ALL_DEBUG,
    });
    // sanity: the source actually carries the overlay + teal (overlay-exclusive colour)
    expect(svg).toContain('<g data-layer="overlay">');
    expect(svg).toContain('#0d9488');
    expect(svg).toContain('#1c3f7a'); // motif ink

    const clean = stripOverlays(svg);
    expect(clean).not.toContain('<g data-layer="overlay">');
    expect(clean).not.toContain('#0d9488');
    // the motif layer and its ink survive
    expect(clean).toContain('<g data-layer="motif">');
    expect(clean).toContain('#1c3f7a');
  });

  it('removes the symmetry-elements layer (switch render)', () => {
    const svg = renderGroupSvg({
      group: 'p4m',
      viewport: VIEW,
      scale: 110,
      rotationDeg: 0,
      debugOptions: ALL_DEBUG,
      showSymmetryElements: true,
    });
    expect(svg).toContain('<g data-layer="symmetry-elements">');

    const clean = stripOverlays(svg);
    expect(clean).not.toContain('<g data-layer="symmetry-elements">');
    expect(clean).not.toContain('<g data-layer="overlay">');
    expect(clean).not.toContain('#0d9488');
    expect(clean).toContain('<g data-layer="motif">');
  });
});

// ── withBackground — faithful white default, transparent opt-in ──────────────
describe('withBackground', () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><g/></svg>';

  it('white inserts a viewBox-sized backdrop right after the opening <svg>', () => {
    const out = withBackground(svg, 'white');
    expect(out).toContain(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><rect x="0" y="0" width="400" height="400" fill="#ffffff"/>',
    );
  });

  it('transparent leaves the SVG untouched', () => {
    expect(withBackground(svg, 'transparent')).toBe(svg);
  });
});

// ── Seamless tileable SVG ────────────────────────────────────────────────────
describe('tileable SVG', () => {
  it('is well-formed: one <pattern> tile filling a rect', () => {
    const out = tileableFromTemplate(templateById('gen-p4-cracked-ice'));
    expect(out).toContain('<svg');
    expect(out).toContain('<pattern id="tile"');
    expect(out).toContain('fill="url(#tile)"');
    expect(out).toContain('<path'); // motif geometry present
    expect(out).toContain('#1c3f7a'); // motif ink present
    expect(out.length).toBeGreaterThan(200);
  });

  it('is the clean PATTERN only — no teaching overlays', () => {
    const out = tileableFromTemplate(templateById('gen-p6-whirl'));
    expect(out).not.toContain('data-layer="overlay"');
    expect(out).not.toContain('data-layer="symmetry-elements"');
    expect(out).not.toContain('#0d9488');
  });

  // The core correctness claim: patternTransform IS the basis matrix and the tile is the
  // unit cell (width=height=1) — i.e. the tiling unit is a true lattice period, carried for
  // EVERY lattice by patternTransform alone (no rectangular supercell). Asserted on a square
  // (p4) and a SKEWED hexagonal (p6) lattice.
  for (const id of ['gen-p4-cracked-ice', 'gen-p6-whirl', 'cm-seigaiha-equilateral-triangle']) {
    it(`patternTransform equals the basis and the tile is one unit cell (${id})`, () => {
      const template = templateById(id);
      const out = buildTileableSvg({
        ...tile({ template, viewport: VIEW, pose: { scale: 1, rotationDeg: 0 } }),
        motifSvg: '<g><path d="M 0 0 L 1 1"/></g>',
        motifLayer: template.motifLayer,
      });
      expect(out).toContain('width="1" height="1"');
      expect(out).toContain(
        `patternTransform="${toSvgMatrix(basisToMatrix(template.basis))}"`,
      );
    });
  }

  it('clip motif bakes the 3×3 neighbourhood and clips to the unit cell (one period, no supercell)', () => {
    const template = templateById('gen-p4-cracked-ice');
    const { opsInCellXy } = tile({
      template,
      viewport: VIEW,
      pose: { scale: 1, rotationDeg: 0 },
    });
    const out = tileableFromTemplate(template);
    expect(out).toContain('clip-path="url(#cell-clip)"');
    // 3×3 cells × coset ops: the neighbour wrap fills the whole cell so translation-tiling
    // reproduces the full group (essential for centred lattices; harmless here — primitive
    // lattice neighbours fall outside the cell-clip). Gallery motifs have no matrix() of their
    // own, so matrix groups count the stamps exactly.
    expect(countMatrixGroups(out)).toBe(9 * opsInCellXy.length);
  });

  it('overlap motif bakes the 3×3 neighbourhood and clips to the unit cell (seigaiha)', () => {
    const template = templateById('cm-seigaiha-equilateral-triangle');
    expect(template.motifLayer).toBe('overlap');
    const { opsInCellXy } = tile({
      template,
      viewport: VIEW,
      pose: { scale: 1, rotationDeg: 0 },
    });
    const out = tileableFromTemplate(template);
    expect(out).toContain('clip-path="url(#cell-clip)"');
    expect(out).toContain('<rect x="0" y="0" width="1" height="1"/>');
    // 3×3 cells × coset ops, all baked into the single period (the seigaiha motif has no
    // matrix() of its own, so matrix groups count the stamps exactly).
    expect(countMatrixGroups(out)).toBe(9 * opsInCellXy.length);
  });
});

// ── Export action wiring — the gap the isolation tests skipped ───────────────
// On the SAME state, the two download actions must be STRUCTURALLY DISTINCT: the snapshot is
// the as-displayed render (no <pattern>, viewBox = the viewport, reflects the pose); the
// tileable is the canonical unit <pattern>. A wiring swap would make them identical.
describe('export action wiring (same state → distinct outputs)', () => {
  const template = templateById('gen-p4m-girih');
  const viewport = { x: 0, y: 0, width: 400, height: 400 };
  // As-displayed render with a non-trivial pose (scale + rotation).
  const displaySvg = renderWallpaperSvg({
    template,
    viewport,
    scale: 110,
    rotationDeg: 30,
  });
  const state: ExportState = {
    displaySvg,
    includeGuides: false,
    mode: 'gallery',
    template,
    group: 'p4m',
    motif: undefined,
    background: 'white',
  };
  const snap = snapshotExportSvg(state);
  const tileable = tileableExportSvg(state);

  it('snapshot is the as-displayed render — NOT a <pattern>, viewBox = centred viewport', () => {
    expect(snap).not.toContain('<pattern');
    // The display surface centres the viewBox on the viewport (coords/ view stage):
    // a 400×400 viewport → "-200 -200 400 400". Still the as-displayed render (not a tile).
    expect(snap).toContain('viewBox="-200 -200 400 400"');
  });

  it('tileable is the canonical unit <pattern> — patternTransform, unit cell, no viewport viewBox', () => {
    expect(tileable).toContain('<pattern');
    expect(tileable).toContain('width="1" height="1"');
    expect(tileable).toContain('patternTransform=');
    expect(tileable).not.toContain('viewBox="0 0 400 400"');
  });

  it('the two actions are not byte-identical (the wiring check)', () => {
    expect(snap).not.toBe(tileable);
  });
});
