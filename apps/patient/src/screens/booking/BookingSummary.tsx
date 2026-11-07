import type React from "react";
import { useState } from "react";

import { messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import { Card, DetailRow } from "@/src/components/ui/card";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { formatDateTime, formatNaira } from "@/src/domain/format";
import { toLocalDate } from "@/src/domain/slots";
import { useBookingDraft } from "@/src/hooks/bookingDraft";
import { useBookingQuote, useCreateBooking } from "@/src/hooks/useBookings";
import { useNav } from "@/src/navigation/Navigations";
import { specialInstructions } from "@/src/services/bookingMapper";

/** Read-only recap of both steps, the price the backend quoted, and the way into payment (card, via Paystack). */
const BookingSummary: React.FC = () => {
  const navigation = useNav();
  const { draft, reset } = useBookingDraft();
  const quote = useBookingQuote(draft);
  const create = useCreateBooking();
  const [dialog, setDialog] = useState<string | null>(null);
  const notes = specialInstructions(draft);

  const proceed = () =>
    create.mutate(draft, {
      onSuccess: ({ booking, paymentError }) => {
        if (paymentError) {
          // The backend cancelled this booking because payment could not start: there is nothing to pay or resume.
          setDialog(`We could not start the payment (${paymentError}). Nothing was charged. Please try again in a moment.`);
          return;
        }
        reset();
        navigation.replace("PaymentResult", { bookingId: booking.id, open: true });
      },
      onError: (e) => setDialog(messageForError(e)),
    });

  const q = quote.data;
  return (
    <Screen title="Booking Summary" scroll>
      <Card>
        <DetailRow label="Booking for" value={draft.forWhom} />
        <DetailRow label="Service" value={draft.service} />
        <DetailRow label="Help needed" value={draft.assistance} />
        {draft.condition ? <DetailRow label="Condition" value={draft.condition} /> : null}
        <DetailRow label="When" value={draft.date && draft.time ? formatDateTime(toLocalDate(draft.date, draft.time).toISOString()) : ""} />
        <DetailRow label="Duration" value={`${draft.durationHours} hours`} />
        <DetailRow label="Address" value={`${draft.address}, ${draft.city}, ${draft.state}`} />
        {notes ? <DetailRow label="Notes" value={notes} /> : null}
      </Card>
      <Button title="Edit" variant="outline" onPress={() => navigation.navigate("BookingStep1")} />
      <Card tone="tint">
        <Text variant="small" color={theme.colors.textLight}>
          Total to pay
        </Text>
        {q ? (
          <>
            <Text variant="h2" weight="bold">
              {formatNaira(q.total)}
            </Text>
            <DetailRow label="Service fee" value={formatNaira(q.serviceFee)} />
            <DetailRow label="Platform fee" value={formatNaira(q.platformFee)} />
            {q.surgeActive ? (
              <Text variant="small" color={theme.colors.textLight}>
                {`Busy-time pricing applies${q.surgeMultiplier ? ` (x${q.surgeMultiplier})` : ""}.`}
              </Text>
            ) : null}
            {q.discountActive && q.discountPercent ? (
              <Text variant="small" color={theme.colors.textLight}>{`A ${q.discountPercent}% discount is included.`}</Text>
            ) : null}
            {q.peakHoursWarning ? (
              <Text variant="small" color={theme.colors.textLight}>
                {q.peakHoursWarning}
              </Text>
            ) : null}
          </>
        ) : quote.isError ? (
          <>
            <Text color={theme.colors.secondary} accessibilityRole="alert">
              {messageForError(quote.error)}
            </Text>
            <Button small variant="outline" title="Try again" onPress={() => void quote.refetch()} />
          </>
        ) : (
          <Text variant="h2" weight="bold">
            …
          </Text>
        )}
        <Text variant="small" color={theme.colors.textLight}>
          You pay by card.
        </Text>
      </Card>
      <Button title="Proceed to Payment" onPress={proceed} loading={create.isPending} disabled={!q} />
      <ErrorDialog visible={dialog !== null} title="Could not create the booking" message={dialog ?? ""} onClose={() => setDialog(null)} />
    </Screen>
  );
};

export default BookingSummary;
