'use client';

import { useAppStore } from '@/lib/store/appStore';
import { WallpaperGroup, P1Group } from '@/lib/wallpaperGroups';
import { WallpaperGroupType } from '@/lib/types';
import { SVGRenderer } from '@/lib/renderers';
import { useEffect, useRef } from 'react';

const groups: { name: WallpaperGroupType; instance: WallpaperGroup }[] = [
  { name: 'p1', instance: new P1Group() },
];

function GroupPreview({
  group,
  isSelected,
  onClick,
}: {
  group: WallpaperGroup;
  isSelected: boolean;
  onClick: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { selectedMotif } = useAppStore();

  useEffect(() => {
    if (svgRef.current && selectedMotif) {
      const renderer = new SVGRenderer(svgRef.current);
      renderer.clear();

      const fundamentalRegion = group.createFundamentalRegion(selectedMotif);
      renderer.renderFundamentalRegion(fundamentalRegion);
    }
  }, [group, selectedMotif]);

  return (
    <div
      className={`inline-block m-1.5 cursor-pointer border ${
        isSelected ? 'border-2 border-purple-500' : 'border border-gray-300'
      } w-16 h-16 overflow-hidden box-border relative group`}
      onClick={onClick}
      data-description={group.groupType}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 1 1"
        width={64}
        height={64}
        xmlns="http://www.w3.org/2000/svg"
      />
      <div className="absolute bottom-[105%] left-[-20%] transform translate-x-0 bg-black/75 text-white px-2.5 py-1.5 rounded whitespace-nowrap opacity-0 pointer-events-none transition-opacity duration-100 z-[100] group-hover:opacity-100">
        {group.groupType}
      </div>
    </div>
  );
}

export default function WallpaperGroupGallery() {
  const { selectedWallpaperGroup, setSelectedWallpaperGroup } = useAppStore();

  return (
    <>
      {groups.map(({ instance }, index) => (
        <GroupPreview
          key={index}
          group={instance}
          isSelected={selectedWallpaperGroup === instance}
          onClick={() => setSelectedWallpaperGroup(instance)}
        />
      ))}
    </>
  );
}
