import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { queryKeys } from "@/src/api/keys";
import { useSession } from "@/src/auth";
import { POLL_DELAY_MS, isSlow, pollStageAt } from "@/src/identity/identityModel";
import { identityService } from "@/src/services/identity.service";

/** The caregiver's identity state (GET /caregiver/identity-verification). Read fresh whenever the screen opens. */
export function useIdentityState() {
  const signedIn = useSession((s) => s.status === "signedIn");
  return useQuery({
    queryKey: queryKeys.identity,
    queryFn: identityService.getState,
    enabled: signedIn,
    staleTime: 0,
    refetchOnMount: "always",
    // The answer holds no personal data, but nothing should keep it once the screen is gone.
    gcTime: 60_000,
  });
}

/**
 * While `enabled` (a result is awaited), calls `refetch` on a backed-off cadence: 3 s, 5 s after 30 s, 10 s after
 * 60 s (`identityModel.POLL_DELAY_MS`), and gives up after five minutes. It is one chain of `setTimeout`s: the next
 * wait is scheduled only after the previous read finished, and the effect's cleanup clears it on unmount or when
 * `enabled` turns off. Nothing here can keep running after the screen is gone.
 *
 * `slow` turns true after one minute ("still checking, you can leave"); `stopped` once polling gave up. `restart`
 * (the "Check again" button) begins a fresh five minutes.
 */
export function useIdentityPolling(enabled: boolean, refetch: () => Promise<unknown>) {
  const [slow, setSlow] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const startedAt = Date.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      const elapsed = Date.now() - startedAt;
      const delay = POLL_DELAY_MS[pollStageAt(elapsed)];
      if (delay === false) {
        setStopped(true);
        return;
      }
      timer = setTimeout(async () => {
        try {
          await refetch();
        } catch {
          // A failed read is retried on the next beat; the screen shows the last good state meanwhile.
        }
        if (cancelled) return;
        setSlow(isSlow(Date.now() - startedAt));
        schedule();
      }, delay);
    };
    schedule();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      // Fresh flags for the next wait, set on the way out rather than on the way in.
      setSlow(false);
      setStopped(false);
    };
    // `refetch` is stable per query; `round` restarts the chain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, round]);

  return { slow: enabled && slow, stopped: enabled && stopped, restart: () => setRound((n) => n + 1) };
}
