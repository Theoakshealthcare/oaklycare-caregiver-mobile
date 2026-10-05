import type React from "react"
import type { ReactNode } from "react"
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  type TouchableOpacityProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  Pressable,
} from "react-native"
import { theme } from "../../constants/theme"

export type ButtonVariant = "primary" | "secondary" | "neutral" | "ghost" | "outline"

interface ButtonProps extends TouchableOpacityProps {
  title: string
  variant?: ButtonVariant
  loading?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  fullWidth?: boolean
  leftIcon?: ReactNode
}

const Button: React.FC<ButtonProps> = ({
  title,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
  leftIcon,
  ...rest
}) => {
  const getButtonStyles = () => {
    const baseStyle:any = [styles.button]

    if (fullWidth) {
      baseStyle.push(styles.fullWidth)
    }

    switch (variant) {
      case "primary":
        baseStyle.push(styles.primaryButton)
        break
      case "secondary":
        baseStyle.push(styles.secondaryButton)
        break
      case "neutral":
        baseStyle.push(styles.neutralButton)
        break
      case "ghost":
        baseStyle.push(styles.ghostButton)
        break
      case "outline":
        baseStyle.push(styles.outlineButton)
        break
    }

    if (disabled) {
      baseStyle.push(styles.disabledButton)
    }

    return baseStyle
  }

  const getTextStyles = () => {
    const baseStyle: any = [styles.text]

    switch (variant) {
      case "primary":
        baseStyle.push(styles.primaryText)
        break
      case "secondary":
        baseStyle.push(styles.secondaryText)
        break
      case "neutral":
        baseStyle.push(styles.neutralText)
        break
      case "ghost":
      case "outline":
        baseStyle.push(styles.ghostText)
        break
    }

    if (disabled) {
      baseStyle.push(styles.disabledText)
    }

    return baseStyle
  }

  return (
    <Pressable style={[getButtonStyles(), style]} disabled={disabled || loading} {...rest}>
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? theme.colors.white : theme.colors.primary} size="small" />
      ) : (
        <>
          {leftIcon}
          <Text style={[getTextStyles(), textStyle]}>{title}</Text>
        </>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: theme.sizes.large,
    paddingHorizontal: theme.sizes.extraLarge,
    borderRadius: theme.borderRadius.xxl,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidth: {
    width: "100%",
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  secondaryButton: {
    backgroundColor: theme.colors.secondary,
  },
  neutralButton: {
    backgroundColor: theme.colors.white,
  },
  ghostButton: {
    backgroundColor: "transparent",
  },
  outlineButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  disabledButton: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
  primaryText: {
    color: theme.colors.white,
  },
  secondaryText: {
    color: theme.colors.white,
  },
  neutralText: {
    color: theme.colors.primary,
  },
  ghostText: {
    color: theme.colors.primary,
  },
  disabledText: {
    color: theme.colors.white,
  },
})

export default Button
