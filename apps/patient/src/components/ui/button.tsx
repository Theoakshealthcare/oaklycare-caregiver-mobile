import type React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

import { MAX_FONT_SCALE, theme } from "../../constants/theme";

/** primary = filled teal pill, outline = teal border, danger = coral border and text (cancel, delete), light = white pill for coloured panels. */
export type ButtonVariant = "primary" | "outline" | "danger" | "light";

interface ButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  /** A compact pill for cards (Track, Chat, Cancel). */
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}

const textColor = (variant: ButtonVariant) =>
  variant === "primary" ? theme.colors.white : variant === "danger" ? theme.colors.secondary : theme.colors.primary;
// "light" and "outline" both read teal on their fill.

const Button: React.FC<ButtonProps> = ({
  title,
  variant = "primary",
  loading = false,
  disabled = false,
  small = false,
  style,
  ...rest
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: disabled || loading, busy: loading }}
    style={[
      styles.button,
      small && styles.small,
      variant === "primary" && styles.primary,
      variant === "outline" && styles.outline,
      variant === "danger" && styles.danger,
      variant === "light" && styles.light,
      (disabled || loading) && styles.disabled,
      style,
    ]}
    disabled={disabled || loading}
    {...rest}
  >
    {loading ? (
      <ActivityIndicator color={textColor(variant)} size="small" />
    ) : (
      <Text
        style={[styles.text, small && styles.smallText, { color: textColor(variant) }]}
        numberOfLines={1}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
      >
        {title}
      </Text>
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: theme.spacing.lg,
    minHeight: 52,
    borderRadius: theme.borderRadius.round,
    alignItems: "center",
    justifyContent: "center",
  },
  small: { minHeight: 36, paddingHorizontal: theme.spacing.md },
  primary: { backgroundColor: theme.colors.primary },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.colors.primary },
  danger: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.colors.secondary },
  light: { backgroundColor: theme.colors.white },
  disabled: { opacity: 0.5 },
  text: { fontSize: theme.sizes.body, fontFamily: theme.fonts.bold },
  smallText: { fontSize: theme.sizes.caption },
});

export default Button;
