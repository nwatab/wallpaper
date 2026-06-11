'use client';

import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { unitTemplates } from '@/wallpaper/unitTemplates';
import { renderWallpaperSvg } from '@/wallpaper/renderSvg';
import type { GalleryMotif } from '@/wallpaper/galleryMotifs';
import type { WallpaperGroup } from '@/wallpaper/types';
import {
  congruentPresets,
  latticeSections,
  placedUserMotif,
  referenceGroupOf,
  sameDrawingFrame,
} from '@/wallpaper/switch/shapeFamilies';
import { renderGroupSvg } from '@/wallpaper/switch/renderSwitch';
import { detectMaximalGroup } from '@/wallpaper/switch/maximalityReport';
import {
  snapshotExportSvg,
  tileableExportSvg,
  type ExportState,
} from '@/wallpaper/export/exportSvg';
import { cellFromTemplate, cellFromGroup } from '@/wallpaper/export/exportSvg';
import type { Card } from '@/wallpaper/conformal/primitives';
import { PRESETS, DEFAULT_PRESET_ID } from '@/wallpaper/conformal/presets';
import {
  toInternalViewAngleDeg,
  toUserViewAngleDeg,
} from '@/lib/coords/canonical';
import { downloadSvg } from './downloadSvg';
import DrawPane from './DrawPane';
import WarpPane from './WarpPane';
import WarpControls from './WarpControls';

const hasInk = (m: GalleryMotif): boolean =>
  (m.fills?.length ?? 0) > 0 || (m.strokes?.length ?? 0) > 0;

