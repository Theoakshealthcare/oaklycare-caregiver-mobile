import type React from "react";
import { useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { useOnboarding } from "@/src/auth/onboarding";
import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import TextLink from "@/src/components/ui/text-link";
import { theme } from "@/src/constants/theme";
import { useNav } from "@/src/navigation/Navigations";

const SLIDES = [
  {
    id: "ai",
    title: "AI-Powered Personalized Care",
    subtitle: "Smart Care, Tailored for You.",
    text: "Our AI-driven platform ensures the right care, at the right time.",
    image: require("../../../assets/images/onboarding/onboarding-1.png"),
    color: theme.colors.primary,
  },
  {
    id: "monitoring",
    title: "Remote Monitoring & Real-Time Updates.",
    subtitle: "",
    text: "Track care sessions, chat with nurses, and receive real-time updates.",
    image: require("../../../assets/images/onboarding/onboarding-2.png"),
    color: theme.colors.primary,
  },
  {
    id: "fallguard",
    title: "Oakly FallGuard™ Fall Predictor",
    subtitle: "Predict. Prevent. Protect.",
    text: "Stay ahead of falls with proactive protection.",
    image: require("../../../assets/images/onboarding/onboarding-3.png"),
    color: theme.colors.secondary,
  },
  {
    id: "nursing",
    title: "On-Demand Nursing Care",
    subtitle: "Book a Nurse Instantly.",
    text: "Reliable, professional home nursing, just a tap away.",
    image: require("../../../assets/images/onboarding/onboarding-4.png"),
    color: theme.colors.primary,
  },
] as const;

/** Four intro slides, shown once per install. Skip, Get Started and Login all end the intro. */
const Onboarding: React.FC = () => {
  const navigation = useNav();
  const { width } = useWindowDimensions();
  const complete = useOnboarding((s) => s.complete);
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];

  const leaveTo = (route: "Login" | "CreateAccount") => {
    void complete();
    navigation.reset({ index: 0, routes: [{ name: route }] });
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  const next = () => {
    if (index < SLIDES.length - 1) scroller.current?.scrollTo({ x: width * (index + 1), animated: true });
    else leaveTo("CreateAccount");
  };

  return (
    <View style={[styles.screen, { backgroundColor: slide.color }]}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip" hitSlop={8} onPress={() => leaveTo("Login")}>
          <Text weight="bold" color={theme.colors.white}>
            Skip
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.pager}
      >
        {SLIDES.map((item) => (
          <View key={item.id} style={[styles.slide, { width }]}>
            <Image source={item.image} style={styles.image} resizeMode="contain" />
            <Text variant="h2" weight="bold" color={theme.colors.white} center>
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text variant="h3" weight="medium" color={theme.colors.white} center>
                {item.subtitle}
              </Text>
            ) : null}
            <Text color={theme.colors.white} center>
              {item.text}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((item, i) => (
          <View key={item.id} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.bottom}>
        <Button title={index === SLIDES.length - 1 ? "Get Started" : "Next"} variant="light" onPress={next} />
        <View style={styles.loginRow}>
          <Text variant="small" color={theme.colors.white}>
            Already have an account?
          </Text>
          <TextLink label="Login" light onPress={() => leaveTo("Login")} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { alignItems: "flex-end", padding: theme.spacing.lg },
  pager: { flex: 1 },
  slide: { alignItems: "center", justifyContent: "center", gap: theme.spacing.md, paddingHorizontal: theme.spacing.lg },
  image: { width: "80%", height: 260 },
  dots: { flexDirection: "row", justifyContent: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { width: 24, backgroundColor: theme.colors.white },
  bottom: { padding: theme.spacing.lg, gap: theme.spacing.md },
  loginRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: theme.spacing.xs },
});

export default Onboarding;
