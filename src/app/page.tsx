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
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* 壁紙：全画面（メニューの下に敷く） */}
      <div
        ref={wallRef}
        id="wallpaper"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          overflow: 'hidden',
          // 壁紙は操作しない前提なら、メニュー操作の邪魔をしないようにしておくと堅い
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            userSelect: 'none',
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      {/* 左メニュー：半透明で上に載せる */}
      <aside
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: 320,
          zIndex: 10,
          overflowY: 'auto',
          padding: 16,
          borderRight: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 14, opacity: 0.9 }}>Wallpaper</div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Template</span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              style={{
                height: 36,
                borderRadius: 8,
                padding: '0 10px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.14)',
                color: 'inherit',
                outline: 'none',
              }}
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
          <div
            style={{
              marginTop: 8,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 8,
            }}
          >
            <button
              onClick={() =>
                setAdvancedOptionsExpanded(!advancedOptionsExpanded)
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: 12,
                background: 'none',
                border: 'none',
                borderRadius: advancedOptionsExpanded ? '8px 8px 0 0' : '8px',
                color: 'inherit',
                fontSize: 12,
                cursor: 'pointer',
                outline: 'none',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  transform: advancedOptionsExpanded
                    ? 'rotate(90deg)'
                    : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  fontSize: 10,
                }}
              >
                ▶
              </span>
              Advanced Options
            </button>

            {advancedOptionsExpanded && (
              <div
                style={{
                  padding: '0 12px 12px 12px',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    opacity: 0.9,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showRegions}
                    onChange={(e) => setShowRegions(e.target.checked)}
                  />
                  Show regions (fundamental domains)
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    opacity: 0.9,
                  }}
                >
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
            <div
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
                Selected
              </div>
              <div>
                <span style={{ opacity: 0.7 }}>group:</span>{' '}
                {selectedTemplate.group}
              </div>
              <div>
                <span style={{ opacity: 0.7 }}>id:</span> {selectedTemplate.id}
              </div>
              <div>
                <span style={{ opacity: 0.7 }}>motif:</span>{' '}
                {selectedTemplate.motifId}
              </div>
              <div style={{ marginTop: 6, opacity: 0.75 }}>
                viewport: {wallSize.width} × {wallSize.height}
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
            壁紙は画面実寸に合わせて自動再生成します（メニューは上に重ね表示）。
          </div>
        </div>
      </aside>

      {/* SVGのサイズを強制的に100%へ */}
      <style>{`
        #wallpaper svg {
          width: 100% !important;
          height: 100% !important;
          display: block;
        }
      `}</style>
    </div>
  );
}
