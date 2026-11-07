import type React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Card } from "@/src/components/ui/card";
import Icon from "@/src/components/ui/icon";
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view";
import QueryError from "@/src/components/ui/query-error";
import Text from "@/src/components/ui/text";
import MenuRow from "@/src/components/ui/menu-row";
import { theme } from "@/src/constants/theme";
import { formatDateTime } from "@/src/domain/format";
import { readingText, VITALS } from "@/src/domain/vitals";
import { useNav } from "@/src/navigation/Navigations";
import { useVitalReadings } from "@/src/hooks/useVitals";

/** The six vitals as tiles (latest reading each); "+" opens manual entry. Wearables are not part of v1. */
const Vitals: React.FC = () => {
  const navigation = useNav();
  const readings = useVitalReadings();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text variant="h2" weight="bold" color={theme.colors.white}>
          Vitals
        </Text>
        <Text color={theme.colors.white}>Your health numbers, in one place</Text>
      </View>
      <KeyboardScrollView contentContainerStyle={styles.content}>
        {readings.isError ? <QueryError what="your vitals" error={readings.error} onRetry={() => void readings.refetch()} /> : null}
        <View style={styles.grid}>
          {VITALS.map((meta) => {
            const latest = readings.data?.find((r) => r.kind === meta.kind);
            return (
              <Card
                key={meta.kind}
                tone="tint"
                style={styles.tile}
                onPress={() => navigation.navigate("VitalDetail", { kind: meta.kind })}
                accessibilityLabel={meta.label}
              >
                <View style={styles.tileTop}>
                  <Icon name={meta.icon} size={20} color={theme.colors.primary} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${meta.label} reading`}
                    hitSlop={8}
                    onPress={() => navigation.navigate("AddVital", { kind: meta.kind })}
                  >
                    <Icon name="add-circle" size={26} color={theme.colors.primary} />
                  </Pressable>
                </View>
                <Text variant="small" color={theme.colors.textLight}>
                  {meta.label}
                </Text>
                <Text variant="h3" weight="bold">
                  {latest ? readingText(latest) : "No reading yet"}
                </Text>
                <Text variant="small" color={theme.colors.textLight}>
                  {latest ? `${meta.unit} · ${formatDateTime(latest.recordedAt)}` : meta.unit}
                </Text>
              </Card>
            );
          })}
        </View>
        <MenuRow icon="time-outline" label="History" onPress={() => navigation.navigate("VitalHistory")} />
        <MenuRow icon="people-outline" label="Who can see my vitals" onPress={() => navigation.navigate("VitalAccess")} />
      </KeyboardScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.white },
  header: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
    borderBottomLeftRadius: theme.borderRadius.xxl,
    borderBottomRightRadius: theme.borderRadius.xxl,
  },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md },
  tile: { width: "47%", flexGrow: 1 },
  tileTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});

export default Vitals;
