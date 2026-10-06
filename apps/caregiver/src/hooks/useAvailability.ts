import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";

import { messageForError } from "@/src/api/errors";
import { queryKeys } from "@/src/api/keys";
import {
  AVAILABILITY_PROBLEM_MESSAGE,
  goAvailable,
  goUnavailable,
  type AvailabilityDeps,
} from "@/src/supply/availabilityFlow";
import { readCurrentPosition } from "@/src/supply/foregroundTracker";
import { locationService, type CaregiverHome } from "@/src/supply/locationService";
import { ensureForegroundLocation } from "@/src/supply/permissions";

const deps: AvailabilityDeps = {
  ensureForegroundLocation: () => ensureForegroundLocation(),
  getPosition: readCurrentPosition,
  ping: (coords) => locationService.ping(coords),
  setAvailability: (isAvailable) => locationService.setAvailability(isAvailable),
};

/** The availability switch on Home. Location first on the way up; errors mapped per the guide. */
export function useAvailability() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (!next) {
        await goUnavailable(deps);
        return { ok: true as const, next };
      }
      return { ...(await goAvailable(deps)), next };
    },
    onSuccess: (result) => {
      if (!result.ok) {
        Alert.alert("Can't go available", AVAILABILITY_PROBLEM_MESSAGE[result.reason]);
        return;
      }
      client.setQueryData<CaregiverHome>(queryKeys.home, (home) =>
        home ? { ...home, is_available: result.next } : home,
      );
    },
    onError: (error, next) => {
      Alert.alert(next ? "Can't go available" : "Can't go unavailable", messageForError(error, "availability"));
    },
    // Home is the source of truth for the switch (also after a 403/409), so always refetch.
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.home }),
  });

  return { setAvailable: (next: boolean) => mutation.mutate(next), pending: mutation.isPending };
}
