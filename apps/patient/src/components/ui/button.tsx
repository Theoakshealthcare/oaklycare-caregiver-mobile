import type React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

import { MAX_FONT_SCALE, theme } from "../../constants/theme";

export type ButtonVariant = "primary" | "outline";

interface ButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const Button: React.FC<ButtonProps> = ({ title, variant = "primary", loading = false, disabled = false, style, ...rest }) => {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      style={[styles.button, primary ? styles.primary : styles.outline, (disabled || loading) && styles.disabled, style]}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={primary ? theme.colors.white : theme.colors.primary} size="small" />
      ) : (
        <Text
          style={[styles.text, { color: primary ? theme.colors.white : theme.colors.primary }]}
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: theme.spacing.md,
    minHeight: 48,
    borderRadius: theme.borderRadius.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: theme.colors.primary },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.colors.primary },
  disabled: { opacity: 0.5 },
  text: { fontSize: theme.sizes.body, fontFamily: theme.fonts.bold },
});

export default Button;
