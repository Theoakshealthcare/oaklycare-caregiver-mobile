import { Platform, type PlatformIOSStatic } from "react-native"

interface ExtendedPlatformIOSStatic extends PlatformIOSStatic {
  isPad: boolean
}

const extendedPlatform = Platform as {
  OS: string
  select: <T extends Record<string, any>>(specifics: T) => T[keyof T]
  Version: number
  ios?: ExtendedPlatformIOSStatic
}

export const platform = {
  isIOS: Platform.OS === "ios",
  isAndroid: Platform.OS === "android",
  isWeb: Platform.OS === "web",
  version: Platform.Version,
  isIpad: Platform.OS === "ios" && extendedPlatform.ios?.isPad,
  select: Platform.select,
}
