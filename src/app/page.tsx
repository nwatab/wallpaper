'use client';

import MotifGallery from '@/components/components/MotifGalleryClient';
import WallpaperGroupGallery from '@/components/components/WallpaperGroupGalleryClient';
import WallpaperView from '@/components/components/WallpaperViewClient';
import { AppProvider } from '@/lib/store/appStore';
import Script from 'next/script';
import Image from 'next/image';

export default function Home() {
  return (
    <AppProvider>
      <div className="flex h-screen">
        <div className="max-w-64 min-w-16 bg-gray-100 p-2.5 pb-[90px] overflow-y-auto">
          <h2 className="mt-10">Unit</h2>
          <div className="flex flex-wrap">
            <MotifGallery />
          </div>
          <h2 className="mt-10">Group</h2>
          <div className="flex flex-wrap">
            <WallpaperGroupGallery />
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
          <WallpaperView />
        </div>
      </div>
    </AppProvider>
  );
}
