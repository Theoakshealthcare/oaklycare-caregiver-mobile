
import { useState, useRef } from "react"
import { StyleSheet, FlatList, View, Animated, type ViewToken } from "react-native"
import { theme } from "../constants/theme"
import OnboardingSlide from "../components/onboarding/onboarding-slide"
import { useAnimation } from "../hooks/use-animation"
import Navigation from "../hooks/use-navigation"
import ScreenSize from "../hooks/screen-size"
import { globalStyles } from "../constants/styles"
import FocusedStatusBar from "../components/StatusBar/FocusedStatusBar"

const slides = [
  {
    id: "1",
    title: "AI-Powered Personalized Care",
    subtitle: "Smart Care, Tailored for You.",
    description: "Our AI-driven platform ensures the right care, at the right time.",
    image: require("../../assets/images/onboarding/onboarding-1.png"),
    backgroundColor: theme.colors.primary,
  },
  {
    id: "2",
    title: "Remote Monitoring &",
    subtitle: "Real-Time Updates.",
    description: "Track care sessions, chat with nurses, and receive real-time updates.",
    image: require("../../assets/images/onboarding/onboarding-2.png"),
    backgroundColor: theme.colors.primary,
  },
  {
    id: "3",
    title: "Oakly FallGuard™ Fall",
    subtitle: "Predictor– Predict. Prevent. Protect.",
    description: "Stay ahead of falls with real-time monitoring and proactive protection.",
    image: require("../../assets/images/onboarding/onboarding-3.png"),
    backgroundColor: theme.colors.secondary,
  },
  {
    id: "4",
    title: "On-Demand Nursing Care",
    subtitle: "Book a Nurse Instantly.",
    description: "Reliable, professional home nursing—just a tap away.",
    image: require("../../assets/images/onboarding/onboarding-4.png"),
    backgroundColor: theme.colors.primary,
  },
]

const OnboardingScreen = () => {
  const {width} = ScreenSize()
  const {navigation} = Navigation()
  
  const [currentIndex, setCurrentIndex] = useState(0)
  const flatListRef = useRef<FlatList>(null)
  const scrollX = useRef(new Animated.Value(0)).current

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      })
    } else {
      navigation.navigate("CreateAccount")
    }
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

          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 16, 8],
            extrapolate: "clamp",
          })

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
                {
                  width: dotWidth,
                  opacity,
                },
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
        ref={flatListRef}
        data={slides}
        renderItem={({ item, index }) => (
          <OnboardingSlide
            title={item.title}
            subtitle={item.subtitle}
            description={item.description}
            image={item.image}
            backgroundColor={item.backgroundColor}
            onNext={handleNext}
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
    width: "100%",
    marginVertical: '4%'
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.white,
    marginHorizontal: 4,
  },
})

export default OnboardingScreen
