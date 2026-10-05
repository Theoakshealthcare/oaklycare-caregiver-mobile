import { globalStyles } from "@/src/constants/styles"
import { theme } from "@/src/constants/theme"
import type React from "react"
import { View, type ViewProps, type StyleProp, type ViewStyle } from "react-native"

interface BoxProps extends ViewProps {
  flex?: number
  row?: boolean
  center?: boolean
  justifyContent?: "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly"
  alignItems?: "flex-start" | "flex-end" | "center" | "stretch" | "baseline"
  padding?: number
  paddingHorizontal?: number
  paddingVertical?: number
  margin?: number
  marginHorizontal?: number
  marginVertical?: number
  backgroundColor?: string
  style?: StyleProp<ViewStyle>
}

const Box: React.FC<BoxProps> = ({
  flex,
  row,
  center,
  justifyContent,
  alignItems,
  padding,
  paddingHorizontal,
  paddingVertical,
  margin,
  marginHorizontal,
  marginVertical,
  backgroundColor,
  style,
  children,
  ...rest
}) => {
  const boxStyles: StyleProp<ViewStyle> = [
    flex !== undefined && { flex },
    row && globalStyles.row,
    center && globalStyles.center,
    justifyContent && { justifyContent },
    alignItems && { alignItems },
    padding !== undefined && { padding },
    paddingHorizontal !== undefined && { paddingHorizontal },
    paddingVertical !== undefined && { paddingVertical },
    margin !== undefined && { margin },
    marginHorizontal !== undefined && { marginHorizontal },
    marginVertical !== undefined && { marginVertical },
    backgroundColor && { backgroundColor },
    style,
  ]

  return (
    <View style={[{padding: theme.sizes.font}, boxStyles]} {...rest}>
      {children}
    </View>
  )
}

export default Box
