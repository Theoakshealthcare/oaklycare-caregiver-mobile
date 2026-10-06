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

export const FOREGROUND_RATIONALE = {
  title: "Share your location",
  message:
    "Oakly uses your location while you are available so we can offer you visits near you. It is only shared while the app is open, and you can go unavailable at any time.",
};

export const BACKGROUND_RATIONALE = {
  title: "Share your location during visits",
  message:
    "During an active visit Oakly shares your location even when the app is closed, so the patient and our team can see you are on your way and have arrived. It stops when you complete the visit. On the next screen, choose \"Always\" (or \"Allow all the time\").",
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
