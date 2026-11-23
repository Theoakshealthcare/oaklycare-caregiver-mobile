import type { StackScreenProps } from "@react-navigation/stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ApiError, messageForError } from "@/src/api/errors";
import { queryKeys } from "@/src/api/keys";
import { useSession } from "@/src/auth";
import AuthPage from "@/src/components/ui/auth-page";
import Button from "@/src/components/ui/button";
import OtpInput, { OtpResendRow } from "@/src/components/ui/otp-input";
import Text from "@/src/components/ui/text";
import TextLink from "@/src/components/ui/text-link";
import { showToast } from "@/src/components/ui/toast";
import { theme } from "@/src/constants/theme";
import { useCooldown } from "@/src/hooks/useCooldown";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import { authService } from "@/src/services/auth.service";

/** Seconds before "Resend Code" works again after a code was just sent. A 429 from the server overrides it. */
const RESEND_SECONDS = 30;
const CODE_LENGTH = 5;

type Props = StackScreenProps<ScreenParamLists, "VerifyEmail">;

/**
 * Two ways in: right after sign-up (signed out; on success go on to "account created") and after a login with an
 * unverified email (signed in; on success `/auth/me` is re-read and the auth gate lets the person through). Figma has no
 * Verify button: the code is sent as soon as the fifth digit is in.
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
      if (signedIn) {
        showToast("Email Address Verified");
        await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      } else navigation.reset({ index: 0, routes: [{ name: "AccountCreated" }] });
    },
    onError: (e) => {
      setError(messageForError(e));
      // A request that never reached the server keeps the code as typed, so Verify can send it again; a wrong code is cleared.
      if (!(e instanceof ApiError && e.status === 0)) setCode("");
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

  // Only when the last request never reached the server and the typed code is still in the boxes.
  const canRetry = verify.isError && code.length === CODE_LENGTH;

  return (
    <AuthPage title="Verify Email Address" subtitle={`Enter the OTP code sent to your mail, ${email}.`} scroll={false}>
      <View style={styles.code}>
        <OtpInput value={code} onChange={typeCode} onComplete={submit} length={CODE_LENGTH} editable={!verify.isPending} autoFocus />
        <OtpResendRow cooldown={cooldown} sending={resend.isPending} disabled={verify.isPending} onResend={() => resend.mutate()} />
      </View>

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
      {canRetry ? <Button title="Verify" onPress={() => submit(code)} loading={verify.isPending} /> : null}

      {signedIn ? <TextLink center label="Use a different account" onPress={() => void authService.logout()} /> : null}
    </AuthPage>
  );
};

const styles = StyleSheet.create({
  // Figma: 84 pt between the boxes and the resend row.
  code: { gap: 84, marginTop: 4 },
});

export default VerifyEmail;
