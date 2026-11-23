import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { bookingErrorMessage, pointsToSupport } from "@/src/api/bookingErrors";
import Button from "@/src/components/ui/button";
import { Card, DetailRow, EmptyState } from "@/src/components/ui/card";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Icon from "@/src/components/ui/icon";
import Overlay from "@/src/components/ui/overlay";
import SuccessIllustration from "@/src/components/ui/success-illustration";
import EmptyCalendar from "@/src/components/home/empty-calendar";
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

  const close = () => navigation.goBack();
  const closeRow = (
    <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={close} hitSlop={8} style={styles.close}>
      <Icon name="close-circle-outline" size={22} color={theme.colors.textLight} />
      <Text variant="small" color={theme.colors.textLight}>
        Close
      </Text>
    </Pressable>
  );

  if (done) {
    const refund = booking.data?.refund ?? null;
    const fee = booking.data?.cancelFee ?? null;
    // Back to the page the dialog was opened over (the bookings list); navigating to "Tabs" instead left that page drawn offset.
    const toBookings = () => navigation.goBack();
    return (
      <Overlay align="center" onClose={toBookings}>
        <View style={styles.art}>
          <View style={styles.success}>
            <SuccessIllustration />
          </View>
        </View>
        <Text variant="h3" weight="bold" center color={theme.colors.successTitle}>
          Booking Canceled Successfully
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
        <Button title="Back to Bookings" onPress={toBookings} />
      </Overlay>
    );
  }

  if (!terms) {
    return (
      <Overlay align="center" onClose={close}>
        {closeRow}
        {termsQuery.isError ? (
          <Card tone="warm">
            <Text accessibilityRole="alert">{bookingErrorMessage(termsQuery.error)}</Text>
            <Button small variant="outline" title="Try again" onPress={() => void termsQuery.refetch()} />
          </Card>
        ) : (
          <Text color={theme.colors.textLight}>Checking the cancellation fee…</Text>
        )}
      </Overlay>
    );
  }

  if (!terms.canCancel) {
    return (
      <Overlay align="center" onClose={close}>
        {closeRow}
        <EmptyState title="This booking can't be cancelled" />
        <Text center>{terms.message ?? "This booking can't be cancelled in the app."}</Text>
        {terms.reason === "booking_in_progress" ? <Button title="Contact support" onPress={() => navigation.replace("Contact")} /> : null}
        <Button title="Back" variant="outline" onPress={close} />
      </Overlay>
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
    <Overlay align="center" onClose={close}>
      <ScrollView contentContainerStyle={styles.dialogBody} showsVerticalScrollIndicator={false}>
        {closeRow}
        <View style={styles.art}>
          <View style={styles.calendar}>
            <EmptyCalendar />
          </View>
        </View>
        <Text variant="h3" weight="bold" center color={theme.colors.primary}>
          Are you sure you want to cancel your booking?
        </Text>
        <Text variant="small" color={theme.colors.textLight} center>
          Once you cancel your booking, you won&apos;t have access to a care provider for this visit.
        </Text>
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
        <View style={styles.buttons}>
          <Button title="No, Go Back" onPress={close} disabled={cancel.isPending} style={styles.button} />
          <Button title="Yes, Cancel" variant="outline" loading={cancel.isPending} onPress={confirm} style={styles.button} />
        </View>
        <ErrorDialog visible={dialog !== null} title="Could not cancel" message={dialog?.message ?? ""} onClose={() => setDialog(null)} />
        {dialog?.support ? <Button title="Contact support" variant="outline" onPress={() => navigation.replace("Contact")} /> : null}
      </ScrollView>
    </Overlay>
  );
};

const styles = StyleSheet.create({
  close: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, alignSelf: "flex-start" },
  dialogBody: { gap: theme.spacing.md },
  art: { alignItems: "center", justifyContent: "center", height: 96 },
  calendar: { transform: [{ scale: 1.9 }] },
  success: { transform: [{ scale: 0.5 }] },
  buttons: { flexDirection: "row", gap: theme.spacing.sm },
  button: { flex: 1, paddingHorizontal: theme.spacing.sm },
});

export default CancelBooking;
