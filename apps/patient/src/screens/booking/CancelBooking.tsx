import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { useState } from "react";

import { messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import { Card, DetailRow, EmptyState } from "@/src/components/ui/card";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Icon from "@/src/components/ui/icon";
import SampleNotice from "@/src/components/ui/sample-notice";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { formatNaira } from "@/src/domain/format";
import { useBooking, useCancelBooking, useCancelTerms } from "@/src/hooks/useBookings";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "CancelBooking">;

/** Shows what canceling costs (free / 20% / 50%) BEFORE the person confirms, then a plain success page. */
const CancelBooking: React.FC<Props> = ({ navigation, route }) => {
  const { id } = route.params;
  const booking = useBooking(id);
  const terms = useCancelTerms(id);
  const cancel = useCancelBooking(id);
  const [done, setDone] = useState(false);
  const [dialog, setDialog] = useState<string | null>(null);

  if (done) {
    return (
      <Screen title="Booking canceled" noBack>
        <Icon name="checkmark" size={36} color={theme.colors.white} circleColor={theme.colors.success} style={{ alignSelf: "center" }} />
        <Text variant="h3" weight="bold" center>
          Booking canceled successfully
        </Text>
        <Text color={theme.colors.textLight} center>
          Any refund is handled by Oakly support, who will get in touch with you.
        </Text>
        <Button title="Back to bookings" onPress={() => navigation.navigate("Tabs", { tab: "bookings", at: Date.now() })} />
      </Screen>
    );
  }

  if (!booking.data || !terms.data) {
    return (
      <Screen title="Cancel booking">
        {booking.isLoading ? null : <EmptyState title="We couldn't find this booking" />}
      </Screen>
    );
  }

  const { feePercent, feeAmount, refundAmount } = terms.data;
  return (
    <Screen title="Cancel booking" scroll>
      <SampleNotice what="The fee shown here" />
      <Text variant="h3" weight="bold">
        Are you sure you want to cancel this booking?
      </Text>
      <Text color={theme.colors.textLight}>Once you cancel, you will not have a care provider for this visit.</Text>
      <Card tone={feePercent === 0 ? "tint" : "warm"}>
        <Text weight="bold">{feePercent === 0 ? "Free cancellation" : `A ${feePercent}% cancellation fee applies`}</Text>
        <DetailRow label="Amount paid" value={formatNaira(booking.data.amount)} />
        <DetailRow label="Cancellation fee" value={formatNaira(feeAmount)} />
        <DetailRow label="Eligible for refund" value={formatNaira(refundAmount)} />
        <Text variant="small" color={theme.colors.textLight}>
          Refunds are handled by Oakly support after you cancel.
        </Text>
      </Card>
      <Button title="No, go back" onPress={() => navigation.goBack()} disabled={cancel.isPending} />
      <Button
        title="Yes, cancel booking"
        variant="danger"
        loading={cancel.isPending}
        onPress={() =>
          cancel.mutate(undefined, { onSuccess: () => setDone(true), onError: (e) => setDialog(messageForError(e)) })
        }
      />
      <ErrorDialog visible={dialog !== null} title="Could not cancel" message={dialog ?? ""} onClose={() => setDialog(null)} />
    </Screen>
  );
};

export default CancelBooking;
