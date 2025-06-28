"use client"

import { useEffect } from "react"
import { View, StyleSheet, Animated, Easing } from "react-native"
import { theme } from "../constants/theme"
import Text from "../components/ui/text"
import { useAnimation } from "../hooks/use-animation"

const SplashScreen = () => {
  const fadeAnim = useAnimation(0)
  const scaleAnim = useAnimation(0.8)
  const logoRotate = useAnimation(0)

  useEffect(() => {
    // Start animations in sequence
    Animated.sequence([
      // Fade in and scale up
      Animated.parallel([
        fadeAnim.animate(1, { duration: 800, easing: Easing.ease }),
        scaleAnim.animate(1, { duration: 800, easing: Easing.elastic(1.2) }),
      ]),

      // Rotate logo slightly
      logoRotate.animate(1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
    ]).start()
  }, [])

  // Interpolate rotation for logo animation
  const spin = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  })

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim.value,
            transform: [{ scale: scaleAnim.value }, { rotate: spin }],
          },
        ]}
      >
        <View style={styles.logo}>
          <Text variant="h1" weight="bold" color={theme.colors.white}>
            O
          </Text>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: fadeAnim.value,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Text variant="h2" weight="bold" color={theme.colors.white}>
          Oakly Health
        </Text>
        <Text variant="body" color={theme.colors.white} style={styles.tagline}>
          Smart care, when you need it
        </Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.primary,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.secondary,
    justifyContent: "center",
    alignItems: "center",
    ...theme.shadows.medium,
  },
  textContainer: {
    alignItems: "center",
  },
  tagline: {
    marginTop: 8,
    opacity: 0.8,
  },
})

export default SplashScreen
