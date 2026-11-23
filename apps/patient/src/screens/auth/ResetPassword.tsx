import type { StackScreenProps } from "@react-navigation/stack";
import { useMutation } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";

import { messageForError } from "@/src/api/errors";
import AuthPage from "@/src/components/ui/auth-page";
import Button from "@/src/components/ui/button";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Input from "@/src/components/ui/input";
import { showToast } from "@/src/components/ui/toast";
import { SUCCESS_TOAST, resetFailure } from "@/src/domain/passwordReset";
import { passwordProblem } from "@/src/domain/validation";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import { authService } from "@/src/services/auth.service";

type Props = StackScreenProps<ScreenParamLists, "ResetPassword">;

const ResetPassword: React.FC<Props> = ({ navigation, route }) => {
  // The 5-digit code came from the code screen; it works once and for 15 minutes.
  const { email, code } = route.params;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [dialog, setDialog] = useState<string | null>(null);

  const reset = useMutation({
    // `email` is the exact string the code was requested with: the server counts and looks up per exact address.
    mutationFn: () => authService.resetPassword({ email, code, newPassword: password }),
    onSuccess: () => {
      showToast(SUCCESS_TOAST);
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    },
    onError: (e) => {
      const failure = resetFailure(e);
      switch (failure.kind) {
        case "invalid_code":
        case "request_new_code":
        case "locked":
          // The code is the problem: say so and go back to the code screen, whose boxes start empty again.
          navigation.navigate("RecoverCode", { email, cleared: Date.now(), error: failure.message });
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

  const submit = () => {
    const next: typeof errors = {};
    const passwordError = passwordProblem(password);
    if (passwordError) next.password = passwordError;
    if (!confirm) next.confirm = "Please confirm your password";
    else if (confirm !== password) next.confirm = "Passwords do not match";
    setErrors(next);
    if (Object.keys(next).length === 0 && !reset.isPending) reset.mutate();
  };

  return (
    <AuthPage title="Reset Password" subtitle="Reset your Password">
      <Input
        label="Create New Password"
        placeholder="Enter New Password"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setErrors((prev) => ({ ...prev, password: undefined }));
        }}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        error={errors.password}
      />
      <Input
        label="Confirm New Password"
        placeholder="Enter New Password"
        value={confirm}
        onChangeText={(value) => {
          setConfirm(value);
          setErrors((prev) => ({ ...prev, confirm: undefined }));
        }}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        error={errors.confirm}
      />
      <Button title="Reset Password" onPress={submit} loading={reset.isPending} />
      <ErrorDialog visible={dialog !== null} message={dialog ?? ""} onClose={() => setDialog(null)} />
    </AuthPage>
  );
};

export default ResetPassword;
