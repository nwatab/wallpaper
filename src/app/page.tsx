'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { downloadSvg } from './downloadSvg';
import DrawPane from './DrawPane';

const hasInk = (m: GalleryMotif): boolean =>
  (m.fills?.length ?? 0) > 0 || (m.strokes?.length ?? 0) > 0;

const DEFAULT_SCALE = 120;
const DEFAULT_ROTATION_DEG = 0;

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

  const [mode, setMode] = useState<'gallery' | 'switch' | 'draw'>('gallery');
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
  const [showBravaisLattice, setShowBravaisLattice] = useState(false);
  const [advancedOptionsExpanded, setAdvancedOptionsExpanded] = useState(false);
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

  const [scale, setScale] = useState(
    unitTemplates[0]?.defaultPose?.scale ?? DEFAULT_SCALE,
  );
  const [rotationDeg, setRotationDeg] = useState(
    unitTemplates[0]?.defaultPose?.rotationDeg ?? DEFAULT_ROTATION_DEG,
  );

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

  const handleTemplateChange = (id: string) => {
    const template = unitTemplates.find((t) => t.id === id);
    setSelectedId(id);
    setScale(template?.defaultPose?.scale ?? DEFAULT_SCALE);
    setRotationDeg(template?.defaultPose?.rotationDeg ?? DEFAULT_ROTATION_DEG);
  };

  // 壁紙は「全画面レイヤー」のサイズで計測する
  const [wallRef, wallSize] = useElementSize<HTMLDivElement>();

  // Region (pink) / Bravais-lattice overlays — shared by the wallpaper and the draw pane.
  const debugOptions = useMemo(
    () => ({
      showRegions: regionDisplay === 'one',
      showOrbit: regionDisplay === 'all',
      showBravaisLattice,
    }),
    [regionDisplay, showBravaisLattice],
  );

  const svg = useMemo(() => {
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
    mode === 'gallery' ? selectedTemplate?.group ?? 'wallpaper' : switchGroup;

  // One ExportState feeds both download buttons; each button invokes its own pure action
  // (snapshotExportSvg / tileableExportSvg), so the wiring can't silently swap.
  const exportState: ExportState = {
    displaySvg: svg,
    includeGuides,
    mode,
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
        <div
          className="w-full h-full select-none"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      {/* 左メニュー：半透明で上に載せる */}
      <aside className="fixed left-0 top-0 bottom-0 w-80 z-10 overflow-y-auto p-4 border-r border-white/12 bg-black/35 backdrop-blur-md">
        <div className="flex flex-col gap-3">
          <div className="text-sm opacity-90">Wallpaper</div>

          {/* Mode toggle: browse the gallery, keep one motif and switch its group, or
              draw your own motif and watch it tile under the group. */}
          <div className="grid grid-cols-3 gap-1.5">
            {(['gallery', 'switch', 'draw'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
                  mode === m
                    ? 'bg-white/90 text-black'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
              >
                {m === 'gallery' ? 'Gallery' : m === 'switch' ? 'Switcher' : 'Draw'}
              </button>
            ))}
          </div>

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
                          <div
                            className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full"
                            dangerouslySetInnerHTML={{ __html: swatchSvgs[t.id] }}
                          />
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
              <span className="text-xs opacity-60 tabular-nums">{rotationDeg}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={345}
              step={15}
              value={rotationDeg}
              onChange={(e) => setRotationDeg(Number(e.target.value))}
              className="w-full cursor-pointer accent-white"
            />
          </label>

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
                  <div className="text-xs opacity-70">Regions (pink)</div>
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

                <label className="flex items-center gap-2 text-xs opacity-90">
                  <input
                    type="checkbox"
                    checked={showBravaisLattice}
                    onChange={(e) => setShowBravaisLattice(e.target.checked)}
                  />
                  Show Bravais lattice (cell boundaries)
                </label>
              </div>
            )}
          </div>

          {mode === 'switch' ? (
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
          ) : (
            selectedTemplate && (
              <div className="mt-2 p-3 rounded-xl bg-white/6 border border-white/10 text-xs leading-relaxed">
                <div className="text-xs opacity-85 mb-1.5">Selected</div>
                <div>
                  <span className="opacity-70">group:</span>{' '}
                  {selectedTemplate.group}
                </div>
                <div>
                  <span className="opacity-70">id:</span> {selectedTemplate.id}
                </div>
                <div>
                  <span className="opacity-70">motif:</span>{' '}
                  {selectedTemplate.motifId}
                </div>
                <div className="mt-1.5 opacity-75">
                  viewport: {wallSize.width} × {wallSize.height}
                </div>
              </div>
            )
          )}

          {/* Export — download the current pattern as a standalone SVG (all modes). */}
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
