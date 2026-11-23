
import { useState, useRef, useEffect } from "react"
import { StyleSheet, FlatList, View, Animated, type ViewToken } from "react-native"
import { theme } from "../constants/theme"
import OnboardingSlide from "../components/onboarding/onboarding-slide"
import { useAnimation } from "../hooks/use-animation"
import Navigation from "../hooks/use-navigation"
import ScreenSize from "../hooks/screen-size"
import { globalStyles } from "../constants/styles"
import { useBottomBand } from "../components/StatusBar/screenChrome"

/** The four welcome slides, in the words of the Figma frames. Slide 3 sits on the coral panel; the others on teal. */
export const slides = [
  {
    id: "1",
    title: "AI-Powered Personalized",
    subtitle: "Smart Care, Tailored for You.",
    description: "Our AI-driven platform ensures the right care, at the right time.",
    descriptionLines: ["Our AI-driven platform ensures the", "right care, at the right time."],
    dotsTop: 47,
    image: require("../../assets/images/onboarding/onboarding-1.png"),
    art: { left: 34, width: 348, top: 117, aspect: 1391 / 1308 },
    backgroundColor: theme.colors.primary,
  },
  {
    id: "2",
    title: "Remote Monitoring &",
    subtitle: "Real-Time Updates.",
    description: "Track care sessions, chat with nurses, and receive real-time updates.",
    descriptionLines: ["Track care sessions, chat with nurses, and", "receive real-time updates."],
    dotsTop: 44,
    image: require("../../assets/images/onboarding/onboarding-2.png"),
    art: { left: 4, width: 413, top: 75, aspect: 1687 / 1556 },
    backgroundColor: theme.colors.primary,
  },
  {
    id: "3",
    title: "Oakly FallGuard™ Fall Predictor–",
    subtitle: "Predict. Prevent. Protect.",
    description: "Stay ahead of falls with real-time monitoring and proactive protection.",
    headlineLines: ["Oakly FallGuard™ Fall", "Predictor– Predict.", "Prevent. Protect."],
    descriptionLines: ["Stay ahead of falls with real-time monitoring", "and proactive protection."],
    dotsTop: 27,
    image: require("../../assets/images/onboarding/onboarding-3.png"),
    art: { left: 18, width: 386, top: 144, aspect: 1288 / 1442 },
    backgroundColor: theme.colors.secondary,
  },
  {
    id: "4",
    title: "On-Demand Nursing Care",
    subtitle: "Book a Nurse Instantly.",
    description: "Reliable, professional home nursing—just a tap away.",
    descriptionLines: ["Reliable, professional home nursing—just a", "tap away."],
    dotsTop: 44,
    image: require("../../assets/images/onboarding/onboarding-4.png"),
    art: { left: 18, width: 398, top: 97, aspect: 1706 / 1504 },
    backgroundColor: theme.colors.primary,
  },
]

const OnboardingScreen = () => {
  const {width} = ScreenSize()
  const {navigation} = Navigation()
  
  const [currentIndex, setCurrentIndex] = useState(0)
  // The coloured panel runs to the bottom edge of the screen: paint the band under the home indicator in its colour.
  const [focused, setFocused] = useState(true)
  useEffect(() => {
    // Optional calls: the screen is also rendered without a real navigator in the unit tests.
    const onFocus = navigation.addListener?.("focus", () => setFocused(true))
    const onBlur = navigation.addListener?.("blur", () => setFocused(false))
    return () => {
      onFocus?.()
      onBlur?.()
    }
  }, [navigation])
  useBottomBand(focused ? slides[currentIndex].backgroundColor : null)
  const scrollX = useRef(new Animated.Value(0)).current

  // "Get Started" is on every slide and always opens sign-up (Figma); the slides themselves are swiped.
  const handleGetStarted = () => {
    navigation.navigate("CreateAccount")
  }

  const handleSkip = () => {
    navigation.navigate("CreateAccount")
  }

  const handleLogin = () => {
    navigation.navigate("Login")
  }

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })

  const handleViewableItemsChanged = ({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const index = viewableItems[0]?.index
    if (index != null) {
      setCurrentIndex(index)
    }
  }

  const renderDots = () => {
    return (
      <View style={styles.pagination}>
        {slides.map((_, index) => {
          const inputRange = [(index - 1) * width, index * width, (index + 1) * width]

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.4, 1, 0.4],
            extrapolate: "clamp",
          })

          return (
            <Animated.View
              key={`dot-${index}`}
              style={[
                styles.dot,
                { opacity },
              ]}
            />
          )
        })}
      </View>
    )
  }

  return (
    <View style={{flex: 1}}>
      <FlatList
        data={slides}
        renderItem={({ item, index }) => (
          <OnboardingSlide
            title={item.title}
            subtitle={item.subtitle}
            description={item.description}
            headlineLines={"headlineLines" in item ? item.headlineLines : undefined}
            descriptionLines={item.descriptionLines}
            dotsTop={item.dotsTop}
            image={item.image}
            art={item.art}
            backgroundColor={item.backgroundColor}
            onNext={handleGetStarted}
            onSkip={handleSkip}
            onLogin={handleLogin}
            renderDots={renderDots}
            scrollX={scrollX}
            index={index}
          />
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        keyExtractor={(item) => item.id}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.white,
    marginHorizontal: 3.5,
  },
})

export default OnboardingScreen
