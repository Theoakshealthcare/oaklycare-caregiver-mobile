import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from "react-native";

import { useQueryClient } from "@tanstack/react-query";

import { messageForError } from "@/src/api/errors";
import { queryKeys } from "@/src/api/keys";
import { paymentLinkErrorMessage, paymentLinkOutcome } from "@/src/api/bookingErrors";
import { useBottomBand, useTopBand } from "@/src/components/StatusBar/screenChrome";
import Button from "@/src/components/ui/button";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Icon from "@/src/components/ui/icon";
import SuccessIllustration from "@/src/components/ui/success-illustration";
import Text from "@/src/components/ui/text";
import TextLink from "@/src/components/ui/text-link";
import { theme } from "@/src/constants/theme";
import { fetchPaymentLink } from "@/src/hooks/fetchPaymentLink";
import { usePaymentLinks } from "@/src/hooks/paymentLinks";
import { usePaymentReturn } from "@/src/hooks/paymentReturn";
import { paymentPolling, usePaymentCheck } from "@/src/hooks/usePaymentCheck";
import { formatNaira } from "@/src/domain/format";
import { useBooking } from "@/src/hooks/useBookings";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import { openCheckout } from "@/src/services/checkout";

type Props = StackScreenProps<ScreenParamLists, "PaymentResult">;

/**
 * Pay for a booking and find out whether it worked. The checkout opens in the system browser; when it closes the
 * backend is asked (a capped poll). Nothing is shown as paid until the backend says so, so a browser that was
 * cancelled or closed leaves "Payment not confirmed yet" with a way to pay again (`Pay now`).
 *
 * The checkout URL of a booking created on this phone is kept in memory and used first. After an app restart it is gone, so
 * "Pay now" asks the backend for a link (`POST /booking/{id}/payment-link`) and remembers it. A refusal is read by its
 * `detail.code`: an already-paid booking is confirmed (good news), a booking that can no longer be paid says why and drops
 * "Pay now", anything else keeps "Pay now" so the person can try again.
 */
/** The Figma result frames: a faint page, a round close at the top left, and the content centred. */
/** `top` starts the content under the close button (Figma's success frame) instead of centring it (the failed frame). */
const Frame: React.FC<{ onClose: () => void; children: React.ReactNode; top?: boolean }> = ({ onClose, children, top }) => {
  // The page tint runs edge to edge, over the status bar and under the home indicator too.
  useTopBand(theme.colors.pageTint);
  useBottomBand(theme.colors.pageTint);
  return (
  <View style={styles.frame}>
    <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onClose} style={styles.close}>
      <Icon name="close-circle-outline" size={24} />
    </Pressable>
    <View style={[styles.center, top && styles.top]}>{children}</View>
  </View>
  );
};

const ReceiptRow: React.FC<{ label: string; value: string; green?: boolean }> = ({ label, value, green }) => (
  <View style={styles.receiptRow}>
    <Text variant="small" color={theme.colors.textLight}>
      {label}
    </Text>
    <Text variant="small" weight="bold" color={green ? theme.colors.success : theme.colors.textLight}>
      {value}
    </Text>
  </View>
);

