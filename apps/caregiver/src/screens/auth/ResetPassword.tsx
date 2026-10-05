import React, { useState, useEffect } from 'react';
import { View, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { theme } from '@/src/constants/theme';
import Box from '@/src/components/ui/box';
import Text from '@/src/components/ui/text';
import Button from '@/src/components/ui/button';
import Input from '@/src/components/ui/input';
import Icon from '@/src/components/ui/icon';
import HeaderBack from '@/src/components/back/HeaderBack';
import { globalStyles } from '@/src/constants/styles';
import Navigation from '@/src/hooks/use-navigation';
import authService from '@/src/services/auth.service';
import { ResetPasswordProps } from '@/src/types/api.types';

const ResetPassword: React.FC<ResetPasswordProps> = ({ route }) => {
  const token = route?.params?.token;
  const { navigation } = Navigation();

  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string>('');
  const [confirmError, setConfirmError] = useState<string>('');

  // Clear errors when inputs change
  useEffect(() => {
    if (passwordError) setPasswordError('');
  }, [newPassword]);

  useEffect(() => {
    if (confirmError) setConfirmError('');
  }, [confirmPassword]);

  const validateInputs = (): boolean => {
    let isValid = true;

    if (!newPassword) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      isValid = false;
    }

    if (!confirmPassword) {
      setConfirmError('Please confirm your password');
      isValid = false;
    } else if (newPassword !== confirmPassword) {
      setConfirmError('Passwords do not match');
      isValid = false;
    }

    return isValid;
  };

  const handleResetPassword = async (): Promise<void> => {
    if (!validateInputs()) {
      return;
    }

    if (!token) {
      Alert.alert('Error', 'Reset token is missing. Please try again.');
      return;
    }

    setIsLoading(true);

    try {
      await authService.resetPassword(token, newPassword);
      
      setIsSuccess(true);

      // Navigate back to login after showing success message
      setTimeout(() => {
        navigation.navigate('Login');
      }, 2000);
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.detail || 'Failed to reset password. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={globalStyles.container}>
      {isSuccess && (
        <Box
          style={{
            backgroundColor: theme.colors.success,
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 8,
            marginBottom: 16,
            gap: 8,
          }}
          row
          alignItems="center"
        >
          <Icon name="checkbox-outline" size={20} color={theme.colors.white} />
          <Text variant="small" color={theme.colors.white}>
            Password has been Reset Successfully
          </Text>
        </Box>
      )}

      <HeaderBack />

      <View style={{ marginVertical: '10%' }}>
        <Text variant="h2">Reset Password</Text>
        <Text variant="body" color={theme.colors.textLight}>
          Reset your Password
        </Text>
      </View>

      <View style={globalStyles.column}>
        <Input
          label="Create New Password"
          placeholder="Enter New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          error={passwordError}
          rightIcon={
            <Feather name="eye" size={20} color={theme.colors.textLight} />
          }
        />

        <Input
          label="Confirm New Password"
          placeholder="Enter New Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          error={confirmError}
          rightIcon={
            <Feather name="eye" size={20} color={theme.colors.textLight} />
          }
        />

        <Button
          title="Reset Password"
          onPress={handleResetPassword}
          loading={isLoading}
          disabled={isSuccess}
        />
      </View>
    </View>
  );
};

export default ResetPassword;