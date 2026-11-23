import type React from "react";
import { StyleSheet, View } from "react-native";

import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import type { VitalStatus } from "@/src/domain/vitalStatus";

const LOOK: Record<VitalStatus, { dot: string; label: string }> = {
  normal: { dot: theme.colors.success, label: "Normal" },
  critical: { dot: theme.colors.secondary, label: "Critical" },
};

/**
 * The dot and word at the corner of a vital ("Normal" green, "Critical" coral). Built from the Figma frames and NOT shown
 * anywhere yet: `vitalStatus()` returns null until a clinician signs the thresholds (see `domain/vitalStatus.ts`).
 */
const StatusBadge: React.FC<{ status: VitalStatus }> = ({ status }) => (
  <View style={styles.row} accessibilityLabel={`Status: ${LOOK[status].label}`}>
    <View style={[styles.dot, { backgroundColor: LOOK[status].dot }]} />
    <Text variant="small">{LOOK[status].label}</Text>
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs + 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

export default StatusBadge;
