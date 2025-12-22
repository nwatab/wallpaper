'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { unitTemplates } from '@/wallpaper/unitTemplates';
import { renderWallpaperSvg } from '@/wallpaper/renderSvg';

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
  const [showBravaisLattice, setShowBravaisLattice] = useState(false);
  const [advancedOptionsExpanded, setAdvancedOptionsExpanded] = useState(false);

  const selectedTemplate = useMemo(() => {
    const t = unitTemplates.find((x) => x.id === selectedId);
    return t ?? unitTemplates[0];
  }, [selectedId]);

  // 壁紙は「全画面レイヤー」のサイズで計測する
  const [wallRef, wallSize] = useElementSize<HTMLDivElement>();

  const svg = useMemo(() => {
    if (!selectedTemplate) return '';
    if (wallSize.width <= 0 || wallSize.height <= 0) return '';

    return renderWallpaperSvg({
      template: selectedTemplate,
      viewport: { x: 0, y: 0, width: wallSize.width, height: wallSize.height },
      debugOptions: {
        showRegions,
        showBravaisLattice,
      },
    });
  }, [
    selectedTemplate,
    wallSize.width,
    wallSize.height,
    showRegions,
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

          <label className="flex flex-col gap-1.5">
            <span className="text-xs opacity-80">Template</span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="h-9 rounded-lg px-2.5 bg-white/8 border border-white/14 text-inherit outline-none"
            >
              {templatesByGroup.map(([group, items]) => (
                <optgroup key={group} label={group}>
                  {items.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
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
                  Show regions (fundamental domains)
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
        </div>
      </aside>
    </div>
  );
}
