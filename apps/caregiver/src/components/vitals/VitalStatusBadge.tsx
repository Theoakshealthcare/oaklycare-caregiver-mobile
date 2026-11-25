import React from "react";
import { View } from "react-native";

import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import type { VitalFlag, VitalFlagStatus } from "@/src/vitals/vitalFlag";

const DOT: Record<VitalFlagStatus, string> = {
  normal: theme.colors.success,
  high: theme.colors.warning,
  low: theme.colors.info,
  critical: theme.colors.error,
};
const TINT: Record<VitalFlagStatus, string> = {
  normal: theme.colors.successLight,
  high: theme.colors.warningLight,
  low: theme.colors.primaryLight,
  critical: theme.colors.errorLight,
};

/** The tile background for a flag (a light tint of its colour); the neutral tile colour when the reading has no flag. */
export function statusTint(flag: VitalFlag | null | undefined): string {
  return flag ? TINT[flag.status] : theme.colors.soft;
}

/**
 * The Normal / High / Low / Critical mark on a vital: a coloured dot and the word the server sent. A critical reading also shows
 * the emergency message ("Call 112 now"). Draws nothing for a reading with no flag (sleep, weight, an unreadable value).
 */
const VitalStatusBadge: React.FC<{ flag: VitalFlag | null | undefined; testID?: string }> = ({ flag, testID = "vital-status" }) => {
  if (!flag) return null;
  return (
    <View testID={testID} accessibilityLabel={flag.emergency && flag.message ? `${flag.label}. ${flag.message}` : flag.label} style={{ gap: theme.spacing.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
        <View testID={`${testID}-dot`} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: DOT[flag.status] }} />
        <Text variant="caption" weight={flag.status === "normal" ? undefined : "medium"} color={theme.colors.text}>
          {flag.label}
        </Text>
      </View>
      {flag.emergency && flag.message ? (
        <Text testID={`${testID}-emergency`} variant="caption" weight="bold" color={theme.colors.error}>
          {flag.message}
        </Text>
      ) : null}
    </View>
  );
};

export default VitalStatusBadge;
