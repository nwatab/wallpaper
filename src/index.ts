import {
  MotifGallery,
  WallpaperGroupGallery,
  WallpaperView,
} from '@/components';
import { setAppState } from '@/app';
import { randomSquareMotif } from '@/assets';
import { P1Group } from '@/wallpaperGroups';
import './styles/index.css';

function initializeApp() {
  // 各コンポーネントを初期化
  new MotifGallery('motif-gallery');
  new WallpaperGroupGallery('wallpaper-group-gallery');
  new WallpaperView('wallpaper-view');

  // 初期のモチーフと壁紙群を設定
  setAppState({
    selectedMotif: randomSquareMotif,
    selectedWallpaperGroup: new P1Group(),
  });
}

window.onload = () => {
  initializeApp();
};
