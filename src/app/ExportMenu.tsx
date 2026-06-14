'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  snapshotExportSvg,
  tileableExportSvg,
  type ExportState,
  type ExportBackground,
} from '@/wallpaper/export/exportSvg';
import type { UnitTemplate } from '@/wallpaper/types';
import type { GalleryMotif } from '@/wallpaper/galleryMotifs';
import { downloadSvg } from './downloadSvg';

// The two export INTENTS (not formats): the pattern as displayed vs. one canonical seamless
// unit. They are distinct enough that an instant-download split button would risk handing the
// user the wrong one — so the entry is a single button that opens a focused, preview-led panel.
type ExportKind = 'current' | 'tile';

type Props = {
  // The live, on-screen SVG (current pose + viewport) — the snapshot source, passed in so this
  // component never re-derives the pattern.
  displaySvg: string;
  // The active SELECTION mode. Never 'warp': the menu is hidden in the warp stage (raster output).
  mode: 'gallery' | 'switch' | 'draw';
  template?: UnitTemplate;
  group: string;
  // Draw mode only — the user's motif tiled under the group.
  motif?: GalleryMotif;
};

const DownloadIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 3v12" />
    <path d="m7 11 5 5 5-5" />
    <path d="M5 19h14" />
  </svg>
);

const ChevronIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

// A live thumbnail of an export string. The exports carry their own viewBox and no
// preserveAspectRatio, so the default (xMidYMid meet) letterboxes them undistorted inside this
// fixed-aspect white box — the white box also previews the default white backdrop.
function Thumb({ svg }: { svg: string }) {
  return (
    <div
      className="aspect-[12/7] w-full overflow-hidden rounded bg-white [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function PreviewCard({
  selected,
  onSelect,
  svg,
  title,
  subtitle,
}: {
  selected: boolean;
  onSelect: () => void;
  svg: string;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`rounded-md p-1.5 text-left transition-shadow ${
        selected
          ? 'bg-white/10 ring-2 ring-white'
          : 'bg-white/5 ring-1 ring-white/15 hover:ring-white/40'
      }`}
    >
      <Thumb svg={svg} />
      <div className="mt-1.5 text-xs font-medium text-white">{title}</div>
      <div className="text-[11px] text-white/55">{subtitle}</div>
    </button>
  );
}

export default function ExportMenu({
  displaySvg,
  mode,
  template,
  group,
  motif,
}: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ExportKind>('current');
  // Background defaults to WHITE: several patterns (seigaiha etc.) rely on the white showing
  // through, so transparent is opt-in. Mirrors exportSvg's own default.
  const [transparent, setTransparent] = useState(false);
  const [includeGuides, setIncludeGuides] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const background: ExportBackground = transparent ? 'transparent' : 'white';

  // ONE ExportState feeds both the previews and the download — the previews call the exact same
  // pure builders the download does, so the thumbnail is byte-identical to the file.
  const exportState: ExportState = useMemo(
    () => ({ displaySvg, includeGuides, mode, template, group, motif, background }),
    [displaySvg, includeGuides, mode, template, group, motif, background],
  );

  // Built only while open: the tileable build runs tile() + a <pattern>, so there's no reason to
  // pay it (or re-parse the big snapshot string) when the popover is closed.
  const currentPreview = useMemo(
    () => (open ? snapshotExportSvg(exportState) : ''),
    [open, exportState],
  );
  const tilePreview = useMemo(
    () => (open ? tileableExportSvg(exportState) : ''),
    [open, exportState],
  );

  const selectedSvg = kind === 'current' ? currentPreview : tilePreview;
  // Guides apply to the snapshot only (the tileable export is always the clean canonical pattern).
  const guidesActive = kind === 'current';

  const filenameGroup =
    mode === 'gallery' ? template?.group ?? 'wallpaper' : group;
  const filename = `wallpaper-${filenameGroup}-${mode}-${kind}`;

  const onDownload = () => {
    if (!selectedSvg) return;
    downloadSvg(selectedSvg, filename);
    setOpen(false);
  };

  return (
    <>
      {/* Outside-click dismissal. Transparent (no dim) — this is a lightweight popover, not a
          modal — and sits below the popover but above the rest of the app. */}
      {open && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[15] cursor-default"
        />
      )}

      <div className="fixed top-4 right-4 z-20 flex flex-col items-end">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/35 px-3.5 py-2 text-[13px] font-medium text-white backdrop-blur-md transition-colors hover:bg-black/45"
        >
          <DownloadIcon className="h-4 w-4" />
          Download
          <ChevronIcon
            className={`h-3.5 w-3.5 opacity-70 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        {open && (
          <div
            role="dialog"
            aria-label="Export SVG"
            className="absolute right-0 top-full mt-2 w-[300px] rounded-xl border border-white/15 bg-black/45 p-3.5 text-white backdrop-blur-md"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">Export SVG</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-white/55 transition-colors hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Two intents as live previews — the thumbnail is the choice, so "snapshot vs
                tileable" never has to be understood from words. */}
            <div
              role="radiogroup"
              aria-label="What to export"
              className="mb-3.5 grid grid-cols-2 gap-2.5"
            >
              <PreviewCard
                selected={kind === 'current'}
                onSelect={() => setKind('current')}
                svg={currentPreview}
                title="Current view"
                subtitle="What's on screen now"
              />
              <PreviewCard
                selected={kind === 'tile'}
                onSelect={() => setKind('tile')}
                svg={tilePreview}
                title="Seamless tile"
                subtitle="One repeating unit"
              />
            </div>

            <div className="mb-1.5 text-[11px] text-white/60">Background</div>
            <div className="mb-3 flex gap-1 rounded-md bg-white/8 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setTransparent(false)}
                aria-pressed={!transparent}
                className={`flex-1 rounded py-1.5 transition-colors ${
                  !transparent
                    ? 'bg-white font-medium text-black'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                White
              </button>
              <button
                type="button"
                onClick={() => setTransparent(true)}
                aria-pressed={transparent}
                className={`flex-1 rounded py-1.5 transition-colors ${
                  transparent
                    ? 'bg-white font-medium text-black'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Transparent
              </button>
            </div>

            {/* Guides only make sense for the snapshot — disabled (not hidden) for the tile, so
                the option stays where the user last saw it. */}
            <div
              className={`mb-3.5 flex items-center justify-between ${
                guidesActive ? '' : 'opacity-40'
              }`}
            >
              <div>
                <div className="text-xs">Include guides</div>
                <div className="text-[11px] text-white/50">Current view only</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={guidesActive && includeGuides}
                disabled={!guidesActive}
                onClick={() => setIncludeGuides((g) => !g)}
                className={`relative h-[18px] w-[34px] shrink-0 rounded-full transition-colors ${
                  guidesActive && includeGuides ? 'bg-white' : 'bg-white/20'
                } ${guidesActive ? '' : 'cursor-not-allowed'}`}
              >
                <span
                  className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${
                    guidesActive && includeGuides
                      ? 'left-[18px] bg-black'
                      : 'left-0.5 bg-white'
                  }`}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={onDownload}
              disabled={!selectedSvg}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-white py-2.5 text-[13px] font-medium text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <DownloadIcon className="h-4 w-4" />
              Download SVG
            </button>
            <div className="mt-2 text-center font-mono text-[11px] text-white/40">
              {filename}.svg
            </div>
          </div>
        )}
      </div>
    </>
  );
}
