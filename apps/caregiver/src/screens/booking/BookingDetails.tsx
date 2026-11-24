import React, { useState } from "react";
import { ActivityIndicator, Linking, ScrollView, View } from "react-native";
import type { StackScreenProps } from "@react-navigation/stack";

import { messageForError } from "@/src/api/errors";
import { ActionChip } from "@/src/components/booking/BookingBlocks";
import DeclineDialog from "@/src/components/booking/DeclineDialog";
import Button from "@/src/components/ui/button";
import HeaderBack from "@/src/components/back/HeaderBack";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";
import { useBooking, useBookingEarningRow } from "@/src/hooks/queries";
import { useOfferActions } from "@/src/hooks/useOfferActions";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import type { Booking, Offer } from "@/src/services/booking.service";
import type { CaregiverTransaction } from "@/src/services/wallet.service";
import { buildDirectionsUrl, directionsTarget } from "@/src/utils/maps";
import { formatDuration, formatVisitTime } from "@/src/utils/dates";
import { bookingStatusLabel, serviceName } from "@/src/utils/labels";
import { bookingEarningView } from "@/src/wallet/bookingEarning";

type Props = StackScreenProps<ScreenParamLists, "BookingDetails">;

/** Statuses where the caregiver holds a live visit and the step-by-step flow applies. */
const ACTIVE_STATUSES: string[] = ["accepted", "en_route", "in_progress"];

/** A pale card with rows of "label ....... value": the Service Information and Location blocks of the Figma frame. */
const InfoCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={{ backgroundColor: theme.colors.primaryLight, borderRadius: theme.borderRadius.xl, padding: theme.spacing.md, gap: theme.spacing.md }}>
    {children}
  </View>
);

const Row: React.FC<{ label: string; value: string; testID?: string; valueColor?: string }> = ({ label, value, testID, valueColor }) => (
  <View style={[globalStyles.row, { justifyContent: "space-between", alignItems: "flex-start" }]}>
    <Text variant="small" color={theme.colors.textLight}>
      {label}
    </Text>
    <Text variant="small" weight="medium" color={valueColor} testID={testID} style={{ flexShrink: 1, textAlign: "right" }}>
      {value}
    </Text>
  </View>
);

const Heading: React.FC<{ children: string }> = ({ children }) => (
  <Text variant="body" weight="bold" style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm }}>
    {children}
  </Text>
);

/** The coral "Special Instructions" card; drawn only where the booking carries instructions. */
const Instructions: React.FC<{ text: string }> = ({ text }) => (
  <>
    <Heading>Special Instructions</Heading>
    <View testID="special-instructions" style={{ backgroundColor: theme.colors.promoBackground, borderRadius: theme.borderRadius.xl, padding: theme.spacing.md }}>
      <Text variant="small" color={theme.colors.textLight}>
        {text}
      </Text>
    </View>
  </>
);

/** Offer view: what the caregiver may know before accepting. Nothing about the patient. */
const OfferDetails: React.FC<{ offer: Offer }> = ({ offer }) => (
  <>
    <Heading>Service Information</Heading>
    <InfoCard>
      <Row label="Service Type" value={serviceName(offer.serviceType)} />
      {offer.assistanceType ? <Row label="Care Needed" value={offer.assistanceType} /> : null}
      <Row label="Date & Time" value={formatVisitTime(offer.scheduledDate)} />
      <Row label="Duration" value={formatDuration(offer.durationHours)} />
    </InfoCard>

    <Heading>Location</Heading>
    <InfoCard>
      <Row label="City" value={offer.area} />
    </InfoCard>
    <Text variant="small" color={theme.colors.textLight} style={{ marginTop: theme.spacing.md }}>
      The patient&apos;s name, address and condition are shared with you once you accept this job.
    </Text>
    {offer.response != null ? (
      // Declined, taken or cancelled: there is nothing left to accept or decline.
      <View testID="offer-unavailable" style={{ backgroundColor: theme.colors.soft, padding: 16, borderRadius: 12, marginTop: theme.spacing.lg }}>
        <Text variant="body" weight="bold">
          No longer available
        </Text>
        <Text variant="small" color={theme.colors.textLight} style={{ marginTop: 2 }}>
          {offer.response === "declined"
            ? "You declined this job, so it can't be accepted any more."
            : "This job is no longer open to you."}
        </Text>
      </View>
    ) : null}
  </>
);

