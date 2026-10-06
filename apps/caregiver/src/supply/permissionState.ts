import * as Location from "expo-location";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

export interface LocationPermissionState {
  foreground: boolean;
  background: boolean;
  /** True once the OS has been asked at least once for this value. */
  loaded: boolean;
  refresh(): Promise<void>;
}

/** What the OS currently allows. Read by the tracking controller; refreshed after every prompt. */
export const locationPermissionStore = createStore<LocationPermissionState>((set) => ({
  foreground: false,
  background: false,
  loaded: false,
  async refresh() {
    try {
      const [fg, bg] = await Promise.all([
        Location.getForegroundPermissionsAsync(),
        Location.getBackgroundPermissionsAsync(),
      ]);
      set({ foreground: fg.granted, background: bg.granted, loaded: true });
    } catch {
      set({ foreground: false, background: false, loaded: true });
    }
  },
}));

export function useLocationPermissions(): LocationPermissionState {
  return useStore(locationPermissionStore);
}
