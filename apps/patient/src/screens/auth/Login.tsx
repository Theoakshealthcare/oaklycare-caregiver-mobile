import { useMutation } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Input from "@/src/components/ui/input";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import TextLink from "@/src/components/ui/text-link";
import { theme } from "@/src/constants/theme";
import { useNav } from "@/src/navigation/Navigations";
import { authService } from "@/src/services/auth.service";

const Login: React.FC = () => {
  const navigation = useNav();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [dialog, setDialog] = useState<string | null>(null);

  // On success the session flips to signed in and the auth gate swaps this screen for the app (or the verify step).
  const login = useMutation({
    mutationFn: () => authService.login(email.trim(), password),
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
    <Screen bare scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="h2" weight="bold">
          Login
        </Text>
        <Text color={theme.colors.textLight}>Sign in to your Oakly Health account</Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Email address"
          placeholder="Your email address"
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
          label="Password"
          placeholder="Your password"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          error={errors.password}
        />
        <View style={styles.forgot}>
          <TextLink label="Forgot password?" onPress={() => navigation.navigate("RecoverPassword")} />
        </View>
        <Button title="Login" onPress={submit} loading={login.isPending} />
        <View style={styles.footer}>
          <Text variant="small" color={theme.colors.textLight}>
            New to Oakly?
          </Text>
          <TextLink label="Create account" onPress={() => navigation.navigate("CreateAccount")} />
        </View>
      </View>

      <ErrorDialog visible={dialog !== null} title="Login failed" message={dialog ?? ""} onClose={() => setDialog(null)} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center" },
  header: { marginBottom: theme.spacing.md, gap: theme.spacing.xs },
  form: { gap: theme.spacing.md },
  forgot: { alignItems: "flex-end" },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: theme.spacing.xs },
});

export default Login;