/** Accept Job / Decline Job, pinned under the page as in the Figma frame. */
const OfferActions: React.FC<{ busy: boolean; onAccept: () => void; onDecline: () => void }> = ({ busy, onAccept, onDecline }) => (
  <View style={[globalStyles.row, { gap: 12, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, backgroundColor: theme.colors.white }]}>
    <Button title="Accept Job" onPress={onAccept} loading={busy} style={{ flex: 1 }} />
    <Button
      title="Decline Job"
      variant="outline"
      onPress={onDecline}
      disabled={busy}
      style={{ flex: 1, borderColor: theme.colors.secondary }}
      textStyle={{ color: theme.colors.secondary }}
    />
  </View>
);

/** Assigned view: this is now the caregiver's job, so the backend returns the full booking. */
const AssignedDetails: React.FC<{
  booking: Booking;
  /** The visit's earning row in the wallet, once completed; says "Under review" for a held earning. */
  earningRow?: CaregiverTransaction;
  onChat: () => void;
  onNotes: () => void;
  onClient: () => void;
  onVisit: () => void;
}> = ({ booking, earningRow, onChat, onNotes, onClient, onVisit }) => {
  // Only for an active assignment whose booking really carries coordinates.
  const destination = directionsTarget(booking);
  const earning = bookingEarningView(booking, earningRow);
  return (
  <>
    <Heading>Service Information</Heading>
    <InfoCard>
      <Row label="Service Type" value={serviceName(booking.service_type)} />
      {booking.assistance_type ? <Row label="Care Needed" value={booking.assistance_type} /> : null}
      <Row label="Client" value={booking.patient_details?.full_name ?? "N/A"} />
      {booking.patient_details?.phone_number ? <Row label="Phone" value={booking.patient_details.phone_number} /> : null}
      <Row label="Date & Time" value={formatVisitTime(booking.scheduled_date)} />
      <Row label="Duration" value={formatDuration(booking.duration_hours)} />
      <Row label="Status" value={bookingStatusLabel(booking.status)} />
      {booking.arrived_at ? <Row label="Arrival" value="Patient told you've arrived" /> : null}
      {booking.condition ? <Row label="Condition" value={booking.condition} /> : null}
      {earning ? (
        // The caregiver's own share, from the backend (never the family's service fee, DP1-15).
        <View testID="booking-earning" style={{ gap: theme.spacing.md }}>
          <Row label="Payment" value={earning.amount} testID="booking-earning-amount" />
          {earning.statusLabel ? (
            <Row
              label="Payment Status"
              value={earning.statusLabel}
              testID="booking-earning-status"
              valueColor={earning.note ? theme.colors.warningText : theme.colors.successTitle}
            />
          ) : null}
          {earning.note ? (
            <Text variant="small" color={theme.colors.textLight} testID="booking-earning-note" style={{ textAlign: "right" }}>
              {earning.note}
            </Text>
          ) : null}
        </View>
      ) : null}
    </InfoCard>

    <Heading>Location</Heading>
    <InfoCard>
      <Row label="Address" value={booking.patient_address ?? "N/A"} />
      <Row label="City" value={`${booking.patient_city}, ${booking.patient_state}`} />
      {destination ? (
        <View style={{ alignItems: "flex-end" }}>
          <ActionChip label="Get Direction" icon="map-pin" onPress={() => void Linking.openURL(buildDirectionsUrl(destination))} />
        </View>
      ) : null}
    </InfoCard>

    {booking.special_instructions ? <Instructions text={booking.special_instructions} /> : null}

    <View style={{ gap: 12, marginTop: theme.spacing.lg }}>
      {ACTIVE_STATUSES.includes(booking.status) ? <Button title="Open visit steps" onPress={onVisit} /> : null}
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
  const earningRow = useBookingEarningRow(booking);
  const [declining, setDeclining] = useState(false);

  const { accept, decline, busyId } = useOfferActions({
    onAccepted: (id) => navigation.replace("BookingDetails", { bookingId: id }),
    onGone: () => navigation.goBack(),
  });

  const renderBody = () => {
    if (offer) return <OfferDetails offer={offer} />;
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
        earningRow={earningRow}
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
          <View style={{ marginTop: "5%" }}>
            <Text variant="page" weight="bold">
              Job Details
            </Text>
          </View>
          {renderBody()}
        </View>
      </ScrollView>
      {offer && offer.response == null ? (
        <OfferActions busy={busyId === bookingId} onAccept={() => accept(bookingId)} onDecline={() => setDeclining(true)} />
      ) : null}
      <DeclineDialog
        visible={declining}
        onClose={() => setDeclining(false)}
        onConfirm={() => {
          setDeclining(false);
          decline(bookingId);
        }}
      />
    </View>
  );
};

export default BookingDetails;
