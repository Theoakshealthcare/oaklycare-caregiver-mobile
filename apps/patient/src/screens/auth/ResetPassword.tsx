import type { StackScreenProps } from "@react-navigation/stack";
import { useMutation } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Input from "@/src/components/ui/input";
import OtpInput from "@/src/components/ui/otp-input";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import TextLink from "@/src/components/ui/text-link";
import { theme } from "@/src/constants/theme";
import {
  RESEND_SECONDS,
  RESET_CODE_LENGTH,
  SENT_NOTICE,
  SUCCESS_NOTICE,
  resetFailure,
} from "@/src/domain/passwordReset";
import { passwordProblem } from "@/src/domain/validation";
import { useCooldown } from "@/src/hooks/useCooldown";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import { authService } from "@/src/services/auth.service";

type Props = StackScreenProps<ScreenParamLists, "ResetPassword">;

const CODE_LENGTH = RESET_CODE_LENGTH;

const ResetPassword: React.FC<Props> = ({ navigation, route }) => {
  const { email } = route.params;
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ code?: string; password?: string; confirm?: string }>({});
  const [dialog, setDialog] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // After the 24-hour guess budget the server sends nothing at all, so Resend is hidden rather than offered.
  const [locked, setLocked] = useState(false);
  // A code was just emailed by the previous screen, so resending opens after a minute.
  const [cooldown, startCooldown] = useCooldown(RESEND_SECONDS);

  const reset = useMutation({
    // `email` is the exact string the code was requested with: the server counts and looks up per exact address.
    mutationFn: () => authService.resetPassword({ email, code: code.trim(), newPassword: password }),
    onSuccess: () => setDone(true),
    onError: (e) => {
      const failure = resetFailure(e);
      setNotice(null);
      switch (failure.kind) {
        case "invalid_code":
        case "request_new_code":
          setErrors({ code: failure.message });
          setCode("");
          break;
        case "locked":
          setErrors({ code: failure.message });
          setCode("");
          setLocked(true);
          break;
        case "weak_password":
          // The code is not used up: only the password needs fixing.
          setErrors({ password: failure.message });
          break;
        default:
          setDialog(messageForError(e));
      }
    },
  });

  const resend = useMutation({
    mutationFn: () => authService.requestPasswordReset(email),
    onSuccess: () => {
      setCode("");
      setErrors({});
      setNotice(SENT_NOTICE);
      startCooldown(RESEND_SECONDS);
    },
    onError: (e) => setDialog(messageForError(e)),
  });

  const submit = () => {
    const next: typeof errors = {};
    if (code.length !== CODE_LENGTH) next.code = `Enter the ${CODE_LENGTH}-digit code`;
    const passwordError = passwordProblem(password);
    if (passwordError) next.password = passwordError;
    if (!confirm) next.confirm = "Please confirm your password";
    else if (confirm !== password) next.confirm = "Passwords do not match";
    setErrors(next);
    if (Object.keys(next).length === 0) reset.mutate();
  };

  if (done) {
    return (
      <Screen title="Password reset" noBack>
        <Text color={theme.colors.textLight}>Your password has been reset. Log in with your new password.</Text>
        <Text variant="small" color={theme.colors.textLight}>{SUCCESS_NOTICE}</Text>
        <Button title="Go to Login" onPress={() => navigation.reset({ index: 0, routes: [{ name: "Login" }] })} />
      </Screen>
    );
  }

  return (
    <Screen title="Reset Password" scroll>
      <Text color={theme.colors.textLight}>{`Enter the ${CODE_LENGTH}-digit code we emailed to ${email} and choose a new password.`}</Text>
      <Text variant="small" color={theme.colors.textLight}>The code works once and for 15 minutes. Check your spam folder if it does not arrive.</Text>
      <View style={{ gap: theme.spacing.xs, marginVertical: theme.spacing.sm }}>
        <OtpInput
          value={code}
          onChange={(v) => { setCode(v); setErrors((p) => ({ ...p, code: undefined })); if (v) setNotice(null); }}
          length={CODE_LENGTH}
          label="Reset code"
          editable={!locked}
        />
        {errors.code ? (
          <Text variant="small" color={theme.colors.secondary} center accessibilityRole="alert">
            {errors.code}
          </Text>
        ) : null}
        {notice ? (
          <Text variant="small" color={theme.colors.success} center>
            {notice}
          </Text>
        ) : null}
      </View>
      <Input
        label="Create new password"
        placeholder="At least 8 characters"
        value={password}
        onChangeText={(v) => { setPassword(v); setErrors((p) => ({ ...p, password: undefined })); }}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        error={errors.password}
      />
      <Input
        label="Confirm new password"
        placeholder="Repeat the new password"
        value={confirm}
        onChangeText={(v) => { setConfirm(v); setErrors((p) => ({ ...p, confirm: undefined })); }}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        error={errors.confirm}
      />
      <Button title="Reset Password" onPress={submit} loading={reset.isPending} disabled={locked} />
      {locked ? null : (
        <View style={styles.resend}>
          <Text variant="small" color={theme.colors.textLight}>
            Didn&apos;t receive a code?
          </Text>
          <TextLink
            label={cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
            onPress={() => resend.mutate()}
            disabled={cooldown > 0 || resend.isPending || reset.isPending}
          />
        </View>
      )}
      <ErrorDialog visible={dialog !== null} message={dialog ?? ""} onClose={() => setDialog(null)} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  resend: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: theme.spacing.xs },
});

export default ResetPassword;
