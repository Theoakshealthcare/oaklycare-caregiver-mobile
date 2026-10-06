import React, { useState } from 'react';
import { View, Alert } from 'react-native';
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
import { authService } from '@/src/services/auth.service';
import { messageForError } from '@/src/api/errors';
import type { ScreenParamLists } from '@/src/navigation/Navigations';

const ResetPassword: React.FC<StackScreenProps<ScreenParamLists, 'ResetPassword'>> = ({ route }) => {
  const email = route.params?.email;
  const { navigation } = Navigation();

  // The reset token arrives in the recovery email; the caregiver pastes it here.
  const [token, setToken] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = useMutation({
    mutationFn: () => authService.resetPassword(token.trim(), newPassword),
    onSuccess: () => {
      Alert.alert('Password reset', 'Your password has been reset. Log in with the new password.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    },
    onError: (error) => Alert.alert('Error', messageForError(error)),
  });

  const validateInputs = (): boolean => {
    const next: Record<string, string> = {};

    if (!token.trim()) next.token = 'Enter the reset code from your email';

    if (!newPassword) {
      next.password = 'Password is required';
    } else if (newPassword.length < 8) {
      next.password = 'Password must be at least 8 characters';
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
    if (validateInputs()) reset.mutate();
  };

  return (
    <View style={globalStyles.container}>
      <HeaderBack />

      <View style={{ marginVertical: '10%' }}>
        <Text variant="h2">Reset Password</Text>
        <Text variant="body" color={theme.colors.textLight}>
          {email ? `Enter the code we sent to ${email} and choose a new password` : 'Enter the code from your email and choose a new password'}
        </Text>
      </View>

      <View style={globalStyles.column}>
        <Input
          label="Reset Code"
          placeholder="Paste the code from your email"
          value={token}
          onChangeText={(t: string) => {
            setToken(t);
            setErrors((prev) => ({ ...prev, token: '' }));
          }}
          autoCapitalize="none"
          autoCorrect={false}
          error={errors.token}
        />

        <Input
          label="Create New Password"
          placeholder="Enter New Password"
          value={newPassword}
          onChangeText={(t: string) => {
            setNewPassword(t);
            setErrors((prev) => ({ ...prev, password: '' }));
          }}
          secureTextEntry
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
          error={errors.confirm}
          rightIcon={
            <Feather name="eye" size={20} color={theme.colors.textLight} />
          }
        />

        <Button
          title="Reset Password"
          onPress={handleResetPassword}
          loading={reset.isPending}
        />
      </View>
    </View>
  );
};

export default ResetPassword;