import type { StackScreenProps } from "@react-navigation/stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ApiError, messageForError } from "@/src/api/errors";
import { queryKeys } from "@/src/api/keys";
import { useSession } from "@/src/auth";
import Button from "@/src/components/ui/button";
import OtpInput from "@/src/components/ui/otp-input";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import TextLink from "@/src/components/ui/text-link";
import { theme } from "@/src/constants/theme";
import { useCooldown } from "@/src/hooks/useCooldown";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import { authService } from "@/src/services/auth.service";

/** Seconds before "Resend code" works again after a code was just sent. A 429 from the server overrides it. */
const RESEND_SECONDS = 30;
const CODE_LENGTH = 5;

type Props = StackScreenProps<ScreenParamLists, "VerifyEmail">;

/**
 * Two ways in: right after sign-up (signed out; on success go on to "account created" and then Login) and after a
 * login with an unverified email (signed in; on success `/auth/me` is re-read and the auth gate lets the person through).
 */
const VerifyEmail: React.FC<Props> = ({ navigation, route }) => {
  const { email } = route.params;
  const signedIn = useSession((s) => s.status === "signedIn");
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // A code was just emailed when arriving from sign-up; after a login nothing was sent, so resending is open at once.
  const [cooldown, startCooldown] = useCooldown(signedIn ? 0 : RESEND_SECONDS);

  const verify = useMutation({
    mutationFn: (value: string) => authService.verifyEmail(email, value),
    onSuccess: async () => {
      if (signedIn) await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      else navigation.reset({ index: 0, routes: [{ name: "AccountCreated" }] });
    },
    onError: (e) => {
      setError(messageForError(e));
      setCode("");
    },
  });

  const resend = useMutation({
    mutationFn: () => authService.resendVerification(email),
    onSuccess: () => {
      setCode("");
      setError(null);
      setNotice(`A new code has been sent to ${email}.`);
      startCooldown(RESEND_SECONDS);
    },
    onError: (e) => {
      setNotice(null);
      setError(messageForError(e));
      // The server's own throttle, when it sends one, is the cooldown to show.
      if (e instanceof ApiError && e.status === 429 && e.retryAfterSeconds) startCooldown(e.retryAfterSeconds);
    },
  });

  const submit = (value: string) => {
    if (verify.isPending) return;
    setError(null);
    setNotice(null);
    verify.mutate(value);
  };

  // Leaving the notice up forever would hide a later error; it clears as soon as the person types again.
  const typeCode = (value: string) => {
    setCode(value);
    if (value) setNotice(null);
  };

  return (
    <Screen title="Verify Email Address" noBack={signedIn} scroll>
      <Text color={theme.colors.textLight}>{`Enter the ${CODE_LENGTH}-digit code we sent to ${email}`}</Text>

      <View style={styles.code}>
        <OtpInput value={code} onChange={typeCode} onComplete={submit} length={CODE_LENGTH} editable={!verify.isPending} />
        {error ? (
          <Text variant="small" color={theme.colors.secondary} center accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        {notice ? (
          <Text variant="small" color={theme.colors.success} center>
            {notice}
          </Text>
        ) : null}
      </View>

      <Button
        title="Verify"
        onPress={() => submit(code)}
        loading={verify.isPending}
        disabled={code.length !== CODE_LENGTH}
      />

      <View style={styles.resend}>
        <Text variant="small" color={theme.colors.textLight}>
          Didn&apos;t receive a code?
        </Text>
        <TextLink
          label={resend.isPending ? "Sending code..." : cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
          onPress={() => resend.mutate()}
          disabled={cooldown > 0 || resend.isPending || verify.isPending}
        />
      </View>

      {signedIn ? (
        <TextLink center label="Use a different account" onPress={() => void authService.logout()} />
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  code: { gap: theme.spacing.md, marginVertical: theme.spacing.lg },
  resend: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: theme.spacing.xs },
});

export default VerifyEmail;
