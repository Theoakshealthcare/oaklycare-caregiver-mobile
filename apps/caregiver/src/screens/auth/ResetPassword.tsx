import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { useMutation } from '@tanstack/react-query';

import { theme } from '@/src/constants/theme';
import Text from '@/src/components/ui/text';
import Button from '@/src/components/ui/button';
import Input from '@/src/components/ui/input';
import { showToast } from '@/src/components/ui/toast';
import HeaderBack from '@/src/components/back/HeaderBack';
import { globalStyles, FORM_PADDING } from '@/src/constants/styles';
import Navigation from '@/src/hooks/use-navigation';
import { authService } from '@/src/services/auth.service';
import { messageForError } from '@/src/api/errors';
import { weakPasswordMessage } from '@/src/account/changePasswordModel';
import { SUCCESS_TOAST, resetFailure } from '@/src/account/resetPasswordModel';
import type { ScreenParamLists } from '@/src/navigation/Navigations';

const ResetPassword: React.FC<StackScreenProps<ScreenParamLists, 'ResetPassword'>> = ({ route }) => {
  const { email, code } = route.params;
  const { navigation } = Navigation();

  // The 5-digit code came from the code screen; it works once and for 15 minutes.
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = useMutation({
    // `email` is the exact string the code was requested with: the server counts and looks up per exact address.
    mutationFn: () => authService.resetPassword(email, code, newPassword),
    onSuccess: () => {
      showToast(SUCCESS_TOAST);
      navigation.navigate('Login');
    },
    onError: (error) => {
      const failure = resetFailure(error);
      switch (failure.kind) {
        case 'invalid_code':
        case 'request_new_code':
        case 'locked':
          // The code is the problem: say so and go back to the code screen, whose boxes start empty again.
          Alert.alert('Error', failure.message);
          navigation.navigate('RecoverCode', { email, cleared: Date.now() });
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

  const validateInputs = (): boolean => {
    const next: Record<string, string> = {};

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
    if (!reset.isPending && validateInputs()) reset.mutate();
  };

  return (
    <View style={[globalStyles.container, FORM_PADDING]}>
      <HeaderBack />

      <View style={{ marginTop: 28, marginBottom: 24 }}>
        <Text variant="page" weight="bold">
          Reset Password
        </Text>
        <Text variant="body" color={theme.colors.textLight}>
          Reset your Password
        </Text>
      </View>

      <View style={[globalStyles.column, { gap: 22 }]}>
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
        />

        <Button title="Reset Password" onPress={handleResetPassword} loading={reset.isPending} />
      </View>
    </View>
  );
};

export default ResetPassword;
