import { useIsFocused, useNavigationState, useRoute } from "@react-navigation/native";
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
  /** The colour a route drawn as a transparent modal dims the page with; the app root dims the two strips the same way. */
  dim: string | null;
  setTop: (color: string | null) => void;
  setBottom: (color: string | null) => void;
  setDim: (color: string | null) => void;
}

export const useScreenChrome = create<ScreenChromeState>((set) => ({
  top: null,
  bottom: null,
  dim: null,
  setTop: (top) => set({ top }),
  setBottom: (bottom) => set({ bottom }),
  setDim: (dim) => set({ dim }),
}));

/**
 * Called by a screen that is a transparent modal route (the manual-entry sheet, the booking sheet and dialogs): the strips over
 * the status bar and under the home indicator are outside the navigator, so without this they stay un-dimmed (a white and a
 * teal stripe above and below the dimmed page). While the screen is mounted the app root dims them with `color`.
 */
export function useDimBands(color: string): void {
  const setDim = useScreenChrome((s) => s.setDim);
  useEffect(() => {
    setDim(color);
    return () => setDim(null);
  }, [color, setDim]);
}

/**
 * The top band of a tab screen whose header is a colour (Vitals, Bookings): on while the tab is on screen, and also while a
 * transparent modal is drawn over it (the screen is then not "focused", but it is still what the person sees behind the dim).
 */
export function useTabTopBand(color: string): void {
  const focused = useIsFocused();
  const route = useRoute();
  const selected = useNavigationState((s) => s.routes[s.index]?.key === route.key);
  const covered = useScreenChrome((s) => s.dim !== null);
  const setTop = useScreenChrome((s) => s.setTop);
  const on = focused || (selected && covered);
  useEffect(() => {
    if (!on) return;
    setTop(color);
    return () => setTop(null);
  }, [on, color, setTop]);
}

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
