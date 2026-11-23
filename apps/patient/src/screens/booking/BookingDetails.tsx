import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { View } from "react-native";

import { messageForError } from "@/src/api/errors";
import VisitCodeCard from "@/src/components/booking/VisitCodeCard";
import Button from "@/src/components/ui/button";
import { Card, Chip, DetailRow, EmptyState } from "@/src/components/ui/card";
import Screen from "@/src/components/ui/screen";
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
} from "@/src/domain/booking";
import { durationLabel } from "@/src/domain/bookingChoices";
import { formatDate, formatNaira, formatTime } from "@/src/domain/format";
import { useBooking } from "@/src/hooks/useBookings";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "BookingDetails">;

const BookingDetails: React.FC<Props> = ({ navigation, route }) => {
  const { id } = route.params;
  const { data: booking, isLoading, isError, error, refetch } = useBooking(id);

  if (!booking) {
    return (
      <Screen title="Booking details">
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
      </Screen>
    );
  }

  const chip = paymentChip(booking);
  return (
    <Screen title="Booking details" scroll>
      {showsVisitCode(booking) && booking.visitCode ? <VisitCodeCard code={booking.visitCode} /> : null}
      <Card>
        <DetailRow label="Booking ID" value={booking.reference} />
        <DetailRow label="Status" value={statusLabel(booking)} />
        <DetailRow label="Service" value={booking.service} />
        <DetailRow label="Booked for" value={booking.bookingFor} />
        <DetailRow label="Date" value={formatDate(booking.scheduledAt)} />
        <DetailRow label="Time" value={formatTime(booking.scheduledAt)} />
        <DetailRow label="Duration" value={durationLabel(booking.durationMinutes)} />
        <DetailRow label="Address" value={booking.address} />
        {booking.caregiver ? <DetailRow label="Caregiver" value={booking.caregiver.firstName} /> : null}
        <DetailRow label="Amount" value={formatNaira(booking.amount)} />
        <View>
          <Chip label={chip.label} tone={chip.tone} />
        </View>
      </Card>
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
      <View style={{ gap: theme.spacing.sm }}>
        {needsPayment(booking) ? (
          <Button title="Pay now" onPress={() => navigation.navigate("PaymentResult", { bookingId: id, open: true })} />
        ) : null}
        {canTrack(booking) ? <Button title="Track caregiver" onPress={() => navigation.navigate("CaregiverDetail", { id })} /> : null}
        {canChat(booking) ? <Button title="Chat with caregiver" variant="outline" onPress={() => navigation.navigate("Chat", { id })} /> : null}
        {canCancel(booking) ? <Button title="Cancel booking" variant="danger" onPress={() => navigation.navigate("CancelBooking", { id })} /> : null}
      </View>
    </Screen>
  );
};

export default BookingDetails;
