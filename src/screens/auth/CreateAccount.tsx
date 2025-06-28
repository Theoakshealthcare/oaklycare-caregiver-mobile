import React, { useState } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { theme } from '@/src/constants/theme';
import Box from '@/src/components/ui/box';
import Text from '@/src/components/ui/text';
import Button from '@/src/components/ui/button';
import Input from '@/src/components/ui/input';
import Navigation from '@/src/hooks/use-navigation';
import { globalStyles } from '@/src/constants/styles';
import HeaderBack from '@/src/components/back/HeaderBack';
import ScreenSize from '@/src/hooks/screen-size';
import Icon from '@/src/components/ui/icon';
import useAuth from '@/src/hooks/useAuth';
import { CreateAccountProps, ValidationErrors } from '@/src/types/api.types';
import { checkAndRedirect } from '@/src/hooks/useProfileRedirect';

const CreateAccount: React.FC<CreateAccountProps> = ({ route }) => {
  const { navigation } = Navigation();
  const { width } = ScreenSize();
  const { register, isLoading } = useAuth();

  const [formData, setFormData] = useState({
    fullName: '',
    emailPhone: '',
    password: '',
  });
  const [isChecked, setIsChecked] = useState<boolean>(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  const updateFormData = (field: keyof typeof formData, value: string): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateInputs = (): boolean => {
    const newErrors: ValidationErrors = {};
    
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    
    if (!formData.emailPhone.trim()) {
      newErrors.emailPhone = 'Email or phone number is required';
    } else if (formData.emailPhone.includes('@') && !formData.emailPhone.match(/^\S+@\S+\.\S+$/)) {
      newErrors.emailPhone = 'Please enter a valid email address';
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

  const handleCreateAccount = async (): Promise<void> => {
    if (!validateInputs()) {
      return;
    }

    try {
      const isEmail = formData.emailPhone.includes('@');
      
      const userData = {
        full_name: formData.fullName,
        password: formData.password,
        email: isEmail ? formData.emailPhone : '',
        phone_number: !isEmail ? formData.emailPhone : undefined,
      };
      
      const success = await register(userData);
      
      if (success) {
        await checkAndRedirect(navigation);
      }
    } catch (error) {
      console.error('Registration error:', error);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <ScrollView>
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
              label="Email Address/Phone Number"
              placeholder="Provide your Email/Phone Number"
              value={formData.emailPhone}
              onChangeText={(text: string) => updateFormData('emailPhone', text)}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.emailPhone}
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
                  By tapping Get Started, you agree to our Terms of Services.
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
              loading={isLoading}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default CreateAccount;