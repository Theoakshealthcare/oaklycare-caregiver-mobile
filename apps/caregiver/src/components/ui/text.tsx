import type React from "react"
import { Text as RNText, StyleSheet, type TextProps as RNTextProps, type StyleProp, type TextStyle, View } from "react-native"
import { theme, lineHeightFor, MAX_FONT_SCALE } from "../../constants/theme"
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
      <RNText style={[getTextStyles(), style]} maxFontSizeMultiplier={MAX_FONT_SCALE} {...rest}>
        {children}
      </RNText>
    </View>
  )
}

const styles = StyleSheet.create({
  h1: {
    fontSize: theme.sizes.display,
    lineHeight: lineHeightFor(theme.sizes.display),
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
  },
  h2: {
    fontSize: theme.sizes.heading,
    lineHeight: lineHeightFor(theme.sizes.heading),
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
  },
  h3: {
    fontSize: theme.sizes.title,
    lineHeight: lineHeightFor(theme.sizes.title),
    color: theme.colors.text,
    fontFamily: theme.fonts.medium,
  },
  body: {
    fontSize: theme.sizes.body,
    lineHeight: lineHeightFor(theme.sizes.body),
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
  small: {
    fontSize: theme.sizes.caption,
    lineHeight: lineHeightFor(theme.sizes.caption),
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
  caption: {
    fontSize: theme.sizes.caption,
    lineHeight: lineHeightFor(theme.sizes.caption),
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
