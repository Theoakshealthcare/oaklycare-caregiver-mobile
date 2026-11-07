
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
    title: "Care work that",
    subtitle: "Comes to you.",
    description: "Get visit requests near you and accept the ones that suit your day.",
    image: require("../../assets/images/onboarding/onboarding-1.png"),
    backgroundColor: theme.colors.primary,
  },
  {
    id: "2",
    title: "Visits, Care Plans &",
    subtitle: "Vitals In One Place.",
    description: "Start a visit with the family's code, follow the care plan and record vitals as you go.",
    image: require("../../assets/images/onboarding/onboarding-2.png"),
    backgroundColor: theme.colors.primary,
  },
  {
    id: "3",
    title: "Earn For Every Visit",
    subtitle: "Get Paid Securely.",
    description: "See what you earn for each completed visit and withdraw to your bank account.",
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
