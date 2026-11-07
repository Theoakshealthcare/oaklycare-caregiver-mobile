import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { StyleSheet, View } from "react-native";

import VisitCodeCard from "@/src/components/booking/VisitCodeCard";
import Button from "@/src/components/ui/button";
import { Card, EmptyState } from "@/src/components/ui/card";
import Icon from "@/src/components/ui/icon";
import SampleNotice from "@/src/components/ui/sample-notice";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { showsVisitCode, statusLabel, type BookingStatus } from "@/src/domain/booking";
import { useBooking } from "@/src/hooks/useBookings";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "CaregiverDetail">;

const STEPS: { status: BookingStatus; label: string }[] = [
  { status: "pending", label: "Finding a caregiver" },
  { status: "accepted", label: "Caregiver assigned" },
  { status: "en_route", label: "Caregiver is on the way" },
  { status: "in_progress", label: "Visit in progress" },
  { status: "completed", label: "Visit completed" },
];

/** Where the visit is, as a checklist of steps. The live map comes with the tracking slice. */
const CaregiverDetail: React.FC<Props> = ({ navigation, route }) => {
  const { id } = route.params;
  const { data: booking, isLoading } = useBooking(id);

  if (!booking) {
    return <Screen title="Track caregiver">{isLoading ? null : <EmptyState title="We couldn't find this booking" />}</Screen>;
  }

  const current = STEPS.findIndex((s) => s.status === booking.status);
  return (
    <Screen title="Track caregiver" scroll>
      <SampleNotice what="Tracking" />
      <Card tone="tint">
        <Text variant="small" color={theme.colors.textLight}>
          Your caregiver
        </Text>
        <Text variant="h3" weight="bold">
          {booking.caregiver?.name ?? "Not assigned yet"}
        </Text>
        <Text variant="small">{statusLabel(booking)}</Text>
      </Card>

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
