import type React from "react";
import { useState } from "react";

import Button from "@/src/components/ui/button";
import Input from "@/src/components/ui/input";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useBookingDraft } from "@/src/hooks/bookingDraft";
import { useNav } from "@/src/navigation/Navigations";

type Field = "state" | "city" | "address";

/** Step 2 of 2: where the visit takes place. */
const BookingStep2: React.FC = () => {
  const navigation = useNav();
  const { draft, patch } = useBookingDraft();
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const set = (fields: Parameters<typeof patch>[0], field: Field) => {
    patch(fields);
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const next = () => {
    const found: Partial<Record<Field, string>> = {};
    if (!draft.state.trim()) found.state = "State is required";
    if (!draft.city.trim()) found.city = "City is required";
    if (!draft.address.trim()) found.address = "House address is required";
    setErrors(found);
    if (Object.keys(found).length === 0) navigation.navigate("BookingSummary");
  };

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
