import type React from "react";
import { StyleSheet, View } from "react-native";

import HeaderBack from "@/src/components/back/HeaderBack";
import { theme } from "@/src/constants/theme";

import KeyboardScrollView from "./keyboard-scroll-view";
import Text from "./text";

/** Side margin of the auth forms (Figma: 20 pt from the screen edge to the fields). */
export const FORM_PADDING = 20;

interface AuthPageProps {
  title: string;
  subtitle?: React.ReactNode;
  /** Sits at the right of the title row (Booking Summary's Edit). */
  titleRight?: React.ReactNode;
  /** Shows "< Back" on the first screen of a stack and says where it goes (see `HeaderBack`). */
  onBackFallback?: () => void;
  /** Wrap the form in the keyboard-aware scroll view. Default true; the code screens are short and do not need it. */
  scroll?: boolean;
  /** Scroll to the end when the keyboard opens, so the button under the last field stays above it. */
  scrollToEndOnKeyboardShow?: boolean;
  /** Gap between the fields; 22 pt in the Figma forms. */
  gap?: number;
  children: React.ReactNode;
}

/**
 * The chrome of the signed-out Figma screens: "< Back" link, bold 22 pt title, grey subtitle, then the form with 22 pt
 * between fields, all on white with a 20 pt side margin.
 */
const AuthPage: React.FC<AuthPageProps> = ({ title, subtitle, titleRight, onBackFallback, scroll = true, scrollToEndOnKeyboardShow, gap = 22, children }) => {
  const body = (
    <View style={styles.content}>
      <HeaderBack onFallback={onBackFallback} />
      <View style={styles.heading}>
        <View style={styles.titleRow}>
          <Text variant="page" weight="bold" style={styles.title}>
            {title}
          </Text>
          {titleRight}
        </View>
        {subtitle ? (
          <Text variant="body" color={theme.colors.textLight}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ gap }}>{children}</View>
    </View>
  );
  return (
    <View style={styles.screen}>
      {scroll ? <KeyboardScrollView scrollToEndOnKeyboardShow={scrollToEndOnKeyboardShow}>{body}</KeyboardScrollView> : body}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.white },
  content: { paddingHorizontal: FORM_PADDING, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  heading: { marginTop: 28, marginBottom: 24 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { flexShrink: 1 },
});

export default AuthPage;
