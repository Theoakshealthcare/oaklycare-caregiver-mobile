import React from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, View } from "react-native";
import type { StackScreenProps } from "@react-navigation/stack";

import { messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import HeaderBack from "@/src/components/back/HeaderBack";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { DECLINE_MESSAGE, DECLINE_TITLE } from "@/src/constants/offerCopy";
import { theme } from "@/src/constants/theme";
import { useBooking } from "@/src/hooks/queries";
import { useOfferActions } from "@/src/hooks/useOfferActions";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import type { Booking, Offer } from "@/src/services/booking.service";
import { buildDirectionsUrl, directionsTarget } from "@/src/utils/maps";
import { formatDuration, formatVisitTime } from "@/src/utils/dates";
import { bookingStatusLabel, serviceName } from "@/src/utils/labels";

type Props = StackScreenProps<ScreenParamLists, "BookingDetails">;

/** Statuses where the caregiver holds a live visit and the step-by-step flow applies. */
const ACTIVE_STATUSES: string[] = ["accepted", "en_route", "in_progress"];

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={[globalStyles.row, { justifyContent: "space-between", marginBottom: 16 }]}>
    <Text variant="body" color={theme.colors.textLight}>
      {label}
    </Text>
    <Text variant="body" weight="medium" style={{ flexShrink: 1, textAlign: "right" }}>
      {value}
    </Text>
  </View>
);

/** Offer view: what the caregiver may know before accepting. Nothing about the patient. */
const OfferDetails: React.FC<{ offer: Offer; busy: boolean; onAccept: () => void; onDecline: () => void }> = ({
  offer,
  busy,
  onAccept,
  onDecline,
}) => (
  <>
    <Text variant="h3" weight="bold" style={{ marginBottom: 16 }}>
      Service Information
    </Text>
    <Row label="Service" value={serviceName(offer.serviceType)} />
    {offer.assistanceType ? <Row label="Care needed" value={offer.assistanceType} /> : null}
    <Row label="When" value={formatVisitTime(offer.scheduledDate)} />
    <Row label="Duration" value={formatDuration(offer.durationHours)} />
    <Row label="Area" value={offer.area} />
    <Text variant="small" color={theme.colors.textLight} style={{ marginBottom: 24 }}>
      The patient&apos;s name, address and condition are shared with you once you accept this job.
    </Text>
    {offer.response != null ? (
      // Declined, taken or cancelled: there is nothing left to accept or decline.
      <View testID="offer-unavailable" style={{ backgroundColor: theme.colors.soft, padding: 16, borderRadius: 12 }}>
        <Text variant="body" weight="bold">
          No longer available
        </Text>
        <Text variant="small" color={theme.colors.textLight} style={{ marginTop: 2 }}>
          {offer.response === "declined"
            ? "You declined this job, so it can't be accepted any more."
            : "This job is no longer open to you."}
        </Text>
      </View>
    ) : (
      <View style={[globalStyles.row, { gap: 12 }]}>
        <Button title="Accept Job" onPress={onAccept} loading={busy} style={{ flex: 1 }} />
        <Button
          title="Decline Job"
          variant="outline"
          onPress={onDecline}
          disabled={busy}
          style={{ flex: 1, borderColor: theme.colors.error }}
          textStyle={{ color: theme.colors.error }}
        />
      </View>
    )}
  </>
);

