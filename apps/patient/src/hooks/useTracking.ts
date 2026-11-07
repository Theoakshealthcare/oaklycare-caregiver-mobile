import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/src/api/keys";
import { trackingService } from "@/src/services/tracking.service";

/** How often the caregiver's position is read while the tracking screen is in front (polling; the WebSocket is not used). */
export const trackingRefresh = { intervalMs: 15_000 };

/**
 * The caregiver's position (`GET .../live-tracking`). Only asked for while `active` (accepted or on the way: once the visit has
 * started the caregiver is at the door and the estimate means nothing) and only while the screen is focused, so a screen left
 * behind in the stack never polls. Never served from the cache: a position is only useful fresh.
 */
export function useLiveTracking(id: string, active: boolean) {
  const focused = useIsFocused();
  return useQuery({
    queryKey: queryKeys.tracking(id),
    queryFn: () => trackingService.get(id),
    enabled: active,
    staleTime: 0,
    refetchInterval: focused ? trackingRefresh.intervalMs : false,
  });
}
