import { useEffect } from "react";
import { create } from "zustand";

/**
 * The strip under the home indicator. The app root keeps every screen inside the safe area on white; a screen whose design
 * runs a colour to the bottom edge (the coloured panel of the welcome slides) asks for that colour here instead of leaving
 * a white band. The same goes for the strip over the status bar (Home sits on a faint cool white edge to edge).
 */
interface ScreenChromeState {
  top: string | null;
  bottom: string | null;
  setTop: (color: string | null) => void;
  setBottom: (color: string | null) => void;
}

export const useScreenChrome = create<ScreenChromeState>((set) => ({
  top: null,
  bottom: null,
  setTop: (top) => set({ top }),
  setBottom: (bottom) => set({ bottom }),
}));

/** Paints the strip under the home indicator with `color` while the calling screen is mounted (null = the default white). */
export function useBottomBand(color: string | null): void {
  const setBottom = useScreenChrome((s) => s.setBottom);
  useEffect(() => {
    setBottom(color);
    return () => setBottom(null);
  }, [color, setBottom]);
}

/** Paints the strip under the status bar with `color` while the calling screen is mounted (null = the default white). */
export function useTopBand(color: string | null): void {
  const setTop = useScreenChrome((s) => s.setTop);
  useEffect(() => {
    setTop(color);
    return () => setTop(null);
  }, [color, setTop]);
}
