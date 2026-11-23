import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import ProviderAvatar from "@/src/components/booking/ProviderAvatar";
import HeaderBack from "@/src/components/back/HeaderBack";
import Button from "@/src/components/ui/button";
import { Card, EmptyState } from "@/src/components/ui/card";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { showsVisitCode, statusLabel, type Booking, type BookingStatus } from "@/src/domain/booking";
import { agoText, distanceText, etaText, isStale, mapsUrl } from "@/src/domain/tracking";
import { useBooking } from "@/src/hooks/useBookings";
import { useLiveTracking } from "@/src/hooks/useTracking";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "CaregiverDetail">;

/**
 * Where the caregiver is, as text: the distance and estimated arrival from the backend, how fresh the position is, and a link that
 * shows it in the phone's own maps app (the Track button). There is no in-app map (it needs a native module and a Google Maps key).
 */
const LiveLocation: React.FC<{ bookingId: string; status: BookingStatus }> = ({ bookingId, status }) => {
  const active = status === "accepted" || status === "en_route";
  const live = useLiveTracking(bookingId, active);
  // Ages are measured at the moment the position was read (the screen reads it again every 15 s), not at render time.
  const now = live.dataUpdatedAt;

  // A query that has been switched off keeps its last answer, so "not active" must hide the card here, not only stop the asking.
  if (!active) return null;
  if (live.isLoading) return <Text color={theme.colors.textLight}>{"Looking for your caregiver's position…"}</Text>;
  if (live.isError) {
    return (
      <Card tone="warm">
        <Text accessibilityRole="alert">{messageForError(live.error)}</Text>
        <Button small variant="outline" title="Try again" onPress={() => void live.refetch()} />
      </Card>
    );
  }
  const tracking = live.data;
  if (!tracking || tracking.kind === "closed") return null;
  if (tracking.kind === "waiting") {
    return (
      <Card>
        <Text weight="bold">Location not shared yet</Text>
        <Text variant="small" color={theme.colors.textLight}>
          {"Your caregiver's position appears here as soon as their phone shares it."}
        </Text>
      </Card>
    );
  }

  const { position } = tracking;
  const stale = isStale(position, now);
  return (
    <Card tone="tint">
      <Text variant="small" color={theme.colors.textLight}>
        {status === "en_route" ? "On the way" : "Assigned"}
      </Text>
      <Text variant="h3" weight="bold">
        {distanceText(position.distanceKm)}
      </Text>
      {status === "en_route" ? <Text>{`Arriving in ${etaText(position.etaMinutes)}`}</Text> : null}
      <Text variant="small" color={stale ? theme.colors.warningText : theme.colors.textLight}>
        {stale ? `Last position ${agoText(position.updatedAt, now)}. It may be out of date.` : `Updated ${agoText(position.updatedAt, now)}`}
      </Text>
    </Card>
  );
};

interface Stage {
  title: string;
  /** Plain text, or the arrival pin line. */
  sub: string;
  reached: boolean;
  current: boolean;
}

/** The stages of the Figma frame, filled from the booking: notified (accepted), enroute, minutes away, arrived. */
function stagesOf(booking: Booking, etaMinutes: number | null): Stage[] {
  const rank = { pending: -1, accepted: 0, en_route: 1, in_progress: 3, completed: 3, cancelled: -1, declined: -1 }[booking.status];
  const arrivalPin = showsVisitCode(booking) && booking.visitCode ? booking.visitCode : null;
  return [
    {
      title: "Caregiver Notified",
      sub: rank >= 0 ? "Your caregiver has accepted this booking" : statusLabel(booking),
      reached: rank >= 0,
      current: rank === 0,
    },
    { title: "Caregiver Enroute", sub: rank >= 1 ? "Your caregiver is on the way" : "Shown when your caregiver sets off", reached: rank >= 1, current: rank === 1 && etaMinutes === null },
    {
      title: etaMinutes !== null && rank === 1 ? `Caregiver is ${etaMinutes} min away` : "Caregiver arrival time",
      sub: etaMinutes !== null && rank === 1 ? "Estimated from your caregiver's position" : "Shown once your caregiver shares their location",
      reached: rank >= 1 && etaMinutes !== null,
      current: rank === 1 && etaMinutes !== null,
    },
    {
      title: "Caregiver has arrived",
      sub: booking.status === "completed" ? "Visit completed" : rank >= 3 ? "Visit in progress" : arrivalPin ? `Give your caregiver Arrival Pin ${arrivalPin}` : "Your arrival pin appears here once a caregiver is assigned",
      reached: rank >= 3,
      current: rank === 3,
    },
  ];
}

