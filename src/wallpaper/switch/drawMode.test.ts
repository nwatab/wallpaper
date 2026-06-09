import { describe, it, expect } from 'vitest';
import type { GalleryMotif, Stroke } from '../galleryMotifs';
import { renderGroupSvg, renderRegionPreview } from './renderSwitch';
import { congruentPresets } from './shapeFamilies';

// ─────────────────────────────────────────────────────────────────────────────
// DRAW MODE — ONE SOURCE OF TRUTH. The full-screen wallpaper and the draw canvas must
// render from the SAME drawMotif. The bug was: in draw mode an EMPTY drawing passed
// motif=undefined to renderGroupSvg, which fell back to renderableByGroup's default
// shape-local motif — so the wallpaper showed a pre-rendered motif while the canvas was
// blank. These lock the two surfaces together.
//
// Surfaces:
//   wallpaper(m)  = renderGroupSvg({ group, motif: m })       — always the user motif
//   canvas(m)     = renderRegionPreview({ group, motif: m })  — the same user motif
// ─────────────────────────────────────────────────────────────────────────────

const GROUP = 'p4m';
const viewport = { x: 0, y: 0, width: 240, height: 240 };
const canvasRect = { width: 360, height: 360, padding: 28 };

const wallpaper = (motif: GalleryMotif): string =>
  renderGroupSvg({ group: GROUP, viewport, scale: 60, rotationDeg: 0, motif });
const canvas = (motif: GalleryMotif): string =>
  renderRegionPreview({ group: GROUP, motif, canvas: canvasRect }).svg;

// Default shape-local motif ink colour (shapeMotifs.ts INK) — what the wallpaper used to
// wrongly show on an empty drawing.
const DEFAULT_INK = '#1c3f7a';
// A distinctive colour no stored motif uses, to trace a user stroke through both surfaces.
const USER_INK = '#abcdef';
const userStroke: Stroke = {
  pts: [
    { x: 0.2, y: 0.05 },
    { x: 0.42, y: 0.27 },
  ],
  width: 0.04,
  color: USER_INK,
};

describe('draw mode — both surfaces share one drawMotif', () => {
  it('empty drawing → BOTH surfaces blank, and the wallpaper does NOT fall back to the default motif', () => {
    const w = wallpaper({});
    const c = canvas({});
    // No user ink and — critically — no default shape-motif ink either.
    expect(w).not.toContain(USER_INK);
    expect(w).not.toContain(DEFAULT_INK);
    expect(c).not.toContain(USER_INK);
    expect(c).not.toContain(DEFAULT_INK);
  });

  it('the Switcher path (motif=undefined) DOES show the default motif — proving the draw path differs', () => {
    const switcher = renderGroupSvg({
      group: GROUP,
      viewport,
      scale: 60,
      rotationDeg: 0,
    });
    expect(switcher).toContain(DEFAULT_INK);
  });

  it('a known stroke → BOTH surfaces contain it', () => {
    const m: GalleryMotif = { strokes: [userStroke] };
    expect(wallpaper(m)).toContain(USER_INK);
    expect(canvas(m)).toContain(USER_INK);
  });

  it('loading a preset → BOTH surfaces contain the preset geometry', () => {
    const preset = congruentPresets(GROUP)[0]; // p4m-girih-star (reference frame)
    expect(preset).toBeDefined();
    const w = wallpaper(preset.motifRef);
    const c = canvas(preset.motifRef);
    expect(w).toContain(DEFAULT_INK); // girih is drawn in INK
    expect(c).toContain(DEFAULT_INK);
  });
});
