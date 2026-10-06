import React, { useState } from 'react';
import { View, Alert } from 'react-native';

import { theme } from '@/src/constants/theme';
import Text from '@/src/components/ui/text';
import Button from '@/src/components/ui/button';
import Input from '@/src/components/ui/input';
import HeaderBack from '@/src/components/back/HeaderBack';
import { globalStyles } from '@/src/constants/styles';
import Navigation from '@/src/hooks/use-navigation';
import authService from '@/src/services/auth.service';
import { RecoverPasswordProps } from '@/src/types/api.types';

const RecoverPassword: React.FC<RecoverPasswordProps> = ({ route }) => {
  const { navigation } = Navigation();
  const [email, setEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const validateEmail = (): boolean => {
    if (!email.trim()) {
      setError('Email address is required');
      return false;
    } else if (!email.match(/^\S+@\S+\.\S+$/)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    setError('');
    return true;
  };

  const handleSendRecoveryLink = async (): Promise<void> => {
    if (!validateEmail()) {
      return;
    }

    setIsLoading(true);

    try {
      await authService.requestPasswordReset({ email });
      
      // Show success message
      Alert.alert(
        'Recovery Email Sent',
        'Please check your email for instructions to reset your password.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('VerifyEmail', { email }),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.detail || 'Failed to send recovery email. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={globalStyles.container}>
      <HeaderBack />

      <View style={{ marginVertical: '10%' }}>
        <Text variant="h2">Recover Password</Text>

        <Text variant="body" color={theme.colors.textLight}>
          Provide your email address to recover your password
        </Text>
      </View>

      <View style={globalStyles.column}>
        <Input
          label="Email Address"
          placeholder="Provide your Email Address"
          value={email}
          onChangeText={(text: string) => {
            setEmail(text);
            if (error) setError('');
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          error={error}
        />

        <Button
          title="Send Recovery Link"
          onPress={handleSendRecoveryLink}
          loading={isLoading}
        />
      </View>
    </View>
  );
};

export default RecoverPassword;