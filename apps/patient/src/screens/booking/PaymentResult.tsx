import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { StyleSheet, View } from "react-native";

import Button from "@/src/components/ui/button";
import Icon from "@/src/components/ui/icon";
import SampleNotice from "@/src/components/ui/sample-notice";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useBooking } from "@/src/hooks/useBookings";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "PaymentResult">;

/** After paying: the booking is confirmed, or the payment failed and can be retried. */
const PaymentResult: React.FC<Props> = ({ navigation, route }) => {
  const { bookingId, outcome } = route.params;
  const booking = useBooking(bookingId);
  const ok = outcome === "success";

  return (
    <View style={styles.container}>
      <SampleNotice what="Payment" />
      <Icon
        name={ok ? "checkmark" : "close"}
        size={40}
        color={theme.colors.white}
        circleColor={ok ? theme.colors.success : theme.colors.secondary}
      />
      <Text variant="h2" weight="bold" center>
        {ok ? "Booking confirmed" : "Payment failed"}
      </Text>
      <Text color={theme.colors.textLight} center>
        {ok
          ? `${booking.data ? `Your booking ${booking.data.reference} is in. ` : ""}We are finding a caregiver for you.`
          : "Your payment did not go through and nothing was charged. Please try again."}
      </Text>
      {ok ? (
        <>
          <Button title="View booking" style={styles.button} onPress={() => navigation.replace("BookingDetails", { id: bookingId })} />
          <Button
            title="Go to bookings"
            variant="outline"
            style={styles.button}
            onPress={() => navigation.navigate("Tabs", { tab: "bookings", at: Date.now() })}
          />
        </>
      ) : (
        <Button title="Try again" style={styles.button} onPress={() => navigation.navigate("BookingSummary")} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  button: { alignSelf: "stretch" },
});

export default PaymentResult;
