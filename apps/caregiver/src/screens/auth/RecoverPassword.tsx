import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { theme } from '@/src/constants/theme';
import Text from '@/src/components/ui/text';
import Button from '@/src/components/ui/button';
import Input from '@/src/components/ui/input';
import HeaderBack from '@/src/components/back/HeaderBack';
import { globalStyles, FORM_PADDING } from '@/src/constants/styles';
import Navigation from '@/src/hooks/use-navigation';
import { authService } from '@/src/services/auth.service';
import { messageForError } from '@/src/api/errors';

const RecoverPassword: React.FC = () => {
  const { navigation } = Navigation();
  const [email, setEmail] = useState<string>('');
  const [error, setError] = useState<string>('');

  const recover = useMutation({
    mutationFn: () => authService.requestPasswordReset(email.trim()),
    // The server answers 200 for any address, so the next screen never says whether the email has an account.
    onSuccess: () => navigation.navigate('RecoverCode', { email: email.trim() }),
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
    <View style={[globalStyles.container, FORM_PADDING]}>
      <HeaderBack />

      <View style={{ marginTop: 28, marginBottom: 24 }}>
        <Text variant="page" weight="bold">
          Recover Password
        </Text>

        <Text variant="body" color={theme.colors.textLight}>
          Provide your email address to recover your password
        </Text>
      </View>

      <View style={[globalStyles.column, { gap: 22 }]}>
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
          loading={recover.isPending}
        />
      </View>
    </View>
  );
};

export default RecoverPassword;