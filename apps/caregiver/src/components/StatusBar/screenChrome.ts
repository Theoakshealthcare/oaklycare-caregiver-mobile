import { useEffect } from "react"
import { useStore } from "zustand"
import { createStore } from "zustand/vanilla"

import { theme } from "../../constants/theme"

/**
 * The colours of the two safe-area bands the app draws around every screen: the strip under the status bar and the strip
 * under the home indicator. The signed-in app keeps its teal bands; the onboarding screens (welcome slides, sign-up,
 * setup, identity) are edge-to-edge white with dark status-bar icons, as in the Figma frames, and a welcome slide lets its
 * coloured panel run to the bottom edge.
 */
export interface ScreenChrome {
  top: string
  bottom: string
  /** Status-bar icon colour: "dark-content" on white bands, "light-content" on teal. */
  barStyle: "dark-content" | "light-content"
}

export const TEAL_CHROME: ScreenChrome = { top: theme.colors.primary, bottom: theme.colors.primary, barStyle: "light-content" }
/** The signed-in app: a teal strip under the status bar for the screens with a teal header, white under the home indicator (Figma draws the bottom bar on white). */
export const APP_TEAL_TOP_CHROME: ScreenChrome = { top: theme.colors.primary, bottom: theme.colors.white, barStyle: "light-content" }

/** The signed-in screens whose header is teal in Figma (Home, Bookings and Vitals tabs, the chat, the care plan hub); every other screen is edge-to-edge white with dark status-bar icons. */
const TEAL_TOP_ROUTES = new Set(["BottomNavigation", "ChatScreen", "CarePlans"])
/** Care plan pages sit on Figma's off-white (#F9FBFA), so the strips above and below match it instead of showing a faint white band. */
const CARE_BACKGROUND_ROUTES = new Set(["CarePlanDetails", "CarePlanProgress", "CarePlanTemplate", "CarePlanClients", "CreateCarePlan", "CarePlanSuccess", "ChatScreen"])
const CARE_BACKGROUND_CHROME: ScreenChrome = { top: theme.colors.careBackground, bottom: theme.colors.careBackground, barStyle: "dark-content" }

export const chromeForRoute = (routeName: string): ScreenChrome => {
  if (TEAL_TOP_ROUTES.has(routeName)) return routeName === "ChatScreen" ? { ...APP_TEAL_TOP_CHROME, bottom: theme.colors.primaryLight } : APP_TEAL_TOP_CHROME
  return CARE_BACKGROUND_ROUTES.has(routeName) ? CARE_BACKGROUND_CHROME : WHITE_CHROME
}

export const WHITE_CHROME: ScreenChrome = { top: theme.colors.white, bottom: theme.colors.white, barStyle: "dark-content" }

interface ChromeState extends ScreenChrome {
  /** A screen's own bottom colour (the welcome slide's panel); wins over `bottom` while set. */
  bottomOverride: string | null
}

export const chromeStore = createStore<ChromeState>(() => ({ ...TEAL_CHROME, bottomOverride: null }))

/** The colours to draw now. */
export const useChrome = (): ScreenChrome => {
  const { top, bottom, barStyle, bottomOverride } = useStore(chromeStore)
  return { top, bottom: bottomOverride ?? bottom, barStyle }
}

/** Sets the bands while the calling component is mounted (and whenever the colours change). */
export function useScreenChrome(chrome: ScreenChrome): void {
  const { top, bottom, barStyle } = chrome
  useEffect(() => {
    chromeStore.setState({ top, bottom, barStyle })
  }, [top, bottom, barStyle])
}

/** Paints only the band under the home indicator while mounted; `null` leaves it to the screen chrome. */
export function useBottomBand(color: string | null): void {
  useEffect(() => {
    chromeStore.setState({ bottomOverride: color })
    return () => chromeStore.setState({ bottomOverride: null })
  }, [color])
}
