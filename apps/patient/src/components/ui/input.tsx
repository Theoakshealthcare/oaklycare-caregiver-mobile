import type React from "react";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { MAX_FONT_SCALE, theme } from "../../constants/theme";
import FieldLabel from "./field-label";
import Icon from "./icon";
import Text from "./text";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

/** A labelled field. A password field (`secureTextEntry`) gets a show / hide eye. */
const Input: React.FC<InputProps> = ({ label, error, secureTextEntry, multiline, style, ...rest }) => {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const isPassword = Boolean(secureTextEntry);
  // Figma draws every field with a teal border at rest; focus is shown by the thicker line.
  const borderColor = error ? theme.colors.secondary : theme.colors.primary;
  return (
    <View>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <View style={[styles.field, { borderColor, borderWidth: focused ? 2 : 1 }, multiline && styles.multiline]}>
        <TextInput
          accessibilityLabel={label}
          style={[styles.input, style]}
          placeholderTextColor={theme.colors.textLight}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          secureTextEntry={isPassword && hidden}
          multiline={multiline}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            hitSlop={8}
            onPress={() => setHidden((value) => !value)}
          >
            <Icon name={hidden ? "eye-off-outline" : "eye-outline"} size={20} color={theme.colors.textLight} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="small" color={theme.colors.secondary} style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
  },
  multiline: { alignItems: "flex-start", minHeight: 96 },
  input: {
    flex: 1,
    paddingVertical: theme.spacing.sm + 4,
    fontSize: theme.sizes.body,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text,
  },
  error: { marginTop: theme.spacing.xs },
});

export default Input;
