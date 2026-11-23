import { useNavigation, useNavigationState } from "@react-navigation/native";
import type React from "react";
import { Pressable, StyleSheet } from "react-native";

import Icon from "@/src/components/ui/icon";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";

interface Props {
  /**
   * What Back does on the first screen of a stack, where there is no history to go back to (Login on a relaunch). Without it
   * the screen draws no Back link at all.
   */
  onFallback?: () => void;
}

/** The "< Back" text link at the top of every Figma auth screen. */
const HeaderBack: React.FC<Props> = ({ onFallback }) => {
  const navigation = useNavigation();
  // Read from this navigator's own state, not `navigation.canGoBack()` at render time: right after a sign-out the new
  // signed-out stack briefly reports the old stack's history, which drew a Back arrow that did nothing.
  const hasHistory = useNavigationState((state) => state.index > 0);

  if (!hasHistory && !onFallback) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={8}
      onPress={() => (hasHistory ? navigation.goBack() : onFallback?.())}
      style={styles.row}
    >
      <Icon name="chevron-back" size={24} />
      <Text style={{ fontSize: theme.sizes.body }}>Back</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, alignSelf: "flex-start" },
});

export default HeaderBack;
