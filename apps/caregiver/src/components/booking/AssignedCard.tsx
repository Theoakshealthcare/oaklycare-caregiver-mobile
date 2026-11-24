import React from "react";
import { Linking } from "react-native";

import { sessionLine, startLabel, statusChip } from "@/src/booking/bookingCardModel";
import { ActionChip, BookingAvatar, BookingCardFrame, BookingLine } from "@/src/components/booking/BookingBlocks";
import type { Booking } from "@/src/services/booking.service";
import { formatDuration, formatVisitTime } from "@/src/utils/dates";
import { buildDirectionsUrl, directionsTarget } from "@/src/utils/maps";

interface Props {
  booking: Booking;
  onView: () => void;
  onStart: () => void;
}

/**
 * A booking this caregiver holds (Bookings, "Upcoming" and "Completed"). The patient is the caregiver's own now, so the
 * name shows. "Start Service" opens the visit steps, as Home's "Clock in" does; "Get Direction" hands off to the phone's maps
 * app (no in-app map) and only shows while the visit is live and the booking really carries coordinates.
 */
const AssignedCard: React.FC<Props> = ({ booking, onView, onStart }) => {
  const name = booking.patient_details?.full_name ?? "Patient";
  const destination = directionsTarget(booking);
  const start = startLabel(booking.status);
  const address = [booking.patient_address, booking.patient_city].filter(Boolean).join(", ");
  return (
    <BookingCardFrame
      testID="assigned-card"
      avatar={<BookingAvatar initial={name.trim().charAt(0).toUpperCase() || undefined} />}
      name={name}
      status={statusChip(booking.status)}
      service={booking.assistance_type}
      price={sessionLine(booking)}
      onOpen={onView}
      lines={
        <>
          {address ? <BookingLine icon="calendar" text={address} testID="booking-address" /> : null}
          <BookingLine icon="clock" text={`${formatVisitTime(booking.scheduled_date)} • ${formatDuration(booking.duration_hours)}`} />
        </>
      }
      actions={
        <>
          <ActionChip label="View Details" icon="file-text" onPress={onView} />
          {start ? <ActionChip label={start} onPress={onStart} /> : null}
          {destination ? (
            <ActionChip label="Get Direction" icon="map-pin" onPress={() => void Linking.openURL(buildDirectionsUrl(destination))} />
          ) : null}
        </>
      }
    />
  );
};

export default AssignedCard;
