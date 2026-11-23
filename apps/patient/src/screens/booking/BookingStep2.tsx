import type React from "react";
import { useEffect, useState } from "react";

import StepBar from "@/src/components/booking/StepBar";
import AuthPage from "@/src/components/ui/auth-page";
import Button from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import Input from "@/src/components/ui/input";
import Select from "@/src/components/ui/select";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { GENDERS, LANGUAGES, STATES } from "@/src/domain/bookingChoices";
import { isEmail } from "@/src/domain/validation";
import { useBookingDraft } from "@/src/hooks/bookingDraft";
import { useMe } from "@/src/hooks/queries";
import { useNav } from "@/src/navigation/Navigations";
import { getCurrentCoordinates, LocationError } from "@/src/services/location";

type Field = "state" | "city" | "address" | "phone" | "email" | "location";

/** A phone number needs at least seven digits (spaces, "+" and dashes are allowed). */
const phoneProblem = (value: string): string | undefined => {
  if (!value.trim()) return "Phone number is required";
  return value.replace(/\D/g, "").length >= 7 ? undefined : "Enter a valid phone number";
};

/** The section headings of Figma's step 2 ("Where do you need Care ?", "Contact Details", "Preference"). */
const Heading: React.FC<{ children: string }> = ({ children }) => (
  <Text weight="bold" style={{ fontSize: theme.sizes.subtitle }} accessibilityRole="header">
    {children}
  </Text>
);

/**
 * Step 2 of 2 (Figma "Book an Appointment"): where the visit takes place, contact details and preferences. The phone's
 * location (the API needs coordinates) and the city are not drawn in Figma but the booking cannot be made without them.
 */
const BookingStep2: React.FC = () => {
  const navigation = useNav();
  const { draft, patch } = useBookingDraft();
  const me = useMe();
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [locating, setLocating] = useState(false);

  // Contact details start as the account's own (and stay editable); a person's typing is never overwritten.
  const accountPhone = me.data?.phone_number ?? "";
  const accountEmail = me.data?.email ?? "";
  useEffect(() => {
    const fill: Parameters<typeof patch>[0] = {};
    if (!draft.phone && accountPhone) fill.phone = accountPhone;
    if (!draft.email && accountEmail) fill.email = accountEmail;
    if (Object.keys(fill).length > 0) patch(fill);
  }, [accountPhone, accountEmail, draft.phone, draft.email, patch]);

  const set = (fields: Parameters<typeof patch>[0], field: Field) => {
    patch(fields);
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const captureLocation = async () => {
    setLocating(true);
    try {
      const { latitude, longitude } = await getCurrentCoordinates();
      set({ latitude, longitude }, "location");
    } catch (error) {
      setErrors((prev) => ({ ...prev, location: error instanceof LocationError ? error.message : "We could not read your location. Please try again." }));
    } finally {
      setLocating(false);
    }
  };

  const next = () => {
    const found: Partial<Record<Field, string>> = {};
    if (!draft.state.trim()) found.state = "State is required";
    if (!draft.city.trim()) found.city = "City is required";
    if (!draft.address.trim()) found.address = "House address is required";
    const phone = phoneProblem(draft.phone);
    if (phone) found.phone = phone;
    if (!draft.email.trim()) found.email = "Email address is required";
    else if (!isEmail(draft.email)) found.email = "Enter a valid email address";
    if (draft.latitude === null || draft.longitude === null) found.location = "Tap “Use my current location” while you are at the visit address";
    setErrors(found);
    if (Object.keys(found).length === 0) navigation.navigate("BookingSummary");
  };

  const located = draft.latitude !== null && draft.longitude !== null;
  return (
    <AuthPage title="Book an Appointment" subtitle="Book your Appointments in 2 steps" gap={20}>
      <StepBar step={2} total={2} />
      <Heading>Where do you need Care ?</Heading>
      <Select label="State" required placeholder="Select" options={STATES} value={draft.state} onChange={(v) => set({ state: v }, "state")} error={errors.state} />
      <Input label="City" required placeholder="e.g. Ikeja" value={draft.city} onChangeText={(v) => set({ city: v }, "city")} error={errors.city} />
      <Input
        label="House Address"
        required
        placeholder="Street, number, landmark"
        value={draft.address}
        onChangeText={(v) => set({ address: v }, "address")}
        error={errors.address}
      />
      <Card tone={located ? "tint" : "plain"}>
        <Text weight="bold">{located ? "Location saved" : "Visit location"}</Text>
        <Text variant="small" color={theme.colors.textLight}>
          {located
            ? "We will look for caregivers near this spot. Tap again if you moved."
            : "Stand at the visit address and tap the button, so we can find caregivers close to it."}
        </Text>
        {errors.location ? (
          <Text variant="small" color={theme.colors.secondary} accessibilityRole="alert">
            {errors.location}
          </Text>
        ) : null}
        <Button small variant={located ? "outline" : "primary"} title={located ? "Update my location" : "Use my current location"} onPress={() => void captureLocation()} loading={locating} />
      </Card>
      <Heading>Contact Details</Heading>
      <Input
        label="Phone Number"
        required
        placeholder="+234…"
        value={draft.phone}
        onChangeText={(v) => set({ phone: v }, "phone")}
        keyboardType="phone-pad"
        autoComplete="tel"
        error={errors.phone}
      />
      <Input
        label="Email Address"
        required
        placeholder="Provide your Email Address"
        value={draft.email}
        onChangeText={(v) => set({ email: v }, "email")}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        error={errors.email}
      />
      <Heading>Preference</Heading>
      <Select label="Language" required placeholder="Select" options={LANGUAGES} value={draft.languagePreference} onChange={(v) => patch({ languagePreference: v })} />
      <Select label="Gender" required placeholder="Select" options={GENDERS} value={draft.genderPreference} onChange={(v) => patch({ genderPreference: v })} />
      <Input
        label="Notes for the caregiver (optional)"
        placeholder="Anything the nurse should know"
        value={draft.instructions}
        onChangeText={(v) => patch({ instructions: v })}
        multiline
      />
      <Button title="Save & Continue" onPress={next} />
    </AuthPage>
  );
};

export default BookingStep2;
