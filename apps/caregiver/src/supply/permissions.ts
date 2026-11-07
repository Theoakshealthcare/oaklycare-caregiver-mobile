import * as Location from "expo-location";
import { Alert, Linking } from "react-native";

import { locationPermissionStore } from "./permissionState";

/** Resolves true when the caregiver taps the confirm button. Shown BEFORE the OS prompt. */
export function confirmRationale(title: string, message: string, confirmLabel = "Continue"): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: "Not now", style: "cancel", onPress: () => resolve(false) },
        { text: confirmLabel, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

function offerSettings(title: string, message: string): void {
  Alert.alert(title, message, [
    { text: "Not now", style: "cancel" },
    { text: "Open Settings", onPress: () => void Linking.openSettings() },
  ]);
}

/**
 * The one statement of when Oakly shares the caregiver's location. Every prompt and card uses it, so
 * they cannot contradict each other (DP1-13). It matches `decideTracking`: while available with the
 * app open, and from "On my way" until the visit is completed (with the app closed too, when
 * "Always" is allowed).
 */
export const LOCATION_SHARING_SENTENCE =
  "Oakly shares your location while you are available and the app is open, and from \u201cOn my way\u201d until you complete a visit, even with the app closed if you allow \u201cAlways\u201d.";

export const FOREGROUND_RATIONALE = {
  title: "Share your location",
  message: `${LOCATION_SHARING_SENTENCE} We use it to offer you visits near you. You can go unavailable at any time.`,
};

export const BACKGROUND_RATIONALE = {
  title: "Share your location during visits",
  message: `${LOCATION_SHARING_SENTENCE} On the next screen, choose \u201cAlways\u201d (or \u201cAllow all the time\u201d).`,
};

interface Explain {
  explain?: (title: string, message: string) => Promise<boolean>;
}

export async function hasForegroundLocation(): Promise<boolean> {
  return (await Location.getForegroundPermissionsAsync()).granted;
}

export async function hasBackgroundLocation(): Promise<boolean> {
  return (await Location.getBackgroundPermissionsAsync()).granted;
}

/**
 * Foreground location, explained first. Already granted: no dialog. Previously denied with the OS
 * unwilling to ask again: point to Settings instead of a prompt that would never appear.
 */
async function foreground({ explain = confirmRationale }: Explain): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) {
    offerSettings("Location is turned off", "Allow location for Oakly in Settings so we can offer you visits near you.");
    return false;
  }
  if (!(await explain(FOREGROUND_RATIONALE.title, FOREGROUND_RATIONALE.message))) return false;
  return (await Location.requestForegroundPermissionsAsync()).granted;
}

/** Background ("Always") location for active visits. Needs foreground first; never forced. */
async function background({ explain = confirmRationale }: Explain): Promise<boolean> {
  if (!(await foreground({ explain }))) return false;
  const current = await Location.getBackgroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) {
    offerSettings(
      "Background location is off",
      "To share your location during visits with the app closed, set Oakly's location access to Always in Settings.",
    );
    return false;
  }
  if (!(await explain(BACKGROUND_RATIONALE.title, BACKGROUND_RATIONALE.message))) return false;
  return (await Location.requestBackgroundPermissionsAsync()).granted;
}

/** Foreground location, explained first (see {@link foreground}). Refreshes the permission store. */
export async function ensureForegroundLocation(options: Explain = {}): Promise<boolean> {
  try {
    return await foreground(options);
  } finally {
    await locationPermissionStore.getState().refresh();
  }
}

/** Background location for active visits (see {@link background}). Refreshes the permission store. */
export async function ensureBackgroundLocation(options: Explain = {}): Promise<boolean> {
  try {
    return await background(options);
  } finally {
    await locationPermissionStore.getState().refresh();
  }
}
