import { useIsFocused } from "@react-navigation/native";
import type React from "react";
import { useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOnboarding } from "@/src/auth/onboarding";
import { useBottomBand } from "@/src/components/StatusBar/screenChrome";
import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { scaleFactor, theme } from "@/src/constants/theme";
import { useNav } from "@/src/navigation/Navigations";

/** Where the artwork sits in the Figma frame, in Figma pixels (a 417 px wide frame): left, width and top from the frame's top-left. */
interface ArtPlacement {
  left: number;
  width: number;
  top: number;
  /** Height / width of the artwork file. */
  aspect: number;
}

interface Slide {
  id: string;
  /** The headline and sub-text broken into lines as the Figma frame breaks them. */
  headlineLines: string[];
  descriptionLines: string[];
  /** Distance from the top of the panel to the centre of the pager dots, in Figma pixels. */
  dotsTop: number;
  image: ImageSourcePropType;
  art: ArtPlacement;
  color: string;
}

/**
 * The four welcome slides, in the words of the Figma frames (spelling mistakes fixed: "AI- Powered" is "AI-Powered").
 * Slide 3 sits on the coral panel, the others on teal. The artwork positions are the Figma frame's.
 */
export const SLIDES: Slide[] = [
  {
    id: "ai",
    headlineLines: ["AI-Powered Personalized Care", "Smart Care, Tailored for You."],
    descriptionLines: ["Our AI-driven platform ensures the", "right care, at the right time."],
    dotsTop: 47,
    image: require("../../../assets/images/onboarding/onboarding-1.png"),
    art: { left: 34, width: 348, top: 117, aspect: 1391 / 1308 },
    color: theme.colors.primary,
  },
  {
    id: "monitoring",
    headlineLines: ["Remote Monitoring &", "Real-Time Updates."],
    descriptionLines: ["Track care sessions, chat with nurses, and", "receive real-time updates."],
    dotsTop: 44,
    image: require("../../../assets/images/onboarding/onboarding-2.png"),
    art: { left: 4, width: 413, top: 75, aspect: 1687 / 1556 },
    color: theme.colors.primary,
  },
  {
    id: "fallguard",
    headlineLines: ["Oakly FallGuard™ Fall", "Predictor– Predict.", "Prevent. Protect."],
    descriptionLines: ["Stay ahead of falls with real-time monitoring", "and proactive protection."],
    dotsTop: 27,
    image: require("../../../assets/images/onboarding/onboarding-3.png"),
    art: { left: 18, width: 386, top: 144, aspect: 1288 / 1442 },
    color: theme.colors.secondary,
  },
  {
    id: "nursing",
    headlineLines: ["On-Demand Nursing Care", "Book a Nurse Instantly."],
    descriptionLines: ["Reliable, professional home nursing—just a", "tap away."],
    dotsTop: 44,
    image: require("../../../assets/images/onboarding/onboarding-4.png"),
    art: { left: 18, width: 398, top: 97, aspect: 1706 / 1504 },
    color: theme.colors.primary,
  },
];

/** The Figma frame is 417 px wide in the exports (375 pt) and 905 px tall; the coloured panel starts 509 px below its top. */
const FRAME_W = 417;
const FRAME_H = 905;
const PANEL_TOP = 572 - 63;

/**
 * Four intro slides, shown once per install: a white area with the artwork over a coloured panel holding the dots,
 * headline, text, "Get Started" and the Login link (Figma). Skip, Get Started and Login all end the intro.
 */
