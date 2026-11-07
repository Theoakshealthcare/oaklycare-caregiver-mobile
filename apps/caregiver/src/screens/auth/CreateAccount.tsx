import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';

import { theme } from '@/src/constants/theme';
import Box from '@/src/components/ui/box';
import Text from '@/src/components/ui/text';
import Button from '@/src/components/ui/button';
import KeyboardScrollView from '@/src/components/ui/keyboard-scroll-view';
import Input from '@/src/components/ui/input';
import Navigation from '@/src/hooks/use-navigation';
import { globalStyles } from '@/src/constants/styles';
import HeaderBack from '@/src/components/back/HeaderBack';
import ScreenSize from '@/src/hooks/screen-size';
import Icon from '@/src/components/ui/icon';
import ErrorDialog from '@/src/components/ui/ErrorDialog';
import { messageForError } from '@/src/api/errors';
import { authService } from '@/src/services/auth.service';

const CreateAccount: React.FC = () => {
  const { navigation } = Navigation();
  const { width } = ScreenSize();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [isChecked, setIsChecked] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<string | null>(null);

  const register = useMutation({
    mutationFn: () =>
      authService.register({
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phoneNumber: formData.phone.trim() || undefined,
        password: formData.password,
      }),
    // The email OTP was just sent: go and enter it.
    onSuccess: () => navigation.navigate('VerifyEmail', { email: formData.email.trim() }),
    onError: (error) => setDialog(messageForError(error)),
  });

  const updateFormData = (field: keyof typeof formData, value: string): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateInputs = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (formData.phone.trim() && !/^\+?[0-9\s-]{7,15}$/.test(formData.phone.trim())) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!isChecked) {
      newErrors.terms = 'You must agree to the terms';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateAccount = (): void => {
    if (validateInputs()) register.mutate();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <KeyboardScrollView>
        <View style={[globalStyles.container, { flex: 1 }]}>
          <HeaderBack />

          <View style={{ marginVertical: '10%' }}>
            <Text variant="h2" weight="bold">
              Create Your Account
            </Text>
            <Text variant="body" color={theme.colors.textLight}>
              Provide Your Personal Details
            </Text>
          </View>

          <View style={globalStyles.column}>
            <Input
              label="Full Name"
              placeholder="Provide your Full Name"
              value={formData.fullName}
              onChangeText={(text: string) => updateFormData('fullName', text)}
              error={errors.fullName}
            />

            <Input
              label="Email Address"
              placeholder="Provide your Email Address"
              value={formData.email}
              onChangeText={(text: string) => updateFormData('email', text)}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />

            <Input
              label="Phone Number (optional)"
              placeholder="+234"
              value={formData.phone}
              onChangeText={(text: string) => updateFormData('phone', text)}
              keyboardType="phone-pad"
              error={errors.phone}
            />

            <Input
              label="Create Password"
              placeholder="Enter your Password"
              value={formData.password}
              onChangeText={(text: string) => updateFormData('password', text)}
              secureTextEntry
              rightIcon={
                <Feather name="eye" size={20} color={theme.colors.textLight} />
              }
              error={errors.password}
            />

            <Box row alignItems="flex-start">
              <Pressable
                style={{
                  width: width * 0.05,
                  height: width * 0.05,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: errors.terms ? theme.colors.error : theme.colors.primary,
                  marginRight: 12,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                onPress={() => {
                  setIsChecked(!isChecked);
                  if (errors.terms) {
                    setErrors(prev => ({ ...prev, terms: '' }));
                  }
                }}
              >
                {isChecked && (
                  <Icon
                    name="checkbox"
                    size={16}
                    color={theme.colors.primary}
                  />
                )}
              </Pressable>

              <View style={{ flex: 1 }}>
                <Text variant="small" style={{ lineHeight: 18 }}>
                  By tapping Create Account, you agree to our Terms of Services.
                  Learn how we process your data in our{' '}
                  <Text
                    variant="small"
                    color={theme.colors.primary}
                    style={{ marginBottom: -7 }}
                  >
                    Privacy Policy
                  </Text>
                  {' '}and{' '}
                  <Text
                    variant="small"
                    color={theme.colors.primary}
                    style={{ marginBottom: -7 }}
                  >
                    Cookies Policy
                  </Text>
                </Text>
                {errors.terms && (
                  <Text variant="small" color={theme.colors.error}>
                    {errors.terms}
                  </Text>
                )}
              </View>
            </Box>

            <Button
              title="Create Account"
              onPress={handleCreateAccount}
              style={{ width: '100%' }}
              loading={register.isPending}
            />
          </View>
        </View>
      </KeyboardScrollView>
      <ErrorDialog
        visible={dialog !== null}
        title="Couldn't create your account"
        message={dialog ?? ''}
        onClose={() => setDialog(null)}
      />
    </View>
  );
};

export default CreateAccount;