import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import VisitCodeCard from "@/src/components/booking/VisitCodeCard";
import Button from "@/src/components/ui/button";
import { Card, EmptyState } from "@/src/components/ui/card";
import Icon from "@/src/components/ui/icon";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { showsVisitCode, statusLabel, type BookingStatus } from "@/src/domain/booking";
import { agoText, distanceText, etaText, isStale, mapsUrl } from "@/src/domain/tracking";
import { useBooking } from "@/src/hooks/useBookings";
import { useLiveTracking } from "@/src/hooks/useTracking";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "CaregiverDetail">;

const STEPS: { status: BookingStatus; label: string }[] = [
  { status: "pending", label: "Finding a caregiver" },
  { status: "accepted", label: "Caregiver assigned" },
  { status: "en_route", label: "Caregiver is on the way" },
  { status: "in_progress", label: "Visit in progress" },
  { status: "completed", label: "Visit completed" },
];

/**
 * Where the caregiver is, as text: the distance and estimated arrival from the backend, how fresh the position is, and a link that
 * shows it in the phone's own maps app. There is no in-app map (it needs a native module and a Google Maps key).
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
      <Button small variant="outline" title="Open in Maps" onPress={() => void Linking.openURL(mapsUrl(position, Platform.OS))} />
    </Card>
  );
};

/** Where the visit is: the caregiver's position while they are on the way, and the steps of the visit. */
const CaregiverDetail: React.FC<Props> = ({ navigation, route }) => {
  const { id } = route.params;
  const { data: booking, isLoading } = useBooking(id);

  if (!booking) {
    return <Screen title="Track caregiver">{isLoading ? null : <EmptyState title="We couldn't find this booking" />}</Screen>;
  }

  const current = STEPS.findIndex((s) => s.status === booking.status);
  return (
    <Screen title="Track caregiver" scroll>
      <Card tone="tint">
        <Text variant="small" color={theme.colors.textLight}>
          Your caregiver
        </Text>
        <Text variant="h3" weight="bold">
          {booking.caregiver?.firstName ?? "Not assigned yet"}
        </Text>
        <Text variant="small">{statusLabel(booking)}</Text>
      </Card>

      <LiveLocation bookingId={id} status={booking.status} />

      {showsVisitCode(booking) && booking.visitCode ? <VisitCodeCard code={booking.visitCode} /> : null}

      <Card>
        {STEPS.map((step, index) => {
          const reached = current >= index;
          return (
            <View key={step.status} style={styles.step} accessibilityLabel={`${step.label}${reached ? ", done" : ""}`}>
              <Icon
                name={reached ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={reached ? theme.colors.success : theme.colors.border}
              />
              <Text color={reached ? theme.colors.text : theme.colors.textLight} weight={index === current ? "bold" : "regular"}>
                {step.label}
              </Text>
            </View>
          );
        })}
      </Card>

      {booking.caregiver ? <Button title="Chat with caregiver" onPress={() => navigation.navigate("Chat", { id })} /> : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  step: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },
});

export default CaregiverDetail;
