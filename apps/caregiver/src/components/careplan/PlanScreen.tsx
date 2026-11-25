import React from "react";
import { View, type RefreshControlProps } from "react-native";
import { useNavigation, useNavigationState } from "@react-navigation/native";

import { RoundBack } from "@/src/components/careplan/parts";
import BottomCta from "@/src/components/ui/bottom-cta";
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";

/**
 * The care plan frames' page: off-white background, a round back button, a bold title (and sub-line), the content, and
 * an optional button pinned under the scroll ("Create Care Plan").
 */
const PlanScreen: React.FC<{
  title: string;
  subtitle?: string;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  footer?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, refreshControl, footer, children }) => {
  const navigation = useNavigation();
  // Same rule as `HeaderBack`: a screen that is first in its stack has nowhere to go back to.
  const hasHistory = useNavigationState((state) => state.index > 0);
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.careBackground }}>
      <KeyboardScrollView refreshControl={refreshControl}>
        <View style={{ padding: theme.spacing.md, paddingTop: theme.spacing.xl, paddingBottom: theme.spacing.xl, gap: theme.spacing.md }}>
          <View>{hasHistory ? <RoundBack onPress={() => navigation.goBack()} /> : null}</View>
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="page" weight="bold" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? (
              <Text variant="small" color={theme.colors.textLight}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {children}
        </View>
      </KeyboardScrollView>
      {footer ? <BottomCta style={{ backgroundColor: theme.colors.careBackground }}>{footer}</BottomCta> : null}
    </View>
  );
};

export default PlanScreen;
