import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { useMutation } from '@tanstack/react-query';

import { theme } from '@/src/constants/theme';
import Text from '@/src/components/ui/text';
import { OtpBoxes, OtpResendRow, emptyOtp } from '@/src/components/ui/otp-boxes';
import HeaderBack from '@/src/components/back/HeaderBack';
import { globalStyles } from '@/src/constants/styles';
import Navigation from '@/src/hooks/use-navigation';
import { useCooldown } from '@/src/hooks/useCooldown';
import { authService } from '@/src/services/auth.service';
import { messageForError } from '@/src/api/errors';
import { RESEND_SECONDS, RESENT_NOTICE } from '@/src/account/resetPasswordModel';
import type { ScreenParamLists } from '@/src/navigation/Navigations';

/**
 * The code screen between "Recover Password" and "Reset Password" (Figma: "Verify Email Address").
 *
 * The server only checks the code together with the new password (`POST /auth/reset-password`), so this screen collects the
 * five digits and hands them on; a wrong or expired code is reported by the next screen, which sends the caregiver back
 * here with `params.cleared` changed so the boxes start empty again.
 */
const RecoverCode: React.FC<StackScreenProps<ScreenParamLists, 'RecoverCode'>> = ({ route }) => {
  const { email, cleared } = route.params;
  const { navigation } = Navigation();
  const [otp, setOtp] = useState<string[]>(emptyOtp());
  // The previous screen just asked for a code, so Resend opens after a minute.
  const [cooldown, startCooldown] = useCooldown(RESEND_SECONDS);

  useEffect(() => {
    setOtp(emptyOtp());
  }, [cleared]);

  const resend = useMutation({
    mutationFn: () => authService.requestPasswordReset(email),
    onSuccess: () => {
      setOtp(emptyOtp());
      startCooldown(RESEND_SECONDS);
      Alert.alert('Check your email', RESENT_NOTICE);
    },
    onError: (error) => Alert.alert('Error', messageForError(error)),
  });

  const handleResend = (): void => {
    if (cooldown > 0 || resend.isPending) return;
    resend.mutate();
  };

  return (
    <View style={[globalStyles.container, { flex: 1 }]}>
      <HeaderBack />

      <View style={{ marginVertical: '10%' }}>
        <Text variant="h2" weight="bold">
          Verify Email Address
        </Text>
        <Text variant="body" color={theme.colors.textLight}>
          Enter the OTP code sent to your mail, {email}
        </Text>
      </View>

      <View style={{ gap: 40 }}>
        <OtpBoxes value={otp} onChange={setOtp} onComplete={(code) => navigation.navigate('ResetPassword', { email, code })} />
        <OtpResendRow cooldown={cooldown} sending={resend.isPending} onResend={handleResend} />
      </View>
    </View>
  );
};

export default RecoverCode;
