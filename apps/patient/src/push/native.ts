/**
 * The expo-notifications / expo-device wiring around the pure logic in `registration.ts`.
 */
import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";

import { useSession } from "@/src/auth";
import { pushTokenStorage } from "@/src/auth/secureStorage";
import { parsePushTap } from "@/src/domain/notifications";
import { notificationKeys } from "@/src/hooks/useNotifications";
import type { NavigationProp } from "@/src/navigation/Navigations";
import { notificationsService, pushService } from "@/src/services/notifications.service";

import { registerForPush, type PushRegistrationDeps } from "./registration";

/** EAS project id from app config. Absent until `eas init` has been run for the patient app: push then skips quietly. */
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
    getExpoPushToken: async (projectId, deviceToken) =>
      (
        await Notifications.getExpoPushTokenAsync({
          projectId,
          ...(deviceToken ? { devicePushToken: { type: Platform.OS === "ios" ? "ios" : "android", data: deviceToken } } : {}),
        })
      ).data,
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

/** While the app is open a notice still shows as a banner (the feed refetches on receipt, see `PushEffects`). */
export function installNotificationHandler(): void {
  if (handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/**
 * The OS rotated the native token. Answer with the token the event carries and never ask the OS for one here:
 * `getDevicePushTokenAsync` inside this listener fires it again, which once sent about 12 registrations a second.
 */
export function onDevicePushToken(token: { data: unknown }): void {
  if (typeof token.data !== "string") return;
  void registerForPush(nativePushDeps(), { deviceToken: token.data });
}

/**
 * Mounted once while a patient is signed in and the app stack is showing (inside the navigation container, outside any
 * screen). Registers the Expo token (skipped without an EAS project), refetches the feed when a push arrives, and opens
 * the booking (or, for a chat message, its chat) a tapped push points at after marking its feed row read (a 404 there is ignored).
 */
export function usePushEffects(): void {
  const signedIn = useSession((s) => s.status === "signedIn");
  const navigation = useNavigation<NavigationProp>();
  const client = useQueryClient();

  useEffect(() => {
    if (!signedIn) return undefined;
    installNotificationHandler();
    void registerForPush(nativePushDeps());

    const open = (data: unknown) => {
      const tap = parsePushTap(data);
      if (!tap) return;
      if (tap.notificationId) {
        void notificationsService
          .markRead(tap.notificationId)
          .catch(() => undefined)
          .then(() => client.invalidateQueries({ queryKey: notificationKeys.all }));
      }
      navigation.navigate(tap.destination === "chat" ? "Chat" : "BookingDetails", { id: tap.bookingId });
    };

    const tokenListener = Notifications.addPushTokenListener(onDevicePushToken);
    const receivedListener = Notifications.addNotificationReceivedListener(() => {
      void client.invalidateQueries({ queryKey: notificationKeys.all });
    });
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      open(response.notification.request.content.data);
    });
    // The app was closed when the push was tapped: the launch response is still waiting.
    void Promise.resolve(Notifications.getLastNotificationResponse()).then((response) => {
      if (response) open(response.notification.request.content.data);
    });

    return () => {
      tokenListener.remove();
      receivedListener.remove();
      responseListener.remove();
    };
  }, [signedIn, navigation, client]);
}
