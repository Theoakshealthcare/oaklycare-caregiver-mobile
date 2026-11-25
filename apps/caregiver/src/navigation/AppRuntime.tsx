import * as Notifications from "expo-notifications";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";

import { queryKeys } from "@/src/api/keys";
import { queryClient } from "@/src/api/queryClient";
import InAppBanner from "@/src/components/booking/InAppBanner";
import { useCaregiverHome } from "@/src/hooks/queries";
import { bannerStore } from "@/src/push/banner";
import { resolveOffer } from "@/src/push/openOffer";
import { isLocationStale, parseChatMessage, parseJobOffer } from "@/src/push/registration";
import { stopVisitUpdates, startVisitUpdates } from "@/src/supply/backgroundLocationTask";
import { createExpoForegroundTracker, readCurrentPosition } from "@/src/supply/foregroundTracker";
import { shouldRefetchHomeAfterPing } from "@/src/home/homeModel";
import { locationService, type CaregiverHome, type Coords } from "@/src/supply/locationService";
import { locationPermissionStore, useLocationPermissions } from "@/src/supply/permissionState";
import { decideTracking } from "@/src/supply/tracking";

import { navigationRef } from "./navigationRef";
import { createTrackingController } from "@/src/supply/trackingController";

/** Opens the offer detail for a booking id, from a push tap or the in-app banner. */
async function openOffer(bookingId: string): Promise<void> {
  const offer = await resolveOffer(bookingId, () =>
    queryClient.fetchQuery({ queryKey: queryKeys.home, queryFn: locationService.getHome, staleTime: 0 }),
  );
  if (!offer) {
    Alert.alert("Job no longer available", "This request was taken by another caregiver or has expired.");
    return;
  }
  if (navigationRef.isReady()) navigationRef.navigate("BookingDetails", { bookingId, offer });
}

/** Opens the booking's chat, from the tap on a new-message push. Chat is reachable only from an accepted booking, so the id is the booking's. */
function openChat(bookingId: string): void {
  if (navigationRef.isReady()) navigationRef.navigate("ChatScreen", { bookingId });
}

/** The tap on the "update your location" nudge opens the app on Home (the same landing as a normal launch). */
function openHome(): void {
  if (navigationRef.isReady()) navigationRef.navigate("BottomNavigation", { tab: "home", at: Date.now() });
}

/**
 * One location ping, and the Home refetch after the first one (the warning on Home is judged from the last fetched home: DP1-14).
 * The ping never carries `is_available`, so it cannot change whether the caregiver is available.
 */
async function sendPing(coords: Coords): Promise<void> {
  await locationService.ping(coords);
  if (shouldRefetchHomeAfterPing(queryClient.getQueryData<CaregiverHome>(queryKeys.home), Date.now())) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.home });
  }
}

/** A fresh position now, for the "update your location" nudge (the watcher alone only reports a move of 100 m, or waits out its 60 s heartbeat). */
async function pingNow(): Promise<void> {
  const coords = await readCurrentPosition();
  if (coords) await sendPing(coords).catch(() => undefined);
}

/**
 * Everything that runs while an approved caregiver is in the app: location tracking decided by
 * `decideTracking`, push-tap routing and the in-app banner. Renders only the banner.
 * Unmounting (sign-out, suspension) stops all location updates.
 */
const AppRuntime: React.FC = () => {
  const home = useCaregiverHome();
  const permissions = useLocationPermissions();
  const [foregroundTracker] = useState(() => createExpoForegroundTracker(sendPing));
  const handled = useRef(new Set<string>());

  // Location permission can change in Settings while the app is in the background.
  useEffect(() => {
    void locationPermissionStore.getState().refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void locationPermissionStore.getState().refresh();
    });
    return () => sub.remove();
  }, []);

  const mode = home.data
    ? decideTracking({
        profileStatus: home.data.profile_status,
        isAvailable: home.data.is_available,
        todayVisitStatuses: home.data.today_visits.map((v) => v.status),
        foregroundGranted: permissions.foreground,
        backgroundGranted: permissions.background,
      })
    : "off";

  // Mode changes are serialised and the controller is disposed on unmount (sign-out), so no
  // watcher can start after cleanup (see trackingController.ts).
  const [tracking] = useState(() =>
    createTrackingController({
      foreground: foregroundTracker,
      startVisit: startVisitUpdates,
      stopVisit: stopVisitUpdates,
    }),
  );

  // The latest tracking mode, for the push handlers below (they are created once).
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    tracking.apply(mode).catch((error: unknown) => {
      if (__DEV__) console.warn("[tracking] could not apply mode", mode, error);
    });
  }, [mode, tracking]);

  useEffect(
    () => () => {
      void tracking.dispose().catch(() => undefined);
    },
    [tracking],
  );

  const handleResponse = useCallback((response: Notifications.NotificationResponse) => {
    const id = response.notification.request.identifier;
    const data = response.notification.request.content.data;
    if (isLocationStale(data)) {
      if (handled.current.has(id)) return;
      handled.current.add(id);
      openHome();
      // Tracking is on only while the caregiver is available: then take a position now rather than waiting for the heartbeat.
      if (modeRef.current !== "off") void pingNow();
      return;
    }
    const offer = parseJobOffer(data);
    const chat = offer ? null : parseChatMessage(data);
    if ((!offer && !chat) || handled.current.has(id)) return;
    handled.current.add(id);
    if (offer) void openOffer(offer.bookingId);
    else if (chat) openChat(chat.bookingId);
  }, []);

  // Cold start from a tap, and taps while the app is running.
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (lastResponse) handleResponse(lastResponse);
  }, [lastResponse, handleResponse]);

  useEffect(() => {
    const tap = Notifications.addNotificationResponseReceivedListener(handleResponse);
    // A push in the foreground: show the banner and refresh offers (push is a hint, home is the truth).
    const received = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (isLocationStale(data)) {
        if (modeRef.current !== "off") void pingNow();
        return;
      }
      const chat = parseChatMessage(data);
      if (chat) {
        // A message arrived while the app is open: the open chat and the Chats list show it without waiting for the next poll.
        void queryClient.invalidateQueries({ queryKey: queryKeys.chat(chat.bookingId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.chats });
        return;
      }
      const offer = parseJobOffer(data);
      if (!offer) return;
      bannerStore.getState().show({
        title: notification.request.content.title ?? "New visit request",
        body: notification.request.content.body ?? "",
        bookingId: offer.bookingId,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      void queryClient.invalidateQueries({ queryKey: queryKeys.allBookings });
    });
    return () => {
      tap.remove();
      received.remove();
    };
  }, [handleResponse]);

  return <InAppBanner onOpen={(bookingId) => void openOffer(bookingId)} />;
};

export default AppRuntime;
