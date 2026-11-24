import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { StackScreenProps } from "@react-navigation/stack";

import ScreenShell from "@/src/components/account/ScreenShell";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/account/StateViews";
import Text from "@/src/components/ui/text";
import ReadingChart from "@/src/components/vitals/ReadingChart";
import { VitalsUnavailable } from "@/src/components/vitals/VitalsStates";
import { theme } from "@/src/constants/theme";
import { useVitals } from "@/src/hooks/queries";
import { formatTimeAgo } from "@/src/utils/dates";
import useNavigation from "@/src/hooks/use-navigation";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import {
  CHART_RANGES,
  GLUCOSE_CONTEXT_LABEL,
  chartPoints,
  formatReading,
  formatUpdated,
  isVitalsAccessDenied,
  kindInfo,
  readingsInRange,
  readingsOfKind,
  toReadings,
  type ChartRange,
} from "@/src/vitals/vitalsModel";

type Props = StackScreenProps<ScreenParamLists, "VitalDetail">;

/** One vital: a Day / Week / Month chart of its readings and the readings themselves, newest first. */
const VitalDetail: React.FC<Props> = ({ route }) => {
  const { patientId, kind } = route.params;
  const { navigation } = useNavigation();
  const info = kindInfo(kind);
  const [range, setRange] = useState<ChartRange>("week");
  const vitals = useVitals(patientId);

  const all = useMemo(() => readingsOfKind(toReadings(vitals.data ?? []), kind), [vitals.data, kind]);
  const inRange = useMemo(() => readingsInRange(all, range), [all, range]);
  const points = useMemo(() => chartPoints(inRange), [inRange]);
  const current = all[0];

  const content = () => {
    if (vitals.isError && !vitals.data) {
      return isVitalsAccessDenied(vitals.error) ? (
        <VitalsUnavailable />
      ) : (
        <ErrorState error={vitals.error} onRetry={() => void vitals.refetch()} />
      );
    }
    if (!vitals.data) return <LoadingState testID="vital-detail-loading" />;
    return (
      <>
        <View style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.xl, padding: theme.spacing.md, gap: theme.spacing.md, ...theme.shadows.small, backgroundColor: theme.colors.white }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
            <Feather name={info.icon} size={22} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="bold" testID="vital-detail-name">
                {info.heading}
              </Text>
              {route.params.patientName ? (
                <Text variant="caption" color={theme.colors.textLight} testID="vital-detail-patient">
                  {route.params.patientName}
                </Text>
              ) : null}
            </View>
            {current ? (
              <Text variant="caption" color={theme.colors.textLight} testID="vital-detail-updated">
                {`Last synced: ${formatTimeAgo(current.recordedAt)}`}
              </Text>
            ) : null}
          </View>

          <ReadingChart points={points} currentLabel={current && points.some((p) => p.id === current.id) ? current.value : undefined} />

          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
            <View>
              <Text variant="caption" color={theme.colors.textLight}>
                Current
              </Text>
              <Text variant="h3" weight="bold" color={theme.colors.primary} testID="vital-detail-current">
                {current ? formatReading(current) : "No reading yet"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: theme.spacing.xs }}>
              {CHART_RANGES.map((r) => (
                <Pressable
                  key={r.id}
                  testID={`range-${r.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: range === r.id }}
                  onPress={() => setRange(r.id)}
                  style={{
                    paddingVertical: theme.spacing.xs,
                    paddingHorizontal: theme.spacing.sm,
                    borderRadius: theme.borderRadius.round,
                    backgroundColor: range === r.id ? theme.colors.primary : theme.colors.soft,
                  }}
                >
                  <Text variant="caption" weight="medium" color={range === r.id ? theme.colors.white : theme.colors.primary}>
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm }}>
          <Text variant="h3" weight="bold">
            History
          </Text>
          <Pressable
            testID="view-all-history"
            accessibilityRole="button"
            onPress={() => navigation.navigate("VitalHistory", { patientId, patientName: route.params.patientName, kind })}
            style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}
          >
            <Text variant="small" weight="medium" color={theme.colors.primary}>
              View all History
            </Text>
            <Feather name="chevron-right" size={16} color={theme.colors.primary} />
          </Pressable>
        </View>
        {inRange.length === 0 ? (
          <EmptyState icon="inbox" title="No readings in this period" hint="Readings recorded during visits are listed here." />
        ) : (
          [...inRange].reverse().map((r) => (
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
                {formatUpdated(r.recordedAt).replace("Updated ", "")}
              </Text>
            </View>
          ))
        )}
        <Text variant="caption" color={theme.colors.textLight} style={{ marginTop: theme.spacing.sm }}>
          Readings are shown as recorded; Oakly does not rate them.
        </Text>
      </>
    );
  };

  return (
    <ScreenShell
      title={`${info.heading} Monitoring`}
      subtitle="Vital Monitoring"
      refreshControl={<RefreshControl refreshing={vitals.isRefetching} onRefresh={() => void vitals.refetch()} />}
    >
      {content()}
    </ScreenShell>
  );
};

export default VitalDetail;
