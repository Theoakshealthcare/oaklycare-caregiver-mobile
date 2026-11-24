import type React from "react"
import { Text as RNText, StyleSheet, type TextProps as RNTextProps, type StyleProp, type TextStyle, type ViewStyle, View } from "react-native"
import { theme, lineHeightFor, MAX_FONT_SCALE } from "../../constants/theme"
import Animated from "react-native-reanimated"
import useTextAnimation from "@/src/hooks/use-text-animation"

export type TextVariant = "h1" | "h2" | "h3" | "subtitle" | "page" | "body" | "compact" | "small" | "label" | "fine" | "micro" | "caption"
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
      case "subtitle":
        baseStyle.push(styles.subtitle)
        break
      case "page":
        baseStyle.push(styles.page)
        break
      case "fine":
        baseStyle.push(styles.fine)
        break
      case "body":
        baseStyle.push(styles.body)
        break
      case "compact":
        baseStyle.push(styles.compact)
        break
      case "label":
        baseStyle.push(styles.label)
        break
      case "micro":
        baseStyle.push(styles.micro)
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

  // The text sits in a plain wrapper View, so a flex style handed to the Text would land on the inner text only: in a row
  // the wrapper kept its full width and long lines ran off the screen edge (the AI Notetaker consent line). The flex
  // properties therefore go on the wrapper, where the row can shrink and wrap them.
  const flat = StyleSheet.flatten(style) as TextStyle | undefined
  const wrapperStyle: ViewStyle | undefined = flat
    ? {
        ...(flat.flex !== undefined ? { flex: flat.flex } : null),
        ...(flat.flexGrow !== undefined ? { flexGrow: flat.flexGrow } : null),
        ...(flat.flexShrink !== undefined ? { flexShrink: flat.flexShrink } : null),
        ...(flat.alignSelf !== undefined ? { alignSelf: flat.alignSelf } : null),
      }
    : undefined

  return (
    <View style={wrapperStyle}>
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
  subtitle: {
    fontSize: theme.sizes.subtitle,
    lineHeight: lineHeightFor(theme.sizes.subtitle),
    color: theme.colors.text,
    fontFamily: theme.fonts.medium,
  },
  page: {
    fontSize: theme.sizes.pageTitle,
    lineHeight: lineHeightFor(theme.sizes.pageTitle),
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
  },
  fine: {
    fontSize: theme.sizes.fine,
    lineHeight: lineHeightFor(theme.sizes.fine) + 2,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
  body: {
    fontSize: theme.sizes.body,
    lineHeight: lineHeightFor(theme.sizes.body),
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
  compact: {
    fontSize: theme.sizes.compact,
    lineHeight: lineHeightFor(theme.sizes.compact),
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
  label: {
    fontSize: theme.sizes.label,
    lineHeight: lineHeightFor(theme.sizes.label),
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
  },
  micro: {
    fontSize: theme.sizes.micro,
    lineHeight: lineHeightFor(theme.sizes.micro),
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
