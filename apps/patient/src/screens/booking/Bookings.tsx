import type React from "react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import Button from "@/src/components/ui/button";
import { Card, Chip, DetailRow, EmptyState } from "@/src/components/ui/card";
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view";
import SampleNotice from "@/src/components/ui/sample-notice";
import SegmentedControl from "@/src/components/ui/segmented-control";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { canCancel, canTrack, statusLabel, tabForStatus, type BookingTab } from "@/src/domain/booking";
import { formatDateTime, formatNaira } from "@/src/domain/format";
import { useBookings } from "@/src/hooks/useBookings";
import { useNav } from "@/src/navigation/Navigations";

const TABS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
] as const;

const EMPTY: Record<BookingTab, string> = {
  upcoming: "No upcoming bookings",
  completed: "No completed bookings yet",
  canceled: "No canceled bookings",
};

const Bookings: React.FC = () => {
  const navigation = useNav();
  const bookings = useBookings();
  const [tab, setTab] = useState<BookingTab>("upcoming");
  const shown = (bookings.data ?? []).filter((b) => tabForStatus(b.status) === tab);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text variant="h2" weight="bold" color={theme.colors.white}>
          Bookings
        </Text>
        <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      </View>
      <KeyboardScrollView contentContainerStyle={styles.content}>
        <SampleNotice what="Your bookings" />
        {shown.length === 0 ? (
          <EmptyState title={EMPTY[tab]} />
        ) : (
          shown.map((booking) => (
            <Card key={booking.id} accessibilityLabel={`Booking ${booking.reference}`}>
              <View style={styles.rowBetween}>
                <Text weight="bold">{booking.reference}</Text>
                <Chip
                  label={statusLabel(booking)}
                  tone={booking.status === "cancelled" || booking.status === "declined" ? "error" : booking.status === "completed" ? "success" : "primary"}
                />
              </View>
              <DetailRow label="Service" value={booking.service} />
              <DetailRow label="For" value={booking.bookingFor} />
              <DetailRow label="When" value={formatDateTime(booking.scheduledAt)} />
              <DetailRow label="Amount" value={formatNaira(booking.amount)} />
              <View style={styles.actions}>
                {canTrack(booking) ? <Button small title="Track" onPress={() => navigation.navigate("CaregiverDetail", { id: booking.id })} /> : null}
                {booking.caregiver && tab === "upcoming" ? (
                  <Button small variant="outline" title="Chat" onPress={() => navigation.navigate("Chat", { id: booking.id })} />
                ) : null}
                {canCancel(booking) ? <Button small variant="danger" title="Cancel" onPress={() => navigation.navigate("CancelBooking", { id: booking.id })} /> : null}
                <Button small variant="outline" title="Booking Details" onPress={() => navigation.navigate("BookingDetails", { id: booking.id })} />
              </View>
            </Card>
          ))
        )}
      </KeyboardScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.white },
  header: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderBottomLeftRadius: theme.borderRadius.xxl,
    borderBottomRightRadius: theme.borderRadius.xxl,
  },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
});

export default Bookings;
