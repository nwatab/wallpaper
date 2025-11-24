'use client';

import { useAppStore } from '@/lib/store/appStore';
import { Motif, Circle, SquareMotif, Rectangle } from '@/lib/models';
import { SVGRenderer } from '@/lib/renderers';
import { useEffect, useRef } from 'react';

// デフォルトのモチーフを作成
const defaultMotif = new SquareMotif(1, [
  new Rectangle(0.1, 0.1, 0.3, 0.3, 'red'),
  new Rectangle(0.4, 0.5, 0.4, 0.4, 'green'),
  new Circle(0.6, 0.6, 0.2, 'blue'),
]);

const motifs: Motif[] = [defaultMotif];

function MotifPreview({
  motif,
  isSelected,
  onClick,
}: {
  motif: Motif;
  isSelected: boolean;
  onClick: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      const renderer = new SVGRenderer(svgRef.current);
      renderer.clear();

      // モチーフを描画
      renderer.renderMotif(motif);
    }
  }, [motif]);

  return (
    <div
      className={`inline-block m-1.5 cursor-pointer border ${
        isSelected ? 'border-2 border-purple-500' : 'border border-gray-300'
      } w-16 h-16 overflow-hidden`}
      onClick={onClick}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 1 1"
        width={64}
        height={64}
        xmlns="http://www.w3.org/2000/svg"
      />
    </div>
  );
}

export default function MotifGallery() {
  const { selectedMotif, setSelectedMotif } = useAppStore();

  return (
    <>
      {motifs.map((motif, index) => (
        <MotifPreview
          key={index}
          motif={motif}
          isSelected={selectedMotif === motif}
          onClick={() => setSelectedMotif(motif)}
        />
      ))}
    </>
  );
}