const Onboarding: React.FC = () => {
  const navigation = useNav();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const complete = useOnboarding((s) => s.complete);
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  // The coloured panel runs to the bottom edge of the screen: paint the strip under the home indicator in its colour.
  // Login and sign-up are pushed on top of the slides, so the band goes back to white once the slides lose focus.
  const focused = useIsFocused();
  useBottomBand(focused ? slide.color : null);

  const leaveTo = (route: "Login" | "CreateAccount") => {
    void complete();
    // Pushed (not reset), so the "< Back" link on those screens returns to the slides, as in Figma.
    navigation.navigate(route);
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  // One scale for everything drawn from the Figma frame: by width, or by height on a short phone.
  const k = Math.min(width / FRAME_W, height / FRAME_H);
  // The white part ends where the panel starts in the frame (56% of the screen); the root already sits under the status bar.
  const artAreaHeight = (PANEL_TOP / FRAME_H) * height - insets.top;
  // The theme sizes are damped by width; the slide text is scaled fully with the width instead, so it keeps its share of the screen as in Figma.
  const s = width / 375;
  const full = s / scaleFactor(width);

  return (
    <View style={[styles.screen, { backgroundColor: slide.color }]}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.pager}
      >
        {SLIDES.map((item) => (
          <View key={item.id} style={{ width, flex: 1 }}>
            <View style={[styles.white, { height: artAreaHeight }]}>
              <Image
                source={item.image}
                resizeMode="contain"
                style={{
                  position: "absolute",
                  left: item.art.left * k,
                  top: item.art.top * k - insets.top,
                  width: item.art.width * k,
                  height: item.art.width * k * item.art.aspect,
                }}
              />
            </View>
            <View style={[styles.panel, { backgroundColor: item.color, paddingTop: Math.max(0, item.dotsTop * k - 4) }]}>
              <View style={styles.dots}>
                {SLIDES.map((dot, i) => (
                  <View key={dot.id} style={[styles.dot, i !== index && styles.dotIdle]} />
                ))}
              </View>
              <View style={{ marginTop: 22 * k, alignItems: "center" }}>
                {item.headlineLines.map((line, i) => (
                  <Text
                    key={line}
                    variant="h2"
                    weight="bold"
                    color={theme.colors.white}
                    center
                    // The first line of a three-line headline is the longest in the frame; all lines share one size.
                    style={{ fontSize: theme.sizes.heading * full * 1.02, lineHeight: 29 * s }}
                    accessibilityRole={i === 0 ? "header" : undefined}
                  >
                    {line}
                  </Text>
                ))}
              </View>
              <View style={{ marginTop: 8 * k, alignItems: "center" }}>
                {item.descriptionLines.map((line) => (
                  <Text
                    key={line}
                    variant="small"
                    color={theme.colors.white}
                    center
                    style={{ fontSize: theme.sizes.caption * full * 1.05, lineHeight: 20 * s }}
                  >
                    {line}
                  </Text>
                ))}
              </View>
              <Button
                title="Get Started"
                variant="light"
                style={{ width: "65%", minHeight: 60, marginTop: 24 * k }}
                onPress={() => leaveTo("CreateAccount")}
              />
              <View style={{ marginTop: 20 * k, flexDirection: "row", justifyContent: "center" }}>
                <Text variant="body" color={theme.colors.white} style={{ fontSize: theme.sizes.body * full * 1.05 }}>
                  {"Already have an account ? "}
                </Text>
                <Text
                  variant="body"
                  weight="medium"
                  color={theme.colors.white}
                  accessibilityRole="button"
                  onPress={() => leaveTo("Login")}
                  style={{ fontSize: theme.sizes.body * full * 1.05, textDecorationLine: "underline" }}
                >
                  Login
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip"
        hitSlop={8}
        onPress={() => leaveTo("Login")}
        style={styles.skip}
      >
        <Text weight="bold" color={theme.colors.primary}>
          Skip
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pager: { flex: 1 },
  white: { backgroundColor: theme.colors.white, overflow: "hidden" },
  panel: { flex: 1, alignItems: "center" },
  skip: { position: "absolute", top: theme.spacing.sm + 4, right: theme.spacing.md + 4, zIndex: 10, padding: theme.spacing.sm },
  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.white, marginHorizontal: 3.5 },
  dotIdle: { opacity: 0.4 },
});

export default Onboarding;