const PaymentResult: React.FC<Props> = ({ navigation, route }) => {
  const { bookingId, open } = route.params;
  const booking = useBooking(bookingId);
  const url = usePaymentLinks((s) => s.urls[bookingId]);
  const { state, check } = usePaymentCheck(bookingId);
  const remember = usePaymentLinks((s) => s.remember);
  const client = useQueryClient();
  const [dialog, setDialog] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  // The booking can no longer be paid (cancelled, expired, someone else's): the sentence replaces "Pay now".
  const [closed, setClosed] = useState<string | null>(null);
  // The backend could not give a link: keep "Pay now" for another try, and offer to cancel the booking (it is free).
  const [linkFailed, setLinkFailed] = useState(false);
  const autoOpened = useRef(false);
  const fetchingRef = useRef(false);

  const pay = useCallback(async () => {
    let target = url;
    if (!target) {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      setFetching(true);
      try {
        target = await fetchPaymentLink(bookingId);
        remember(bookingId, target);
        setLinkFailed(false);
      } catch (error) {
        const outcome = paymentLinkOutcome(error);
        if (outcome === "paid") {
          // Paid a moment ago and the webhook was late: the server settled it. Confirm it the normal way.
          void client.invalidateQueries({ queryKey: queryKeys.bookings });
          void check();
        } else if (outcome === "closed") {
          void client.invalidateQueries({ queryKey: queryKeys.bookings });
          setClosed(paymentLinkErrorMessage(error));
        } else {
          setLinkFailed(true);
          setDialog(paymentLinkErrorMessage(error));
        }
        return;
      } finally {
        fetchingRef.current = false;
        setFetching(false);
      }
    }
    try {
      setBrowserOpen(true);
      const outcome = await openCheckout(target);
      if (outcome === "closed") {
        setBrowserOpen(false);
        void check();
      }
    } catch (error) {
      setBrowserOpen(false);
      setDialog(messageForError(error));
    }
  }, [url, bookingId, remember, client, check]);

  // Arriving from "Proceed to Payment" or "Pay now": open the checkout once (asking the backend for a link if this phone has none).
  useEffect(() => {
    if (open && !autoOpened.current) {
      autoOpened.current = true;
      void pay();
    }
  }, [open, pay]);

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

  // The payment return link ("Return to the app" on the page Paystack ends on) opened the app: ask the backend now.
  const returned = usePaymentReturn((s) => s.pending[bookingId] === true);
  const consumeReturn = usePaymentReturn((s) => s.consume);
  useEffect(() => {
    if (!returned) return;
    consumeReturn(bookingId);
    void check();
  }, [returned, bookingId, consumeReturn, check]);

  const goBookings = () => navigation.navigate("Tabs", { tab: "bookings", at: Date.now() });
  const viewBooking = () =>
    navigation.reset({
      index: 1,
      routes: [{ name: "Tabs", params: { tab: "bookings", at: Date.now() } }, { name: "BookingDetails", params: { id: bookingId } }],
    });

  if (state.kind === "paid") {
    const booking_ = booking.data;
    // "View Caregiver" only when the booking really has one; right after payment the search has only just begun.
    const caregiver = booking_?.caregiver ?? null;
    return (
      <Frame onClose={goBookings} top>
        <SuccessIllustration />
        <Text variant="page" weight="bold" color={theme.colors.paymentSuccess} center style={styles.title}>
          {"Payment Successful.\nBooking Confirmed"}
        </Text>
        <Text variant="small" color={theme.colors.textLight} center style={styles.body}>
          Your payment was received. We are now finding a caregiver for you.
        </Text>
        {booking_ ? (
          <View style={styles.receipt}>
            <ReceiptRow label="Appointment ID" value={booking_.reference} />
            <ReceiptRow label="Amount Paid" value={formatNaira(booking_.amount)} />
            <ReceiptRow label="Payment Status" value="PAID" green />
          </View>
        ) : null}
        <Button title={caregiver ? "View Caregiver" : "View Booking"} style={styles.pill} onPress={viewBooking} />
      </Frame>
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

  if (fetching) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="h3" weight="bold" center>
          Preparing your payment…
        </Text>
      </View>
    );
  }

  if (closed) {
    return (
      <View style={styles.container}>
        <Icon name="information" size={40} color={theme.colors.white} circleColor={theme.colors.secondary} />
        <Text variant="h2" weight="bold" center>
          This booking can&apos;t be paid
        </Text>
        <Text color={theme.colors.textLight} center>
          {closed}
        </Text>
        <Button title="View booking" style={styles.button} onPress={viewBooking} />
        <Button title="Go to bookings" variant="outline" style={styles.button} onPress={goBookings} />
      </View>
    );
  }

  // Paystack itself said the payment was abandoned or failed (the checkout was closed or cancelled): Figma's "Payment Failed" frame.
  if (state.kind === "not_confirmed" && state.declined) {
    return (
      <Frame onClose={goBookings}>
        <Text variant="page" weight="bold" color={theme.colors.secondary} center style={styles.title}>
          Payment Failed! Try Again
        </Text>
        <Text variant="small" color={theme.colors.textLight} center style={styles.body}>
          Your payment did not go through. Nothing is charged unless a payment succeeds, so you can try again.
        </Text>
        <Button title="Try Again" style={styles.pill} onPress={() => void pay()} />
        <TextLink label="Already paid? Check again" center onPress={() => void check()} />
        <ErrorDialog visible={dialog !== null} title="Could not open the payment page" message={dialog ?? ""} onClose={() => setDialog(null)} />
      </Frame>
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
          : linkFailed
            ? "We couldn't get your payment link just now. If you already paid, check the payment below. Otherwise try again, or cancel this booking (it is free) and book again."
            : "Pay by card in the secure payment page. Come back here when you are done."}
      </Text>
      <Button title="Pay now" style={styles.button} onPress={() => void pay()} />
      <Button title={notConfirmed ? "Check again" : "I have paid, check now"} variant="outline" style={styles.button} onPress={() => void check()} />
      {linkFailed ? <Button title="Cancel this booking" variant="danger" style={styles.button} onPress={() => navigation.navigate("CancelBooking", { id: bookingId })} /> : null}
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
  frame: { flex: 1, backgroundColor: theme.colors.pageTint, paddingHorizontal: theme.spacing.md + 4, paddingTop: theme.spacing.lg },
  close: { alignSelf: "flex-start" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: theme.spacing.xxl, gap: theme.spacing.md },
  top: { flex: 0, justifyContent: "flex-start", paddingTop: theme.spacing.lg + 20, paddingBottom: 0 },
  title: { width: "85%" },
  body: { width: "80%" },
  receipt: { alignSelf: "center", width: "80%", backgroundColor: theme.colors.primaryLight, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, gap: theme.spacing.sm + 2, marginTop: theme.spacing.sm },
  receiptRow: { flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.md },
  pill: { width: "80%", marginTop: theme.spacing.sm },
});

export default PaymentResult;
