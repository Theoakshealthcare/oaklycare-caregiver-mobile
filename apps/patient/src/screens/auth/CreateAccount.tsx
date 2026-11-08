import { useMutation } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Icon from "@/src/components/ui/icon";
import Input from "@/src/components/ui/input";
import LegalLink from "@/src/components/ui/legal-link";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import TextLink from "@/src/components/ui/text-link";
import { theme } from "@/src/constants/theme";
import { isEmail, passwordProblem } from "@/src/domain/validation";
import { usePageOpener } from "@/src/hooks/usePageOpener";
import { useNav } from "@/src/navigation/Navigations";
import { authService } from "@/src/services/auth.service";

type Field = "name" | "email" | "password" | "terms";

const CreateAccount: React.FC = () => {
  const navigation = useNav();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [dialog, setDialog] = useState<string | null>(null);

  const register = useMutation({
    mutationFn: () => authService.register({ fullName: name.trim(), email: email.trim(), password }),
    // The backend has sent the 5-digit code by now; the next screen takes it.
    onSuccess: () => navigation.navigate("VerifyEmail", { email: email.trim() }),
    onError: (error) => setDialog(messageForError(error, "register")),
  });

  const clear = (field: Field) => setErrors((prev) => ({ ...prev, [field]: undefined }));
  const toggleAgreed = () => {
    setAgreed((value) => !value);
    clear("terms");
  };
  const { open, dialog: pageDialog } = usePageOpener();

  const submit = () => {
    const next: Partial<Record<Field, string>> = {};
    if (!name.trim()) next.name = "Full name is required";
    if (!email.trim()) next.email = "Email is required";
    else if (!isEmail(email)) next.email = "Enter a valid email address";
    const passwordError = passwordProblem(password);
    if (passwordError) next.password = passwordError;
    if (!agreed) next.terms = "Please accept the terms to continue";
    setErrors(next);
    if (Object.keys(next).length === 0) register.mutate();
  };

  return (
    <Screen title="Create Your Account" scroll>
      <Text color={theme.colors.textLight}>Tell us a little about you to get started.</Text>
      <Input
        label="Full name"
        placeholder="Your full name"
        value={name}
        onChangeText={(value) => {
          setName(value);
          clear("name");
        }}
        autoComplete="name"
        textContentType="name"
        error={errors.name}
      />
      <Input
        label="Email address"
        placeholder="Your email address"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          clear("email");
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        error={errors.email}
      />
      <Input
        label="Create password"
        placeholder="At least 8 characters"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          clear("password");
        }}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        error={errors.password}
      />

      <View>
        <View style={styles.terms}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            accessibilityLabel="I agree to the Privacy Policy and Cookies Policy"
            hitSlop={8}
            onPress={toggleAgreed}
          >
            <Icon name={agreed ? "checkbox" : "square-outline"} size={24} color={theme.colors.primary} />
          </Pressable>
          {/* The sentence still ticks the box when tapped; the Privacy Policy link inside it opens the page and does not. */}
          <Text variant="small" style={styles.termsText} onPress={toggleAgreed}>
            I agree to the{" "}
            <LegalLink page="privacy" onOpen={open}>
              Privacy Policy
            </LegalLink>{" "}
            and Cookies Policy
          </Text>
        </View>
        {errors.terms ? (
          <Text variant="small" color={theme.colors.secondary}>
            {errors.terms}
          </Text>
        ) : null}
      </View>

      <Button title="Create Account" onPress={submit} loading={register.isPending} />
      <View style={styles.footer}>
        <Text variant="small" color={theme.colors.textLight}>
          Already have an account?
        </Text>
        <TextLink label="Login" onPress={() => navigation.navigate("Login")} />
      </View>

      <ErrorDialog
        visible={dialog !== null}
        title="Could not create your account"
        message={dialog ?? ""}
        onClose={() => setDialog(null)}
      />
      {pageDialog}
    </Screen>
  );
};

const styles = StyleSheet.create({
  terms: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  termsText: { flex: 1 },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: theme.spacing.xs },
});

export default CreateAccount;
