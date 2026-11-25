import * as Notifications from "expo-notifications";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";

import { queryKeys } from "@/src/api/keys";
import { queryClient } from "@/src/api/queryClient";
import InAppBanner from "@/src/components/booking/InAppBanner";
import { useCaregiverHome } from "@/src/hooks/queries";
import { bannerStore } from "@/src/push/banner";
import { resolveOffer } from "@/src/push/openOffer";
import { parseChatMessage, parseJobOffer } from "@/src/push/registration";
import { stopVisitUpdates, startVisitUpdates } from "@/src/supply/backgroundLocationTask";
import { createExpoForegroundTracker } from "@/src/supply/foregroundTracker";
import { shouldRefetchHomeAfterPing } from "@/src/home/homeModel";
import { locationService, type CaregiverHome } from "@/src/supply/locationService";
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

/**
 * Everything that runs while an approved caregiver is in the app: location tracking decided by
 * `decideTracking`, push-tap routing and the in-app banner. Renders only the banner.
 * Unmounting (sign-out, suspension) stops all location updates.
 */
const AppRuntime: React.FC = () => {
  const home = useCaregiverHome();
  const permissions = useLocationPermissions();
  const [foregroundTracker] = useState(() => createExpoForegroundTracker(async (coords) => {
      await locationService.ping(coords);
      // The warning on Home is judged from the last fetched home: refetch once the first ping lands (DP1-14).
      if (shouldRefetchHomeAfterPing(queryClient.getQueryData<CaregiverHome>(queryKeys.home), Date.now())) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      }
    }));
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
