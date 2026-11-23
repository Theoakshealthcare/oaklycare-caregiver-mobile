import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import Icon from "@/src/components/ui/icon";
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view";
import PageHeader from "@/src/components/ui/page-header";
import QueryError from "@/src/components/ui/query-error";
import Text from "@/src/components/ui/text";
import AreaChart from "@/src/components/vitals/AreaChart";
import InsightList from "@/src/components/vitals/InsightList";
import StatusBadge from "@/src/components/vitals/StatusBadge";
import { theme } from "@/src/constants/theme";
import { formatAgo } from "@/src/domain/format";
import { vitalStatus } from "@/src/domain/vitalStatus";
import { convertUnit, readingText, vitalMeta, type VitalRange } from "@/src/domain/vitals";
import { useVitalInsights, useVitalReadings } from "@/src/hooks/useVitals";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "VitalDetail">;

const RANGES: { value: VitalRange; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];
const DAYS: Record<VitalRange, number> = { day: 1, week: 7, month: 30 };
const HOME_INSIGHTS = 2;

/**
 * "<Vital> Monitoring" (Figma): the vital's card with when it was last recorded, an area chart of the readings in the chosen
 * window with the latest one marked, the current value and Day / Week / Month, then "History & Insights". Readings saved in
 * another unit (°F against °C, mmol/L against mg/dL) are drawn in the unit of the latest one. The Normal / Critical line is
 * built but off (`domain/vitalStatus.ts`). A blood pressure chart follows the top (systolic) number.
 */
const VitalDetail: React.FC<Props> = ({ navigation, route }) => {
  const { kind } = route.params;
  const meta = vitalMeta(kind);
  const readings = useVitalReadings();
  const insights = useVitalInsights();
  const [range, setRange] = useState<VitalRange>("week");
  const [now] = useState(() => Date.now());

  const all = (readings.data ?? []).filter((r) => r.kind === kind).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const latest = all[all.length - 1];
  const unit = latest?.unit ?? meta.unit;
  const from = now - DAYS[range] * 24 * 3_600_000;
  const inRange = all.filter((r) => new Date(r.recordedAt).getTime() >= from);
  const points = inRange.map((r) => ({ t: new Date(r.recordedAt).getTime(), v: convertUnit(kind, r.value, r.unit, unit) }));
  const status = latest ? vitalStatus(latest) : null;
  const notes = insights.data ?? [];

  return (
    <View style={styles.screen}>
      <PageHeader title={meta.monitorTitle} subtitle="Vital Monitoring" />
      <KeyboardScrollView contentContainerStyle={styles.content}>
        {readings.isError ? <QueryError what="this vital" error={readings.error} onRetry={() => void readings.refetch()} /> : null}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.name}>
              <Icon name={meta.icon} size={22} color={meta.tint} />
              <Text weight="bold" style={styles.nameText} numberOfLines={1}>
                {meta.title}
              </Text>
            </View>
            {latest ? (
              <Text variant="small" color={theme.colors.textLight}>{`Last synced: ${formatAgo(latest.recordedAt)}`}</Text>
            ) : null}
          </View>
          {status ? <StatusBadge status={status} /> : null}
          {points.length > 0 ? (
            <AreaChart points={points} from={from} to={now} color={meta.tint} accessibilityLabel={`${meta.title} chart, ${points.length} readings`} />
          ) : (
            <View style={styles.empty}>
              <Text weight="bold" center>
                {all.length === 0 ? "No reading yet" : "No readings in this period"}
              </Text>
              <Text variant="small" color={theme.colors.textLight} center>
                {all.length === 0 ? "Tap + on the Vitals page to add one." : "Pick a longer period to see earlier readings."}
              </Text>
            </View>
          )}
          <View style={styles.footer}>
            <View>
              <Text variant="small" color={theme.colors.textLight}>
                Current
              </Text>
              {latest ? (
                <View style={styles.valueRow}>
                  <Text weight="bold" style={styles.current}>
                    {readingText(latest)}
                  </Text>
                  <Text variant="small" weight="bold" color={theme.colors.primary}>
                    {latest.unit}
                  </Text>
                </View>
              ) : (
                <Text weight="bold" color={theme.colors.textLight}>
                  No reading yet
                </Text>
              )}
            </View>
            <View style={styles.pills} accessibilityRole="tablist">
              {RANGES.map((r) => (
                <Pressable
                  key={r.value}
                  accessibilityRole="tab"
                  accessibilityLabel={r.label}
                  accessibilityState={{ selected: range === r.value }}
                  onPress={() => setRange(r.value)}
                  style={[styles.pill, range === r.value && styles.pillOn]}
                >
                  <Text variant="small" weight="bold" color={theme.colors.primary}>
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.sectionHead}>
          <Text variant="h3" weight="bold">
            History & Insights
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="View all History" hitSlop={8} onPress={() => navigation.navigate("VitalHistory")} style={styles.viewAll}>
            <Text variant="small">View all History</Text>
            <Icon name="chevron-forward" size={14} />
          </Pressable>
        </View>
        {notes.length > 0 ? <InsightList lines={notes.slice(0, HOME_INSIGHTS)} /> : null}
      </KeyboardScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.white },
  content: { padding: theme.spacing.lg, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.xxl, gap: theme.spacing.md },
  card: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.xxl, padding: theme.spacing.md, gap: theme.spacing.md },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  name: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexShrink: 1 },
  nameText: { flexShrink: 1 },
  empty: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: theme.spacing.xs },
  footer: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: theme.spacing.sm },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: theme.spacing.xs + 2 },
  current: { fontSize: theme.sizes.heading, lineHeight: Math.round(theme.sizes.heading * 1.3) },
  pills: { flexDirection: "row", gap: theme.spacing.xs },
  pill: { paddingHorizontal: theme.spacing.sm + 2, paddingVertical: theme.spacing.xs + 2, borderRadius: theme.borderRadius.round },
  pillOn: { backgroundColor: theme.colors.primaryLight },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: theme.spacing.sm },
  viewAll: { flexDirection: "row", alignItems: "center", gap: 2 },
});

export default VitalDetail;
