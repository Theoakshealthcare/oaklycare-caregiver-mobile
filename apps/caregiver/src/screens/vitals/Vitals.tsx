import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { messageForError } from "@/src/api/errors";
import { ErrorState, LoadingState } from "@/src/components/account/StateViews";
import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { NoActiveVisit, VitalsUnavailable } from "@/src/components/vitals/VitalsStates";
import { theme } from "@/src/constants/theme";
import { useBookingsTab, useVitals } from "@/src/hooks/queries";
import useNavigation from "@/src/hooks/use-navigation";
import { vitalsService } from "@/src/services/vitals.service";
import { shareVitalsReport } from "@/src/vitals/report";
import {
  VITAL_KINDS,
  formatUpdated,
  isVitalsAccessDenied,
  latestByKind,
  toReadings,
  vitalsPatients,
  type VitalKindInfo,
} from "@/src/vitals/vitalsModel";

const Tile: React.FC<{ info: VitalKindInfo; value: string | null; unit: string | null; updated: string | null; onPress: () => void }> = ({
  info,
  value,
  unit,
  updated,
  onPress,
}) => (
  <Pressable
    testID={`vital-tile-${info.kind}`}
    accessibilityRole="button"
    accessibilityLabel={`${info.label}, open chart`}
    onPress={onPress}
    style={{ width: "48%", backgroundColor: theme.colors.soft, borderRadius: theme.borderRadius.xl, padding: theme.spacing.md, marginBottom: theme.spacing.md, gap: theme.spacing.sm }}
  >
    <Feather name={info.icon} size={22} color={theme.colors.primary} />
    <Text variant="body" weight="medium">
      {info.label}
    </Text>
    {value ? (
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: theme.spacing.xs, flexWrap: "wrap" }}>
        <Text variant="h3" weight="bold" testID={`vital-value-${info.kind}`}>
          {value}
        </Text>
        {unit ? (
          <Text variant="caption" color={theme.colors.textLight}>
            {unit}
          </Text>
        ) : null}
      </View>
    ) : (
      <Text variant="body" color={theme.colors.textLight} testID={`vital-empty-${info.kind}`}>
        No reading yet
      </Text>
    )}
    <Text variant="caption" color={theme.colors.textLight}>
      {updated ?? " "}
    </Text>
  </Pressable>
);

/**
 * The Vitals tab: the six vitals of the patient on the caregiver's in-progress visit, newest reading
 * of each. The backend allows vitals only during an active visit, so everything else is a clear
 * "available during an active visit" state, not a workaround.
 *
 * `active` is false while another tab is showing, so nothing is fetched until the tab is opened.
 */
