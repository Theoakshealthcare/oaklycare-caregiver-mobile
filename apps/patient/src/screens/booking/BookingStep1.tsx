import type React from "react";
import { useState } from "react";

import Button from "@/src/components/ui/button";
import ChipSelect from "@/src/components/ui/chip-select";
import Input from "@/src/components/ui/input";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { dateOptions, timeOptions, toLocalDate } from "@/src/domain/slots";
import { useBookingDraft } from "@/src/hooks/bookingDraft";
import { useNav } from "@/src/navigation/Navigations";

const DATES = dateOptions();
const TIMES = timeOptions();

type Field = "forWhom" | "assistance" | "date" | "time" | "durationHours";

/** Step 1 of 2: who the visit is for, what help they need, and when. v1 books a nurse visit only. */
const BookingStep1: React.FC = () => {
  const navigation = useNav();
  const { draft, patch } = useBookingDraft();
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const set = (fields: Parameters<typeof patch>[0], field: Field) => {
    patch(fields);
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const next = () => {
    const found: Partial<Record<Field, string>> = {};
    if (!draft.forWhom.trim()) found.forWhom = "Tell us who the visit is for";
    if (!draft.assistance.trim()) found.assistance = "Tell us what help is needed";
    if (!draft.date) found.date = "Choose a date";
    if (!draft.time) found.time = "Choose a start time";
    else if (draft.date && toLocalDate(draft.date, draft.time).getTime() < Date.now()) found.time = "Choose a time that has not passed";
    const hours = Number(draft.durationHours);
    if (!draft.durationHours.trim()) found.durationHours = "Enter how many hours";
    else if (!Number.isInteger(hours) || hours < 1 || hours > 24) found.durationHours = "Enter a whole number of hours from 1 to 24";
    setErrors(found);
    if (Object.keys(found).length === 0) navigation.navigate("BookingStep2");
  };

  return (
    <Screen title="Book an Appointment" scroll>
      <Text color={theme.colors.textLight}>Book a nurse visit in 2 steps. Step 1 of 2.</Text>
      <Input
        label="Who are you booking for?"
        placeholder="e.g. My mother"
        value={draft.forWhom}
        onChangeText={(v) => set({ forWhom: v }, "forWhom")}
        error={errors.forWhom}
      />
      <Input label="Service" value="Nurse visit" editable={false} />
      <Input
        label="What help is needed?"
        placeholder="e.g. Walking assistance, wound dressing"
        value={draft.assistance}
        onChangeText={(v) => set({ assistance: v }, "assistance")}
        error={errors.assistance}
      />
      <Input
        label="Health condition (optional)"
        placeholder="e.g. Hypertension"
        value={draft.condition}
        onChangeText={(v) => patch({ condition: v })}
      />
      <ChipSelect label="Preferred date" options={DATES} value={draft.date} onChange={(v) => set({ date: v }, "date")} error={errors.date} />
      <ChipSelect label="Start time" options={TIMES} value={draft.time} onChange={(v) => set({ time: v }, "time")} error={errors.time} />
      <Input
        label="Duration (hours)"
        placeholder="1 to 24"
        value={draft.durationHours}
        onChangeText={(v) => set({ durationHours: v.replace(/\D/g, "") }, "durationHours")}
        keyboardType="number-pad"
        error={errors.durationHours}
      />
      <Button title="Save & Continue" onPress={next} />
    </Screen>
  );
};

export default BookingStep1;
