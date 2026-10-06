import type React from "react"
import { View, type ViewStyle, type StyleProp } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { theme } from "../../constants/theme"

export type IconName = keyof typeof Ionicons.glyphMap

interface IconProps {
  name: IconName
  size?: number
  color?: string
  style?: StyleProp<ViewStyle>
  backgroundColor?: string
  circle?: boolean
  circleSize?: number
}

const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = theme.colors.text,
  style,
  backgroundColor,
  circle = false,
  circleSize,
}) => {
  const getContainerStyle = () => {
    if (!circle && !backgroundColor) return null

    const containerStyle: ViewStyle = {}

    if (backgroundColor) {
      containerStyle.backgroundColor = backgroundColor
    }

    if (circle) {
      const calculatedSize = circleSize || size * 1.8
      containerStyle.width = calculatedSize
      containerStyle.height = calculatedSize
      containerStyle.borderRadius = calculatedSize / 2
      containerStyle.justifyContent = "center"
      containerStyle.alignItems = "center"
    }

    return containerStyle
  }

  const containerStyle = getContainerStyle()

  if (containerStyle) {
    return (
      <View style={[containerStyle, style]}>
        <Ionicons name={name} size={size} color={color} />
      </View>
    )
  }

  return <Ionicons name={name} size={size} color={color} style={style} />
}

export default Icon
