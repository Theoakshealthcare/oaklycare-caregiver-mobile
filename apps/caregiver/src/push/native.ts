/**
 * The expo-notifications / expo-device wiring around the pure logic in `registration.ts`.
 */
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";

import { pushTokenStorage } from "@/src/auth/secureStorage";
import { useSession } from "@/src/auth";
import { pushService } from "@/src/services/push.service";

import { parseJobOffer, registerForPush, type PushRegistrationDeps } from "./registration";

/** EAS project id from app config. Absent until `eas init` has been run for this app. */
export function easProjectId(): string | undefined {
  const extra: unknown = Constants.expoConfig?.extra;
  const eas = extra && typeof extra === "object" ? (extra as { eas?: unknown }).eas : undefined;
  const id = eas && typeof eas === "object" ? (eas as { projectId?: unknown }).projectId : undefined;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export function nativePushDeps(): PushRegistrationDeps {
  return {
    isDevice: Device.isDevice,
    platform: Platform.OS === "ios" ? "ios" : "android",
    projectId: easProjectId(),
    ensurePermission: ensureNotificationPermission,
    getExpoPushToken: async (projectId) => (await Notifications.getExpoPushTokenAsync({ projectId })).data,
    storedToken: () => pushTokenStorage.get(),
    storeToken: (token) => pushTokenStorage.set(token),
    register: (token, platform) => pushService.register(token, platform),
    forget: (token) => pushService.forget(token),
    log: (message) => {
      if (__DEV__) console.log(message);
    },
  };
}

let handlerInstalled = false;

/**
 * Foreground behaviour: a job offer is shown by the app's own banner (see `InAppBanner`), so the
 * system banner is suppressed for it. Everything else keeps the default.
 */
export function installNotificationHandler(): void {
  if (handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const isOffer = parseJobOffer(notification.request.content.data) !== null;
      return {
        shouldShowBanner: !isOffer,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      };
    },
  });
}

/**
 * Registers the Expo push token once the caregiver is signed in, and again whenever the OS rotates
 * it. Never throws: a failed registration is retried on the next launch or sign-in.
 */
export function usePushRegistration(): void {
  const signedIn = useSession((s) => s.status === "signedIn");
  useEffect(() => {
    if (!signedIn) return;
    void registerForPush(nativePushDeps());
    const subscription = Notifications.addPushTokenListener(() => {
      void registerForPush(nativePushDeps());
    });
    return () => subscription.remove();
  }, [signedIn]);
}
