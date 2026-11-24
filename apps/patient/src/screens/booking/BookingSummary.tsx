import type React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { bookingErrorMessage } from "@/src/api/bookingErrors";
import AuthPage from "@/src/components/ui/auth-page";
import Button from "@/src/components/ui/button";
import Icon from "@/src/components/ui/icon";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { conditionText, helpNeeded } from "@/src/domain/booking";
import { durationLabel, GENDERS, LANGUAGES } from "@/src/domain/bookingChoices";
import { formatNaira } from "@/src/domain/format";
import { formatSlot } from "@/src/domain/slots";
import { useBookingDraft } from "@/src/hooks/bookingDraft";
import { useBookingQuote } from "@/src/hooks/useBookings";
import { useNav } from "@/src/navigation/Navigations";

/** Figma writes "Nil" for a value that was left empty. */
const NIL = "Nil";

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.row}>
    <Text variant="small" color={theme.colors.textLight}>
      {label}
    </Text>
    <Text weight="bold">{value || NIL}</Text>
  </View>
);

const Heading: React.FC<{ children: string }> = ({ children }) => (
  <Text weight="bold" style={styles.heading} accessibilityRole="header">
    {children}
  </Text>
);

const choiceLabel = (choices: { value: string; label: string }[], value: string) => choices.find((c) => c.value === value)?.label ?? value;

/** Read-only recap of both steps (Figma "Booking Summary"), the price the backend quoted, and the way on to "Payment Details". */
const BookingSummary: React.FC = () => {
  const navigation = useNav();
  const { draft } = useBookingDraft();
  const quote = useBookingQuote(draft);

  // The booking is made on the next screen, with the payment method chosen there.
  const proceed = () => navigation.navigate("PaymentDetails");

  const q = quote.data;
  const edit = (
    <Pressable accessibilityRole="button" accessibilityLabel="Edit" hitSlop={8} onPress={() => navigation.navigate("BookingStep1")} style={styles.edit}>
      <Text variant="small" color={theme.colors.textLight}>
        Edit
      </Text>
      <Icon name="create-outline" size={18} />
    </Pressable>
  );

  return (
    <AuthPage title="Booking Summary" subtitle="Kindly confirm your appointment details" titleRight={edit} gap={0}>
      <Row label="Who are you Booking for" value={draft.forWhom} />
      <Row label="What Services are you Booking ?" value={draft.serviceLabel} />
      <Row label="What Assistance Do You Need?" value={helpNeeded(draft)} />
      <Row label="Do You Have Any Common Conditions?" value={conditionText(draft) ?? ""} />
      <Row label="Select Preferred Date and Time" value={draft.date && draft.time ? formatSlot(draft.date, draft.time) : ""} />
      <Row label="Duration" value={draft.durationMinutes === null ? "" : durationLabel(draft.durationMinutes)} />
      <Heading>Where do you need Care ?</Heading>
      <Row label="State" value={draft.state} />
      <Row label="City" value={draft.city} />
      <Row label="House Address" value={draft.address} />
      <Heading>Contact Details</Heading>
      <Row label="Phone Number" value={draft.phone} />
      <Row label="Email Address" value={draft.email} />
      <Heading>Preference</Heading>
      <Row label="Language" value={choiceLabel(LANGUAGES, draft.languagePreference)} />
      <Row label="Gender" value={choiceLabel(GENDERS, draft.genderPreference)} />
      {draft.instructions.trim() ? <Row label="Notes for the caregiver" value={draft.instructions.trim()} /> : null}
      <Heading>Service Fee</Heading>
      <View style={styles.cost}>
        {q ? (
          <>
            <View style={styles.costRow}>
              <Text>Estimated Cost</Text>
              <Text weight="bold">{formatNaira(q.total)}</Text>
            </View>
            <View style={styles.costRow}>
              <Text variant="small" color={theme.colors.textLight}>
                Service fee
              </Text>
              <Text variant="small" color={theme.colors.textLight}>
                {formatNaira(q.serviceFee)}
              </Text>
            </View>
            <View style={styles.costRow}>
              <Text variant="small" color={theme.colors.textLight}>
                Platform fee
              </Text>
              <Text variant="small" color={theme.colors.textLight}>
                {formatNaira(q.platformFee)}
              </Text>
            </View>
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
              {bookingErrorMessage(quote.error)}
            </Text>
            <Button small variant="outline" title="Try again" onPress={() => void quote.refetch()} />
          </>
        ) : (
          <View style={styles.costRow}>
            <Text>Estimated Cost</Text>
            <Text weight="bold">…</Text>
          </View>
        )}
      </View>
      <View style={styles.action}>
        <Button title="Proceed to Payment" onPress={proceed} disabled={!q} />
      </View>
    </AuthPage>
  );
};

const styles = StyleSheet.create({
  row: { paddingVertical: theme.spacing.sm + 2, gap: 2, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  heading: { fontSize: theme.sizes.subtitle, marginTop: theme.spacing.md, marginBottom: theme.spacing.xs },
  edit: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  cost: { backgroundColor: theme.colors.soft, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, gap: theme.spacing.xs, marginTop: theme.spacing.xs },
  costRow: { flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.md },
  action: { marginTop: theme.spacing.lg },
});

export default BookingSummary;
