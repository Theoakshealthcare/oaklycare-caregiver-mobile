import type React from "react"
import { View, Animated, type ImageSourcePropType } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { scaleFactor, theme } from "../../constants/theme"
import Text from "../ui/text"
import Button from "../ui/button"
import Image from "../ui/image"
import ScreenSize from "@/src/hooks/screen-size"

/** Where the artwork sits in the Figma frame, in Figma pixels (a 417 px wide frame): left, width and top from the frame's top-left. */
export interface ArtPlacement {
  left: number
  width: number
  top: number
  /** Height / width of the artwork file. */
  aspect: number
}

export interface OnboardingSlideProps {
  title: string
  subtitle: string
  description: string
  /** The headline and the sub-text broken into lines as the Figma frame breaks them; defaults to [title, subtitle] / [description]. */
  headlineLines?: string[]
  descriptionLines?: string[]
  /** Distance from the top of the panel to the centre of the pager dots, in Figma pixels. */
  dotsTop?: number
  image: ImageSourcePropType
  art: ArtPlacement
  backgroundColor: string
  textColor?: string
  onNext?: () => void
  onSkip?: () => void
  onLogin?: () => void
  renderDots: () => React.ReactNode
  scrollX?: Animated.Value
  index?: number
}

/** The Figma frame is 417 px wide in the exports (375 pt) and 905 px tall; the coloured panel starts 509 px below its top. */
const FRAME_W = 417
const FRAME_H = 905
const PANEL_TOP = 572 - 63

const OnboardingSlide: React.FC<OnboardingSlideProps> = ({
  title,
  subtitle,
  description,
  headlineLines,
  descriptionLines,
  dotsTop = 47,
  image,
  art,
  backgroundColor,
  textColor = theme.colors.white,
  onNext,
  onSkip,
  onLogin,
  renderDots,
  scrollX,
  index = 0,
}) => {
  const { height, width } = ScreenSize()
  const insets = useSafeAreaInsets()

  // One scale for everything drawn from the Figma frame: by width, or by height on a short phone.
  const k = Math.min(width / FRAME_W, height / FRAME_H)
  // The white part ends where the panel starts in the frame (56% of the screen); the root already sits under the status bar.
  const artAreaHeight = (PANEL_TOP / FRAME_H) * height - insets.top

  // Calculate animation values based on scroll position
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width]

  const imageOpacity =
    scrollX?.interpolate({
      inputRange,
      outputRange: [0.7, 1, 0.7],
      extrapolate: "clamp",
    }) || 1

  const lines = headlineLines ?? [title, subtitle]
  const descLines = descriptionLines ?? [description]
  // The theme sizes are damped by width; the slide text is scaled fully with the width instead, so it keeps its share of the screen as in Figma.
  const s = width / 375
  const full = s / scaleFactor(width)
  const body = { fontSize: theme.sizes.caption * full * 1.05, lineHeight: 20 * s }

  return (
    <View style={{ flex: 1, width }}>
      <View style={{ height: artAreaHeight, backgroundColor: theme.colors.white, overflow: "hidden" }}>
        <Button
          title="Skip"
          variant="ghost"
          textStyle={{ color: theme.colors.primary }}
          onPress={onSkip}
          style={{ position: "absolute", zIndex: 10, top: theme.spacing.sm, right: theme.spacing.sm }}
        />

        <Animated.View
          style={{
            position: "absolute",
            left: art.left * k,
            top: art.top * k - insets.top,
            width: art.width * k,
            height: art.width * k * art.aspect,
            opacity: imageOpacity,
          }}
        >
          <Image source={image} containerStyle={{ width: "100%", height: "100%" }} contentFit="contain" showLoader={false} />
        </Animated.View>
      </View>

      <View style={{ flex: 1, backgroundColor, alignItems: "center", paddingTop: Math.max(0, dotsTop * k - 4) }}>
        {renderDots()}

        <View style={{ marginTop: 22 * k, alignItems: "center" }}>
          {lines.map((line) => (
            <Text key={line} variant="h2" weight="bold" color={textColor} center style={{ fontSize: theme.sizes.heading * full * 1.02, lineHeight: 29 * s }}>
              {line}
            </Text>
          ))}
        </View>

        <View style={{ marginTop: 8 * k, alignItems: "center" }}>
          {descLines.map((line) => (
            <Text key={line} variant="small" color={textColor} center style={body}>
              {line}
            </Text>
          ))}
        </View>

        <Button
          title="Get Started"
          variant="neutral"
          style={{ width: "65%", minHeight: 60, marginTop: 24 * k }}
          onPress={onNext}
        />

        <View style={{ marginTop: 20 * k, flexDirection: "row", justifyContent: "center" }}>
          <Text variant="body" color={textColor} style={{ fontSize: theme.sizes.body * full * 1.05 }}>
            {"Already have an account ? "}
          </Text>
          <Text
            variant="body"
            weight="medium"
            color={textColor}
            onPress={onLogin}
            style={{ fontSize: theme.sizes.body * full * 1.05, textDecorationLine: "underline" }}
          >
            Login
          </Text>
        </View>
      </View>
    </View>
  )
}

export default OnboardingSlide
