import { Motif } from '@/models';
import { P1Group, WallpaperGroup } from '@/wallpaperGroups';
import { randomSquareMotif } from './assets';

export type AppState = {
  selectedMotif: Motif;
  selectedWallpaperGroup: WallpaperGroup;
  listeners: (() => void)[];
};

export const appState: AppState = {
  selectedMotif: randomSquareMotif,
  selectedWallpaperGroup: new P1Group(),
  listeners: [],
};

// 状態を更新するたびに、リスナーに通知
export function setAppState(state: Partial<AppState>) {
  if (state.selectedMotif !== undefined) {
    appState.selectedMotif = state.selectedMotif;
  }
  if (state.selectedWallpaperGroup !== undefined) {
    appState.selectedWallpaperGroup = state.selectedWallpaperGroup;
  }
  // リスナーに通知
  appState.listeners.forEach((listener) => listener());
}

// 状態変更時にコールバックを登録
export function subscribe(listener: () => void) {
  appState.listeners.push(listener);
}
