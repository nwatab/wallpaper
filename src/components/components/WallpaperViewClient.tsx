'use client';

import { useAppStore } from '@/lib/store/appStore';
import { SVGRenderer } from '@/lib/renderers';
import { Tiling } from '@/lib/tiling';
import { useEffect, useRef, useState } from 'react';

export default function WallpaperView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const { selectedMotif, selectedWallpaperGroup } = useAppStore();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // クライアントサイドでのみ実行
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // 初期サイズを設定
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!svgRef.current || !selectedMotif || !selectedWallpaperGroup || dimensions.width === 0) {
      return;
    }

    const renderer = new SVGRenderer(svgRef.current);
    renderer.clear();

    // 1. タイルベクトルを計算
    selectedWallpaperGroup.computeTileVectors(selectedMotif);

    // 2. ファンダメンタル・リージョンを生成
    const fundamentalRegion = selectedWallpaperGroup.createFundamentalRegion(selectedMotif);

    // 3. タイリングを行い、壁紙全体を生成
    const tiling = new Tiling(dimensions.width, dimensions.height);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [tileVectorA, tileVectorB] = fundamentalRegion.tileVectors.map((v: any) => v.scale(64));
    const tileVectors = tiling.generateWallpaperMotif(tileVectorA, tileVectorB);

    // 4. 描画を実行
    renderer.renderTilesWithDefs(fundamentalRegion, tileVectors);
  }, [selectedMotif, selectedWallpaperGroup, dimensions]);

  return (
    <svg
      ref={svgRef}
      id="wallpaper-view"
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      style={{ display: 'block' }}
    >
      <defs />
    </svg>
  );
}