// A gallery swatch's SVG, isolated so selectedId never flows into it. Its only prop is the
// byte-identical swatch html (computed once in `swatchSvgs`), so on a pattern switch `memo`
// bails and React keeps the existing svg DOM instead of re-committing innerHTML — which
// otherwise recreates all 27 swatch <svg>s and triggers an ~85k-element style recalc.
const SwatchImage = memo(function SwatchImage({ html }: { html: string }) {
  return (
    <div
      className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

const DEFAULT_SCALE = 120;
const DEFAULT_ROTATION_DEG = 0;

// Scale/Rotation are GLOBAL VIEW STATE — initialised once, never reset by a selection or mode
// change. "Reset view" returns to these. (First template's defaultPose, falling back to the
// module defaults.)
const INITIAL_SCALE = unitTemplates[0]?.defaultPose?.scale ?? DEFAULT_SCALE;
const INITIAL_ROTATION_DEG =
  unitTemplates[0]?.defaultPose?.rotationDeg ?? DEFAULT_ROTATION_DEG;

type Size = { width: number; height: number };

function useElementSize<T extends HTMLElement>(): [React.RefObject<T>, Size] {
  const ref = useRef<T>(null!);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({
        width: Math.max(0, Math.floor(width)),
        height: Math.max(0, Math.floor(height)),
      });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size];
}

export default function Page() {
  const sections = useMemo(() => latticeSections(), []);
  // First toggle-set's first member = the default switcher selection (flagship p4m).
  const firstToggleGroup = useMemo(() => {
    for (const s of sections)
      for (const c of s.classes)
        if (c.kind === 'toggle') return c.set.members[0].group;
    return '';
  }, [sections]);

  // Stage 1: pattern SELECTION — three ways to pick the base wallpaper (persists across the
  // Warp stage so Warp can inherit whichever is active).
  const [selectionMode, setSelectionMode] = useState<'gallery' | 'switch' | 'draw'>(
    'gallery',
  );
  // Stage 2: WARP — the downstream raster stage. Not a 4th selection peer: it warps the base
  // chosen upstream. The effective render mode is the selection mode unless Warp is active.
  const [warpActive, setWarpActive] = useState(false);
  const mode = warpActive ? 'warp' : selectionMode;
  // Warp (M4): the conformal pipeline — an ordered list of primitive cards. Default = the
  // Inversion preset (a single Möbius card), preserving the original single-map behaviour.
  const [pipeline, setPipeline] = useState<Card[]>(() =>
    (PRESETS.find((p) => p.id === DEFAULT_PRESET_ID)?.cards ?? []).map((c) => ({
      ...c,
    })),
  );
  // Debug: overlay the warp's lattice basis frame so any shear/rotation/reflection vs the
  // gallery shows directly as the pattern diverging from the drawn a/b vectors.
  const [showLatticeFrame, setShowLatticeFrame] = useState(false);
  const [selectedId, setSelectedId] = useState(unitTemplates[0]?.id ?? '');
  const [switchGroup, setSwitchGroup] = useState<string>(firstToggleGroup);
  // The user's drawing (M2), stored in the toggle-set REFERENCE frame so it survives a
  // toggle. Reset when the draw frame (reference region) changes.
  const [userMotif, setUserMotif] = useState<GalleryMotif>({});
  const drawReference = useMemo(
    () => referenceGroupOf(switchGroup as WallpaperGroup),
    [switchGroup],
  );

  // Select a group. Switching WITHIN a toggle set (same drawing frame) keeps the drawing
  // and preset — they re-map to the new member via the placement isometry (the "draw
  // once, toggle" payoff). Switching to a different congruence class (a different
  // reference region) resets the canvas, since the old uv geometry no longer applies.
  const selectGroup = (group: string) => {
    if (!sameDrawingFrame(group as WallpaperGroup, switchGroup as WallpaperGroup)) {
      setUserMotif({});
    }
    setSwitchGroup(group);
  };
  const [showSymmetryElements, setShowSymmetryElements] = useState(false);
  const [regionDisplay, setRegionDisplay] = useState<'none' | 'one' | 'all'>(
    'none',
  );
  const [bravaisDisplay, setBravaisDisplay] = useState<'none' | 'all'>('none');
  const [advancedOptionsExpanded, setAdvancedOptionsExpanded] = useState(false);
  // Mobile: the side panel collapses into a thin full-height rail at the left edge (no
  // hamburger). Tapping the rail pops the panel out; tapping the scrim outside tucks it
  // back. On md+ the panel is always visible (rail/scrim hidden), so this only affects
  // small screens.
  const [panelOpen, setPanelOpen] = useState(false);
  // Export options. Background defaults to WHITE (patterns like seigaiha rely on the white
  // showing through); transparent is opt-in. "Include guides" applies to the snapshot only —
  // the tileable export is always the clean canonical pattern.
  const [exportTransparent, setExportTransparent] = useState(false);
  const [includeGuides, setIncludeGuides] = useState(false);

  // The toggle-set the current group belongs to (if any) — drives the caption.
  const activeToggle = useMemo(() => {
    for (const s of sections)
      for (const c of s.classes)
        if (c.kind === 'toggle' && c.set.members.some((m) => m.group === switchGroup))
          return c.set;
    return undefined;
  }, [sections, switchGroup]);

  // Presets strictly congruent to the current draw frame (M2). Empty ⇒ "draw your own".
  const presets = useMemo(
    () => congruentPresets(switchGroup as WallpaperGroup),
    [switchGroup],
  );

  // Educational maximality REPORT for the drawing. Off the hot path: userMotif changes
  // only on commit (not while drafting), so deriving here is cheap and not per-frame.
  const report = useMemo(() => {
    if (!hasInk(userMotif)) return undefined;
    return detectMaximalGroup(
      placedUserMotif(switchGroup as WallpaperGroup, userMotif),
      switchGroup as WallpaperGroup,
    );
  }, [userMotif, switchGroup]);

  const [scale, setScale] = useState(INITIAL_SCALE);
  const [rotationDeg, setRotationDeg] = useState(INITIAL_ROTATION_DEG);
  const resetView = () => {
    setScale(INITIAL_SCALE);
    setRotationDeg(INITIAL_ROTATION_DEG);
  };

  const selectedTemplate = useMemo(() => {
    const t = unitTemplates.find((x) => x.id === selectedId);
    return t ?? unitTemplates[0];
  }, [selectedId]);

  // Gallery swatches: a small fixed-pose render per template. Templates are static,
  // so compute once. Scale is small so each swatch shows the pattern repeating.
  const swatchSvgs = useMemo(() => {
    const size = 120;
    const map: Record<string, string> = {};
    for (const t of unitTemplates) {
      map[t.id] = renderWallpaperSvg({
        template: t,
        viewport: { x: 0, y: 0, width: size, height: size },
        scale: 30,
        rotationDeg: t.defaultPose?.rotationDeg ?? 0,
      });
    }
    return map;
  }, []);

  // Selecting a template no longer resets the view — Scale/Rotation are global and stay under
  // user control across selections and the Warp stage (use "Reset view" to return to defaults).
  const handleTemplateChange = (id: string) => setSelectedId(id);

  // 壁紙は「全画面レイヤー」のサイズで計測する
  const [wallRef, wallSize] = useElementSize<HTMLDivElement>();

  // Region (pink) / Bravais-lattice overlays — shared by the wallpaper and the draw pane.
  const debugOptions = useMemo(
    () => ({
      showRegions: regionDisplay === 'one',
      showOrbit: regionDisplay === 'all',
      showBravaisLattice: bravaisDisplay === 'all',
    }),
    [regionDisplay, bravaisDisplay],
  );

  // Warp texture source: the seamless cell + basis of WHATEVER the active selection mode has
  // chosen — gallery template, switcher group, or the draw user motif. One resolver, so the
  // Warp stage always reflects the upstream base and re-rasterises when it changes.
  const warpCell = useMemo(() => {
    if (!warpActive) return null;
    const opts = { background: 'white' as const, targetPx: 1024 };
    if (selectionMode === 'gallery') {
      return selectedTemplate ? cellFromTemplate(selectedTemplate, opts) : null;
    }
    if (!switchGroup) return null;
    const motif = selectionMode === 'draw' ? userMotif : undefined;
    return cellFromGroup(switchGroup, motif, opts);
  }, [warpActive, selectionMode, selectedTemplate, switchGroup, userMotif]);

  // What the Warp stage is warping, shown instead of a (removed) picker — the base is chosen
  // upstream in Stage 1; Warp only reflects it.
  const warpBaseLabel = useMemo(() => {
    if (selectionMode === 'gallery')
      return selectedTemplate
        ? `${selectedTemplate.group} · ${selectedTemplate.label}`
        : '—';
    if (selectionMode === 'draw') return `${switchGroup} · your drawing`;
    return `${switchGroup} · group default`;
  }, [selectionMode, selectedTemplate, switchGroup]);

  const svg = useMemo(() => {
    if (mode === 'warp') return '';
    if (wallSize.width <= 0 || wallSize.height <= 0) return '';
    const viewport = { x: 0, y: 0, width: wallSize.width, height: wallSize.height };

    // Draw mode: ONE source of truth. The wallpaper tiles exactly the user's drawing
    // (userMotif), the same motif the canvas renders — never the renderableByGroup
    // default. An empty drawing renders blank (no fallback/seed), so both surfaces match.
    if (mode === 'draw') {
      if (!switchGroup) return '';
      return renderGroupSvg({
        group: switchGroup,
        viewport,
        scale,
        rotationDeg,
        motif: userMotif,
        debugOptions,
        showSymmetryElements,
      });
    }

    if (mode === 'switch') {
      if (!switchGroup) return '';
      return renderGroupSvg({
        group: switchGroup,
        viewport,
        scale,
        rotationDeg,
        debugOptions,
        showSymmetryElements,
      });
    }

    if (!selectedTemplate) return '';
    return renderWallpaperSvg({
      template: selectedTemplate,
      viewport,
      scale,
      rotationDeg,
      debugOptions,
    });
  }, [
    mode,
    switchGroup,
    selectedTemplate,
    userMotif,
    wallSize.width,
    wallSize.height,
    scale,
    rotationDeg,
    showSymmetryElements,
    debugOptions,
  ]);

  // The group label baked into export filenames (gallery → template's group; otherwise the
  // switcher/draw group).
  const exportGroup =
    selectionMode === 'gallery'
      ? selectedTemplate?.group ?? 'wallpaper'
      : switchGroup;

  // One ExportState feeds both download buttons; each button invokes its own pure action
  // (snapshotExportSvg / tileableExportSvg), so the wiring can't silently swap.
  const exportState: ExportState = {
    displaySvg: svg,
    includeGuides,
    // Warp output is raster (conformal export = PNG, deferred); the SVG export panel is
    // hidden in that stage, so the SVG-export mode is simply the active selection mode.
    mode: selectionMode,
    template: selectedTemplate,
    group: switchGroup,
    motif: mode === 'draw' ? userMotif : undefined,
    background: exportTransparent ? 'transparent' : 'white',
  };
  const runExport = (
    build: (s: ExportState) => string,
    kind: 'snapshot' | 'tile',
  ) => {
    const out = build(exportState);
    if (out) downloadSvg(out, `wallpaper-${exportGroup}-${mode}-${kind}`);
  };

  const templatesByGroup = useMemo(() => {
    const map = new Map<string, typeof unitTemplates>();
    for (const t of unitTemplates) {
      const arr = map.get(t.group) ?? [];
      arr.push(t);
      map.set(t.group, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* 壁紙：全画面（メニューの下に敷く） */}
      <div
        ref={wallRef}
        id="wallpaper"
        className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
      >
        {mode === 'warp' ? (
          warpCell ? (
            <WarpPane
              cellSvg={warpCell.cellSvg}
              basis={warpCell.basis}
              cards={pipeline}
              scale={scale}
              rotationDeg={rotationDeg}
              showLattice={showLatticeFrame}
            />
          ) : null
        ) : (
          <div
            className="w-full h-full select-none"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
      </div>

      {/* Mobile: the collapsed menu is a thin full-height rail at the left edge. Tapping it
          pops the panel out; it slides away in sync as the panel slides in. Hidden on md+. */}
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        aria-label="Open menu"
        aria-expanded={panelOpen}
        aria-controls="control-panel"
        tabIndex={panelOpen ? -1 : 0}
        className={`md:hidden fixed left-0 top-0 bottom-0 z-10 w-10 flex flex-col items-center gap-3 pt-4 border-r border-white/12 bg-black/35 backdrop-blur-md text-white/80 transition-transform duration-200 ease-in-out ${
          panelOpen ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        <span aria-hidden="true" className="text-base leading-none">
          »
        </span>
        <span className="text-[11px] uppercase tracking-[0.25em] [writing-mode:vertical-rl]">
          Menu
        </span>
      </button>

      {/* Mobile: tap anywhere outside the open panel to tuck it back into the rail. */}
      {panelOpen && (
        <button
          type="button"
          onClick={() => setPanelOpen(false)}
          aria-label="Close menu"
          className="md:hidden fixed inset-0 z-[5] bg-black/20 cursor-default"
        />
      )}

      {/* 左メニュー：半透明で上に載せる。モバイルでは細いレールに収納し、タップで飛び出す。 */}
      <aside
        id="control-panel"
        className={`fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] z-10 overflow-y-auto p-4 border-r border-white/12 bg-black/35 backdrop-blur-md transition-transform duration-200 ease-in-out md:translate-x-0 ${
          panelOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col gap-3">
          <div className="text-sm opacity-90">Wallpaper</div>

          {/* Stage 1 — pattern SELECTION: browse the gallery, keep one motif and switch its
              group, or draw your own motif and watch it tile under the group. */}
          <div className="grid grid-cols-3 gap-1.5">
            {(['gallery', 'switch', 'draw'] as const).map((m) => {
              const active = !warpActive && selectionMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setSelectionMode(m);
                    setWarpActive(false);
                  }}
                  aria-pressed={active}
                  className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
                    active
                      ? 'bg-white/90 text-black'
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  {m === 'gallery' ? 'Gallery' : m === 'switch' ? 'Switcher' : 'Draw'}
                </button>
              );
            })}
          </div>

          {/* Stage 2 — WARP: a downstream raster stage, not a 4th selection. It warps the base
              chosen above (vector SVG → WebGL raster); set apart with an arrow + divider. */}
          <button
            type="button"
            onClick={() => setWarpActive(true)}
            aria-pressed={warpActive}
            className={`rounded-md px-2 py-1.5 text-xs transition-colors flex items-center justify-center gap-1.5 ${
              warpActive
                ? 'bg-white/90 text-black'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            <span className="opacity-60">↓</span> Warp
          </button>

          {/* Group switcher / draw: organised by lattice (headed by its maximal group).
              A congruence class with ≥2 members is a same-tile TOGGLE; singletons
              are selectable but don't toggle. Shape + motif stay fixed across a toggle.
              In draw mode the same picker chooses which group tiles your drawing. */}
          {(mode === 'switch' || mode === 'draw') && (
            <div className="flex flex-col gap-3">
              {sections.map((section) => (
                <div key={section.lattice} className="flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase tracking-wide opacity-50">
                    {section.lattice} · max {section.maximalGroup}
                  </span>
                  {section.classes.map((entry, idx) =>
                    entry.kind === 'toggle' ? (
                      <div
                        key={`t${idx}`}
                        className="rounded-md bg-white/6 ring-1 ring-white/10 p-1.5 flex flex-wrap gap-1.5"
                      >
                        {entry.set.members.map((m) => {
                          const active = m.group === switchGroup;
                          return (
                            <button
                              key={m.group}
                              type="button"
                              onClick={() => selectGroup(m.group)}
                              aria-pressed={active}
                              title="same tile — switch the group"
                              className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                                active
                                  ? 'bg-white/90 text-black'
                                  : 'bg-white/10 text-white/80 hover:bg-white/20'
                              }`}
                            >
                              {m.group}
                            </button>
                          );
                        })}
                        <span className="self-center text-[9px] opacity-40">↔ toggle</span>
                      </div>
                    ) : (
                      <button
                        key={entry.group}
                        type="button"
                        onClick={() => selectGroup(entry.group)}
                        aria-pressed={entry.group === switchGroup}
                        className={`self-start rounded px-3 py-1 text-xs font-mono transition-colors ${
                          entry.group === switchGroup
                            ? 'bg-white/90 text-black'
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }`}
                      >
                        {entry.group}
                      </button>
                    ),
                  )}
                </div>
              ))}

              {activeToggle && (
                <p className="text-[11px] leading-relaxed opacity-75">
                  {activeToggle.discriminator.caption}
                </p>
              )}

              <label className="flex items-center gap-2 text-xs opacity-90">
                <input
                  type="checkbox"
                  checked={showSymmetryElements}
                  onChange={(e) => setShowSymmetryElements(e.target.checked)}
                />
                Show symmetry elements (mirrors / glides / centres)
              </label>
            </div>
          )}

          {/* Draw mode: choose a preset (strict-congruent only) or draw your own motif
              in the reference region; it tiles live under the selected group above. */}
          {mode === 'draw' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-wide opacity-50">
                  Start from a preset
                </span>
                {presets.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {presets.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setUserMotif(p.motifRef)}
                        className="rounded px-2 py-1 text-[11px] bg-white/10 text-white/80 hover:bg-white/20"
                      >
                        {p.id}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] italic opacity-40">
                    No presets for this shape — draw your own.
                  </p>
                )}
              </div>

              <DrawPane
                referenceGroup={drawReference}
                motif={userMotif}
                onMotifChange={setUserMotif}
                showSymmetryElements={showSymmetryElements}
                debugOptions={debugOptions}
              />

              {report && (
                <div
                  className={`rounded-md p-2 text-[11px] leading-relaxed ring-1 ${
                    report.isMaximal
                      ? 'bg-white/6 ring-white/10 opacity-80'
                      : 'bg-amber-400/10 ring-amber-300/30 text-amber-100'
                  }`}
                >
                  <span className="font-mono">{report.maximal}</span> — {report.caption}
                </div>
              )}
            </div>
          )}

          {/* Gallery: visual preset picker (grouped by wallpaper group) */}
          {mode === 'gallery' && (
          <div className="flex flex-col gap-2">
            <span className="text-xs opacity-80">Gallery</span>
            {templatesByGroup.map(([group, items]) => (
              <div key={group} className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide opacity-50">
                  {group}
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {items.map((t) => {
                    const active = t.id === selectedId;
                    return (
                      <div key={t.id} className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => handleTemplateChange(t.id)}
                          title={t.label}
                          aria-pressed={active}
                          className={`group relative aspect-square overflow-hidden rounded-md bg-white transition-shadow ${
                            active
                              ? 'ring-2 ring-white'
                              : 'ring-1 ring-white/15 hover:ring-white/40'
                          }`}
                        >
                          <SwatchImage html={swatchSvgs[t.id]} />
                        </button>
                        <span
                          className={`text-[9px] leading-tight text-center break-words transition-opacity ${
                            active ? 'opacity-100' : 'opacity-60'
                          }`}
                        >
                          {t.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          )}

          {/* Warp stage: the conformal pipeline editor. Base inherited from Stage 1 (shown,
              not re-picked); presets + an ordered list of composable transform cards. */}
          {mode === 'warp' && (
            <>
              <WarpControls
                cards={pipeline}
                onChange={setPipeline}
                baseLabel={warpBaseLabel}
              />
              <label className="flex items-center gap-2 text-[11px] opacity-80">
                <input
                  type="checkbox"
                  checked={showLatticeFrame}
                  onChange={(e) => setShowLatticeFrame(e.target.checked)}
                />
                Show lattice frame (debug: <span className="text-[#e5484d]">a</span> /{' '}
                <span className="text-[#3b82f6]">b</span> vectors)
              </label>
            </>
          )}

          {/* Scale */}
          <label className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs opacity-80">Scale</span>
              <span className="text-xs opacity-60 tabular-nums">{scale}</span>
            </div>
            <input
              type="range"
              min={20}
              max={400}
              step={1}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="w-full cursor-pointer accent-white"
            />
          </label>

          {/* Rotation */}
          <label className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs opacity-80">Rotation</span>
              <span className="text-xs opacity-60 tabular-nums">
                {toUserViewAngleDeg(rotationDeg)}°
              </span>
            </div>
            {/* The control is CCW-positive (coords/canonical). `rotationDeg` state stays in
                the engine's internal convention; only this slider relabels it, so every
                render path (and overlapDepth) is unchanged. See toInternalViewAngleDeg. */}
            <input
              type="range"
              min={0}
              max={345}
              step={15}
              value={toUserViewAngleDeg(rotationDeg)}
              onChange={(e) =>
                setRotationDeg(toInternalViewAngleDeg(Number(e.target.value)))
              }
              className="w-full cursor-pointer accent-white"
            />
          </label>

          {/* View is global state (persists across selections + the Warp stage). */}
          {(scale !== INITIAL_SCALE || rotationDeg !== INITIAL_ROTATION_DEG) && (
            <button
              type="button"
              onClick={resetView}
              className="self-start rounded-md px-2 py-1 text-[11px] bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
            >
              Reset view
            </button>
          )}

          {/* Advanced Options */}
          <div className="mt-2 bg-white/6 border border-white/10 rounded-lg">
            <button
              onClick={() =>
                setAdvancedOptionsExpanded(!advancedOptionsExpanded)
              }
              className={`flex items-center gap-2 w-full p-3 bg-transparent border-none text-inherit text-xs cursor-pointer outline-none text-left ${
                advancedOptionsExpanded ? 'rounded-t-lg' : 'rounded-lg'
              }`}
            >
              <span
                className={`text-[10px] transition-transform duration-200 ease-in-out ${
                  advancedOptionsExpanded ? 'rotate-90' : 'rotate-0'
                }`}
              >
                ▶
              </span>
              Advanced Options
            </button>

            {advancedOptionsExpanded && (
              <div className="px-3 pb-3 border-t border-white/8 flex flex-col gap-2">
                <div className="flex flex-col gap-1.5">
                  <div className="text-xs opacity-70">Regions</div>
                  {(
                    [
                      { value: 'none', label: 'None' },
                      { value: 'one', label: 'One per cell' },
                      { value: 'all', label: 'All regions' },
                    ] as const
                  ).map(({ value, label }) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 text-xs opacity-90"
                    >
                      <input
                        type="radio"
                        name="regionDisplay"
                        checked={regionDisplay === value}
                        onChange={() => setRegionDisplay(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="text-xs opacity-70">
                    Bravais lattice (cell boundaries)
                  </div>
                  {(
                    [
                      { value: 'none', label: 'None' },
                      { value: 'all', label: 'All bravais lattices' },
                    ] as const
                  ).map(({ value, label }) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 text-xs opacity-90"
                    >
                      <input
                        type="radio"
                        name="bravaisDisplay"
                        checked={bravaisDisplay === value}
                        onChange={() => setBravaisDisplay(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {mode === 'switch' && (
            <div className="mt-2 p-3 rounded-xl bg-white/6 border border-white/10 text-xs leading-relaxed">
              <div className="text-xs opacity-85 mb-1.5">Switching</div>
              <div>
                <span className="opacity-70">group:</span> {switchGroup}
              </div>
              <div>
                <span className="opacity-70">mode:</span>{' '}
                {activeToggle ? `toggle (${activeToggle.discriminator.kind})` : 'singleton'}
              </div>
              <div className="mt-1.5 opacity-75">
                viewport: {wallSize.width} × {wallSize.height}
              </div>
            </div>
          )}

          {/* Export — download the current pattern as a standalone SVG. Hidden in the Warp
              stage: the warped output is raster (PNG export is a later slice). */}
          {mode !== 'warp' && (
          <div className="mt-2 p-3 rounded-xl bg-white/6 border border-white/10 flex flex-col gap-2">
            <div className="text-xs opacity-85">Export SVG</div>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => runExport(snapshotExportSvg, 'snapshot')}
                className="rounded-md px-2 py-1.5 text-xs bg-white/10 text-white/85 hover:bg-white/20 transition-colors"
              >
                Download SVG (snapshot)
              </button>
              <button
                type="button"
                onClick={() => runExport(tileableExportSvg, 'tile')}
                className="rounded-md px-2 py-1.5 text-xs bg-white/10 text-white/85 hover:bg-white/20 transition-colors"
              >
                Download tileable SVG
              </button>
            </div>
            <label className="flex items-center gap-2 text-[11px] opacity-80">
              <input
                type="checkbox"
                checked={exportTransparent}
                onChange={(e) => setExportTransparent(e.target.checked)}
              />
              Transparent background
            </label>
            <label className="flex items-center gap-2 text-[11px] opacity-80">
              <input
                type="checkbox"
                checked={includeGuides}
                onChange={(e) => setIncludeGuides(e.target.checked)}
              />
              Include guides (snapshot only)
            </label>
          </div>
          )}

          {/* GitHub Link */}
          <div className="mt-auto pt-4">
            <a
              href="https://github.com/nwatab/wallpaper"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs opacity-80 hover:opacity-100 transition-opacity duration-200"
            >
              <img
                src="/wallpaper/github-mark.svg"
                alt="GitHub"
                className="w-4 h-4 opacity-80"
              />
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}
