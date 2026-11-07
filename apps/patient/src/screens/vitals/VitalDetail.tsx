import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import Button from "@/src/components/ui/button";
import { Card, EmptyState } from "@/src/components/ui/card";
import SampleNotice from "@/src/components/ui/sample-notice";
import Screen from "@/src/components/ui/screen";
import SegmentedControl from "@/src/components/ui/segmented-control";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { formatDateTime } from "@/src/domain/format";
import { readingText, vitalMeta, type VitalRange } from "@/src/domain/vitals";
import { useVitalReadings } from "@/src/hooks/useVitals";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "VitalDetail">;

const RANGES = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
] as const;
const DAYS: Record<VitalRange, number> = { day: 1, week: 7, month: 30 };
const CHART_HEIGHT = 120;

/** One vital: the latest reading, a Day / Week / Month bar chart of the readings in that window, and the list behind it. */
const VitalDetail: React.FC<Props> = ({ navigation, route }) => {
  const { kind } = route.params;
  const meta = vitalMeta(kind);
  const readings = useVitalReadings();
  const [range, setRange] = useState<VitalRange>("week");
  const [now] = useState(() => Date.now());

  const all = (readings.data ?? []).filter((r) => r.kind === kind).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const since = now - DAYS[range] * 24 * 3_600_000;
  const inRange = all.filter((r) => new Date(r.recordedAt).getTime() >= since);
  const latest = all[all.length - 1];
  const max = Math.max(1, ...inRange.map((r) => r.value));

  return (
    <Screen title={meta.label} scroll>
      <SampleNotice what="This vital" />
      <Card tone="tint">
        <Text variant="small" color={theme.colors.textLight}>
          Latest reading
        </Text>
        <Text variant="h1" weight="bold">
          {latest ? `${readingText(latest)} ${meta.unit}` : "No reading yet"}
        </Text>
        {latest ? (
          <Text variant="small" color={theme.colors.textLight}>
            {`Last entry: ${formatDateTime(latest.recordedAt)}`}
          </Text>
        ) : null}
      </Card>

      <SegmentedControl options={RANGES} value={range} onChange={setRange} />

      {inRange.length === 0 ? (
        <EmptyState title="No readings in this period" message="Add a reading to see it here." />
      ) : (
        <View style={styles.chart} accessibilityLabel={`${meta.label} chart, ${inRange.length} readings`}>
          {inRange.map((r) => (
            <View key={r.id} style={styles.barSlot}>
              <View style={[styles.bar, { height: Math.max(6, (r.value / max) * CHART_HEIGHT) }]} />
            </View>
          ))}
        </View>
      )}

      {inRange
        .slice()
        .reverse()
        .map((r) => (
          <Card key={r.id}>
            <Text weight="bold">{`${readingText(r)} ${meta.unit}`}</Text>
            <Text variant="small" color={theme.colors.textLight}>
              {formatDateTime(r.recordedAt)}
            </Text>
          </Card>
        ))}

      <Button title="Add reading" onPress={() => navigation.navigate("AddVital", { kind })} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  chart: { height: CHART_HEIGHT, flexDirection: "row", alignItems: "flex-end", gap: theme.spacing.sm },
  barSlot: { flex: 1, justifyContent: "flex-end" },
  bar: { backgroundColor: theme.colors.primary, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
});

export default VitalDetail;
