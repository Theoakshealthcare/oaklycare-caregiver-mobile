import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

/** The only thing besides the tokens kept on the device: "this phone has seen the intro slides". Not secret, and
 * signing out leaves it alone (the intro is per install, not per account). */
export const ONBOARDING_KEY = "oakly.onboarding_seen";

interface OnboardingState {
  status: "unknown" | "unseen" | "seen";
  restore: () => Promise<void>;
  complete: () => Promise<void>;
}

export const useOnboarding = create<OnboardingState>((set) => ({
  status: "unknown",
  async restore() {
    try {
      set({ status: (await SecureStore.getItemAsync(ONBOARDING_KEY)) ? "seen" : "unseen" });
    } catch {
      // An unreadable store must never trap the person on the intro: treat it as seen.
      set({ status: "seen" });
    }
  },
  async complete() {
    set({ status: "seen" });
    try {
      await SecureStore.setItemAsync(ONBOARDING_KEY, "1");
    } catch {
      // Worst case the slides show once more on the next launch.
    }
  },
}));
