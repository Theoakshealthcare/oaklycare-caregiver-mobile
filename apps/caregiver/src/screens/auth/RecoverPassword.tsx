import React, { useState } from 'react';
import { View, Alert } from 'react-native';
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
import { SENT_MESSAGE, SENT_TITLE } from '@/src/account/resetPasswordModel';

const RecoverPassword: React.FC = () => {
  const { navigation } = Navigation();
  const [email, setEmail] = useState<string>('');
  const [error, setError] = useState<string>('');

  const recover = useMutation({
    mutationFn: () => authService.requestPasswordReset(email.trim()),
    onSuccess: () => {
      // The server answers 200 for any address, so the wording never says whether the email has an account.
      Alert.alert(SENT_TITLE, SENT_MESSAGE, [
        { text: 'OK', onPress: () => navigation.navigate('ResetPassword', { email: email.trim() }) },
      ]);
    },
    onError: (err) => Alert.alert('Error', messageForError(err)),
  });

  const handleSendRecoveryLink = (): void => {
    if (!email.trim()) {
      setError('Email address is required');
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Please enter a valid email address');
    } else {
      setError('');
      recover.mutate();
    }
  };

  return (
    <View style={globalStyles.container}>
      <HeaderBack />

      <View style={{ marginVertical: '10%' }}>
        <Text variant="h2">Recover Password</Text>

        <Text variant="body" color={theme.colors.textLight}>
          Provide your email address and we will email you a 5-digit code to reset your password
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
          title="Send Reset Code"
          onPress={handleSendRecoveryLink}
          loading={recover.isPending}
        />
      </View>
    </View>
  );
};

export default RecoverPassword;