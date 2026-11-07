import { useMutation } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";

import { messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Input from "@/src/components/ui/input";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { isEmail } from "@/src/domain/validation";
import { useNav } from "@/src/navigation/Navigations";
import { authService } from "@/src/services/auth.service";

const RecoverPassword: React.FC = () => {
  const navigation = useNav();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [dialog, setDialog] = useState<string | null>(null);

  // The server answers 200 for any address, so this always moves on: the screen never says whether the email has an account.
  const request = useMutation({
    mutationFn: () => authService.requestPasswordReset(email.trim()),
    onSuccess: () => navigation.navigate("ResetPassword", { email: email.trim() }),
    onError: (e) => setDialog(messageForError(e)),
  });

  const submit = () => {
    if (!email.trim()) return setError("Email is required");
    if (!isEmail(email)) return setError("Enter a valid email address");
    setError(undefined);
    request.mutate();
  };

  return (
    <Screen title="Recover Password" scroll>
      <Text color={theme.colors.textLight}>Enter the email you signed up with and we will email you a 5-digit code to reset your password.</Text>
      <Input
        label="Email address"
        placeholder="Your email address"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setError(undefined);
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        error={error}
      />
      <Button title="Send Reset Code" onPress={submit} loading={request.isPending} />
      <ErrorDialog visible={dialog !== null} message={dialog ?? ""} onClose={() => setDialog(null)} />
    </Screen>
  );
};

export default RecoverPassword;
