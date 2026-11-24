import type React from "react";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import { useTabTopBand } from "@/src/components/StatusBar/screenChrome";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Icon from "@/src/components/ui/icon";
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view";
import MenuRow from "@/src/components/ui/menu-row";
import QueryError from "@/src/components/ui/query-error";
import Text from "@/src/components/ui/text";
import InsightList from "@/src/components/vitals/InsightList";
import StatusBadge from "@/src/components/vitals/StatusBadge";
import { theme } from "@/src/constants/theme";
import { formatUpdated } from "@/src/domain/format";
import { vitalStatus } from "@/src/domain/vitalStatus";
import { readingText, VITALS } from "@/src/domain/vitals";
import { useDownloadVitals, useVitalInsights, useVitalReadings } from "@/src/hooks/useVitals";
import { useNav } from "@/src/navigation/Navigations";
import { shareVitalsReport } from "@/src/services/vitalsReport";

/** How many AI notes the home shows before "View all History". */
const HOME_INSIGHTS = 2;

/**
 * The Vitals home (Figma "Vital Digital"): the teal header with "Download Report", the six tiles with the latest reading, and
 * "History & Insights". Wearables, Heart Alerts and caregiver access requests are not in v1 (no device or endpoint), so the
 * "Connect to Wearable Device" link, the Wearable / Manual switch and those two sections are left out. Every reading is typed in
 * by hand, so each tile carries a "+" (in the corner where the Normal / Critical badge goes once thresholds are signed).
 */
const Vitals: React.FC = () => {
  const navigation = useNav();
  // The teal header runs up under the clock, as in the design.
  useTabTopBand(theme.colors.primary);
  const readings = useVitalReadings();
  const insights = useVitalInsights();
  const download = useDownloadVitals();
  const [problem, setProblem] = useState<string | null>(null);

  const downloadReport = () =>
    download.mutate(undefined, {
      onSuccess: async (csv) => {
        try {
          await shareVitalsReport(csv);
          navigation.navigate("VitalReport");
        } catch (e) {
          setProblem(messageForError(e));
        }
      },
      onError: (e) => setProblem(messageForError(e)),
    });

  const notes = insights.data ?? [];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text variant="h2" weight="bold" color={theme.colors.white}>
              Vitals
            </Text>
            <Text variant="small" color={theme.colors.white}>
              Real-time Health Metrics
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Download Report"
            accessibilityState={{ busy: download.isPending }}
            disabled={download.isPending}
            hitSlop={8}
            onPress={downloadReport}
            style={styles.download}
          >
            <Icon name="download-outline" size={18} color={theme.colors.white} />
            <Text variant="small" color={theme.colors.white}>
              {download.isPending ? "Preparing…" : "Download Report"}
            </Text>
          </Pressable>
        </View>
      </View>
      <KeyboardScrollView contentContainerStyle={styles.content}>
        {readings.isError ? <QueryError what="your vitals" error={readings.error} onRetry={() => void readings.refetch()} /> : null}
        <View style={styles.grid}>
          {VITALS.map((meta) => {
            const latest = readings.data?.find((r) => r.kind === meta.kind);
            const status = latest ? vitalStatus(latest) : null;
            return (
              <Pressable
                key={meta.kind}
                accessibilityRole="button"
                accessibilityLabel={meta.label}
                onPress={() => navigation.navigate("VitalDetail", { kind: meta.kind })}
                style={styles.tile}
              >
                <View style={styles.tileTop}>
                  <Icon name={meta.icon} size={22} color={meta.tint} />
                  <View style={styles.tileCorner}>
                    {status ? <StatusBadge status={status} /> : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${meta.label} reading`}
                      hitSlop={10}
                      onPress={() => navigation.navigate("AddVital", { kind: meta.kind })}
                    >
                      <Icon name="add-circle-outline" size={24} color={theme.colors.primary} />
                    </Pressable>
                  </View>
                </View>
                <Text weight="medium" style={styles.tileName}>
                  {meta.label}
                </Text>
                {latest ? (
                  <View style={styles.valueRow}>
                    <Text weight="bold" style={styles.value}>
                      {readingText(latest)}
                    </Text>
                    <Text variant="small" color={theme.colors.textLight}>
                      {latest.unit}
                    </Text>
                  </View>
                ) : (
                  <Text weight="bold" color={theme.colors.textLight} style={styles.empty}>
                    No reading yet
                  </Text>
                )}
                <Text variant="small">{latest ? formatUpdated(latest.recordedAt) : " "}</Text>
              </Pressable>
            );
          })}
        </View>

        {notes.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text variant="h3" weight="bold">
                History & Insights
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="View all History" hitSlop={8} onPress={() => navigation.navigate("VitalHistory")} style={styles.viewAll}>
                <Text variant="small">View all History</Text>
                <Icon name="chevron-forward" size={14} />
              </Pressable>
            </View>
            <InsightList lines={notes.slice(0, HOME_INSIGHTS)} />
          </View>
        ) : (
          <MenuRow icon="time-outline" label="History" onPress={() => navigation.navigate("VitalHistory")} />
        )}
        <MenuRow icon="people-outline" label="Who can see my vitals" onPress={() => navigation.navigate("VitalAccess")} />
      </KeyboardScrollView>
      <ErrorDialog visible={problem !== null} title="Could not download your report" message={problem ?? ""} onClose={() => setProblem(null)} />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.white },
  header: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    borderBottomLeftRadius: theme.borderRadius.xxl,
    borderBottomRightRadius: theme.borderRadius.xxl,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: theme.spacing.md },
  headerText: { gap: theme.spacing.xs },
  download: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs + 2, paddingBottom: theme.spacing.xs },
  // Extra bottom room: the last row must clear the floating tab bar without scrolling past it.
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl * 2, gap: theme.spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md },
  tile: { width: "47%", flexGrow: 1, backgroundColor: theme.colors.primaryLight, borderRadius: theme.borderRadius.xl, padding: theme.spacing.md, gap: theme.spacing.xs },
  tileTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tileCorner: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  tileName: { marginTop: theme.spacing.xs },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: theme.spacing.xs + 2 },
  value: { fontSize: theme.sizes.heading, lineHeight: Math.round(theme.sizes.heading * 1.3) },
  empty: { lineHeight: Math.round(theme.sizes.heading * 1.3) },
  section: { gap: theme.spacing.sm },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  viewAll: { flexDirection: "row", alignItems: "center", gap: 2 },
});

export default Vitals;
