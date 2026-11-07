import type React from "react";
import { useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { MAX_FONT_SCALE, theme } from "../../constants/theme";
import Text from "./text";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, error, ...rest }) => {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? theme.colors.secondary : focused ? theme.colors.primary : theme.colors.border;
  return (
    <View>
      {label ? (
        <Text variant="small" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        style={[styles.input, { borderColor }]}
        placeholderTextColor={theme.colors.textLight}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        {...rest}
      />
      {error ? (
        <Text variant="small" color={theme.colors.secondary} style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  label: { marginBottom: theme.spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.white,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.sizes.body,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text,
  },
  error: { marginTop: theme.spacing.xs },
});

export default Input;
