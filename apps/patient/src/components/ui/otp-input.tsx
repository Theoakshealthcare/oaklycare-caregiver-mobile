import type React from "react";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";

import { MAX_FONT_SCALE, theme } from "@/src/constants/theme";

import Text from "./text";

/** Digits only, never more than `length`. Pasted text and the iOS / Android one-time-code suggestion pass through here. */
export const digitsOnly = (value: string, length: number): string => value.replace(/\D/g, "").slice(0, length);

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called once with the full code the moment the last digit is in. */
  onComplete?: (code: string) => void;
  length?: number;
  editable?: boolean;
  label?: string;
  /** Open the number pad as soon as the screen is there (the code screens do; Figma shows the keypad up). */
  autoFocus?: boolean;
}

/**
 * The code boxes (5 for the emailed verification and reset codes). One real input sits invisibly over the boxes, so
 * typing, paste, backspace and the keyboard's "code from email" suggestion all work, and the boxes only draw it.
 */
const OtpInput: React.FC<OtpInputProps> = ({ value, onChange, onComplete, length = 5, editable = true, label = "Verification code", autoFocus = false }) => {
  const ref = useRef<TextInput>(null);
  const hadFocus = useRef(false);
  // While a code is being checked the input is not editable, and iOS then drops its focus (and the keyboard) for good: after a
  // wrong code the boxes looked ready but typing went nowhere until they were tapped. Take the focus back when editing resumes.
  useEffect(() => {
    if (editable && hadFocus.current) ref.current?.focus();
  }, [editable]);
  const handleChange = (text: string) => {
    const next = digitsOnly(text, length);
    onChange(next);
    if (next.length === length && next !== value) onComplete?.(next);
  };
  return (
    <Pressable onPress={() => ref.current?.focus()} style={styles.row} accessible={false}>
      {Array.from({ length }, (_, index) => (
        <View key={index} style={[styles.box, index < value.length && styles.filled]}>
          <Text variant="h1" weight="regular">
            {value[index] ?? ""}
          </Text>
        </View>
      ))}
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        editable={editable}
        onFocus={() => {
          hadFocus.current = true;
        }}
        onBlur={() => {
          // The blur that switching editing off causes arrives with the props of that render (editable is already false): it is not
          // the person leaving the field.
          if (editable) hadFocus.current = false;
        }}
        autoFocus={autoFocus}
        caretHidden
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={styles.hidden}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  // Figma: five 60 pt boxes, pale-teal with a light-teal border; a typed box turns pale blue.
  row: { flexDirection: "row", justifyContent: "center", gap: 13 },
  box: {
    width: 60,
    height: 60,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: "#9FCFCF",
    backgroundColor: theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  filled: { backgroundColor: "#F0F6FF", borderColor: "#B4D2FD" },
  resendRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm },
  pill: {
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.colors.primaryLight,
    paddingVertical: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing.md,
  },
  sending: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  hidden: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: "transparent" },
});

interface OtpResendRowProps {
  /** Seconds left before Resend opens; 0 means it is open. */
  cooldown: number;
  sending?: boolean;
  disabled?: boolean;
  onResend: () => void;
}

/** "Didn't receive a code ?" and the Resend Code pill (Figma; the spelling mistake in the frame is fixed). */
export const OtpResendRow: React.FC<OtpResendRowProps> = ({ cooldown, sending = false, disabled = false, onResend }) => {
  const blocked = cooldown > 0 || sending || disabled;
  const label = sending ? "Sending code..." : cooldown > 0 ? `Resend Code (${cooldown}s)` : "Resend Code";
  return (
    <View style={styles.resendRow}>
      <Text variant="small" weight="bold" color={theme.colors.textLight}>
        Didn&apos;t receive a code ?
      </Text>
      <Pressable
        onPress={onResend}
        disabled={blocked}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: blocked }}
        style={styles.pill}
      >
        {sending ? (
          <View style={styles.sending}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text variant="small" color={theme.colors.textLight}>
              {label}
            </Text>
          </View>
        ) : (
          <Text variant="small" color={blocked ? theme.colors.textLight : theme.colors.text}>
            {label}
          </Text>
        )}
      </Pressable>
    </View>
  );
};

export default OtpInput;
