import MotifGallery from '@/components/MotifGalleryClient';
import WallpaperGroupGallery from '@/components/WallpaperGroupGalleryClient';
import WallpaperView from '@/components/WallpaperViewClient';
import { Circle, SquareMotif, Rectangle } from '@/lib/models';
import { P1Group } from '@/lib/wallpaperGroups/implementations';
import Script from 'next/script';
import Image from 'next/image';

// デフォルトのモチーフを作成
const defaultMotif = new SquareMotif(1, [
  new Rectangle(0.1, 0.1, 0.3, 0.3, 'red'),
  new Rectangle(0.4, 0.5, 0.4, 0.4, 'green'),
  new Circle(0.6, 0.6, 0.2, 'blue'),
]);

const defaultWallpaperGroup = new P1Group();

export default function Home() {
  return (
    <div className="flex h-screen">
      <div className="max-w-64 min-w-16 bg-gray-100 p-2.5 pb-[90px] overflow-y-auto">
        <h2 className="mt-10">Unit</h2>
        <div className="flex flex-wrap">
          <MotifGallery
            selectedMotif={defaultMotif}
            setSelectedMotif={() => {}}
          />
        </div>
        <h2 className="mt-10">Group</h2>
        <div className="flex flex-wrap">
          <WallpaperGroupGallery
            selectedMotif={defaultMotif}
            selectedWallpaperGroup={defaultWallpaperGroup}
            setSelectedWallpaperGroup={() => {}}
          />
        </div>

        <div className="fixed bottom-2.5 left-2.5 z-[1000] text-left">
          <Script
            src="https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js"
            data-name="bmc-button"
            data-slug="nwta"
            data-color="#FFDD00"
            data-emoji=""
            data-font="Cookie"
            data-text="Buy me a coffee"
            data-outline-color="#000000"
            data-font-color="#000000"
            data-coffee-color="#ffffff"
          />
        </div>

        <div className="mt-[60px] text-left">
          <a
            href="https://github.com/nwatab/wallpaper"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src="/github-mark.svg"
              alt="GitHub Repository"
              width={24}
              height={24}
            />
          </a>
        </div>
      </div>

      <div className="flex-grow relative overflow-hidden">
        <WallpaperView
          selectedMotif={defaultMotif}
          selectedWallpaperGroup={defaultWallpaperGroup}
        />
      </div>
    </div>
  );
}
