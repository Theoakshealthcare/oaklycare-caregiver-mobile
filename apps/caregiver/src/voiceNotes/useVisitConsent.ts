import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";

import { CONSENT_VERSION } from "./consentCopy";

const keyFor = (bookingId: string) => `oakly.voice-consent.${bookingId}`;

/**
 * Whether the caregiver has ticked the consent line for this visit, remembered on the phone per visit (booking id).
 * What is stored is the consent VERSION: a tick given to an older wording does not count for the current one.
 *
 * This only spares the caregiver ticking again for every recording of the same visit. The server still stores the
 * consent flag with every note, and refuses a recording without it.
 */
export function useVisitConsent(bookingId: string, enabled: boolean) {
  const [loaded, setLoaded] = useState(!enabled);
  const [consented, setConsentedState] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    SecureStore.getItemAsync(keyFor(bookingId))
      .then((stored) => {
        if (alive) setConsentedState(stored === CONSENT_VERSION);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [bookingId, enabled]);

  const setConsented = useCallback(
    (value: boolean) => {
      setConsentedState(value);
      const write = value ? SecureStore.setItemAsync(keyFor(bookingId), CONSENT_VERSION) : SecureStore.deleteItemAsync(keyFor(bookingId));
      write.catch(() => undefined); // not remembered is fine: the caregiver just ticks again
    },
    [bookingId],
  );

  return { loaded, consented, setConsented };
}
