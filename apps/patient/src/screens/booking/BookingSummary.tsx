import type React from "react";
import { useState } from "react";

import { messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import { Card, DetailRow } from "@/src/components/ui/card";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import SampleNotice from "@/src/components/ui/sample-notice";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { formatDateTime, formatNaira } from "@/src/domain/format";
import { toLocalDate } from "@/src/domain/slots";
import { useBookingDraft } from "@/src/hooks/bookingDraft";
import { useBookingQuote, useCreateBooking } from "@/src/hooks/useBookings";
import { useNav } from "@/src/navigation/Navigations";

/** Read-only recap of both steps, the estimated cost, and the way into payment (card, via Paystack once wired). */
const BookingSummary: React.FC = () => {
  const navigation = useNav();
  const { draft, reset } = useBookingDraft();
  const quote = useBookingQuote(draft);
  const create = useCreateBooking();
  const [dialog, setDialog] = useState<string | null>(null);

  const proceed = () =>
    create.mutate(draft, {
      onSuccess: (bookingId) => {
        reset();
        navigation.replace("PaymentResult", { bookingId, outcome: "success" });
      },
      onError: (e) => setDialog(messageForError(e)),
    });

  return (
    <Screen title="Booking Summary" scroll>
      <SampleNotice what="The price" />
      <Card>
        <DetailRow label="Booking for" value={draft.forWhom} />
        <DetailRow label="Service" value={draft.service} />
        <DetailRow label="Help needed" value={draft.assistance} />
        {draft.condition ? <DetailRow label="Condition" value={draft.condition} /> : null}
        <DetailRow label="When" value={draft.date && draft.time ? formatDateTime(toLocalDate(draft.date, draft.time).toISOString()) : ""} />
        <DetailRow label="Duration" value={`${draft.durationHours} hours`} />
        <DetailRow label="Address" value={`${draft.address}, ${draft.city}, ${draft.state}`} />
        {draft.instructions ? <DetailRow label="Notes" value={draft.instructions} /> : null}
      </Card>
      <Button title="Edit" variant="outline" onPress={() => navigation.navigate("BookingStep1")} />
      <Card tone="tint">
        <Text variant="small" color={theme.colors.textLight}>
          Estimated cost
        </Text>
        <Text variant="h2" weight="bold">
          {quote.data ? formatNaira(quote.data.amount) : "…"}
        </Text>
        <Text variant="small" color={theme.colors.textLight}>
          You pay by card. The final price is confirmed when you pay.
        </Text>
      </Card>
      <Button title="Proceed to Payment" onPress={proceed} loading={create.isPending} />
      <ErrorDialog visible={dialog !== null} title="Could not create the booking" message={dialog ?? ""} onClose={() => setDialog(null)} />
    </Screen>
  );
};

export default BookingSummary;