/** Assigned view: this is now the caregiver's job, so the backend returns the full booking. */
const AssignedDetails: React.FC<{
  booking: Booking;
  onChat: () => void;
  onNotes: () => void;
  onClient: () => void;
  onVisit: () => void;
}> = ({ booking, onChat, onNotes, onClient, onVisit }) => {
  // Only for an active assignment whose booking really carries coordinates.
  const destination = directionsTarget(booking);
  return (
  <>
    <Text variant="h3" weight="bold" style={{ marginBottom: 16 }}>
      Service Information
    </Text>
    <Row label="Service" value={serviceName(booking.service_type)} />
    {booking.assistance_type ? <Row label="Care needed" value={booking.assistance_type} /> : null}
    <Row label="Patient" value={booking.patient_details?.full_name ?? "N/A"} />
    {booking.patient_details?.phone_number ? <Row label="Phone" value={booking.patient_details.phone_number} /> : null}
    <Row label="When" value={formatVisitTime(booking.scheduled_date)} />
    <Row label="Duration" value={formatDuration(booking.duration_hours)} />
    <Row label="Status" value={bookingStatusLabel(booking.status)} />
    {/* No earning row: the booking carries the family's service fee, not the caregiver's share, and
        showing it read as the caregiver's pay (DP1-15). Needs a caregiver_earning field from the API. */}

    <Text variant="h3" weight="bold" style={{ marginTop: 16, marginBottom: 16 }}>
      Location
    </Text>
    <Row label="Address" value={booking.patient_address ?? "N/A"} />
    <Row label="City" value={`${booking.patient_city}, ${booking.patient_state}`} />

    {booking.condition ? <Row label="Condition" value={booking.condition} /> : null}
    {booking.special_instructions ? (
      <View style={{ backgroundColor: theme.colors.background, padding: 16, borderRadius: 8, marginBottom: 24 }}>
        <Text variant="small" weight="bold" style={{ marginBottom: 4 }}>
          Special instructions
        </Text>
        <Text variant="body">{booking.special_instructions}</Text>
      </View>
    ) : null}

    <View style={{ gap: 12 }}>
      {ACTIVE_STATUSES.includes(booking.status) ? <Button title="Open visit steps" onPress={onVisit} /> : null}
      {destination ? (
        <Button
          title="Get Directions"
          variant="outline"
          onPress={() => void Linking.openURL(buildDirectionsUrl(destination))}
        />
      ) : null}
      {ACTIVE_STATUSES.includes(booking.status) ? <Button title="Client profile" variant="outline" onPress={onClient} /> : null}
      <Button title="Message patient" variant="outline" onPress={onChat} />
      <Button title="Visit notes" variant="outline" onPress={onNotes} />
    </View>
  </>
  );
};

const BookingDetails: React.FC<Props> = ({ route, navigation }) => {
  const { bookingId, offer } = route.params;
  const isOffer = offer !== undefined;
  const { data: booking, isLoading, error, refetch } = useBooking(bookingId, !isOffer);

  const { accept, decline, busyId } = useOfferActions({
    onAccepted: (id) => navigation.replace("BookingDetails", { bookingId: id }),
    onGone: () => navigation.goBack(),
  });

  const confirmDecline = () =>
    Alert.alert(DECLINE_TITLE, DECLINE_MESSAGE, [
      { text: "Cancel", style: "cancel" },
      { text: "Decline", style: "destructive", onPress: () => decline(bookingId) },
    ]);

  const renderBody = () => {
    if (offer) {
      return (
        <OfferDetails
          offer={offer}
          busy={busyId === bookingId}
          onAccept={() => accept(bookingId)}
          onDecline={confirmDecline}
        />
      );
    }
    if (isLoading) return <ActivityIndicator size="large" color={theme.colors.primary} />;
    if (error || !booking) {
      return (
        <View style={{ gap: 12 }}>
          <Text variant="body" color={theme.colors.textLight}>
            {messageForError(error)}
          </Text>
          <Button title="Try again" onPress={() => void refetch()} />
        </View>
      );
    }
    return (
      <AssignedDetails
        booking={booking}
        onChat={() =>
          navigation.navigate("ChatScreen", { bookingId, patientName: booking.patient_details?.full_name })
        }
        onNotes={() => navigation.navigate("AINoteTaker", { bookingId })}
        onClient={() => navigation.navigate("ClientProfile", { bookingId, bookingCode: booking.booking_code })}
        onVisit={() => navigation.navigate("VisitFlow", { bookingId })}
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={globalStyles.container}>
          <HeaderBack />
          <View style={{ marginVertical: "5%" }}>
            <Text variant="h2" weight="bold">
              {isOffer ? "Job Request" : "Job Details"}
            </Text>
          </View>
          {renderBody()}
        </View>
      </ScrollView>
    </View>
  );
};

export default BookingDetails;
