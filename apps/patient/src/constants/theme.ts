import { Dimensions } from "react-native"

const { width, height } = Dimensions.get("window")

/** Width the screens were designed at (iPhone 15/16 class). */
export const DESIGN_WIDTH = 390

/**
 * Moderate, damped scale factor from the window WIDTH (never height): half of the relative
 * difference from the design width, clamped to 0.9 to 1.15. Small Androids shrink a little, large
 * phones and small tablets grow a little, never more. The OS text size is applied separately by
 * React Native (capped with maxFontSizeMultiplier), so it is deliberately not divided out here.
 */
export const scaleFactor = (windowWidth: number): number =>
  Math.min(1.15, Math.max(0.9, 1 + (windowWidth / DESIGN_WIDTH - 1) * 0.5))

const factor = scaleFactor(width)
const scale = (size: number) => Math.round(size * factor * 2) / 2

/** Cap for the OS accessibility text size, so large settings do not break layouts. */
export const MAX_FONT_SCALE = 1.3

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
    successLight: "#E8F5E9",
    error: "#F44336",
    warning: "#FFC107",
    info: "#2196F3",
    errorText: "#721C24",
    warningText: "#856404",
    infoText: "#0C5460",
    primaryLight: "#F2FDFD",
    soft: "#F8F8FC",
    /** Floating bottom bar. */
    dark: "#1D1F24",
    warningLight: "#FDF6EC",
    errorLight: "#FCEDEB",
    /**
     * Green of the confirmation toast and title of the success pages. The Figma PNGs are exported in Display P3, so the raw
     * pixel values (#65C466, #43976F) are not the sRGB values to use; these are the converted ones (same finding as the
     * caregiver app). The brand teal and coral already match the design, do not change them from pixel readings.
     */
    /** Page background of Home (Figma: a faint cool white behind the white cards). */
    pageTint: "#F9FBFB",
    toast: "#35C759",
    successTitle: "#00996C",
  },
  spacing: {
    xs: scale(4),
    sm: scale(8),
    md: scale(16),
    lg: scale(24),
    xl: scale(32),
    xxl: scale(48),
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 20,
    round: 9999,
  },
  /** The only font sizes in the app (design values, scaled by width). Raw `fontSize:` numbers are banned. */
  sizes: {
    /** Legal fine print (the terms line under sign-up; Figma 11 pt). */
    fine: scale(11),
    caption: scale(13),
    body: scale(15),
    subtitle: scale(17),
    title: scale(20),
    /** Page title on the auth screens ("Create Your Account", "Login"; Figma 22 pt). */
    pageTitle: scale(22),
    heading: scale(24),
    display: scale(28),
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

/** Line height for a font size from the scale. */
export const lineHeightFor = (fontSize: number): number => Math.round(fontSize * 1.35)
