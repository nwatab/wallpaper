'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { unitTemplates } from '@/wallpaper/unitTemplates';
import { renderWallpaperSvg } from '@/wallpaper/renderSvg';

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
  const [selectedId, setSelectedId] = useState(unitTemplates[0]?.id ?? '');
  const [showRegions, setShowRegions] = useState(false);
  const [showOrbit, setShowOrbit] = useState(false);
  const [showBravaisLattice, setShowBravaisLattice] = useState(false);
  const [advancedOptionsExpanded, setAdvancedOptionsExpanded] = useState(false);
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

  const svg = useMemo(() => {
    if (!selectedTemplate) return '';
    if (wallSize.width <= 0 || wallSize.height <= 0) return '';

    return renderWallpaperSvg({
      template: selectedTemplate,
      viewport: { x: 0, y: 0, width: wallSize.width, height: wallSize.height },
      scale,
      rotationDeg,
      debugOptions: {
        showRegions,
        showOrbit,
        showBravaisLattice,
      },
    });
  }, [
    selectedTemplate,
    wallSize.width,
    wallSize.height,
    scale,
    rotationDeg,
    showRegions,
    showOrbit,
    showBravaisLattice,
  ]);

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

          {/* Gallery: visual preset picker (grouped by wallpaper group) */}
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
                      <button
                        key={t.id}
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
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

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
                <label className="flex items-center gap-2 text-xs opacity-90">
                  <input
                    type="checkbox"
                    checked={showRegions}
                    onChange={(e) => setShowRegions(e.target.checked)}
                  />
                  Show region (pink, 1 per cell)
                </label>

                <label className="flex items-center gap-2 text-xs opacity-90">
                  <input
                    type="checkbox"
                    checked={showOrbit}
                    onChange={(e) => setShowOrbit(e.target.checked)}
                  />
                  Show orbit (gray, all domains)
                </label>

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

          {selectedTemplate && (
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
