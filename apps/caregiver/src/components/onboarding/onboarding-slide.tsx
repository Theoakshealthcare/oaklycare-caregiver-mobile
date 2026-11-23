import type React from "react"
import { View, Animated, type ImageSourcePropType } from "react-native"
import { theme } from "../../constants/theme"
import Box from "../ui/box"
import Text from "../ui/text"
import Button from "../ui/button"
import Image from "../ui/image"
import ScreenSize from "@/src/hooks/screen-size"

export interface OnboardingSlideProps {
  title: string
  subtitle: string
  description: string
  image: ImageSourcePropType
  backgroundColor: string
  textColor?: string
  onNext?: () => void
  onSkip?: () => void
  onLogin?: () => void
  renderDots: () => React.ReactNode
  scrollX?: Animated.Value
  index?: number
}

const OnboardingSlide: React.FC<OnboardingSlideProps> = ({
  title,
  subtitle,
  description,
  image,
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

  // Calculate animation values based on scroll position
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width]

  // Image animations
  const imageScale =
    scrollX?.interpolate({
      inputRange,
      outputRange: [0.8, 1, 0.8],
      extrapolate: "clamp",
    }) || 1

  const imageTranslateY =
    scrollX?.interpolate({
      inputRange,
      outputRange: [30, 0, 30],
      extrapolate: "clamp",
    }) || 0

  const imageOpacity =
    scrollX?.interpolate({
      inputRange,
      outputRange: [0.7, 1, 0.7],
      extrapolate: "clamp",
    }) || 1

  return (
    <View style={[{ flex: 1, width: width }]}>
      <Box style={{ height: height * 0.5, backgroundColor: theme.colors.white, padding: 0 }}>
        <Button
          title="Skip"
          variant="ghost"
          textStyle={{ color: theme.colors.primary }}
          onPress={onSkip}
          style={{ position: "absolute", zIndex: 10, top: theme.spacing.sm, right: 0 }}
        />

        <Animated.View
          style={{
            width: width * 0.9,
            height: width * 0.8,
            position: "absolute",
            right: -30,
            bottom: 0,
            transform: [{ scale: imageScale }, { translateY: imageTranslateY }],
            opacity: imageOpacity,
          }}
        >
          <Image source={image} containerStyle={{ width: "100%", height: "100%" }} contentFit="contain" />
        </Animated.View>
      </Box>

      <Box style={{ height: height * 0.5, backgroundColor, gap: theme.spacing.md }} paddingVertical={theme.spacing.lg}>
        {renderDots()}

        <View>
          <Text variant="h2" weight="bold" color={textColor} center>
            {title}
          </Text>
          <Text variant="h2" weight="bold" color={textColor} center>
            {subtitle}
          </Text>
        </View>

        <Text variant="body" color={textColor} center>
          {description}
        </Text>

        <Box style={{ alignItems: "center" }}>
          <Button title="Get Started" variant={"neutral"} style={{ width: "100%" }} onPress={onNext} />
        </Box>

        <Box style={{ marginTop: -20 }} row justifyContent="center">
            <Text variant="small" color={textColor}>
              {"Already have an account ? "}
            </Text>
            <Text
              variant="small"
              weight="bold"
              color={textColor}
              onPress={onLogin}
              style={{ textDecorationLine: "underline" }}
            >
              Login
            </Text>
          </Box>
      </Box>
    </View>
  )
}

export default OnboardingSlide
