'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { Motif } from '@/lib/models';
import { WallpaperGroup } from '@/lib/wallpaperGroups';
import { P1Group } from '@/lib/wallpaperGroups/implementations';
import { Circle, SquareMotif, Rectangle } from '@/lib/models';

// デフォルトのモチーフを作成
const defaultMotif = new SquareMotif(1, [
  new Rectangle(0.1, 0.1, 0.3, 0.3, 'red'),
  new Rectangle(0.4, 0.5, 0.4, 0.4, 'green'),
  new Circle(0.6, 0.6, 0.2, 'blue'),
]);

interface AppState {
  selectedMotif: Motif;
  selectedWallpaperGroup: WallpaperGroup;
  setSelectedMotif: (motif: Motif) => void;
  setSelectedWallpaperGroup: (group: WallpaperGroup) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedMotif, setSelectedMotif] = useState<Motif>(defaultMotif);
  const [selectedWallpaperGroup, setSelectedWallpaperGroup] = useState<WallpaperGroup>(new P1Group());

  return (
    <AppContext.Provider
      value={{
        selectedMotif,
        selectedWallpaperGroup,
        setSelectedMotif,
        setSelectedWallpaperGroup,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
}
