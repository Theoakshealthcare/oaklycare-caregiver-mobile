import type React from "react";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { paymentMethodErrorMessage } from "@/src/api/bookingErrors";
import AuthPage from "@/src/components/ui/auth-page";
import Button from "@/src/components/ui/button";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Icon from "@/src/components/ui/icon";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { PAYMENT_CHANNEL_LABELS, PAYMENT_CHANNELS, type PaymentChannel } from "@/src/domain/paymentMethods";
import { useBookingDraft } from "@/src/hooks/bookingDraft";
import { useCreateBooking } from "@/src/hooks/useBookings";
import { useNav } from "@/src/navigation/Navigations";

/**
 * Figma "Payment Details": Card Payment or Bank Transfer, then "Make Payment". The booking is created here, not on the
 * summary, because the chosen method has to travel with the call that makes the Paystack link (the first link wins). The
 * payment itself happens on Paystack's secure page: nothing about a card is ever typed in the app. The wallet row of the
 * design is not built, so it is not drawn. With no method picked the field is left out and Paystack shows its own methods.
 */
const PaymentDetails: React.FC = () => {
  const navigation = useNav();
  const { draft, reset } = useBookingDraft();
  const create = useCreateBooking();
  const [channel, setChannel] = useState<PaymentChannel | undefined>(undefined);
  const [dialog, setDialog] = useState<string | null>(null);

  const pay = () =>
    create.mutate(
      { draft, channel },
      {
        onSuccess: ({ booking, paymentError }) => {
          if (paymentError) {
            // The backend cancelled this booking because payment could not start: there is nothing to pay or resume.
            setDialog(`We could not start the payment (${paymentError}). Nothing was charged. Please try again in a moment.`);
            return;
          }
          reset();
          // The form is done: Back from here goes to the bookings list (where an unpaid booking offers "Pay now"), not
          // into the emptied form.
          navigation.reset({
            index: 1,
            routes: [{ name: "Tabs", params: { tab: "bookings", at: Date.now() } }, { name: "PaymentResult", params: { bookingId: booking.id, open: true } }],
          });
        },
        onError: (e) => setDialog(paymentMethodErrorMessage(e)),
      },
    );

  return (
    <AuthPage
      booking
      title="Payment Details"
      subtitle="Book your Appointments in 2 steps"
      gap={theme.spacing.sm + 2}
      footer={<Button title="Make Payment" onPress={pay} loading={create.isPending} />}
    >
      <View accessibilityRole="radiogroup" style={styles.methods}>
        {PAYMENT_CHANNELS.map((option) => {
          const selected = channel === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={PAYMENT_CHANNEL_LABELS[option]}
              accessibilityState={{ selected, disabled: create.isPending }}
              disabled={create.isPending}
              onPress={() => setChannel(option)}
              style={[styles.method, selected && styles.selected]}
            >
              <Text weight="bold" style={styles.methodLabel}>
                {PAYMENT_CHANNEL_LABELS[option]}
              </Text>
              <Icon name="chevron-forward" size={18} color={theme.colors.text} />
            </Pressable>
          );
        })}
      </View>
      <ErrorDialog visible={dialog !== null} title="Could not create the booking" message={dialog ?? ""} onClose={() => setDialog(null)} />
    </AuthPage>
  );
};

const styles = StyleSheet.create({
  methods: { gap: theme.spacing.sm + 2 },
  method: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  methodLabel: { flex: 1 },
  /** Not in the design (it draws no pick): a teal outline is the least that tells the person which row is chosen. */
  selected: { borderColor: theme.colors.primary },
});

export default PaymentDetails;
