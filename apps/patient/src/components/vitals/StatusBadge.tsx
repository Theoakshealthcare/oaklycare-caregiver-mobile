import type React from "react";
import { StyleSheet, View } from "react-native";

import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import type { VitalFlag, VitalStatus } from "@/src/domain/vitalStatus";

const DOT: Record<VitalStatus, string> = {
  normal: theme.colors.success,
  high: theme.colors.warning,
  low: theme.colors.info,
  critical: theme.colors.error,
};

/** The emergency message of a critical flag ("This may be an emergency. Call 112 now."), else null. */
export function emergencyMessage(flag: VitalFlag | null | undefined): string | null {
  return flag?.emergency && flag.message ? flag.message : null;
}

/**
 * The dot and word at the corner of a vital: Normal (green), High (amber), Low (blue), Critical (red), as the server rated the
 * reading. A critical one also shows the emergency message ("Call 112 now") under the word. Draws nothing without a flag.
 */
const StatusBadge: React.FC<{ flag: VitalFlag | null | undefined; testID?: string; showMessage?: boolean }> = ({ flag, testID = "vital-status", showMessage = true }) => {
  if (!flag) return null;
  const emergency = showMessage ? emergencyMessage(flag) : null;
  return (
    <View testID={testID} accessible accessibilityLabel={emergency ? `Status: ${flag.label}. ${emergency}` : `Status: ${flag.label}`} style={styles.box}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: DOT[flag.status] }]} />
        <Text variant="small" weight={flag.status === "normal" ? undefined : "medium"}>
          {flag.label}
        </Text>
      </View>
      {emergency ? (
        <Text testID={`${testID}-emergency`} variant="small" weight="bold" color={theme.colors.error}>
          {emergency}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { gap: theme.spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs + 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

/** The emergency message on its own line, for a spot too narrow to hold it beside the badge (a tile corner). Nothing unless critical. */
export const EmergencyLine: React.FC<{ flag: VitalFlag | null | undefined; testID?: string }> = ({ flag, testID = "vital-emergency" }) => {
  const message = emergencyMessage(flag);
  if (!message) return null;
  return (
    <Text testID={testID} variant="small" weight="bold" color={theme.colors.error}>
      {message}
    </Text>
  );
};

export default StatusBadge;
