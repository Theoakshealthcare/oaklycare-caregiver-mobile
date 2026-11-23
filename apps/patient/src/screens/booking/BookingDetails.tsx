import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import ProviderAvatar from "@/src/components/booking/ProviderAvatar";
import VisitCodeCard from "@/src/components/booking/VisitCodeCard";
import Button from "@/src/components/ui/button";
import { Card, DetailRow, EmptyState } from "@/src/components/ui/card";
import Icon from "@/src/components/ui/icon";
import Overlay from "@/src/components/ui/overlay";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import {
  canCancel,
  canChat,
  canTrack,
  needsPayment,
  paymentChip,
  refundText,
  REFUND_DESTINATION_TEXT,
  showsVisitCode,
  statusLabel,
  type ChipTone,
} from "@/src/domain/booking";
import { durationLabel } from "@/src/domain/bookingChoices";
import { formatDate, formatNaira, formatTime } from "@/src/domain/format";
import { useBooking } from "@/src/hooks/useBookings";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "BookingDetails">;

const TONE: Record<ChipTone, string> = {
  primary: theme.colors.primary,
  success: theme.colors.success,
  warning: theme.colors.warningText,
  error: theme.colors.error,
  neutral: theme.colors.textLight,
};

/** A line of the tinted panel: the label on the left, the value in bold on the right (Figma "Bookings Details"). */
const Row: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <View style={styles.row}>
    <Text variant="small" color={theme.colors.textLight}>
      {label}
    </Text>
    <Text variant="small" weight="bold" color={color} style={styles.rowValue}>
      {value}
    </Text>
  </View>
);

/** The booking as a sheet over the list: the caregiver, the receipt rows and the actions that fit where the booking is. */
const BookingDetails: React.FC<Props> = ({ navigation, route }) => {
  const { id } = route.params;
  const { data: booking, isLoading, isError, error, refetch } = useBooking(id);
  const close = () => navigation.goBack();
  // The sheet gives way to the next page (replace, not push): a page pushed on top of a transparent one is drawn as a card.

  const header = (
    <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" onPress={close} style={styles.close} hitSlop={8}>
      <Icon name="close-circle-outline" size={22} color={theme.colors.textLight} />
      <Text variant="small" color={theme.colors.textLight}>
        Close
      </Text>
    </Pressable>
  );

  if (!booking) {
    return (
      <Overlay align="bottom" onClose={close}>
        <View style={styles.body}>
          {header}
          <Text variant="h3" weight="bold" center>
            Booking Details
          </Text>
          {isLoading ? (
            <Text color={theme.colors.textLight}>Loading…</Text>
          ) : isError ? (
            <Card tone="warm">
              <Text accessibilityRole="alert">{messageForError(error)}</Text>
              <Button small variant="outline" title="Try again" onPress={() => void refetch()} />
            </Card>
          ) : (
            <EmptyState title="We couldn't find this booking" />
          )}
        </View>
      </Overlay>
    );
  }

  const chip = paymentChip(booking);
  const caregiver = booking.caregiver;
  return (
    <Overlay align="bottom" onClose={close}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {header}
        <Text variant="h3" weight="bold" center>
          Booking Details
        </Text>
        <View style={styles.provider}>
          <ProviderAvatar uri={caregiver?.photoUrl} name={caregiver?.firstName} />
          <View style={styles.providerText}>
            <Text weight="bold" variant="h3" numberOfLines={1}>
              {caregiver?.firstName ?? booking.service}
            </Text>
            <Text variant="small" color={theme.colors.textLight}>
              {caregiver ? (caregiver.role ?? "Health Care Provider") : "No caregiver assigned yet"}
            </Text>
          </View>
        </View>
        <Text variant="small" weight="bold">
          Booking Details
        </Text>
        <View style={styles.panel}>
          <Row label="Appointment ID" value={booking.reference} />
          <Row label="Status" value={statusLabel(booking)} />
          <Row label="Service" value={booking.service} />
          <Row label="Booked for" value={booking.bookingFor} />
          <Row label="Appointment Date" value={formatDate(booking.scheduledAt)} />
          <Row label="Time" value={formatTime(booking.scheduledAt)} />
          <Row label="Duration" value={durationLabel(booking.durationMinutes)} />
          <Row label="Address" value={booking.address} />
          <Row label="Amount" value={formatNaira(booking.amount)} />
          <Row label="Payment Status" value={chip.label} color={TONE[chip.tone]} />
        </View>
        {showsVisitCode(booking) && booking.visitCode ? <VisitCodeCard code={booking.visitCode} /> : null}
        {booking.status === "cancelled" && booking.cancelFee !== null ? (
          <Card tone="tint">
            <Text weight="bold">Cancellation</Text>
            <DetailRow label="Cancellation fee" value={booking.cancelFee === 0 ? "Free" : formatNaira(booking.cancelFee)} />
            {booking.refund ? (
              <>
                <DetailRow label="Refund" value={booking.refund.amount === null ? "Amount to be confirmed" : formatNaira(booking.refund.amount)} />
                <Text>{refundText(booking.refund)}</Text>
                <Text variant="small" color={theme.colors.textLight}>
                  {REFUND_DESTINATION_TEXT}
                </Text>
              </>
            ) : (
              <Text variant="small" color={theme.colors.textLight}>
                Nothing was charged, so there is nothing to refund.
              </Text>
            )}
          </Card>
        ) : null}
        <View style={styles.actions}>
          {needsPayment(booking) ? <Button title="Pay now" onPress={() => navigation.replace("PaymentResult", { bookingId: id, open: true })} /> : null}
          {canTrack(booking) ? <Button title="Track caregiver" onPress={() => navigation.replace("CaregiverDetail", { id })} /> : null}
          {canChat(booking) ? <Button title="Chat with caregiver" variant="outline" onPress={() => navigation.replace("Chat", { id })} /> : null}
          {canCancel(booking) ? <Button title="Cancel booking" variant="danger" onPress={() => navigation.replace("CancelBooking", { id })} /> : null}
        </View>
      </ScrollView>
    </Overlay>
  );
};

const styles = StyleSheet.create({
  body: { padding: theme.spacing.lg, gap: theme.spacing.md },
  close: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, alignSelf: "flex-start" },
  provider: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  providerText: { flex: 1, gap: 2 },
  panel: { backgroundColor: theme.colors.primaryLight, borderRadius: theme.borderRadius.xl, padding: theme.spacing.md, gap: theme.spacing.sm + 2 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.md },
  rowValue: { flexShrink: 1, textAlign: "right" },
  actions: { gap: theme.spacing.sm },
});

export default BookingDetails;
