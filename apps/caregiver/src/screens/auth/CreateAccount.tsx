import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';

import { theme } from '@/src/constants/theme';
import Text from '@/src/components/ui/text';
import Button from '@/src/components/ui/button';
import KeyboardScrollView from '@/src/components/ui/keyboard-scroll-view';
import Input from '@/src/components/ui/input';
import Navigation from '@/src/hooks/use-navigation';
import { globalStyles, FORM_PADDING } from '@/src/constants/styles';
import HeaderBack from '@/src/components/back/HeaderBack';
import ErrorDialog from '@/src/components/ui/ErrorDialog';
import LegalLink from '@/src/components/ui/legal-link';
import { messageForError } from '@/src/api/errors';
import { authService } from '@/src/services/auth.service';
import { rememberPendingSignIn } from '@/src/auth/pendingSignIn';

/** The Figma terms line says "By tapping Get Started"; change this one word if the owner decides it should name the button. */
export const TERMS_ACTION = 'Get Started';

const CreateAccount: React.FC = () => {
  const { navigation } = Navigation();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
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
        password: formData.password,
      }),
    // The email OTP was just sent: go and enter it.
    onSuccess: () => {
      // Kept in memory only, so "Set up your Account" after verification can sign in without asking again.
      rememberPendingSignIn(formData.email.trim(), formData.password);
      navigation.navigate('VerifyEmail', { email: formData.email.trim() });
    },
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
      {/* Scrolls to the end when the keyboard opens, so the button and the terms line stay above it. */}
      <KeyboardScrollView scrollToEndOnKeyboardShow>
        <View style={[globalStyles.container, FORM_PADDING, { flex: 1 }]}>
          <HeaderBack />

          <View style={{ marginTop: 28, marginBottom: 24 }}>
            <Text variant="page" weight="bold">
              Create Your Account
            </Text>
            <Text variant="body" color={theme.colors.textLight}>
              Provide Your Personal Details
            </Text>
          </View>

          <View style={[globalStyles.column, { gap: 22 }]}>
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

            <Button
              title="Create Account"
              onPress={handleCreateAccount}
              style={{ width: '100%' }}
              loading={register.isPending}
            />

            {/* Figma puts the terms line under the button. The box stays unticked until the person ticks it (owner decision). */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isChecked }}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: errors.terms ? theme.colors.error : theme.colors.primary,
                  backgroundColor: isChecked ? theme.colors.primary : theme.colors.white,
                  marginRight: 12,
                  marginTop: 1,
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
                {isChecked && <Feather name="check" size={12} color={theme.colors.white} />}
              </Pressable>

              <View style={{ flex: 1 }}>
                <Text variant="fine">
                  {`By tapping ${TERMS_ACTION}, you agree to our `}
                  <LegalLink page="terms">Terms of Services</LegalLink>.
                  {' '}Learn how we process your data in our{' '}
                  <LegalLink page="privacy">Privacy Policy</LegalLink>
                  {' '}and{' '}
                  <LegalLink page="cookies">Cookies Policy</LegalLink>
                </Text>
                {errors.terms && (
                  <Text variant="small" color={theme.colors.error}>
                    {errors.terms}
                  </Text>
                )}
              </View>
            </View>
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