import * as Notifications from "expo-notifications";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";

import { queryKeys } from "@/src/api/keys";
import { queryClient } from "@/src/api/queryClient";
import InAppBanner from "@/src/components/booking/InAppBanner";
import { useCaregiverHome } from "@/src/hooks/queries";
import { bannerStore } from "@/src/push/banner";
import { resolveOffer } from "@/src/push/openOffer";
import { parseJobOffer } from "@/src/push/registration";
import { stopVisitUpdates, startVisitUpdates } from "@/src/supply/backgroundLocationTask";
import { createExpoForegroundTracker } from "@/src/supply/foregroundTracker";
import { locationService } from "@/src/supply/locationService";
import { locationPermissionStore, useLocationPermissions } from "@/src/supply/permissionState";
import { decideTracking } from "@/src/supply/tracking";

import { navigationRef } from "./navigationRef";

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

/**
 * Everything that runs while an approved caregiver is in the app: location tracking decided by
 * `decideTracking`, push-tap routing and the in-app banner. Renders only the banner.
 * Unmounting (sign-out, suspension) stops all location updates.
 */
const AppRuntime: React.FC = () => {
  const home = useCaregiverHome();
  const permissions = useLocationPermissions();
  const [foregroundTracker] = useState(() => createExpoForegroundTracker((coords) => locationService.ping(coords)));
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

  useEffect(() => {
    const apply = async () => {
      if (mode === "background") {
        foregroundTracker.stop();
        await startVisitUpdates();
      } else if (mode === "foreground") {
        await stopVisitUpdates();
        await foregroundTracker.start();
      } else {
        foregroundTracker.stop();
        await stopVisitUpdates();
      }
    };
    apply().catch((error: unknown) => {
      if (__DEV__) console.warn("[tracking] could not apply mode", mode, error);
    });
  }, [mode, foregroundTracker]);

  useEffect(
    () => () => {
      foregroundTracker.stop();
      void stopVisitUpdates().catch(() => undefined);
    },
    [foregroundTracker],
  );

  const handleResponse = useCallback((response: Notifications.NotificationResponse) => {
    const id = response.notification.request.identifier;
    const offer = parseJobOffer(response.notification.request.content.data);
    if (!offer || handled.current.has(id)) return;
    handled.current.add(id);
    void openOffer(offer.bookingId);
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
      const offer = parseJobOffer(notification.request.content.data);
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
