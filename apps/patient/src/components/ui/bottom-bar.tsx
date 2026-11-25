import type React from "react";
import { StyleSheet, View } from "react-native";

import { theme } from "@/src/constants/theme";

/** Side margin of a pinned bottom button (Figma: 20 pt from the screen edge, the same as the form fields above it). */
export const BOTTOM_BAR_SIDE = 20;

/**
 * A button (or buttons) pinned under a screen's body: "Make Payment", and any later screen that pins its call to action.
 * The one place that decides how far it sits from the bottom edge, so no screen draws its own gap.
 *
 * The bottom safe area (home indicator, the gesture pill, the three Android navigation buttons) is not added here: the app
 * root (`MainApp`) already keeps every screen above it with a strip of the inset's height. What a pinned button needs on top
 * of that is air, `theme.spacing.lg` (24 pt before the width scale, about 22 to 28 on real phones), so it never touches the
 * strip. On a phone that reports no inset at all the button is still that far from the edge.
 */
const BottomBar: React.FC<{ children: React.ReactNode }> = ({ children }) => <View style={styles.bar}>{children}</View>;

const styles = StyleSheet.create({
  bar: { paddingHorizontal: BOTTOM_BAR_SIDE, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.lg },
});

export default BottomBar;
