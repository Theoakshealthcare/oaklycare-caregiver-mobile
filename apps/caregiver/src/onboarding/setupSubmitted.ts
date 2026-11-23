import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

/**
 * "Profile Setup Completed" is shown once, right after the consent is submitted and before the "under review" screen.
 *
 * The auth gate is driven by the server's profile status, and submitting consent flips it to `under_review` at once, which
 * would replace the setup stack with the status screen before the success page could be seen. So the consent screen raises
 * this flag first; while it is up the navigator shows the success page for an `under_review` profile, and "Go to Homepage"
 * (or Close) lowers it so the status screen takes over. In memory on purpose: relaunching the app, or signing out, goes
 * straight to the status screen.
 */
const store = createStore<{ submitted: boolean }>(() => ({ submitted: false }));

/** Called when the consent was accepted by the server. */
export function markSetupSubmitted(): void {
  store.setState({ submitted: true });
}

/** Called by "Go to Homepage" / Close, and on sign-out. */
export function resetSetupSubmitted(): void {
  store.setState({ submitted: false });
}

export function useSetupSubmitted(): boolean {
  return useStore(store, (state) => state.submitted);
}
