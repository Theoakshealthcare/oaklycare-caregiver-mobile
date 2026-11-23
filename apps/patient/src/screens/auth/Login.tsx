import { useMutation } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { messageForError } from "@/src/api/errors";
import AuthPage from "@/src/components/ui/auth-page";
import Button from "@/src/components/ui/button";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Input from "@/src/components/ui/input";
import Text from "@/src/components/ui/text";
import { showToast } from "@/src/components/ui/toast";
import { useNav } from "@/src/navigation/Navigations";
import { authService } from "@/src/services/auth.service";

const Login: React.FC = () => {
  const navigation = useNav();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [dialog, setDialog] = useState<string | null>(null);

  // On success the session flips to signed in and the auth gate swaps this screen for the app (or the verify step).
  // The Figma "Login Successful" toast shows over whatever comes next.
  const login = useMutation({
    mutationFn: () => authService.login(email.trim(), password),
    onSuccess: () => showToast("Login Successful"),
    onError: (error) => setDialog(messageForError(error, "login")),
  });

  const submit = () => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Email is required";
    if (!password) next.password = "Password is required";
    setErrors(next);
    if (Object.keys(next).length === 0) login.mutate();
  };

  return (
    // On a relaunch Login is the first screen: Back then goes to the welcome slides, as in Figma.
    <AuthPage title="Login" subtitle="Provide Your Personal Details" onBackFallback={() => navigation.navigate("Onboarding")}>
      <Input
        label="Email Address"
        placeholder="Provide your Email Address"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setErrors((prev) => ({ ...prev, email: undefined }));
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        error={errors.email}
      />
      <Input
        label="Input Password"
        placeholder="Input password"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setErrors((prev) => ({ ...prev, password: undefined }));
        }}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        // The Login button can sit under the keyboard: the keyboard's own key finishes the job.
        returnKeyType="go"
        onSubmitEditing={submit}
        error={errors.password}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Forgot Password" hitSlop={8} style={styles.forgot} onPress={() => navigation.navigate("RecoverPassword")}>
        <Text variant="small" weight="bold">
          Forgot Password
        </Text>
      </Pressable>
      <Button title="Login" onPress={submit} loading={login.isPending} />

      <ErrorDialog visible={dialog !== null} title="Login failed" message={dialog ?? ""} onClose={() => setDialog(null)} />
    </AuthPage>
  );
};

const styles = StyleSheet.create({
  forgot: { alignSelf: "flex-end" },
});

export default Login;
