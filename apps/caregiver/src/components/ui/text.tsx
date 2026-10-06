import type React from "react"
import { Text as RNText, StyleSheet, type TextProps as RNTextProps, type StyleProp, type TextStyle, View } from "react-native"
import { theme } from "../../constants/theme"
import Animated from "react-native-reanimated"
import useTextAnimation from "@/src/hooks/use-text-animation"

export type TextVariant = "h1" | "h2" | "h3" | "body" | "small" | "caption"
export type TextWeight = "regular" | "medium" | "bold"

interface TextProps extends RNTextProps {
  variant?: TextVariant
  weight?: TextWeight
  color?: string
  style?: StyleProp<TextStyle>
  center?: boolean
}

const Text: React.FC<TextProps> = ({
  variant = "body",
  weight = "regular",
  color,
  style,
  center = false,
  children,
  ...rest
}) => {
  const {textStyle} = useTextAnimation()

  const getTextStyles = () => {
    const baseStyle = []

    // Variant styles
    switch (variant) {
      case "h1":
        baseStyle.push(styles.h1)
        break
      case "h2":
        baseStyle.push(styles.h2)
        break
      case "h3":
        baseStyle.push(styles.h3)
        break
      case "body":
        baseStyle.push(styles.body)
        break
      case "small":
        baseStyle.push(styles.small)
        break
      case "caption":
        baseStyle.push(styles.caption)
        break
    }

    // Weight styles
    switch (weight) {
      case "regular":
        baseStyle.push(styles.regular)
        break
      case "medium":
        baseStyle.push(styles.medium)
        break
      case "bold":
        baseStyle.push(styles.bold)
        break
    }

    // Text alignment
    if (center) {
      baseStyle.push(styles.center)
    }

    // Custom color
    if (color) {
      baseStyle.push({ color })
    }

    return baseStyle
  }

  return (
    <View>
      <RNText style={[getTextStyles(), style, {}]} {...rest}>
        {children}
      </RNText>
    </View>
  )
}

const styles = StyleSheet.create({
  h1: {
    fontSize: theme.sizes.xxxl,
    lineHeight: 34,
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
  },
  h2: {
    fontSize: theme.sizes.xxl,
    lineHeight: 30,
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
  },
  h3: {
    fontSize: theme.sizes.extraLarge,
    lineHeight: 26,
    color: theme.colors.text,
    fontFamily: theme.fonts.medium,
  },
  body: {
    fontSize: theme.sizes.medium,
    lineHeight: 22,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
  small: {
    fontSize: theme.sizes.font,
    lineHeight: 20,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
  caption: {
    fontSize: theme.sizes.small,
    lineHeight: 18,
    color: theme.colors.textLight,
  },
  regular: {
    fontFamily: theme.fonts.regular,
  },
  medium: {
    fontFamily: theme.fonts.medium,
  },
  bold: {
    fontFamily: theme.fonts.bold,
  },
  center: {
    textAlign: "center",
  },
})

export default Text
