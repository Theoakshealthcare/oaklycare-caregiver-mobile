import React, { useState, useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { theme } from '@/src/constants/theme';
import Text from '@/src/components/ui/text';
import Button from '@/src/components/ui/button';
import Input from '@/src/components/ui/input';
import ErrorMessage from '@/src/components/ui/ErrorMessage';
import ErrorDialog from '@/src/components/ui/ErrorDialog';
import HeaderBack from '@/src/components/back/HeaderBack';
import { globalStyles } from '@/src/constants/styles';
import Navigation from '@/src/hooks/use-navigation';
import useAuth from '@/src/hooks/useAuth';
import { useAuthError, useAuthUser, useAuthStore } from '@/src/stores/auth.store';
import { LoginProps, ValidationErrors } from '@/src/types/api.types';
import { checkAndRedirect } from '@/src/hooks/useProfileRedirect';

const Login: React.FC<LoginProps> = ({ route }) => {
  const { navigation } = Navigation();
  const { login, isLoading, clearError, logout } = useAuth();
  const authError = useAuthError();
  const user = useAuthUser();
  const [formData, setFormData] = useState({
    emailPhone: '',
    password: '',
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [errorDialog, setErrorDialog] = useState<{ visible: boolean; title: string; message: string }>({ visible: false, title: '', message: '' });

  // Clear auth errors when component mounts
  useEffect(() => {
    clearError();
  }, [clearError]);

  // Show auth errors in the dialog
  useEffect(() => {
    if (authError) {
      let title = 'Error';
      let message = authError.detail || 'An unexpected error occurred';
      if (authError.status_code === 0) {
        title = 'Connection Error';
        message = 'Unable to connect to the server. Please check your internet connection and try again.';
      } else if (authError.status_code === 401) {
        title = 'Login Failed';
        message = 'Invalid email/phone or password. Please check your credentials and try again.';
      } else if (authError.status_code === 422) {
        title = 'Invalid Input';
        message = 'Please check your email/phone format and try again.';
      } else if (authError.status_code === 429) {
        title = 'Too Many Attempts';
        message = 'Too many login attempts. Please wait a moment and try again.';
      } else if (authError.status_code && authError.status_code >= 500) {
        title = 'Server Error';
        message = 'Server error. Please try again later.';
      }
      setErrorDialog({ visible: true, title, message });
    }
  }, [authError]);

  // User type check after login
  useEffect(() => {
    if (user && user.user_type && user.user_type !== 'caregiver') {
      setErrorDialog({
        visible: true,
        title: 'Account Type Error',
        message: 'You do not have a caregiver account. Please use the correct app for your account type.',
      });
      // Log out the user
      logout();
    }
  }, [user, logout]);

  const updateFormData = (field: keyof typeof formData, value: string): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    // Clear auth error when user starts typing
    if (authError) {
      clearError();
    }
  };

  const validateInputs = (): boolean => {
    const newErrors: ValidationErrors = {};
    
    if (!formData.emailPhone.trim()) {
      newErrors.emailPhone = 'Email or phone number is required';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (): Promise<void> => {
    if (!validateInputs()) {
      return;
    }

    const success = await login({
      email_or_phone: formData.emailPhone,
      password: formData.password,
    });
    console.log(success)
    
    if (success && user && user.user_type === 'caregiver') {
      await checkAndRedirect(navigation);
    }
  };

  const handleForgotPassword = (): void => {
    navigation.navigate('ForgotPassword');
  };

  return (
    <View style={globalStyles.container}>
      <HeaderBack />

      <View style={{ marginVertical: '10%' }}>
        <Text variant="h2" weight="bold">
          Login
        </Text>
        <Text variant="body" color={theme.colors.textLight}>
          Provide Your Personal Details
        </Text>
      </View>

      <View style={globalStyles.column}>
        <Input
          label="Email Address/Phone Number"
          placeholder="Provide your Email Address"
          value={formData.emailPhone}
          onChangeText={(text: string) => updateFormData('emailPhone', text)}
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.emailPhone}
        />

        <Input
          label="Input Password"
          placeholder="Input password"
          value={formData.password}
          onChangeText={(text: string) => updateFormData('password', text)}
          secureTextEntry
          error={errors.password}
          rightIcon={
            <Feather name="eye" size={20} color={theme.colors.textLight} />
          }
        />

        {/* Show auth error message visually as well */}
        <ErrorMessage 
          message={authError?.detail}
          visible={!!authError}
          type="error"
        />

        <Pressable
          style={{ alignSelf: 'flex-end' }}
          onPress={handleForgotPassword}
        >
          <Text variant="small" color={theme.colors.primary}>
            Forgot Password
          </Text>
        </Pressable>

        <Button
          title="Login"
          onPress={handleLogin}
          style={{ marginTop: '5%' }}
          loading={isLoading}
        />
      </View>

      {/* Modern error dialog */}
      <ErrorDialog
        visible={errorDialog.visible}
        title={errorDialog.title}
        message={errorDialog.message}
        onClose={() => {
          setErrorDialog({ ...errorDialog, visible: false });
          clearError();
        }}
      />
    </View>
  );
};

export default Login;