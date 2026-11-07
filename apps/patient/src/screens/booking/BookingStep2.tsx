import type React from "react";
import { useState } from "react";

import Button from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import ChipSelect from "@/src/components/ui/chip-select";
import Input from "@/src/components/ui/input";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useBookingDraft } from "@/src/hooks/bookingDraft";
import { useNav } from "@/src/navigation/Navigations";
import { getCurrentCoordinates, LocationError } from "@/src/services/location";

type Field = "state" | "city" | "address" | "location";

const GENDER = [
  { value: "any", label: "No preference" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];
const LANGUAGE = [
  { value: "any", label: "No preference" },
  { value: "English", label: "English" },
  { value: "Yoruba", label: "Yoruba" },
  { value: "Igbo", label: "Igbo" },
  { value: "Hausa", label: "Hausa" },
  { value: "Pidgin", label: "Pidgin" },
];

/** Step 2 of 2: where the visit takes place (typed address plus the phone's location, which the API needs) and preferences. */
const BookingStep2: React.FC = () => {
  const navigation = useNav();
  const { draft, patch } = useBookingDraft();
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [locating, setLocating] = useState(false);

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
    if (draft.latitude === null || draft.longitude === null) found.location = "Tap “Use my current location” while you are at the visit address";
    setErrors(found);
    if (Object.keys(found).length === 0) navigation.navigate("BookingSummary");
  };

  const located = draft.latitude !== null && draft.longitude !== null;
  return (
    <Screen title="Book an Appointment" scroll>
      <Text color={theme.colors.textLight}>Where should the nurse come? Step 2 of 2.</Text>
      <Input label="State" placeholder="e.g. Lagos" value={draft.state} onChangeText={(v) => set({ state: v }, "state")} error={errors.state} />
      <Input label="City" placeholder="e.g. Ikeja" value={draft.city} onChangeText={(v) => set({ city: v }, "city")} error={errors.city} />
      <Input
        label="House address"
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
      <ChipSelect label="Caregiver gender (optional)" options={GENDER} value={draft.genderPreference} onChange={(v) => patch({ genderPreference: v })} />
      <ChipSelect label="Language (optional)" options={LANGUAGE} value={draft.languagePreference} onChange={(v) => patch({ languagePreference: v })} />
      <Input
        label="Notes for the caregiver (optional)"
        placeholder="Anything the nurse should know"
        value={draft.instructions}
        onChangeText={(v) => patch({ instructions: v })}
        multiline
      />
      <Button title="Save & Continue" onPress={next} />
    </Screen>
  );
};

export default BookingStep2;
