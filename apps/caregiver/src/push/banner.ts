import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";

export interface BannerState {
  banner: { title: string; body: string; bookingId: string } | null;
  show(banner: NonNullable<BannerState["banner"]>): void;
  hide(): void;
}

/** The in-app banner for a job offer that arrives while the app is open. */
export const bannerStore: StoreApi<BannerState> = createStore<BannerState>((set) => ({
  banner: null,
  show: (banner) => set({ banner }),
  hide: () => set({ banner: null }),
}));

export function useBanner(): BannerState {
  return useStore(bannerStore);
}
