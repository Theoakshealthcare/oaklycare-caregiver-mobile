import React from "react";
import { Alert, RefreshControl, ScrollView, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { messageForError } from "@/src/api/errors";
import { queryKeys } from "@/src/api/keys";
import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";
import { useVerificationStatus } from "@/src/hooks/queries";
import { kycEnabled } from "@/src/identity/config";
import Navigation from "@/src/hooks/use-navigation";
import { authService } from "@/src/services/auth.service";
import { caregiverService, type VerificationStatus } from "@/src/services/caregiver.service";

/** How often the screen re-checks while the caregiver waits for an admin decision. */
const POLL_MS = 30_000;

interface Copy {
  title: string;
  body: string;
  tone: "info" | "warning" | "error";
}

/** The words for each non-approved status. Exported for tests. */
export function statusCopy(status: VerificationStatus): Copy {
  switch (status.profileStatus) {
    case "under_review":
      return {
        tone: "info",
        title: "Your profile is under review",
        body: "An admin is checking your details and documents. We'll update this screen as soon as there is a decision. You can't accept jobs until you're approved.",
      };
    case "changes_requested":
      return {
        tone: "warning",
        title: "Changes requested",
        body: "An admin needs a few changes before your profile can be approved. Fix the items below, then resubmit for review.",
      };
    case "rejected":
      return {
        tone: "error",
        title: "Your application was not approved",
        body: status.rejectionReason ?? "No reason was given. Please contact Oakly support if you think this is a mistake.",
      };
    case "suspended":
      return {
        tone: "error",
        title: "Your account is suspended",
        body: "You can't go available or accept jobs while your account is suspended. Please contact Oakly support.",
      };
    case "approved":
      return { tone: "info", title: "You're approved", body: "Taking you to the app." };
    case "incomplete":
      return { tone: "info", title: "Finish setting up", body: "Complete your profile to submit it for review." };
  }
}

export interface IdentityEntry {
  /** One plain line about the identity check. */
  line: string;
  /** Whether to offer the button that opens the identity step. */
  canOpen: boolean;
}

/**
 * The identity line on the status screen (design 11.3, last paragraph). A caregiver who skipped the check during an
 * outage ("Continue without for now") or was reset can open it from here; one whose case is with a person, or who was
 * turned down by a person, only reads a line. Never says why. `enabled` is the identity feature switch.
 */
export function identityEntry(status: VerificationStatus, enabled: boolean = kycEnabled()): IdentityEntry | null {
  if (!enabled) return null;
  const open = status.profileStatus === "under_review" || status.profileStatus === "changes_requested";
  switch (status.identityVerificationStatus) {
    case "pending":
    case "in_progress":
      return open
        ? { line: "Your identity isn't verified yet. You can't be approved until it is.", canOpen: true }
        : null;
    case "needs_review":
      return { line: "Your identity check is with our team.", canOpen: false };
    case "failed":
      return { line: "Our team couldn't confirm your identity. Please contact Oakly support.", canOpen: false };
    default:
      return null;
  }
}

const TONE_COLOR: Record<Copy["tone"], string> = {
  info: theme.colors.primary,
  warning: theme.colors.warningText,
  error: theme.colors.error,
};

const VerificationStatusScreen: React.FC = () => {
  const { navigation } = Navigation();
  const queryClient = useQueryClient();
  const { data, isRefetching, refetch } = useVerificationStatus(true, POLL_MS);

  const resubmit = useMutation({
    mutationFn: () => caregiverService.updateConsent(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.verificationStatus }),
    onError: (error) => Alert.alert("Couldn't resubmit", messageForError(error)),
  });

  if (!data) return null;
  const copy = statusCopy(data);
  const identity = identityEntry(data);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
      >
        <View style={[globalStyles.container, { justifyContent: "center", gap: 16 }]}>
          <Text variant="h2" weight="bold" color={TONE_COLOR[copy.tone]} center>
            {copy.title}
          </Text>
          <Text variant="body" color={theme.colors.textLight} center>
            {copy.body}
          </Text>

          {data.profileStatus === "changes_requested" && data.changesRequested ? (
            <View style={{ gap: 8, backgroundColor: theme.colors.background, padding: 16, borderRadius: 12 }}>
              {data.changesRequested.items.map((item) => (
                <Text key={item} variant="body">
                  {"• "}
                  {item}
                </Text>
              ))}
              {data.changesRequested.note ? (
                <Text variant="small" color={theme.colors.textLight}>
                  {data.changesRequested.note}
                </Text>
              ) : null}
            </View>
          ) : null}

          {identity ? (
            <View testID="status-identity" style={{ gap: 12, backgroundColor: theme.colors.background, padding: 16, borderRadius: 12 }}>
              <Text variant="body">{identity.line}</Text>
              {identity.canOpen ? (
                <Button
                  testID="status-identity-open"
                  title="Verify your identity"
                  onPress={() => navigation.navigate("IdentityVerification")}
                />
              ) : null}
            </View>
          ) : null}

          {data.profileStatus === "changes_requested" ? (
            <View style={{ gap: 12 }}>
              <Button title="Edit my details" variant="outline" onPress={() => navigation.navigate("CaregiverSetupStep1")} />
              <Button title="Resubmit for review" onPress={() => resubmit.mutate()} loading={resubmit.isPending} />
            </View>
          ) : null}

          <Button title="Sign out" variant="ghost" onPress={() => void authService.logout()} />
        </View>
      </ScrollView>
    </View>
  );
};

export default VerificationStatusScreen;
