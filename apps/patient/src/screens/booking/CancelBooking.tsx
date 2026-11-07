import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { useState } from "react";

import { bookingErrorMessage, pointsToSupport } from "@/src/api/bookingErrors";
import Button from "@/src/components/ui/button";
import { Card, DetailRow, EmptyState } from "@/src/components/ui/card";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Icon from "@/src/components/ui/icon";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { feeReason, refundText, REFUND_DESTINATION_TEXT, type CancelTerms } from "@/src/domain/booking";
import { formatNaira } from "@/src/domain/format";
import { useBooking, useCancelBooking, useCancelTerms } from "@/src/hooks/useBookings";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import { termsFromChangedError } from "@/src/services/booking.service";

type Props = StackScreenProps<ScreenParamLists, "CancelBooking">;

/**
 * Shows what canceling costs BEFORE the person confirms (`cancel-terms`), sends the fee they saw, and ends on the refund
 * summary read from the booking. A fee that rose in the meantime (`409 terms_changed`) is not an error: the new fee is
 * shown and the person is asked again.
 */
const CancelBooking: React.FC<Props> = ({ navigation, route }) => {
  const { id } = route.params;
  const booking = useBooking(id);
  const termsQuery = useCancelTerms(id);
  const cancel = useCancelBooking(id);
  const [done, setDone] = useState(false);
  const [dialog, setDialog] = useState<{ message: string; support: boolean } | null>(null);
  /** The newer terms a `terms_changed` answer carried; they replace what the screen opened with. */
  const [changed, setChanged] = useState<CancelTerms | null>(null);
  const terms = changed ?? termsQuery.data;

  if (done) {
    const refund = booking.data?.refund ?? null;
    const fee = booking.data?.cancelFee ?? null;
    return (
      <Screen title="Cancellation" noBack scroll>
        <Icon name="checkmark" size={36} color={theme.colors.white} circleColor={theme.colors.success} style={{ alignSelf: "center" }} />
        <Text variant="h3" weight="bold" center>
          Booking canceled
        </Text>
        <Card tone="tint">
          {fee !== null ? <DetailRow label="Cancellation fee" value={fee === 0 ? "Free" : formatNaira(fee)} /> : null}
          {refund ? (
            <>
              <DetailRow label="Refund" value={refund.amount === null ? "Amount to be confirmed" : formatNaira(refund.amount)} />
              <Text>{refundText(refund)}</Text>
              <Text variant="small" color={theme.colors.textLight}>
                {REFUND_DESTINATION_TEXT}
              </Text>
            </>
          ) : (
            <Text color={theme.colors.textLight}>You were not charged, so there is nothing to refund.</Text>
          )}
        </Card>
        <Button title="Back to bookings" onPress={() => navigation.navigate("Tabs", { tab: "bookings", at: Date.now() })} />
      </Screen>
    );
  }

  if (!terms) {
    return (
      <Screen title="Cancel booking">
        {termsQuery.isError ? (
          <Card tone="warm">
            <Text accessibilityRole="alert">{bookingErrorMessage(termsQuery.error)}</Text>
            <Button small variant="outline" title="Try again" onPress={() => void termsQuery.refetch()} />
          </Card>
        ) : (
          <Text color={theme.colors.textLight}>Checking the cancellation fee…</Text>
        )}
      </Screen>
    );
  }

  if (!terms.canCancel) {
    return (
      <Screen title="Cancel booking">
        <EmptyState title="This booking can't be cancelled" />
        <Text center>{terms.message ?? "This booking can't be cancelled in the app."}</Text>
        {terms.reason === "booking_in_progress" ? <Button title="Contact support" onPress={() => navigation.navigate("Contact")} /> : null}
        <Button title="Back" variant="outline" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const confirm = () =>
    cancel.mutate(
      { acceptedFeeKobo: terms.feeAmountKobo },
      {
        onSuccess: () => setDone(true),
        onError: (e) => {
          const newer = termsFromChangedError(e);
          if (newer) {
            setChanged(newer);
            return;
          }
          setDialog({ message: bookingErrorMessage(e), support: pointsToSupport(e) });
        },
      },
    );

  const free = terms.feeTier === "none";
  return (
    <Screen title="Cancel booking" scroll>
      <Text variant="h3" weight="bold">
        Are you sure you want to cancel this booking?
      </Text>
      <Text color={theme.colors.textLight}>Once you cancel, you will not have a care provider for this visit.</Text>
      {changed ? (
        <Card tone="warm">
          <Text weight="bold" accessibilityRole="alert">
            The cancellation fee has changed
          </Text>
          <Text variant="small">Nothing was cancelled. Please check the new amount below, then confirm again.</Text>
        </Card>
      ) : null}
      <Card tone={free ? "tint" : "warm"}>
        <Text weight="bold">{free ? "Free cancellation" : `A ${terms.feePercent}% cancellation fee applies`}</Text>
        <Text variant="small" color={theme.colors.textLight}>
          {feeReason(terms)}
        </Text>
        <DetailRow label="Amount paid" value={formatNaira(terms.paidAmount)} />
        <DetailRow label="Cancellation fee" value={free ? "Free" : formatNaira(terms.feeAmount)} />
        <DetailRow label="Refund" value={formatNaira(terms.refundableAmount)} />
        <Text variant="small" color={terms.refundWillBeQueued ? theme.colors.text : theme.colors.textLight}>
          {terms.refundWillBeQueued ? REFUND_DESTINATION_TEXT : "You have not paid yet, so there is nothing to refund."}
        </Text>
      </Card>
      <Button title="No, go back" onPress={() => navigation.goBack()} disabled={cancel.isPending} />
      <Button title="Yes, cancel booking" variant="danger" loading={cancel.isPending} onPress={confirm} />
      <ErrorDialog visible={dialog !== null} title="Could not cancel" message={dialog?.message ?? ""} onClose={() => setDialog(null)} />
      {dialog?.support ? <Button title="Contact support" variant="outline" onPress={() => navigation.navigate("Contact")} /> : null}
    </Screen>
  );
};

export default CancelBooking;
