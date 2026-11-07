import React, { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { useMutation } from "@tanstack/react-query";

import {
  SUCCESS_MESSAGE,
  SUCCESS_TITLE,
  changePasswordFailure,
  validatePasswordForm,
  type PasswordField,
} from "@/src/account/changePasswordModel";
import { formatCountdown, messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view";
import Input from "@/src/components/ui/input";
import Text from "@/src/components/ui/text";
import HeaderBack from "@/src/components/back/HeaderBack";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";
import useNavigation from "@/src/hooks/use-navigation";
import { authService } from "@/src/services/auth.service";

type FieldErrors = Partial<Record<PasswordField, string>>;

const ChangePassword: React.FC = () => {
  const { navigation } = useNavigation();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  /** After too many wrong current passwords: when the backend will answer again (epoch ms). */
  const [waitUntil, setWaitUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const secondsLeft = waitUntil === null ? 0 : Math.max(0, Math.ceil((waitUntil - now) / 1000));
  const waiting = secondsLeft > 0;

  useEffect(() => {
    if (waitUntil === null) return undefined;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= waitUntil) setWaitUntil(null);
    }, 1000);
    return () => clearInterval(timer);
  }, [waitUntil]);

  const change = useMutation({
    mutationFn: () => authService.changePassword(current, next),
    onSuccess: () => {
      // The new tokens are already stored (authService.changePassword), so the caregiver stays signed in.
      Alert.alert(SUCCESS_TITLE, SUCCESS_MESSAGE, [{ text: "OK", onPress: () => navigation.goBack() }]);
    },
    onError: (error) => {
      const failure = changePasswordFailure(error);
      if (failure.kind === "field") {
        setErrors({ [failure.field]: failure.message });
      } else if (failure.kind === "wait") {
        setErrors({});
        setNow(Date.now());
        setWaitUntil(Date.now() + failure.seconds * 1000);
      } else {
        Alert.alert("Couldn't change your password", messageForError(error));
      }
    },
  });

  const edit = (setter: (value: string) => void, field: PasswordField) => (value: string) => {
    setter(value);
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const submit = () => {
    if (waiting || change.isPending) return;
    const found = validatePasswordForm({ current, next, confirm });
    setErrors(found);
    if (Object.keys(found).length === 0) change.mutate();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <KeyboardScrollView scrollToEndOnKeyboardShow>
        <View style={globalStyles.container}>
          <HeaderBack />
          <View style={{ marginVertical: "8%" }}>
            <Text variant="h2" weight="bold">
              Change password
            </Text>
            <Text variant="body" color={theme.colors.textLight}>
              Choose a new password. You will be signed out on your other devices.
            </Text>
          </View>

          <View style={globalStyles.column}>
            <Input
              label="Current password"
              placeholder="Enter current password"
              value={current}
              onChangeText={edit(setCurrent, "current")}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              error={errors.current}
            />
            <Input
              label="New password"
              placeholder="At least 8 characters"
              value={next}
              onChangeText={edit(setNext, "new")}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              error={errors.new}
            />
            <Input
              label="Confirm new password"
              placeholder="Enter the new password again"
              value={confirm}
              onChangeText={edit(setConfirm, "confirm")}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              error={errors.confirm}
            />

            {waiting ? (
              <Text variant="small" color={theme.colors.secondary} accessibilityRole="alert">
                Too many incorrect attempts. You can try again in {formatCountdown(secondsLeft)}.
              </Text>
            ) : null}

            <Button
              title={waiting ? `Try again in ${formatCountdown(secondsLeft)}` : "Change password"}
              onPress={submit}
              loading={change.isPending}
              disabled={waiting}
            />
          </View>
        </View>
      </KeyboardScrollView>
    </View>
  );
};

export default ChangePassword;
