import type React from "react";
import { Text as RNText, StyleSheet, type StyleProp, type TextProps as RNTextProps, type TextStyle } from "react-native";

import { lineHeightFor, MAX_FONT_SCALE, theme } from "../../constants/theme";

export type TextVariant = "h1" | "h2" | "h3" | "body" | "small";
export type TextWeight = "regular" | "medium" | "bold";

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  weight?: TextWeight;
  color?: string;
  style?: StyleProp<TextStyle>;
  center?: boolean;
}

const Text: React.FC<TextProps> = ({ variant = "body", weight = "regular", color, style, center, children, ...rest }) => (
  <RNText
    style={[styles[variant], { fontFamily: theme.fonts[weight] }, center && styles.center, color ? { color } : null, style]}
    maxFontSizeMultiplier={MAX_FONT_SCALE}
    {...rest}
  >
    {children}
  </RNText>
);

const styles = StyleSheet.create({
  h1: { fontSize: theme.sizes.display, lineHeight: lineHeightFor(theme.sizes.display), color: theme.colors.text },
  h2: { fontSize: theme.sizes.heading, lineHeight: lineHeightFor(theme.sizes.heading), color: theme.colors.text },
  h3: { fontSize: theme.sizes.title, lineHeight: lineHeightFor(theme.sizes.title), color: theme.colors.text },
  body: { fontSize: theme.sizes.body, lineHeight: lineHeightFor(theme.sizes.body), color: theme.colors.text },
  small: { fontSize: theme.sizes.caption, lineHeight: lineHeightFor(theme.sizes.caption), color: theme.colors.text },
  center: { textAlign: "center" },
});

export default Text;
