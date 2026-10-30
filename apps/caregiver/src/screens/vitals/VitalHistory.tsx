import React, { useMemo } from "react";
import { RefreshControl, View } from "react-native";
import type { StackScreenProps } from "@react-navigation/stack";

import ScreenShell from "@/src/components/account/ScreenShell";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/account/StateViews";
import Text from "@/src/components/ui/text";
import { VitalsUnavailable } from "@/src/components/vitals/VitalsStates";
import { theme } from "@/src/constants/theme";
import { useVitalHistory } from "@/src/hooks/queries";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import {
  GLUCOSE_CONTEXT_LABEL,
  formatReading,
  formatTime,
  groupReadingsByDay,
  isVitalsAccessDenied,
  kindInfo,
  readingsOfKind,
  toReadings,
} from "@/src/vitals/vitalsModel";

type Props = StackScreenProps<ScreenParamLists, "VitalHistory">;

/** "View all History" of the design: every reading of one vital on record, newest first, grouped by day. */
const VitalHistory: React.FC<Props> = ({ route }) => {
  const { patientId, kind, patientName } = route.params;
  const info = kindInfo(kind);
  const vitals = useVitalHistory(patientId);
  const groups = useMemo(() => groupReadingsByDay(readingsOfKind(toReadings(vitals.data ?? []), kind)), [vitals.data, kind]);

  const content = () => {
    if (vitals.isError && !vitals.data) {
      return isVitalsAccessDenied(vitals.error) ? (
        <VitalsUnavailable />
      ) : (
        <ErrorState error={vitals.error} onRetry={() => void vitals.refetch()} />
      );
    }
    if (!vitals.data) return <LoadingState testID="vital-history-loading" />;
    if (groups.length === 0) {
      return <EmptyState icon="inbox" title="No readings yet" hint="Readings recorded during visits are listed here." />;
    }
    return (
      <>
        {groups.map((group) => (
          <View key={group.title} style={{ marginBottom: theme.spacing.md }}>
            <Text variant="body" weight="bold" style={{ marginBottom: theme.spacing.sm }} testID="history-day">
              {group.title}
            </Text>
            {group.readings.map((r) => (
              <View
                key={r.id}
                testID="history-row"
                style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: theme.spacing.md, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.soft, marginBottom: theme.spacing.sm }}
              >
                <View style={{ flex: 1, paddingRight: theme.spacing.sm }}>
                  <Text variant="body" weight="bold">
                    {formatReading(r)}
                  </Text>
                  {r.glucoseContext ? (
                    <Text variant="caption" color={theme.colors.textLight}>
                      {GLUCOSE_CONTEXT_LABEL[r.glucoseContext]}
                    </Text>
                  ) : null}
                </View>
                <Text variant="caption" color={theme.colors.textLight}>
                  {formatTime(r.recordedAt)}
                </Text>
              </View>
            ))}
          </View>
        ))}
        <Text variant="caption" color={theme.colors.textLight}>
          Readings are shown as recorded; Oakly does not rate them.
        </Text>
      </>
    );
  };

  return (
    <ScreenShell
      title={`${info.label} history`}
      subtitle={patientName}
      refreshControl={<RefreshControl refreshing={vitals.isRefetching} onRefresh={() => void vitals.refetch()} />}
    >
      {content()}
    </ScreenShell>
  );
};

export default VitalHistory;
