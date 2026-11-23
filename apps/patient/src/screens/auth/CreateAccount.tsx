import { useMutation } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import { rememberPendingSignIn } from "@/src/auth/pendingSignIn";
import AuthPage from "@/src/components/ui/auth-page";
import Button from "@/src/components/ui/button";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Icon from "@/src/components/ui/icon";
import Input from "@/src/components/ui/input";
import LegalLink from "@/src/components/ui/legal-link";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { isEmail, passwordProblem } from "@/src/domain/validation";
import { usePageOpener } from "@/src/hooks/usePageOpener";
import { useNav } from "@/src/navigation/Navigations";
import { authService } from "@/src/services/auth.service";

type Field = "name" | "email" | "password" | "terms";

/** The Figma terms line says "By tapping Get Started"; change this one word if the owner decides it should name the button. */
export const TERMS_ACTION = "Get Started";

const CreateAccount: React.FC = () => {
  const navigation = useNav();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Unticked until the person ticks it (owner decision, same as the caregiver app); Figma shows it pre-ticked.
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [dialog, setDialog] = useState<string | null>(null);

  const register = useMutation({
    mutationFn: () => authService.register({ fullName: name.trim(), email: email.trim(), password }),
    // The backend has sent the 5-digit code by now; the next screen takes it.
    onSuccess: () => {
      // Kept in memory only, so "Start Booking Journey" after verification can sign in without asking again.
      rememberPendingSignIn(email.trim(), password);
      navigation.navigate("VerifyEmail", { email: email.trim() });
    },
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
    // Scrolls to the end when the keyboard opens, so the button and the terms line stay above it.
    <AuthPage title="Create Your Account" subtitle="Provide Your Personal Details" scrollToEndOnKeyboardShow>
      <Input
        label="Full Name"
        placeholder="Provide your Full Name"
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
        label="Email Address"
        placeholder="Provide your Email Address"
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
        label="Create Password"
        placeholder="Enter your Password"
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

      <Button title="Create Account" onPress={submit} loading={register.isPending} />

      {/* Figma puts the terms line under the button. */}
      <View>
        <View style={styles.terms}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            accessibilityLabel="I agree to the Terms of Service, Privacy Policy and Cookies Policy"
            hitSlop={8}
            onPress={toggleAgreed}
            style={[
              styles.box,
              { borderColor: errors.terms ? theme.colors.error : theme.colors.primary, backgroundColor: agreed ? theme.colors.primary : theme.colors.white },
            ]}
          >
            {agreed ? <Icon name="checkmark" size={14} color={theme.colors.white} /> : null}
          </Pressable>
          {/* The sentence still ticks the box when tapped; the links inside it open their page and do not. */}
          <Text variant="fine" style={styles.termsText} onPress={toggleAgreed}>
            {`By tapping ${TERMS_ACTION}, you agree to our `}
            <LegalLink page="terms" onOpen={open}>
              Terms of Service
            </LegalLink>
            {". Learn how we process your data in our "}
            <LegalLink page="privacy" onOpen={open}>
              Privacy Policy
            </LegalLink>
            {" and "}
            <LegalLink page="cookies" onOpen={open}>
              Cookies Policy
            </LegalLink>
          </Text>
        </View>
        {errors.terms ? (
          <Text variant="small" color={theme.colors.secondary} style={styles.termsError}>
            {errors.terms}
          </Text>
        ) : null}
      </View>

      <ErrorDialog
        visible={dialog !== null}
        title="Could not create your account"
        message={dialog ?? ""}
        onClose={() => setDialog(null)}
      />
      {pageDialog}
    </AuthPage>
  );
};

const styles = StyleSheet.create({
  terms: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  box: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, marginTop: 1, alignItems: "center", justifyContent: "center" },
  termsText: { flex: 1 },
  termsError: { marginTop: theme.spacing.xs },
});

export default CreateAccount;
