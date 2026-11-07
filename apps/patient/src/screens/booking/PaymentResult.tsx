import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Icon from "@/src/components/ui/icon";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { usePaymentLinks } from "@/src/hooks/paymentLinks";
import { paymentPolling, usePaymentCheck } from "@/src/hooks/usePaymentCheck";
import { useBooking } from "@/src/hooks/useBookings";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import { openCheckout } from "@/src/services/checkout";

type Props = StackScreenProps<ScreenParamLists, "PaymentResult">;

/**
 * Pay for a booking and find out whether it worked. The checkout opens in the system browser; when it closes the
 * backend is asked (a capped poll). Nothing is shown as paid until the backend says so, so a browser that was
 * cancelled or closed leaves "Payment not confirmed yet" with a way to pay again (`Pay now`).
 */
const PaymentResult: React.FC<Props> = ({ navigation, route }) => {
  const { bookingId, open } = route.params;
  const booking = useBooking(bookingId);
  const url = usePaymentLinks((s) => s.urls[bookingId]);
  const { state, check } = usePaymentCheck(bookingId);
  const [dialog, setDialog] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const autoOpened = useRef(false);

  const pay = useCallback(async () => {
    if (!url) return;
    try {
      setBrowserOpen(true);
      const outcome = await openCheckout(url);
      if (outcome === "closed") {
        setBrowserOpen(false);
        void check();
      }
    } catch (error) {
      setBrowserOpen(false);
      setDialog(messageForError(error));
    }
  }, [url, check]);

  // Arriving from "Proceed to Payment" or "Pay now": open the checkout once.
  useEffect(() => {
    if (open && url && !autoOpened.current) {
      autoOpened.current = true;
      void pay();
    }
  }, [open, url, pay]);

  // A browser that cannot report its own close (Android Custom Tabs): ask when the app comes back to the front.
  useEffect(() => {
    if (!browserOpen) return;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        setBrowserOpen(false);
        void check();
      }
    });
    return () => subscription.remove();
  }, [browserOpen, check]);

  const reference = booking.data?.reference;
  const goBookings = () => navigation.navigate("Tabs", { tab: "bookings", at: Date.now() });
  const viewBooking = () =>
    navigation.reset({
      index: 1,
      routes: [{ name: "Tabs", params: { tab: "bookings", at: Date.now() } }, { name: "BookingDetails", params: { id: bookingId } }],
    });

  if (state.kind === "paid") {
    return (
      <View style={styles.container}>
        <Icon name="checkmark" size={40} color={theme.colors.white} circleColor={theme.colors.success} />
        <Text variant="h2" weight="bold" center>
          Booking confirmed
        </Text>
        <Text color={theme.colors.textLight} center>
          {`${reference ? `Your booking ${reference} is paid. ` : ""}We are finding a caregiver for you.`}
        </Text>
        <Button title="View booking" style={styles.button} onPress={viewBooking} />
        <Button title="Go to bookings" variant="outline" style={styles.button} onPress={goBookings} />
      </View>
    );
  }

  if (state.kind === "paid_refund_required") {
    return (
      <View style={styles.container}>
        <Icon name="information" size={40} color={theme.colors.white} circleColor={theme.colors.secondary} />
        <Text variant="h2" weight="bold" center>
          Payment received, booking not going ahead
        </Text>
        <Text color={theme.colors.textLight} center>
          Your payment arrived after the booking had expired, so the visit will not go ahead. Your payment will be refunded to your original payment method.
        </Text>
        <Button title="Go to bookings" style={styles.button} onPress={goBookings} />
      </View>
    );
  }

  if (state.kind === "checking") {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="h3" weight="bold" center>
          Confirming your payment…
        </Text>
        <Text variant="small" color={theme.colors.textLight} center>{`Checking with our payment provider (${state.attempt} of ${paymentPolling.attempts}).`}</Text>
      </View>
    );
  }

  const notConfirmed = state.kind === "not_confirmed";
  return (
    <View style={styles.container}>
      <Icon name={notConfirmed ? "time-outline" : "card-outline"} size={40} color={theme.colors.white} circleColor={notConfirmed ? theme.colors.secondary : theme.colors.primary} />
      <Text variant="h2" weight="bold" center>
        {notConfirmed ? "Payment not confirmed yet" : "Complete your payment"}
      </Text>
      <Text color={theme.colors.textLight} center>
        {notConfirmed
          ? state.message ??
            "We have not received a payment for this booking yet. If you just paid, it can take a minute to show. Nothing is charged for a booking you do not pay for."
          : url
            ? "Pay by card in the secure payment page. Come back here when you are done."
            : "The payment link for this booking is not available on this phone any more. If you already paid, check the payment below. Otherwise cancel this booking (it is free) and book again."}
      </Text>
      {url ? <Button title="Pay now" style={styles.button} onPress={() => void pay()} /> : null}
      <Button title={notConfirmed ? "Check again" : "I have paid, check now"} variant={url ? "outline" : "primary"} style={styles.button} onPress={() => void check()} />
      {!url ? <Button title="Cancel this booking" variant="danger" style={styles.button} onPress={() => navigation.navigate("CancelBooking", { id: bookingId })} /> : null}
      <Button title="View booking" variant="outline" style={styles.button} onPress={viewBooking} />
      <ErrorDialog visible={dialog !== null} title="Could not open the payment page" message={dialog ?? ""} onClose={() => setDialog(null)} />
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
