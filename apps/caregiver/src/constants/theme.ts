import { PixelRatio, Dimensions } from "react-native"

const fontScale = PixelRatio.getFontScale();
const getFontSize = (size: number) => size / fontScale;

const { width, height } = Dimensions.get("window")

export const theme = {
  colors: {
    primary: "#168283",
    secondary: "#FD5E52",
    secondaryLight: "#FBEFE9",
    white: "#FFFFFF",
    blue: "#0066F5",
    text: "#333333",
    textLight: "#757575",
    border: "#E0E0E0",
    background: "#F5F5F5",
    success: "#4CAF50",
    error: "#F44336",
    warning: "#FFC107",
    info: "#2196F3",
    primaryLight: "#F2FDFD",
    soft: "#F8F8FC"
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 20,
    round: 9999,
  },
  sizes: {
    nano: getFontSize(4),
    base: getFontSize(8),
    small: getFontSize(height * 0.015),
    font: getFontSize(height * 0.018),
    medium: getFontSize(height * 0.02),
    large: getFontSize(height * 0.022),
    extraLarge: getFontSize(height * 0.026),
    xxl: getFontSize(height * 0.028),
    xxxl: getFontSize(28),
    button: getFontSize(48),
  },
  shadows: {
    small: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,
      elevation: 2,
    },
    medium: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.23,
      shadowRadius: 2.62,
      elevation: 4,
    },
    large: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4.65,
      elevation: 8,
    },
  },
  fonts: {
    black: "gt-black",
    bold: "gt-bold",
    medium: "gt-medium",
    regular: "gt-regular"
  }
}

export const screenSize = {
  width,
  height,
  isSmallDevice: width < 375,
}
