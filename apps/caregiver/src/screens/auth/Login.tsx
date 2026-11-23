import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";

import { messageForError } from "@/src/api/errors";
import { theme } from "@/src/constants/theme";
import Text from "@/src/components/ui/text";
import Button from "@/src/components/ui/button";
import Input from "@/src/components/ui/input";
import { showToast } from "@/src/components/ui/toast";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import HeaderBack from "@/src/components/back/HeaderBack";
import { globalStyles, FORM_PADDING } from "@/src/constants/styles";
import Navigation from "@/src/hooks/use-navigation";
import { authService } from "@/src/services/auth.service";

const Login: React.FC = () => {
  const { navigation } = Navigation();
  const [emailPhone, setEmailPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ emailPhone?: string; password?: string }>({});
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(null);

  // On success the session flips to signed in and the auth gate swaps this stack for the right
  // screen (verify email, onboarding step, status or home). There is nothing to navigate to here.
  const login = useMutation({
    mutationFn: () => authService.login(emailPhone.trim(), password),
    onSuccess: () => showToast("Login Successful"),
    onError: (error) => setDialog({ title: "Login failed", message: messageForError(error, "login") }),
  });

  const handleLogin = () => {
    const next: typeof errors = {};
    if (!emailPhone.trim()) next.emailPhone = "Email or phone number is required";
    if (!password) next.password = "Password is required";
    setErrors(next);
    if (Object.keys(next).length === 0) login.mutate();
  };

  return (
    <View style={[globalStyles.container, FORM_PADDING]}>
      {/* On a relaunch Login is the first screen: Back then goes to the welcome slides, as in Figma. */}
      <HeaderBack onFallback={() => navigation.navigate("Onboarding")} />

      <View style={{ marginTop: 28, marginBottom: 24 }}>
        <Text variant="page" weight="bold">
          Login
        </Text>
        <Text variant="body" color={theme.colors.textLight}>
          Provide Your Personal Details
        </Text>
      </View>

      <View style={[globalStyles.column, { gap: 22 }]}>
        <Input
          label="Email Address/Phone Number"
          placeholder="Provide your Email Address"
          value={emailPhone}
          onChangeText={(text: string) => {
            setEmailPhone(text);
            setErrors((prev) => ({ ...prev, emailPhone: undefined }));
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.emailPhone}
        />

        <Input
          label="Input Password"
          placeholder="Input password"
          value={password}
          onChangeText={(text: string) => {
            setPassword(text);
            setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          secureTextEntry
          error={errors.password}
          rightIcon={<Feather name="eye" size={20} color={theme.colors.textLight} />}
        />

        <Pressable style={{ alignSelf: "flex-end" }} onPress={() => navigation.navigate("RecoverPassword")}>
          <Text variant="small" weight="bold">
            Forgot Password
          </Text>
        </Pressable>

        <Button title="Login" onPress={handleLogin} loading={login.isPending} />
      </View>

      <ErrorDialog
        visible={dialog !== null}
        title={dialog?.title}
        message={dialog?.message ?? ""}
        onClose={() => setDialog(null)}
      />
    </View>
  );
};

export default Login;
