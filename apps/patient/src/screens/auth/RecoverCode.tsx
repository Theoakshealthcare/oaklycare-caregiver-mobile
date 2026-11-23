import type { StackScreenProps } from "@react-navigation/stack";
import { useMutation } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import AuthPage from "@/src/components/ui/auth-page";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import OtpInput, { OtpResendRow } from "@/src/components/ui/otp-input";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { RESEND_SECONDS, RESET_CODE_LENGTH, SENT_NOTICE } from "@/src/domain/passwordReset";
import { useCooldown } from "@/src/hooks/useCooldown";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import { authService } from "@/src/services/auth.service";

type Props = StackScreenProps<ScreenParamLists, "RecoverCode">;

/**
 * The code screen between "Recover Password" and "Reset Password" (Figma: "Verify Email Address").
 *
 * The server only checks the code together with the new password (`POST /auth/reset-password`), so this screen collects the
 * five digits and hands them on; a wrong or expired code is reported by the next screen, which sends the person back here
 * with `params.cleared` changed so the boxes start empty again.
 */
const RecoverCode: React.FC<Props> = ({ navigation, route }) => {
  const { email, cleared, error: refusal } = route.params;
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  // What the reset screen found wrong with the code, shown under the boxes until the person types again.
  const [error, setError] = useState<string | null>(refusal ?? null);
  const [dialog, setDialog] = useState<string | null>(null);
  // The previous screen just asked for a code, so Resend opens after a minute.
  const [cooldown, startCooldown] = useCooldown(RESEND_SECONDS);

  // The reset screen sends the person back with a new `cleared`: start with empty boxes again.
  const [seenCleared, setSeenCleared] = useState(cleared);
  if (seenCleared !== cleared) {
    setSeenCleared(cleared);
    setCode("");
    setError(refusal ?? null);
    setNotice(null);
  }

  const resend = useMutation({
    mutationFn: () => authService.requestPasswordReset(email),
    onSuccess: () => {
      setCode("");
      setError(null);
      setNotice(SENT_NOTICE);
      startCooldown(RESEND_SECONDS);
    },
    onError: (e) => setDialog(messageForError(e)),
  });

  return (
    <AuthPage title="Verify Email Address" subtitle={`Enter the OTP code sent to your mail, ${email}.`} scroll={false}>
      <View style={styles.code}>
        <OtpInput
          value={code}
          onChange={(value) => {
            setCode(value);
            if (value) {
              setNotice(null);
              setError(null);
            }
          }}
          onComplete={(full) => navigation.navigate("ResetPassword", { email, code: full })}
          length={RESET_CODE_LENGTH}
          label="Reset code"
          autoFocus
        />
        <OtpResendRow cooldown={cooldown} sending={resend.isPending} onResend={() => resend.mutate()} />
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
      <ErrorDialog visible={dialog !== null} message={dialog ?? ""} onClose={() => setDialog(null)} />
    </AuthPage>
  );
};

const styles = StyleSheet.create({
  code: { gap: 84, marginTop: 4 },
});

export default RecoverCode;
