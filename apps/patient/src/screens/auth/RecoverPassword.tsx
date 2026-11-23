import { useMutation } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";

import { messageForError } from "@/src/api/errors";
import AuthPage from "@/src/components/ui/auth-page";
import Button from "@/src/components/ui/button";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Input from "@/src/components/ui/input";
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
    onSuccess: () => navigation.navigate("RecoverCode", { email: email.trim() }),
    onError: (e) => setDialog(messageForError(e)),
  });

  const submit = () => {
    if (!email.trim()) return setError("Email is required");
    if (!isEmail(email)) return setError("Enter a valid email address");
    setError(undefined);
    request.mutate();
  };

  return (
    <AuthPage title="Recover Password" subtitle="Provide your email address to recover your password">
      <Input
        label="Email Address"
        placeholder="Provide your Email Address"
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
      <Button title="Send Recovery Link" onPress={submit} loading={request.isPending} />
      <ErrorDialog visible={dialog !== null} message={dialog ?? ""} onClose={() => setDialog(null)} />
    </AuthPage>
  );
};

export default RecoverPassword;
