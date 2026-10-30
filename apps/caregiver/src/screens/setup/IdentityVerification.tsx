import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking } from "react-native";

import { messageForError } from "@/src/api/errors";
import { queryKeys } from "@/src/api/keys";
import { CONTACT_EMAIL } from "@/src/config/contact";
import { useIdentityPolling, useIdentityState } from "@/src/hooks/useIdentityVerification";
import Navigation from "@/src/hooks/use-navigation";
import {
  CONSENT_TEXT_VERSION,
  SELF_EXPLAINING_CODES,
  identityErrorCode,
  identityErrorMessage,
  nextRouteAfterIdentity,
  resolveIdentityScreen,
  shouldPoll,
  type IdentityPhase,
} from "@/src/identity/identityModel";
import { getWidgetLauncher } from "@/src/identity/widget";
import { identityService } from "@/src/services/identity.service";
import IdentityVerificationView from "./IdentityVerificationView";

/**
 * The identity step of onboarding (design 11.3). Reads the server state, starts or resumes an attempt, opens the
 * widget behind `getWidgetLauncher()`, forwards what it reports as hints, and waits for the server to say the
 * result. Nothing here sets a verified state: the screen reads `status` from the backend.
 */
const IdentityVerification: React.FC = () => {
  const { navigation } = Navigation();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<IdentityPhase>({ kind: "idle" });
  const [consentChecked, setConsentChecked] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const identity = useIdentityState();
  const screen = resolveIdentityScreen({ state: identity.data, loadError: identity.error, phase });
  const polling = useIdentityPolling(shouldPoll(screen), identity.refetch);

  // The server moves the caregiver's step when a result arrives; refresh the gate's copy of it.
  useEffect(() => {
    if (screen === "verified" || screen === "underReview" || screen === "exhausted") {
      void queryClient.invalidateQueries({ queryKey: queryKeys.verificationStatus });
    }
  }, [screen, queryClient]);

  const refreshState = useCallback(() => queryClient.invalidateQueries({ queryKey: queryKeys.identity }), [queryClient]);

  const start = useCallback(async () => {
    if (phase.kind === "starting" || phase.kind === "widget") return;
    setPhase({ kind: "starting" });
    let session;
    try {
      session = await identityService.startSession({ consent: true, policyVersion: CONSENT_TEXT_VERSION });
    } catch (error) {
      const code = identityErrorCode(error);
      // 409/503: the state moved on (verified, in review, no attempts left, provider down...); re-read it.
      void refreshState();
      if (!mounted.current) return;
      setConsentChecked(false);
      setPhase({
        kind: "startFailed",
        code,
        message: code && SELF_EXPLAINING_CODES.includes(code) ? "" : identityErrorMessage(error, messageForError),
      });
      return;
    }
    if (!mounted.current) return;
    // The tick belongs to this attempt; a later attempt asks again.
    setConsentChecked(false);
    queryClient.setQueryData(queryKeys.identity, session.state);
    setPhase({ kind: "widget" });

    // Hints are best effort: a failed one never blocks the caregiver and never decides anything.
    const hint = (event: "opened" | "completed" | "closed" | "error", sessionId?: string) =>
      identityService.sendClientEvent(session.verification_id, event, sessionId).catch(() => undefined);
    void hint("opened");
    let outcome;
    try {
      outcome = await getWidgetLauncher().open(session.widget);
    } catch {
      outcome = { kind: "error" as const };
    }
    if (!mounted.current) return;

    switch (outcome.kind) {
      case "completed":
        await hint("completed", outcome.sessionId);
        if (!mounted.current) return;
        // Show "Checking..." immediately, then let the server state take over.
        setPhase({ kind: "submitted" });
        void refreshState();
        return;
      case "closed":
        void hint("closed");
        setPhase({ kind: "closed" });
        return;
      case "permissionDenied":
        setPhase({ kind: "permissionDenied" });
        return;
      case "error":
        void hint("error");
        setPhase({ kind: "widgetError" });
        return;
    }
  }, [phase.kind, queryClient, refreshState]);

  const goNext = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.verificationStatus });
    const route = nextRouteAfterIdentity(navigation.getState()?.routeNames);
    navigation.navigate(route);
  }, [navigation, queryClient]);

  const defer = useMutation({
    mutationFn: () => identityService.defer(),
    onSuccess: async () => {
      await goNext();
    },
    onError: (error) => {
      void refreshState();
      setPhase({ kind: "startFailed", code: identityErrorCode(error), message: identityErrorMessage(error, messageForError) });
    },
  });

  return (
    <IdentityVerificationView
      screen={screen}
      state={identity.data}
      errorMessage={identity.error ? identityErrorMessage(identity.error, messageForError) : null}
      banner={phase.kind === "startFailed" && phase.message ? phase.message : null}
      consentChecked={consentChecked}
      onToggleConsent={() => setConsentChecked((v) => !v)}
      slow={polling.slow}
      stopped={polling.stopped}
      onStart={() => void start()}
      onContinue={() => void goNext()}
      onDefer={() => defer.mutate()}
      deferring={defer.isPending}
      onReload={() => {
        setPhase({ kind: "idle" });
        void identity.refetch();
      }}
      onCheckAgain={() => {
        polling.restart();
        void identity.refetch();
      }}
      onOpenSettings={() => void Linking.openSettings()}
      onContactSupport={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
    />
  );
};

export default IdentityVerification;
