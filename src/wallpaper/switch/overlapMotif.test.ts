import { describe, expect, it } from 'vitest';
import type { GalleryMotif } from '../galleryMotifs';
import { splitByLayer } from '../galleryMotifs';
import { applyToPoint, basisToMatrix } from '../affine';
import { placeUserMotif } from './shapeFamilies';
import { renderGroupSvg } from './renderSwitch';
import { detectMaximalGroup } from './maximalityReport';
import { cellFromGroup, tileableFromGroup } from '../export/exportSvg';

// ─────────────────────────────────────────────────────────────────────────────
// Overlap draw layer (M3). layer:'overlap' shapes are stored AS DRAWN and composite
// painter-style per copy — the compositing that lets a front copy occlude the copy
// behind it (seigaiha), which neither folding nor full-canvas flattening can express.
// Pins: the split, the second render layer (and its absence without overlap ink),
// per-copy depth order, the maximality report's fold-equivalence, and the export's
// widened neighbour wrap.
// ─────────────────────────────────────────────────────────────────────────────

const baseStroke = {
  pts: [
    { x: 0.3, y: 0.4 },
    { x: 0.4, y: 0.45 },
  ],
  width: 0.04,
  color: '#222222',
};

const overlapStroke = {
  pts: [
    { x: 0.2, y: 0.1 },
    { x: 1.3, y: 0.8 }, // crosses into the neighbour cell — stays as drawn
  ],
  width: 0.04,
  color: '#1c3f7a',
  layer: 'overlap' as const,
};

describe('splitByLayer', () => {
  it('routes shapes by their layer tag, preserving order', () => {
    const m: GalleryMotif = {
      strokes: [baseStroke, overlapStroke],
      fills: [{ pts: overlapStroke.pts, color: '#fff', layer: 'overlap' }],
    };
    const { base, overlap } = splitByLayer(m);
    expect(base.strokes).toEqual([baseStroke]);
    expect(base.fills).toEqual([]);
    expect(overlap.strokes).toEqual([overlapStroke]);
    expect(overlap.fills).toHaveLength(1);
  });
});

describe('placeUserMotif (overlap split)', () => {
  it('emits no overlap svg for a fold-only motif', () => {
    const r = placeUserMotif('p1', { strokes: [baseStroke] });
    expect(r.overlapMotifSvg).toBeUndefined();
    expect(r.overlapReach).toBeUndefined();
  });

  it('splits overlap ink out of the base svg and derives its reach', () => {
    const r = placeUserMotif('p1', { strokes: [baseStroke, overlapStroke] });
    expect(r.overlapMotifSvg).toBeDefined();
    // base svg keeps only the base stroke's colour; overlap svg only the overlap one's
    expect(r.motifSvg).toContain('#222222');
    expect(r.motifSvg).not.toContain('#1c3f7a');
    expect(r.overlapMotifSvg).toContain('#1c3f7a');
    expect(r.overlapMotifSvg).not.toContain('#222222');
    // reaches 0.3 beyond the cell → 1 cell of neighbour wrap
    expect(r.overlapReach).toBe(1);
  });

  it('reach grows with the ink extent', () => {
    const far = {
      ...overlapStroke,
      pts: [
        { x: -1.2, y: 0.5 },
        { x: 0.5, y: 0.5 },
      ],
    };
    const r = placeUserMotif('p1', { strokes: [far] });
    expect(r.overlapReach).toBe(2);
  });
});

