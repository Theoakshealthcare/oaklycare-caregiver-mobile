import type React from "react";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

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
}

/**
 * The code boxes (5 for the emailed verification and reset codes). One real input sits invisibly over the boxes, so
 * typing, paste, backspace and the keyboard's "code from email" suggestion all work, and the boxes only draw it.
 */
const OtpInput: React.FC<OtpInputProps> = ({ value, onChange, onComplete, length = 5, editable = true, label = "Verification code" }) => {
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
        <View key={index} style={[styles.box, index === value.length && editable && styles.active]}>
          <Text variant="h3" weight="bold">
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
        caretHidden
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={styles.hidden}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: theme.spacing.sm },
  box: {
    width: 52,
    height: 56,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  active: { borderColor: theme.colors.primary },
  hidden: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: "transparent" },
});

export default OtpInput;
