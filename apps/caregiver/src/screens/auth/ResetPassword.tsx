import React, { useState } from 'react';
import { View, Alert, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { StackScreenProps } from '@react-navigation/stack';
import { useMutation } from '@tanstack/react-query';

import { theme } from '@/src/constants/theme';
import Text from '@/src/components/ui/text';
import Button from '@/src/components/ui/button';
import Input from '@/src/components/ui/input';
import HeaderBack from '@/src/components/back/HeaderBack';
import { globalStyles } from '@/src/constants/styles';
import Navigation from '@/src/hooks/use-navigation';
import { useCooldown } from '@/src/hooks/useCooldown';
import { authService } from '@/src/services/auth.service';
import { messageForError } from '@/src/api/errors';
import { weakPasswordMessage } from '@/src/account/changePasswordModel';
import {
  RESEND_SECONDS,
  RESENT_NOTICE,
  RESET_CODE_LENGTH,
  SUCCESS_MESSAGE,
  SUCCESS_TITLE,
  codeDigits,
  resetFailure,
} from '@/src/account/resetPasswordModel';
import type { ScreenParamLists } from '@/src/navigation/Navigations';

const ResetPassword: React.FC<StackScreenProps<ScreenParamLists, 'ResetPassword'>> = ({ route }) => {
  const { email } = route.params;
  const { navigation } = Navigation();

  // The 5-digit code arrives in the recovery email; it works once and for 15 minutes.
  const [code, setCode] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  // After the 24-hour guess budget the server sends nothing at all, so Resend is hidden rather than offered.
  const [locked, setLocked] = useState<boolean>(false);
  // A code was just emailed by the previous screen, so resending opens after a minute.
  const [cooldown, startCooldown] = useCooldown(RESEND_SECONDS);

  const reset = useMutation({
    // `email` is the exact string the code was requested with: the server counts and looks up per exact address.
    mutationFn: () => authService.resetPassword(email, code, newPassword),
    onSuccess: () => {
      Alert.alert(SUCCESS_TITLE, SUCCESS_MESSAGE, [{ text: 'OK', onPress: () => navigation.navigate('Login') }]);
    },
    onError: (error) => {
      const failure = resetFailure(error);
      setNotice(null);
      switch (failure.kind) {
        case 'invalid_code':
        case 'request_new_code':
          setErrors({ code: failure.message });
          setCode('');
          break;
        case 'locked':
          setErrors({ code: failure.message });
          setCode('');
          setLocked(true);
          break;
        case 'weak_password':
          // The code is not used up: only the password needs fixing.
          setErrors({ password: failure.message });
          break;
        default:
          Alert.alert('Error', messageForError(error));
      }
    },
  });

  const resend = useMutation({
    mutationFn: () => authService.requestPasswordReset(email),
    onSuccess: () => {
      setCode('');
      setErrors({});
      setNotice(RESENT_NOTICE);
      startCooldown(RESEND_SECONDS);
    },
    onError: (error) => Alert.alert('Error', messageForError(error)),
  });

  const validateInputs = (): boolean => {
    const next: Record<string, string> = {};

    if (code.length !== RESET_CODE_LENGTH) next.code = `Enter the ${RESET_CODE_LENGTH}-digit code from your email`;

    if (!newPassword) {
      next.password = 'Password is required';
    } else {
      const weak = weakPasswordMessage(newPassword);
      if (weak) next.password = weak;
    }

    if (!confirmPassword) {
      next.confirm = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      next.confirm = 'Passwords do not match';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleResetPassword = (): void => {
    if (!locked && !reset.isPending && validateInputs()) reset.mutate();
  };

  const handleResend = (): void => {
    if (cooldown > 0 || resend.isPending || reset.isPending) return;
    resend.mutate();
  };

  return (
    <View style={globalStyles.container}>
      <HeaderBack />

      <View style={{ marginVertical: '10%' }}>
        <Text variant="h2">Reset Password</Text>
        <Text variant="body" color={theme.colors.textLight}>
          {`Enter the ${RESET_CODE_LENGTH}-digit code we sent to ${email} and choose a new password`}
        </Text>
      </View>

      <View style={globalStyles.column}>
        <Input
          label="Reset Code"
          placeholder="5-digit code"
          value={code}
          onChangeText={(t: string) => {
            setCode(codeDigits(t));
            setErrors((prev) => ({ ...prev, code: '' }));
            if (t) setNotice(null);
          }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={RESET_CODE_LENGTH}
          autoCorrect={false}
          editable={!locked}
          error={errors.code}
        />
        {notice ? (
          <Text variant="small" color={theme.colors.success}>
            {notice}
          </Text>
        ) : null}

        <Input
          label="Create New Password"
          placeholder="Enter New Password"
          value={newPassword}
          onChangeText={(t: string) => {
            setNewPassword(t);
            setErrors((prev) => ({ ...prev, password: '' }));
          }}
          secureTextEntry
          autoCapitalize="none"
          error={errors.password}
          rightIcon={
            <Feather name="eye" size={20} color={theme.colors.textLight} />
          }
        />

        <Input
          label="Confirm New Password"
          placeholder="Enter New Password"
          value={confirmPassword}
          onChangeText={(t: string) => {
            setConfirmPassword(t);
            setErrors((prev) => ({ ...prev, confirm: '' }));
          }}
          secureTextEntry
          autoCapitalize="none"
          error={errors.confirm}
          rightIcon={
            <Feather name="eye" size={20} color={theme.colors.textLight} />
          }
        />

        <Button
          title="Reset Password"
          onPress={handleResetPassword}
          loading={reset.isPending}
          disabled={locked}
        />

        {locked ? null : (
          <View style={[globalStyles.row, { justifyContent: 'center', gap: 6 }]}>
            <Text variant="small" color={theme.colors.textLight}>
              Didn&apos;t receive a code?
            </Text>
            <Pressable
              onPress={handleResend}
              disabled={cooldown > 0 || resend.isPending || reset.isPending}
              accessibilityRole="button"
              accessibilityLabel={cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
              accessibilityState={{ disabled: cooldown > 0 || resend.isPending || reset.isPending }}
            >
              <Text
                variant="small"
                weight="medium"
                color={cooldown > 0 || resend.isPending ? theme.colors.textLight : theme.colors.primary}
              >
                {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
};

export default ResetPassword;
