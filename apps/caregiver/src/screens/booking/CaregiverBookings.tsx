import React, { useState } from "react";
import { ActivityIndicator, Image, RefreshControl, ScrollView, TouchableOpacity, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import DeclineDialog from "@/src/components/booking/DeclineDialog";
import OfferCard from "@/src/components/booking/OfferCard";
import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useBookingsTab, type BookingsTab } from "@/src/hooks/queries";
import Navigation from "@/src/hooks/use-navigation";
import { useOfferActions } from "@/src/hooks/useOfferActions";
import { toOffer, type Booking } from "@/src/services/booking.service";
import { formatDuration, formatVisitTime } from "@/src/utils/dates";

const TABS: { id: BookingsTab; title: string }[] = [
  { id: "new_requests", title: "New request" },
  { id: "upcoming", title: "Upcoming" },
  { id: "completed", title: "Completed" },
];

const STATUS_LABEL: Record<string, string> = {
  accepted: "Accepted",
  en_route: "On the way",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const CaregiverBookings: React.FC = () => {
  const { navigation } = Navigation();
  const [activeTab, setActiveTab] = useState<BookingsTab>("new_requests");
  const [declineId, setDeclineId] = useState<string | null>(null);
  const list = useBookingsTab(activeTab);

  const { accept, decline, busyId } = useOfferActions({
    onAccepted: (bookingId) => navigation.navigate("BookingDetails", { bookingId }),
    onGone: () => setDeclineId(null),
  });

  const confirmDecline = () => {
    if (declineId) decline(declineId);
    setDeclineId(null);
  };

  const bookings: Booking[] = list.data ?? [];

  const renderAssigned = (booking: Booking) => (
    <TouchableOpacity
      key={booking.id}
      activeOpacity={0.8}
      onPress={() => navigation.navigate("BookingDetails", { bookingId: booking.id })}
      style={{ backgroundColor: theme.colors.white, borderRadius: 12, padding: 16, marginBottom: 16, elevation: 3 }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text variant="h3" weight="bold" style={{ flex: 1 }}>
          {booking.patient_details?.full_name ?? "Patient"}
        </Text>
        <Text variant="small" color={theme.colors.primary} weight="medium">
          {STATUS_LABEL[booking.status] ?? booking.status}
        </Text>
      </View>
      <Text variant="body" color={theme.colors.primary} style={{ marginTop: 4 }}>
        {booking.assistance_type}
      </Text>
      <Text variant="body" color={theme.colors.textLight} style={{ marginTop: 8 }}>
        {booking.patient_address}
      </Text>
      <Text variant="body" color={theme.colors.textLight}>
        {formatVisitTime(booking.scheduled_date)} {"•"} {formatDuration(booking.duration_hours)}
      </Text>
    </TouchableOpacity>
  );

  const renderBody = () => {
    if (list.isLoading) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      );
    }
    if (list.isError) {
      return (
        <View style={{ alignItems: "center", marginTop: 50, gap: 12, paddingHorizontal: 20 }}>
          <Text variant="body" color={theme.colors.textLight} center>
            {messageForError(list.error)}
          </Text>
          <Button title="Try again" onPress={() => void list.refetch()} />
        </View>
      );
    }
    return (
      <ScrollView
        style={{ paddingHorizontal: 20 }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
      >
        {bookings.length === 0 ? (
          <View style={{ alignItems: "center", marginTop: 50 }}>
            <Image
              source={require("@/assets/images/pngs/calendar-remove.png")}
              style={{ width: 120, height: 120, marginBottom: 16 }}
            />
            <Text variant="h3" weight="bold" center style={{ marginBottom: 8 }}>
              {activeTab === "new_requests" ? "No job requests right now" : "Nothing here yet"}
            </Text>
            <Text variant="body" color={theme.colors.textLight} center>
              {activeTab === "new_requests"
                ? "New requests near you will show up here. Pull down to refresh."
                : "Your visits will show up here."}
            </Text>
          </View>
        ) : activeTab === "new_requests" ? (
          // Offers: rendered from the narrow offer view only (no patient identity before accepting).
          bookings.map((booking) => {
            const offer = toOffer(booking);
            return (
              <OfferCard
                key={offer.id}
                offer={offer}
                busy={busyId === offer.id}
                onView={() => navigation.navigate("BookingDetails", { bookingId: offer.id, offer })}
                onAccept={() => accept(offer.id)}
                onDecline={() => setDeclineId(offer.id)}
              />
            );
          })
        ) : (
          bookings.map(renderAssigned)
        )}
      </ScrollView>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.primary }}>
      <View style={{ paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 }}>
        <Text variant="h2" weight="bold" color={theme.colors.white}>
          Bookings
        </Text>
      </View>

      <View
        style={{
          backgroundColor: theme.colors.white,
          borderRadius: 30,
          padding: 4,
          marginHorizontal: 20,
          marginBottom: 20,
          flexDirection: "row",
        }}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 4,
              borderRadius: 25,
              backgroundColor: activeTab === tab.id ? theme.colors.primary : "transparent",
              alignItems: "center",
            }}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text
              variant="body"
              weight="medium"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              color={activeTab === tab.id ? theme.colors.white : theme.colors.textLight}
            >
              {tab.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 20,
        }}
      >
        {renderBody()}

        <DeclineDialog visible={declineId !== null} onClose={() => setDeclineId(null)} onConfirm={confirmDecline} />
      </View>
    </View>
  );
};

export default CaregiverBookings;