describe('renderGroupSvg (overlap layer)', () => {
  const viewport = { x: 0, y: 0, width: 400, height: 300 };

  it('renders no overlap layer without overlap ink (back-compat)', () => {
    const svg = renderGroupSvg({
      group: 'pm',
      viewport,
      scale: 100,
      rotationDeg: 0,
      motif: { strokes: [baseStroke] },
    });
    expect(svg).toContain('data-layer="motif"');
    expect(svg).not.toContain('data-layer="motif-overlap"');
  });

  it('renders overlap ink as its own unclipped layer on top of the base', () => {
    const svg = renderGroupSvg({
      group: 'pm',
      viewport,
      scale: 100,
      rotationDeg: 0,
      motif: { strokes: [baseStroke, overlapStroke] },
    });
    const overlapAt = svg.indexOf('data-layer="motif-overlap"');
    expect(overlapAt).toBeGreaterThan(svg.indexOf('data-layer="motif"'));
    // the overlap layer's copies are not clipped to the region
    const overlapBody = svg.slice(overlapAt, svg.indexOf('</g>', overlapAt));
    expect(overlapBody).not.toContain('clip-path');
  });

  it('stacks overlap copies back-to-front by canonical depth (p1 lattice)', () => {
    const svg = renderGroupSvg({
      group: 'p1',
      viewport,
      scale: 80,
      rotationDeg: 0,
      motif: { strokes: [overlapStroke] },
    });
    const overlapAt = svg.indexOf('data-layer="motif-overlap"');
    expect(overlapAt).toBeGreaterThanOrEqual(0);
    const layerEnd = svg.indexOf('data-layer="overlay"');
    const body = svg.slice(overlapAt, layerEnd > 0 ? layerEnd : undefined);
    // p1's orbit is the bare lattice, so screen ty is affine in canonical depth:
    // the emitted copy order must be non-decreasing in ty.
    const tys = [...body.matchAll(/matrix\([^)]*? ([-\d.e]+)\)/g)].map((m) =>
      Number(m[1]),
    );
    expect(tys.length).toBeGreaterThan(1);
    for (let i = 1; i < tys.length; i++) {
      expect(tys[i]).toBeGreaterThanOrEqual(tys[i - 1] - 1e-9);
    }
  });
});

describe('maximality report (overlap ink folds into the fingerprint)', () => {
  it('an overlap stroke outside the unit reports like its folded twin', () => {
    // p1's unit is the whole cell: translating by a lattice vector IS the fold.
    const inside: GalleryMotif = { strokes: [baseStroke] };
    const outside: GalleryMotif = {
      strokes: [
        {
          ...baseStroke,
          pts: baseStroke.pts.map((p) => ({ x: p.x + 1, y: p.y })),
          layer: 'overlap',
        },
      ],
    };
    const a = detectMaximalGroup(inside, 'p1');
    const b = detectMaximalGroup(outside, 'p1');
    expect(b.maximal).toBe(a.maximal);
    expect(b.isMaximal).toBe(a.isMaximal);
  });
});

describe('tileable export (overlap layer bakes with its reach)', () => {
  it('stamps the neighbour wrap out to the overlap reach', () => {
    const far: GalleryMotif = {
      strokes: [
        {
          ...overlapStroke,
          pts: [
            { x: -1.2, y: 0.5 },
            { x: 0.5, y: 0.5 },
          ],
        },
      ],
    };
    const svg = tileableFromGroup('p1', far, { background: 'transparent' });
    // reach 2 ⇒ the overlap layer stamps the (2,2) lattice neighbour (p1: identity op)
    expect(svg).toContain('matrix(1 0 0 1 2 2)');
  });

  it('keeps the ±1 wrap when there is no overlap ink', () => {
    const svg = tileableFromGroup(
      'p1',
      { strokes: [baseStroke] },
      { background: 'transparent' },
    );
    expect(svg).not.toContain('matrix(1 0 0 1 2 2)');
    expect(svg).toContain('matrix(1 0 0 1 1 1)');
  });

  it('orients the pg overlap depth along the glide axis (canonical x, not y)', () => {
    // pg's coset reps all put copy centres on the same y per lattice row, so a y-sort
    // (the old constant depth 0) leaves x unordered; the derived depth 90 must emit
    // the baked overlap stamps in non-decreasing canonical x.
    const r = placeUserMotif('pg', {});
    const B = basisToMatrix(r.template.basis);
    const motif: GalleryMotif = { strokes: [{ ...overlapStroke }] };
    const cell = cellFromGroup('pg', motif, { background: 'transparent' })!;
    const chunks = cell.cellSvg.split('<g clip-path="url(#cell-clip)">');
    const overlapChunk = chunks[chunks.length - 1]; // overlapExtra is appended last
    const xs = [...overlapChunk.matchAll(/matrix\(([-\d.e ]+)\)/g)].map((m) => {
      const [a, b, c, d, e, f] = m[1].split(' ').map(Number);
      const centreUv = { x: a * 0.5 + c * 0.5 + e, y: b * 0.5 + d * 0.5 + f };
      return applyToPoint(B, centreUv).x;
    });
    expect(xs.length).toBeGreaterThan(1);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1] - 1e-9);
    }
  });
});
