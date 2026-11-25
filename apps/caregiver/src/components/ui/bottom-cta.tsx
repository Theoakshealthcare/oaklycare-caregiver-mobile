import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/src/constants/theme";

/** The clear space kept under the last button of a screen, on top of the system's own bottom inset. */
export const CTA_BOTTOM_GAP = 20;

/** The bottom padding of a button bar: the gap, plus the safe-area inset where nothing else has added it yet. */
export function ctaBottomPadding(safeBottom: number, outsideAppRoot: boolean): number {
  return CTA_BOTTOM_GAP + (outsideAppRoot ? safeBottom : 0);
}

/**
 * The one container for a button (or a row of buttons) pinned under a screen, so none sits against the bottom edge on
 * gesture navigation, three-button Android or a small iPhone.
 *
 * The app root (`MainApp`) already insets the whole navigator by the bottom safe area, so a pinned bar inside a screen
 * only needs the gap. Content drawn in a native `Modal` is outside that root, so it passes `outsideAppRoot` and gets the
 * inset added here instead.
 */
const BottomCta: React.FC<{
  children: React.ReactNode;
  outsideAppRoot?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}> = ({ children, outsideAppRoot = false, style, testID }) => {
  const safeBottom = useSafeAreaInsets().bottom;
  return (
    <View
      testID={testID}
      style={[{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md, paddingBottom: ctaBottomPadding(safeBottom, outsideAppRoot) }, style]}
    >
      {children}
    </View>
  );
};

export default BottomCta;
