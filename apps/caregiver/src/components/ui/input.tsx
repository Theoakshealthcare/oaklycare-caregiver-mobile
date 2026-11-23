"use client";

import type React from "react";
import { useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  TouchableOpacity,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Text from "./text";
import FieldLabel from "./field-label";
import { theme, MAX_FONT_SCALE } from "../../constants/theme";
import Box from "./box";
import { globalStyles } from "@/src/constants/styles";

/** Corner radius of every form field (Figma: about 16 pt on a 48 pt field). */
export const FIELD_RADIUS = 16;

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  secureTextEntry?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  secureTextEntry,
  backgroundColor,
  borderColor,
  borderWidth,
  borderRadius,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  const togglePasswordVisibility = () =>
    setIsPasswordVisible(!isPasswordVisible);

  const getBorderColor = () => {
    if (error) return theme.colors.secondary;
    // Figma draws every field with a teal border at rest; focus is shown by the thicker line below.
    return theme.colors.primary;
  };

  return (
    <View style={[containerStyle]}>
      {label && <FieldLabel>{label}</FieldLabel>}

      <View
        style={[
          globalStyles.row,
          {
            borderWidth: borderWidth ?? (isFocused ? 2 : 1),
            borderRadius: borderRadius ?? FIELD_RADIUS,
            backgroundColor: backgroundColor ?? theme.colors.white,
            borderColor: getBorderColor(),
          },
        ]}
      >
        {leftIcon && <View style={{ paddingLeft: 16 }}>{leftIcon}</View>}

        <TextInput
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeftIcon : null,
            rightIcon || secureTextEntry ? styles.inputWithRightIcon : null,
            inputStyle,
          ]}
          placeholderTextColor={theme.colors.textLight}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          {...rest}
        />

        {secureTextEntry && (
          <TouchableOpacity
            style={styles.rightIcon}
            onPress={togglePasswordVisibility}
          >
            <Feather
              name={isPasswordVisible ? "eye" : "eye-off"}
              size={20}
              color={theme.colors.textLight}
            />
          </TouchableOpacity>
        )}

        {rightIcon && !secureTextEntry && (
          <View style={styles.rightIcon}>{rightIcon}</View>
        )}
      </View>

      {error && (
        <Text
          variant="small"
          color={theme.colors.secondary}
          style={styles.error}
        >
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.sizes.body,
    color: theme.colors.text,
  },
  inputWithLeftIcon: {
    paddingLeft: 8,
  },
  inputWithRightIcon: {
    paddingRight: 8,
  },
  leftIcon: {
    paddingLeft: 16,
  },
  rightIcon: {
    paddingRight: 16,
  },
  error: {
    marginTop: 4,
  },
});

export default Input;
