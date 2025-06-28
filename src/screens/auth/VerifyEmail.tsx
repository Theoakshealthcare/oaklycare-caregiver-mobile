import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';

import { theme } from '@/src/constants/theme';
import Box from '@/src/components/ui/box';
import Text from '@/src/components/ui/text';
import Icon from '@/src/components/ui/icon';
import HeaderBack from '@/src/components/back/HeaderBack';
import { globalStyles } from '@/src/constants/styles';
import Navigation from '@/src/hooks/use-navigation';
import authService from '@/src/services/auth.service';
import { VerifyEmailProps } from '@/src/types/api.types';

const VerifyEmail: React.FC<VerifyEmailProps> = ({ route }) => {
  const { navigation } = Navigation();
  const { email } = route?.params || { email: 'example@gmail.com' };

  const [otp, setOtp] = useState<string[]>(['', '', '', '', '']);
  const [timer, setTimer] = useState<number>(30);
  const [showKeypad, setShowKeypad] = useState<boolean>(true);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prevTimer) => (prevTimer > 0 ? prevTimer - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleOtpChange = (value: string, index: number): void => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 4) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if complete using newOtp
    if (newOtp.every((digit) => digit !== '')) {
      verifyCode(newOtp.join(''));
    }
  };

  const handleKeyPress = (key: string): void => {
    const emptyIndex = otp.findIndex((digit) => digit === '');

    if (key === 'delete') {
      const lastFilledIndex = otp
        .map((digit) => digit !== '')
        .lastIndexOf(true);
      if (lastFilledIndex !== -1) {
        const newOtp = [...otp];
        newOtp[lastFilledIndex] = '';
        setOtp(newOtp);
      }
    } else if (emptyIndex !== -1) {
      const newOtp = [...otp];
      newOtp[emptyIndex] = key;
      setOtp(newOtp);

      // Check completion using newOtp
      if (newOtp.every((digit) => digit !== '')) {
        verifyCode(newOtp.join(''));
      }
    }
  };

  const verifyCode = async (code: string): Promise<void> => {
    if (isVerifying) return;
    
    setIsVerifying(true);
    
    try {
      await authService.verifyEmail(email || '', code);
      
      // Navigate to account created screen
      setTimeout(() => {
        navigation.navigate('AccountCreated');
      }, 500);
    } catch (error: any) {
      Alert.alert(
        'Verification Failed',
        error.detail || 'Invalid verification code. Please try again.'
      );
      // Reset OTP fields
      setOtp(['', '', '', '', '']);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async (): Promise<void> => {
    if (timer > 0) return;
    
    try {
      await authService.resendVerification(email || '');
      
      setOtp(['', '', '', '', '']);
      setTimer(30);
      
      Alert.alert('Success', 'A new verification code has been sent to your email.');
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.detail || 'Failed to resend verification code. Please try again.'
      );
    }
  };

  return (
    <View style={[globalStyles.container, { flex: 1 }]}>
      <HeaderBack />

      <View style={{ marginVertical: '10%' }}>
        <Text variant="h2">Verify Email Address</Text>

        <Text variant="body" color={theme.colors.textLight}>
          Enter the OTP code sent to your mail, {email}
        </Text>
      </View>

      <View style={globalStyles.column}>
        <View style={{ gap: 20 }}>
          <View
            style={[globalStyles.row, { justifyContent: 'center', gap: 8 }]}
          >
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={styles.otpInput}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                keyboardType="number-pad"
                maxLength={1}
                onFocus={() => setShowKeypad(true)}
                editable={!isVerifying}
              />
            ))}
          </View>

          <View style={[globalStyles.row, { justifyContent: 'space-between' }]}>
            <Pressable onPress={() => {}} disabled={timer > 0}>
              <Text
                variant="small"
                color={
                  timer > 0 ? theme.colors.textLight : theme.colors.primary
                }
              >
                Didn't receive a code?
              </Text>
            </Pressable>

            <Pressable onPress={handleResendCode} disabled={timer > 0 || isVerifying}>
              <Text
                variant="small"
                weight="medium"
                color={
                  timer > 0 || isVerifying ? theme.colors.textLight : theme.colors.primary
                }
              >
                {timer > 0 ? `Resend Code (${timer}s)` : 'Resend Code'}
              </Text>
            </Pressable>
          </View>
        </View>

        {showKeypad && (
          <Box style={{ marginTop: 'auto' }}>
            <Box row style={{ justifyContent: 'space-between' }}>
              <TouchableOpacity
                style={styles.keypadKey}
                onPress={() => handleKeyPress('1')}
                disabled={isVerifying}
              >
                <Text variant="h3">1</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.keypadKey}
                onPress={() => handleKeyPress('2')}
                disabled={isVerifying}
              >
                <Text variant="h3">2</Text>
                <Text variant="caption" color={theme.colors.textLight}>
                  ABC
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.keypadKey}
                onPress={() => handleKeyPress('3')}
                disabled={isVerifying}
              >
                <Text variant="h3">3</Text>
                <Text variant="caption" color={theme.colors.textLight}>
                  DEF
                </Text>
              </TouchableOpacity>
            </Box>

            <Box row style={{ justifyContent: 'space-between' }}>
              <TouchableOpacity
                style={styles.keypadKey}
                onPress={() => handleKeyPress('4')}
                disabled={isVerifying}
              >
                <Text variant="h3">4</Text>
                <Text variant="caption" color={theme.colors.textLight}>
                  GHI
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.keypadKey}
                onPress={() => handleKeyPress('5')}
                disabled={isVerifying}
              >
                <Text variant="h3">5</Text>
                <Text variant="caption" color={theme.colors.textLight}>
                  JKL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.keypadKey}
                onPress={() => handleKeyPress('6')}
                disabled={isVerifying}
              >
                <Text variant="h3">6</Text>
                <Text variant="caption" color={theme.colors.textLight}>
                  MNO
                </Text>
              </TouchableOpacity>
            </Box>

            <Box row style={{ justifyContent: 'space-between' }}>
              <TouchableOpacity
                style={styles.keypadKey}
                onPress={() => handleKeyPress('7')}
                disabled={isVerifying}
              >
                <Text variant="h3">7</Text>
                <Text variant="caption" color={theme.colors.textLight}>
                  PQRS
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.keypadKey}
                onPress={() => handleKeyPress('8')}
                disabled={isVerifying}
              >
                <Text variant="h3">8</Text>
                <Text variant="caption" color={theme.colors.textLight}>
                  TUV
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.keypadKey}
                onPress={() => handleKeyPress('9')}
                disabled={isVerifying}
              >
                <Text variant="h3">9</Text>
                <Text variant="caption" color={theme.colors.textLight}>
                  WXYZ
                </Text>
              </TouchableOpacity>
            </Box>

            <Box row style={{ justifyContent: 'space-between' }}>
              <TouchableOpacity
                style={styles.keypadKey}
                onPress={() => handleKeyPress('+')}
                disabled={isVerifying}
              >
                <Text variant="h3">+</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.keypadKey}
                onPress={() => handleKeyPress('0')}
                disabled={isVerifying}
              >
                <Text variant="h3">0</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.keypadKey}
                onPress={() => handleKeyPress('delete')}
                disabled={isVerifying}
              >
                <Icon name="backspace-outline" size={24} />
              </TouchableOpacity>
            </Box>
          </Box>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  otpInput: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: 'black',
  },
  keypadKey: {
    width: '30%',
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
  },
});

export default VerifyEmail;