/** Where the visit is: the caregiver, the stages of the visit and, while they are on the way, where they are (as text). */
const CaregiverDetail: React.FC<Props> = ({ navigation, route }) => {
  const { id } = route.params;
  const { data: booking, isLoading } = useBooking(id);
  const live = useLiveTracking(id, booking ? booking.status === "accepted" || booking.status === "en_route" : false);

  if (!booking) {
    return (
      <Screen title="Caregiver Details">
        {isLoading ? null : <EmptyState title="We couldn't find this booking" />}
      </Screen>
    );
  }

  const position = live.data?.kind === "live" && (booking.status === "accepted" || booking.status === "en_route") ? live.data.position : null;
  // An arrival time from a stale position is not shown as if it were current.
  const fresh = position !== null && !isStale(position, live.dataUpdatedAt);
  const stages = stagesOf(booking, booking.status === "en_route" && position && fresh ? position.etaMinutes : null);
  const caregiver = booking.caregiver;
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <HeaderBack />
        <View style={styles.titles}>
          <Text variant="page" weight="bold">
            Caregiver Details
          </Text>
          <Text color={theme.colors.textLight}>Follow your visit, step by step</Text>
        </View>
        <View style={styles.provider}>
          <ProviderAvatar uri={caregiver?.photoUrl} name={caregiver?.firstName} />
          <View style={styles.providerText}>
            <Text weight="bold" variant="h3" numberOfLines={1}>
              {caregiver?.firstName ?? "Not assigned yet"}
            </Text>
            <Text variant="small" color={theme.colors.textLight}>
              {caregiver ? (caregiver.role ?? "Health Care Provider") : statusLabel(booking)}
            </Text>
          </View>
        </View>

        <LiveLocation bookingId={id} status={booking.status} />

        {stages.map((stage, index) => (
          <View key={stage.title} style={[styles.stage, !stage.reached && styles.stageDim]} accessibilityLabel={`${stage.title}${stage.reached ? ", done" : ""}`}>
            <View style={styles.stageText}>
              <Text weight="bold" color={stage.reached ? theme.colors.text : theme.colors.textLight}>
                {stage.title}
              </Text>
              <Text variant="small" color={theme.colors.textLight}>
                {stage.sub}
              </Text>
            </View>
            {index === 0 && position ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Track" onPress={() => void Linking.openURL(mapsUrl(position, Platform.OS))} style={styles.track}>
                <Text variant="small" weight="bold" color={theme.colors.white}>
                  Track
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>
      {caregiver ? (
        <View style={styles.footer}>
          <Button title="Chat with Service Provider" onPress={() => navigation.navigate("Chat", { id })} />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.white },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xl },
  titles: { gap: 4, marginTop: theme.spacing.sm },
  provider: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, marginVertical: theme.spacing.sm },
  providerText: { flex: 1, gap: 2 },
  stage: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.md, backgroundColor: theme.colors.primaryLight, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md },
  stageDim: { opacity: 0.75 },
  stageText: { flex: 1, gap: 2 },
  track: { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.round, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
  footer: { padding: theme.spacing.lg, paddingTop: theme.spacing.sm },
});

export default CaregiverDetail;
