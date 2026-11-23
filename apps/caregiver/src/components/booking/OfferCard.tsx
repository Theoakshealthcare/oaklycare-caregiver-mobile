import React from "react";

import { ActionChip, BookingAvatar, BookingCardFrame, BookingLine } from "@/src/components/booking/BookingBlocks";
import type { Offer } from "@/src/services/booking.service";
import { formatDuration, formatVisitTime } from "@/src/utils/dates";
import { serviceName } from "@/src/utils/labels";

interface Props {
  offer: Offer;
  busy?: boolean;
  onView: () => void;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * A job offered to the caregiver (Bookings, "New Request"). It takes the narrow {@link Offer} type, never a full
 * booking, so no patient identity can be shown before the caregiver accepts: the card is titled by the service, as Home
 * does, because the offer carries no name (Figma shows the patient's first name and last initial here).
 *
 * No price line: the caregiver's own figure (`caregiver_earning`) is null until the job is accepted, and the booking's
 * total is what the family pays, which is never shown to a caregiver.
 */
const OfferCard: React.FC<Props> = ({ offer, busy = false, onView, onAccept, onDecline }) => (
  <BookingCardFrame
    testID="offer-card"
    avatar={<BookingAvatar />}
    name={serviceName(offer.serviceType)}
    service={offer.assistanceType}
    onOpen={onView}
    lines={
      <>
        <BookingLine icon="calendar" text={offer.area} testID="offer-area" />
        <BookingLine icon="clock" text={`${formatVisitTime(offer.scheduledDate)} • ${formatDuration(offer.durationHours)}`} />
      </>
    }
    actions={
      <>
        <ActionChip label="View Details" icon="file-text" onPress={onView} disabled={busy} />
        <ActionChip label="Decline" icon="x-circle" tone="coral" onPress={onDecline} disabled={busy} />
        <ActionChip label={busy ? "Accepting..." : "Accept"} icon="check-circle" onPress={onAccept} disabled={busy} />
      </>
    }
  />
);

export default OfferCard;
