import type React from "react";
import { useEffect, useMemo, useState } from "react";

import StepBar from "@/src/components/booking/StepBar";
import AuthPage from "@/src/components/ui/auth-page";
import Button from "@/src/components/ui/button";
import DateTimeField from "@/src/components/ui/date-time-field";
import Input from "@/src/components/ui/input";
import QueryError from "@/src/components/ui/query-error";
import Select from "@/src/components/ui/select";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { ASSISTANCE, CONDITIONS, durationChoices, offeredServices, OTHER, RELATIONS } from "@/src/domain/bookingChoices";
import { isPastSlot } from "@/src/domain/slots";
import { useBookingDraft } from "@/src/hooks/bookingDraft";
import { useBookableServices } from "@/src/hooks/useBookings";
import { useNav } from "@/src/navigation/Navigations";

type Field = "forWhom" | "service" | "assistance" | "assistanceOther" | "conditionOther" | "when" | "duration";

/** Step 1 of 2 (Figma "Book an Appointment"): who the visit is for, the service, the help needed, when and for how long. */
const BookingStep1: React.FC = () => {
  const navigation = useNav();
  const { draft, patch } = useBookingDraft();
  const services = useBookableServices();
  const offered = useMemo(() => offeredServices(services.data ?? []), [services.data]);
  const service = offered.find((s) => s.serviceType === draft.serviceType);
  const lengths = useMemo(() => (service ? durationChoices(service) : []), [service]);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const set = (fields: Parameters<typeof patch>[0], field: Field) => {
    patch(fields);
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // Only one service is on sale today, so it is chosen for the person; if the one kept from an earlier visit is no longer on sale, the first listed is.
  useEffect(() => {
    if (offered.length > 0 && !service) patch({ serviceType: offered[0].serviceType, serviceLabel: offered[0].displayName, durationMinutes: null });
  }, [offered, service, patch]);

  const next = () => {
    const found: Partial<Record<Field, string>> = {};
    if (!draft.forWhom) found.forWhom = "Tell us who the visit is for";
    if (!service) found.service = "Choose a service";
    if (!draft.assistance) found.assistance = "Tell us what help is needed";
    else if (draft.assistance === OTHER && !draft.assistanceOther.trim()) found.assistanceOther = "Type the help that is needed";
    if (draft.condition === OTHER && !draft.conditionOther.trim()) found.conditionOther = "Type the condition";
    if (!draft.date || !draft.time) found.when = "Choose a date and time";
    else if (isPastSlot(draft.date, draft.time)) found.when = "Choose a time that has not passed";
    if (draft.durationMinutes === null || !lengths.some((l) => l.value === String(draft.durationMinutes))) found.duration = "Choose how long the visit should be";
    setErrors(found);
    if (Object.keys(found).length === 0) navigation.navigate("BookingStep2");
  };

  if (services.isError && !services.data) {
    return (
      <AuthPage booking title="Book an Appointment" subtitle="Book your Appointments in 2 steps">
        <QueryError what="the services" error={services.error} onRetry={() => void services.refetch()} />
      </AuthPage>
    );
  }

  const noneOnSale = services.isSuccess && offered.length === 0;
  return (
    <AuthPage booking title="Book an Appointment" subtitle="Book your Appointments in 2 steps">
      <StepBar step={1} total={2} />
      <Select label="Who are you Booking for ?" required placeholder="Select" options={RELATIONS} value={draft.forWhom} onChange={(v) => set({ forWhom: v }, "forWhom")} error={errors.forWhom} />
      <Select
        label="What Services are you Booking ?"
        required
        placeholder="Select"
        options={offered.map((s) => ({ value: s.serviceType, label: s.displayName }))}
        value={draft.serviceType}
        onChange={(v) => {
          const chosen = offered.find((s) => s.serviceType === v);
          if (chosen) set({ serviceType: v, serviceLabel: chosen.displayName, durationMinutes: null }, "service");
        }}
        error={errors.service}
      />
      {noneOnSale ? (
        <Text color={theme.colors.secondary} accessibilityRole="alert">
          No services are available right now. Please try again later.
        </Text>
      ) : null}
      <Select label="What Assistance Do You Need?" required placeholder="Select" options={ASSISTANCE} value={draft.assistance} onChange={(v) => set({ assistance: v }, "assistance")} error={errors.assistance} />
      {draft.assistance === OTHER ? (
        <Input label="Describe the help needed" placeholder="What help does the patient need?" value={draft.assistanceOther} onChangeText={(v) => set({ assistanceOther: v }, "assistanceOther")} error={errors.assistanceOther} />
      ) : null}
      <Select label="Do You Have Any Common Conditions?" placeholder="Select" options={CONDITIONS} value={draft.condition} onChange={(v) => set({ condition: v }, "conditionOther")} />
      {draft.condition === OTHER ? (
        <Input label="Describe the condition" placeholder="e.g. Asthma" value={draft.conditionOther} onChangeText={(v) => set({ conditionOther: v }, "conditionOther")} error={errors.conditionOther} />
      ) : null}
      <DateTimeField
        label="Select Preferred Date and Time"
        required
        date={draft.date}
        time={draft.time}
        onChange={({ date, time }) => set({ date, time }, "when")}
        error={errors.when}
      />
      <Select
        label="Duration"
        required
        placeholder="Select"
        options={lengths}
        value={draft.durationMinutes === null ? "" : String(draft.durationMinutes)}
        onChange={(v) => set({ durationMinutes: Number(v) }, "duration")}
        error={errors.duration}
      />
      <Button title="Save & Continue" onPress={next} disabled={!service} />
    </AuthPage>
  );
};

export default BookingStep1;
