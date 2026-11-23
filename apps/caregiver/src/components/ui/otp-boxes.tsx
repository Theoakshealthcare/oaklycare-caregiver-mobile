import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";

import { MAX_FONT_SCALE, theme } from "@/src/constants/theme";

import Text from "./text";

/** Length of every emailed code (sign-up verification and password recovery). */
export const OTP_LENGTH = 5;

export const emptyOtp = (): string[] => Array.from({ length: OTP_LENGTH }, () => "");

const FILLED_BACKGROUND = "#EEF3FD";

interface OtpBoxesProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Called once with the joined code when the last box is filled. */
  onComplete?: (code: string) => void;
  editable?: boolean;
}

/**
 * The five code boxes of the Figma "Verify Email Address" frames. The phone's own number pad does the typing (the Figma
 * keypad is the iOS keyboard), the first box is focused on arrival, and a pasted or auto-filled code spreads over the boxes.
 */
export const OtpBoxes: React.FC<OtpBoxesProps> = ({ value, onChange, onComplete, editable = true }) => {
  const refs = useRef<(TextInput | null)[]>([]);
  const focusedOnce = useRef(false);

  // Open the number pad as soon as the screen is there.
  useEffect(() => {
    if (focusedOnce.current) return;
    focusedOnce.current = true;
    const timer = setTimeout(() => refs.current[0]?.focus(), 250);
    return () => clearTimeout(timer);
  }, []);

  const setFrom = (index: number, text: string) => {
    const digits = text.replace(/\D/g, "");
    const next = [...value];
    if (!digits) {
      next[index] = "";
      onChange(next);
      return;
    }
    let cursor = index;
    for (const digit of digits) {
      if (cursor >= OTP_LENGTH) break;
      next[cursor] = digit;
      cursor += 1;
    }
    onChange(next);
    if (next.every((d) => d !== "")) {
      refs.current[OTP_LENGTH - 1]?.blur();
      onComplete?.(next.join(""));
    } else {
      refs.current[Math.min(cursor, OTP_LENGTH - 1)]?.focus();
    }
  };

  const onKeyPress = (index: number, key: string) => {
    if (key !== "Backspace" || value[index] !== "" || index === 0) return;
    const next = [...value];
    next[index - 1] = "";
    onChange(next);
    refs.current[index - 1]?.focus();
  };

  return (
    <View style={styles.row}>
      {value.map((digit, index) => (
        <TextInput
          key={index}
          testID={`otp-box-${index}`}
          ref={(ref) => {
            refs.current[index] = ref;
          }}
          style={[styles.box, digit ? styles.boxFilled : null]}
          value={digit}
          onChangeText={(text) => setFrom(index, text)}
          onKeyPress={(e) => onKeyPress(index, e.nativeEvent.key)}
          keyboardType="number-pad"
          textContentType={index === 0 ? "oneTimeCode" : "none"}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          selectTextOnFocus
          editable={editable}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          accessibilityLabel={`Code digit ${index + 1} of ${OTP_LENGTH}`}
        />
      ))}
    </View>
  );
};

interface OtpResendRowProps {
  /** Seconds left before Resend opens; 0 means it is open. */
  cooldown: number;
  sending?: boolean;
  disabled?: boolean;
  onResend: () => void;
}

/** "Didn't receive a code ?" and the Resend Code pill (Figma). */
export const OtpResendRow: React.FC<OtpResendRowProps> = ({ cooldown, sending = false, disabled = false, onResend }) => {
  const blocked = cooldown > 0 || sending || disabled;
  return (
    <View style={styles.resendRow}>
      <Text variant="small" weight="bold" color={theme.colors.textLight}>
        Didn&apos;t receive a code ?
      </Text>
      <Pressable
        onPress={onResend}
        disabled={blocked}
        accessibilityRole="button"
        accessibilityState={{ disabled: blocked }}
        style={styles.pill}
      >
        {sending ? (
          <View style={styles.sending}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text variant="caption" color={theme.colors.textLight}>
              Sending code...
            </Text>
          </View>
        ) : (
          <Text variant="caption" color={blocked ? theme.colors.textLight : theme.colors.text}>
            {cooldown > 0 ? `Resend Code (${cooldown}s)` : "Resend Code"}
          </Text>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: theme.spacing.sm },
  box: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.primaryLight,
    textAlign: "center",
    fontSize: theme.sizes.display,
    color: theme.colors.text,
    padding: 0,
  },
  boxFilled: { backgroundColor: FILLED_BACKGROUND, borderColor: "#D5DEF3" },
  resendRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm },
  pill: {
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.colors.primaryLight,
    paddingVertical: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing.md,
  },
  sending: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
});
