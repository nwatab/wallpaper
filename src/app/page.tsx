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
      <div id="container">
        <div id="sidebar">
          <h2>Unit</h2>
          <div id="motif-gallery" className="previewGrid">
            <MotifGallery />
          </div>
          <h2>Group</h2>
          <div id="wallpaper-group-gallery" className="previewGrid">
            <WallpaperGroupGallery />
          </div>
          
          <div id="buyMeACoffee">
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

          <div id="githubLink" style={{ marginTop: '60px', textAlign: 'left' }}>
            <a href="https://github.com/nwatab/wallpaper" target="_blank" rel="noopener noreferrer">
              <Image src="/github-mark.svg" alt="GitHub Repository" width={24} height={24} />
            </a>
          </div>
        </div>

        <div id="mainContent" style={{ overflow: 'hidden' }}>
          <WallpaperView />
        </div>
      </div>
    </AppProvider>
  );
}
