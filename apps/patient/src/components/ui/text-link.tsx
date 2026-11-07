import type React from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";

import { theme } from "@/src/constants/theme";

import Text from "./text";

interface TextLinkProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  center?: boolean;
  /** Coral instead of teal (a destructive step). */
  danger?: boolean;
  /** White, for links on a coloured panel. */
  light?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** An inline text button ("Forgot password?", "Resend code"). */
const TextLink: React.FC<TextLinkProps> = ({ label, onPress, disabled, center, danger, light, style }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: Boolean(disabled) }}
    disabled={disabled}
    hitSlop={8}
    onPress={onPress}
    style={style}
  >
    <Text
      variant="small"
      weight="bold"
      center={center}
      color={light ? theme.colors.white : disabled ? theme.colors.textLight : danger ? theme.colors.secondary : theme.colors.primary}
    >
      {label}
    </Text>
  </Pressable>
);

export default TextLink;
