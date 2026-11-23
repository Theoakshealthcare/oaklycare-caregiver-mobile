import React from "react";
import { View } from "react-native";

import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { VITAL_STATUS_BADGES } from "@/src/config/vitals";

/** What a clinician-approved status can be. The app never derives one from a reading. */
export type VitalStatus = "normal" | "critical";

const LABEL: Record<VitalStatus, string> = { normal: "Normal", critical: "Critical" };
const DOT: Record<VitalStatus, string> = { normal: theme.colors.success, critical: theme.colors.error };
const TINT: Record<VitalStatus, string> = { normal: theme.colors.successLight, critical: theme.colors.secondaryLight };

/** The tile background for a status (green or red tint); the neutral tile colour when the badges are off or there is no status. */
export function statusTint(status: VitalStatus | null | undefined): string {
  return VITAL_STATUS_BADGES && status ? TINT[status] : theme.colors.soft;
}

/**
 * The Figma "Normal" / "Critical" mark on a vital tile: a coloured dot and the word. Built but OFF: it draws nothing while
 * `VITAL_STATUS_BADGES` is false (`config/vitals.ts`), and nothing feeds it a status yet.
 */
const VitalStatusBadge: React.FC<{ status: VitalStatus | null | undefined; testID?: string }> = ({ status, testID = "vital-status" }) => {
  if (!VITAL_STATUS_BADGES || !status) return null;
  return (
    <View testID={testID} accessibilityLabel={LABEL[status]} style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
      <View testID={`${testID}-dot`} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: DOT[status] }} />
      <Text variant="caption" color={theme.colors.text}>
        {LABEL[status]}
      </Text>
    </View>
  );
};

export default VitalStatusBadge;
