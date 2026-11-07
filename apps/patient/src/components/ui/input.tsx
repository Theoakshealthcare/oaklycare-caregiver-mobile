import type React from "react";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { MAX_FONT_SCALE, theme } from "../../constants/theme";
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
  const borderColor = error ? theme.colors.secondary : focused ? theme.colors.primary : theme.colors.border;
  return (
    <View>
      {label ? (
        <Text variant="small" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.field, { borderColor }, multiline && styles.multiline]}>
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
            <Icon name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color={theme.colors.textLight} />
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
  label: { marginBottom: theme.spacing.xs },
  field: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
  },
  multiline: { alignItems: "flex-start", minHeight: 96 },
  input: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    fontSize: theme.sizes.body,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text,
  },
  error: { marginTop: theme.spacing.xs },
});

export default Input;
