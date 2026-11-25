import { useNavigation } from "@react-navigation/native";
import type React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { theme } from "@/src/constants/theme";

import BottomBar from "./bottom-bar";
import Icon from "./icon";
import KeyboardScrollView from "./keyboard-scroll-view";
import Text from "./text";

interface HeaderProps {
  title?: string;
  /** Hide the back arrow on a screen that cannot go back. */
  noBack?: boolean;
  right?: React.ReactNode;
  /** Centre the title between the back button and the right side (Figma: "Contact Us", "Account and Data", "Edit Profile"). */
  center?: boolean;
}

/** The white header: round back button and a bold left-aligned title (design header style a). */
export const Header: React.FC<HeaderProps> = ({ title, noBack, right, center }) => {
  const navigation = useNavigation();
  return (
    <View style={styles.header}>
      {!noBack && navigation.canGoBack() ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <Icon name="chevron-back" size={22} />
        </Pressable>
      ) : null}
      {title ? (
        <Text variant="h3" weight="bold" center={center} style={center ? [styles.title, styles.centerTitle] : styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.title} />
      )}
      {right}
    </View>
  );
};

interface ScreenProps {
  title?: string;
  noBack?: boolean;
  headerRight?: React.ReactNode;
  /** Centre the header title. */
  centerTitle?: boolean;
  /** Wrap the body in the keyboard-aware scroll view (forms, long pages). Default: a plain padded view. */
  scroll?: boolean;
  /** No header at all (tab roots draw their own). */
  bare?: boolean;
  /** Footer pinned under the scroll area (primary button). */
  footer?: React.ReactNode;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Page chrome shared by the stack screens: header, scrolling body, optional pinned footer. */
const Screen: React.FC<ScreenProps> = ({ title, noBack, headerRight, centerTitle, scroll, bare, footer, children, contentStyle }) => (
  <View style={styles.screen}>
    {bare ? null : <Header title={title} noBack={noBack} right={headerRight} center={centerTitle} />}
    {scroll ? (
      <KeyboardScrollView contentContainerStyle={[styles.content, styles.scrollContent, contentStyle]}>{children}</KeyboardScrollView>
    ) : (
      <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>
    )}
    {footer ? <BottomBar>{footer}</BottomBar> : null}
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1 },
  // The back button is 40 wide: an equal gap on the right keeps a centred title in the middle.
  centerTitle: { marginRight: 40 },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  /** Room under the last item, so a button at the end of a long page (the chat button under the visit-code card) is never cut at the edge. */
  scrollContent: { paddingBottom: theme.spacing.xxl },
  fill: { flex: 1 },
});

export default Screen;
