import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { View } from "react-native";

import VisitCodeCard from "@/src/components/booking/VisitCodeCard";
import Button from "@/src/components/ui/button";
import { Card, Chip, DetailRow, EmptyState } from "@/src/components/ui/card";
import SampleNotice from "@/src/components/ui/sample-notice";
import Screen from "@/src/components/ui/screen";
import { theme } from "@/src/constants/theme";
import { canCancel, canTrack, showsVisitCode, statusLabel } from "@/src/domain/booking";
import { formatDate, formatNaira, formatTime } from "@/src/domain/format";
import { useBooking } from "@/src/hooks/useBookings";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "BookingDetails">;

const BookingDetails: React.FC<Props> = ({ navigation, route }) => {
  const { id } = route.params;
  const { data: booking, isLoading } = useBooking(id);

  if (!booking) {
    return (
      <Screen title="Booking details">
        {isLoading ? null : <EmptyState title="We couldn't find this booking" />}
      </Screen>
    );
  }

  return (
    <Screen title="Booking details" scroll>
      <SampleNotice what="This booking" />
      {showsVisitCode(booking) && booking.visitCode ? <VisitCodeCard code={booking.visitCode} /> : null}
      <Card>
        <DetailRow label="Booking ID" value={booking.reference} />
        <DetailRow label="Status" value={statusLabel(booking)} />
        <DetailRow label="Service" value={booking.service} />
        <DetailRow label="Booked for" value={booking.bookingFor} />
        <DetailRow label="Date" value={formatDate(booking.scheduledAt)} />
        <DetailRow label="Time" value={formatTime(booking.scheduledAt)} />
        <DetailRow label="Duration" value={`${booking.durationHours} ${booking.durationHours === 1 ? "hour" : "hours"}`} />
        <DetailRow label="Address" value={booking.address} />
        {booking.caregiver ? <DetailRow label="Caregiver" value={booking.caregiver.name} /> : null}
        <DetailRow label="Amount" value={formatNaira(booking.amount)} />
        <View>
          <Chip
            label={booking.paymentStatus === "paid" ? "PAID" : booking.paymentStatus === "refunded" ? "REFUNDED" : "PAYMENT PENDING"}
            tone={booking.paymentStatus === "paid" ? "success" : booking.paymentStatus === "refunded" ? "neutral" : "warning"}
          />
        </View>
      </Card>
      <View style={{ gap: theme.spacing.sm }}>
        {canTrack(booking) ? <Button title="Track caregiver" onPress={() => navigation.navigate("CaregiverDetail", { id })} /> : null}
        {booking.caregiver ? <Button title="Chat with caregiver" variant="outline" onPress={() => navigation.navigate("Chat", { id })} /> : null}
        {canCancel(booking) ? <Button title="Cancel booking" variant="danger" onPress={() => navigation.navigate("CancelBooking", { id })} /> : null}
      </View>
    </Screen>
  );
};

export default BookingDetails;
