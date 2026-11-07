import type { StackScreenProps } from "@react-navigation/stack";
import { useMutation } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { View } from "react-native";

import { messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Input from "@/src/components/ui/input";
import OtpInput from "@/src/components/ui/otp-input";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { passwordProblem } from "@/src/domain/validation";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import { authService } from "@/src/services/auth.service";

type Props = StackScreenProps<ScreenParamLists, "ResetPassword">;

const CODE_LENGTH = 5;

const ResetPassword: React.FC<Props> = ({ navigation, route }) => {
  const { email } = route.params;
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ code?: string; password?: string; confirm?: string }>({});
  const [dialog, setDialog] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = useMutation({
    mutationFn: () => authService.resetPassword({ code, newPassword: password }),
    onSuccess: () => setDone(true),
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
        <Button title="Go to Login" onPress={() => navigation.reset({ index: 0, routes: [{ name: "Login" }] })} />
      </Screen>
    );
  }

  return (
    <Screen title="Reset Password" scroll>
      <Text color={theme.colors.textLight}>{`Enter the ${CODE_LENGTH}-digit code we emailed to ${email} and choose a new password.`}</Text>
      <View style={{ gap: theme.spacing.xs, marginVertical: theme.spacing.sm }}>
        <OtpInput value={code} onChange={(v) => { setCode(v); setErrors((p) => ({ ...p, code: undefined })); }} length={CODE_LENGTH} label="Reset code" />
        {errors.code ? (
          <Text variant="small" color={theme.colors.secondary} center>
            {errors.code}
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
      <Button title="Reset Password" onPress={submit} loading={reset.isPending} />
      <ErrorDialog visible={dialog !== null} message={dialog ?? ""} onClose={() => setDialog(null)} />
    </Screen>
  );
};

export default ResetPassword;
