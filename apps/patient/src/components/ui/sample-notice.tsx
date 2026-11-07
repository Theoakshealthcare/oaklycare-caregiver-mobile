import type React from "react";
import { StyleSheet, View } from "react-native";

import { theme } from "@/src/constants/theme";

import Icon from "./icon";
import Text from "./text";

/**
 * Shown on every screen that still reads sample data (its `useXxx` hook is a fixture). The slice that wires the screen to
 * the backend deletes the line that renders this, so a screen with no notice is a screen that shows real data.
 */
const SampleNotice: React.FC<{ what?: string }> = ({ what = "This screen" }) => (
  <View style={styles.box} accessibilityRole="alert">
    <Icon name="information-circle-outline" size={18} color={theme.colors.warningText} />
    <Text variant="small" color={theme.colors.warningText} style={styles.text}>
      {`${what} shows sample information. It is not connected to your account yet.`}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.warningLight,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm + 2,
  },
  text: { flex: 1 },
});

export default SampleNotice;
