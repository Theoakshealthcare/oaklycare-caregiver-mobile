import React, { useState, useEffect } from 'react';
import { View, Alert, ActivityIndicator } from 'react-native';

import type { StackScreenProps } from '@react-navigation/stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { theme } from '@/src/constants/theme';
import Text from '@/src/components/ui/text';
import Button from '@/src/components/ui/button';
import { OtpBoxes, OtpResendRow, emptyOtp } from '@/src/components/ui/otp-boxes';
import { showToast } from '@/src/components/ui/toast';
import HeaderBack from '@/src/components/back/HeaderBack';
import { globalStyles, FORM_PADDING } from '@/src/constants/styles';
import Navigation from '@/src/hooks/use-navigation';
import { authService } from '@/src/services/auth.service';
import { ApiError, messageForError } from '@/src/api/errors';
import { queryKeys } from '@/src/api/keys';
import { useSession } from '@/src/auth';
import type { ScreenParamLists } from '@/src/navigation/Navigations';

const VerifyEmail: React.FC<StackScreenProps<ScreenParamLists, 'VerifyEmail'>> = ({ route }) => {
  const { navigation } = Navigation();
  const { email } = route.params;
  const signedIn = useSession((s) => s.status === 'signedIn');
  const queryClient = useQueryClient();

  const [otp, setOtp] = useState<string[]>(emptyOtp());
  const [timer, setTimer] = useState<number>(30);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prevTimer) => (prevTimer > 0 ? prevTimer - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const verify = useMutation({
    mutationFn: (code: string) => authService.verifyEmail(email, code),
    onSuccess: async () => {
      if (signedIn) {
        // Logged in before verifying: re-read /auth/me and the auth gate moves on to onboarding.
        showToast('Email Address Verified');
        await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      } else {
        navigation.navigate('AccountCreated');
      }
    },
    onError: (error) => {
      Alert.alert('Verification Failed', messageForError(error));
      // A request that never reached the server keeps the code as typed, so Verify can send it again; a wrong code is cleared.
      if (!(error instanceof ApiError && error.status === 0)) setOtp(emptyOtp());
    },
  });
  const isVerifying = verify.isPending;
  // Verification starts by itself on the fifth digit (Figma has no Verify button). The button only appears when that
  // request never reached the server and the typed code is still in the boxes.
  const canRetry = verify.isError && otp.every((digit) => digit !== '');

  const resend = useMutation({
    mutationFn: () => authService.resendVerification(email),
    onSuccess: () => {
      setOtp(emptyOtp());
      setTimer(30);
      Alert.alert('Success', 'A new verification code has been sent to your email.');
    },
    onError: (error) => Alert.alert('Error', messageForError(error)),
  });

  const verifyCode = (code: string): void => {
    if (!isVerifying) verify.mutate(code);
  };

  const handleResendCode = (): void => {
    if (timer > 0 || resend.isPending || isVerifying) return;
    resend.mutate();
  };

  return (
    <View style={[globalStyles.container, FORM_PADDING, { flex: 1 }]}>
      <HeaderBack />

      <View style={{ marginTop: 28, marginBottom: 24 }}>
        <Text variant="page" weight="bold">
          Verify Email Address
        </Text>

        <Text variant="body" color={theme.colors.textLight}>
          Enter the OTP code sent to your mail, {email}
        </Text>
      </View>

      <View style={{ gap: 84 }}>
        <OtpBoxes value={otp} onChange={setOtp} onComplete={verifyCode} editable={!isVerifying} />

        {isVerifying ? <ActivityIndicator testID="verify-busy" color={theme.colors.primary} /> : null}

        <OtpResendRow cooldown={timer} sending={resend.isPending} disabled={isVerifying} onResend={handleResendCode} />

        {canRetry ? (
          <Button title="Verify" onPress={() => verifyCode(otp.join(''))} loading={isVerifying} />
        ) : null}
      </View>
    </View>
  );
};

export default VerifyEmail;