const Vitals: React.FC<{ active?: boolean }> = ({ active = true }) => {
  const { navigation } = useNavigation();
  const bookings = useBookingsTab("upcoming");
  const { ready, waiting } = useMemo(() => vitalsPatients(bookings.data ?? []), [bookings.data]);

  const [pickedId, setPickedId] = useState<string | null>(null);
  const patient = ready.find((p) => p.patientId === pickedId) ?? ready[0];
  const vitals = useVitals(patient?.patientId, active);

  // A downloaded report belongs to one patient; it is kept in memory only, tagged with who it is for.
  const [report, setReport] = useState<{ patientId: string; csv: string } | null>(null);
  const [downloading, setDownloading] = useState(false);

  const { refetch: refetchBookings } = bookings;
  const { refetch: refetchVitals } = vitals;
  useEffect(() => {
    if (active) {
      void refetchBookings();
      if (patient) void refetchVitals();
    }
    // Refresh when the tab is opened, not on every change of `patient`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const csv = report && report.patientId === patient?.patientId ? report.csv : null;

  const latest = useMemo(() => latestByKind(toReadings(vitals.data ?? [])), [vitals.data]);

  const download = async () => {
    if (!patient) return;
    setDownloading(true);
    try {
      setReport({ patientId: patient.patientId, csv: await vitalsService.downloadCsv(patient.patientId) });
    } catch (error) {
      Alert.alert("Couldn't download the report", isVitalsAccessDenied(error) ? "Reports are available during an active visit." : messageForError(error));
    } finally {
      setDownloading(false);
    }
  };

  const share = async () => {
    if (csv === null) return;
    try {
      await shareVitalsReport(csv);
    } catch (error) {
      Alert.alert("Couldn't share the report", error instanceof Error ? error.message : messageForError(error));
    }
  };

  const body = () => {
    if (bookings.isError && !bookings.data) return <ErrorState error={bookings.error} onRetry={() => void bookings.refetch()} />;
    if (!bookings.data) return <LoadingState testID="vitals-loading" />;
    if (!patient) return waiting ? <VitalsUnavailable /> : <NoActiveVisit />;
    if (vitals.isError && !vitals.data) {
      return isVitalsAccessDenied(vitals.error) ? (
        <VitalsUnavailable />
      ) : (
        <ErrorState error={vitals.error} onRetry={() => void vitals.refetch()} />
      );
    }
    if (!vitals.data) return <LoadingState testID="vitals-loading" />;

    return (
      <>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.primaryLight, alignItems: "center", justifyContent: "center" }}>
            <Text variant="h3" weight="bold" color={theme.colors.primary}>
              {patient.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="caption" color={theme.colors.textLight}>
              Patient
            </Text>
            <Text variant="body" weight="bold" testID="vitals-patient-name">
              {patient.name}
            </Text>
          </View>
        </View>

        {ready.length > 1 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            {ready.map((p) => (
              <Pressable
                key={p.patientId}
                accessibilityRole="button"
                onPress={() => setPickedId(p.patientId)}
                style={{
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.borderRadius.round,
                  backgroundColor: p.patientId === patient.patientId ? theme.colors.primary : theme.colors.soft,
                }}
              >
                <Text variant="small" weight="medium" color={p.patientId === patient.patientId ? theme.colors.white : theme.colors.text}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
          {VITAL_KINDS.map((info) => {
            const reading = latest[info.kind];
            return (
              <Tile
                key={info.kind}
                info={info}
                value={reading?.value ?? null}
                unit={reading?.unit ?? null}
                updated={reading ? formatUpdated(reading.recordedAt) : null}
                onPress={() => navigation.navigate("VitalDetail", { patientId: patient.patientId, patientName: patient.name, kind: info.kind })}
              />
            );
          })}
        </View>
        <Text variant="caption" color={theme.colors.textLight} style={{ marginBottom: theme.spacing.md }}>
          Last 30 days. Readings are shown as recorded; Oakly does not rate them.
        </Text>

        {csv !== null ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="body" weight="medium" color={theme.colors.primary} testID="vitals-downloaded">
              Vital report downloaded
            </Text>
            <Button title="Share report" onPress={() => void share()} />
          </View>
        ) : (
          <Button title="Download report" variant="outline" onPress={() => void download()} loading={downloading} />
        )}
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <View
        style={{
          backgroundColor: theme.colors.primary,
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.xl,
          paddingBottom: theme.spacing.md,
          borderBottomLeftRadius: theme.borderRadius.xxl,
          borderBottomRightRadius: theme.borderRadius.xxl,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text variant="h2" weight="bold" color={theme.colors.white}>
          Vitals
        </Text>
        {patient ? (
          <Pressable
            accessibilityRole="button"
            testID="add-readings"
            onPress={() => navigation.navigate("AddVitals", { patientId: patient.patientId, patientName: patient.name })}
            style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}
          >
            <Feather name="plus" size={18} color={theme.colors.white} />
            <Text variant="small" weight="medium" color={theme.colors.white}>
              Add new readings
            </Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: theme.spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={bookings.isRefetching || vitals.isRefetching}
            onRefresh={() => {
              void bookings.refetch();
              if (patient) void vitals.refetch();
            }}
          />
        }
      >
        {body()}
      </ScrollView>
    </View>
  );
};

export default Vitals;
