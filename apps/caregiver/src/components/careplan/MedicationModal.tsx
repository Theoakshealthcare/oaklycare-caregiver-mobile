import React, { useState } from "react";
import { View } from "react-native";

import { messageForError } from "@/src/api/errors";
import { FieldHint, FullPageFrame } from "@/src/components/careplan/parts";
import Button from "@/src/components/ui/button";
import DateField from "@/src/components/ui/date-field";
import Input from "@/src/components/ui/input";
import { Select } from "@/src/components/ui/select";
import { theme } from "@/src/constants/theme";
import {
  MEDICATION_FREQUENCIES,
  ONLY_NURSES_HINT,
  buildMedicationBody,
  emptyMedicationDraft,
  errorCode,
  isNoAccess,
  validateMedication,
  validationField,
  type MedicationDraft,
  type MedicationErrors,
} from "@/src/careplan/carePlanModel";
import { useAddMedication } from "@/src/hooks/useCarePlanMedications";
import type { CarePlan } from "@/src/services/carePlans.service";

// The server names a rejected field in the backend's own words; map it to the form field that shows it.
const FIELD_OF: Record<string, keyof MedicationErrors> = {
  name: "name",
  strength: "strength",
  dose_amount: "doseAmount",
  dose_unit: "doseUnit",
  route: "route",
  reason: "reason",
  prescribed_by: "prescribedBy",
  note: "note",
  times_of_day: "times",
  start_date: "startDate",
  end_date: "endDate",
};

/**
 * "Add Medication" (nurses): the medicine as the prescriber ordered it. Every dose field is free text that nothing
 * checks or calculates (a record only). Adding never overwrites anything, so no version is sent.
 */
const MedicationModal: React.FC<{
  plan: CarePlan;
  onClose: () => void;
  onSaved: () => void;
  onNoAccess: () => void;
}> = ({ plan, onClose, onSaved, onNoAccess }) => {
  const add = useAddMedication(plan.id);
  const [draft, setDraft] = useState(emptyMedicationDraft);
  const [errors, setErrors] = useState<MedicationErrors>({});
  const [error, setError] = useState<string | null>(null);

  const set = (key: Exclude<keyof MedicationDraft, "frequency">) => (value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    // Typing into a field that was refused clears its message.
    setErrors((e) => (e[key as keyof MedicationErrors] ? { ...e, [key]: undefined } : e));
  };

  const fail = (e: unknown) => {
    if (isNoAccess(e)) return onNoAccess();
    if (errorCode(e) === "not_a_nurse") return setError(ONLY_NURSES_HINT);
    if (errorCode(e) === "invalid_care_plan") {
      // An end date before the start date (a blank start date means today) shows on the date; the 40-medicine limit shows as the server words it.
      const message = messageForError(e);
      return /end_date/.test(message) ? setErrors({ endDate: "The end date can't be before the start date." }) : setError(message);
    }
    const field = FIELD_OF[validationField(e) ?? ""];
    if (field) return setErrors({ [field]: messageForError(e) });
    setError(messageForError(e));
  };

  const save = () => {
    const found = validateMedication(draft);
    setErrors(found);
    setError(null);
    if (Object.keys(found).length > 0) return;
    add.mutate(buildMedicationBody(draft), { onSuccess: onSaved, onError: fail });
  };

  // The pieces the Figma page has no box for (strength, route, who prescribed it, the clock times) stay on the page after
  // the Figma fields: they are what the care team reads back in the list, and the record is incomplete without them.
  return (
    // Closing while the save is open would lose its answer (success page or error) and invite a duplicate.
    <FullPageFrame
      testID="medication-modal"
      title="Add New Medication Schedule"
      subtitle={`Create new schedule for ${plan.client.full_name}`}
      onClose={() => (add.isPending ? undefined : onClose())}
      footer={<Button testID="medication-save" title="Save Medication" onPress={save} loading={add.isPending} />}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <Input testID="medication-name" label="Enter Medication Name" accessibilityLabel="Medication name" placeholder="As written on the prescription" value={draft.name} onChangeText={set("name")} error={errors.name} />
        <Input testID="medication-reason" label="Reason for Medication" accessibilityLabel="Reason for medication" value={draft.reason} onChangeText={set("reason")} error={errors.reason} />
        <Input testID="medication-dose-amount" label="Enter Medication Dosage" accessibilityLabel="Medication dosage" placeholder="For example: 1" value={draft.doseAmount} onChangeText={set("doseAmount")} error={errors.doseAmount} />
        <Input testID="medication-dose-unit" label="Dosage Unit" accessibilityLabel="Dosage unit" placeholder="For example: tablet" value={draft.doseUnit} onChangeText={set("doseUnit")} error={errors.doseUnit} />
        <Select
          testID="medication-frequency"
          label="Select Usage Time"
          options={MEDICATION_FREQUENCIES.map((f) => ({ label: f.label, value: f.value }))}
          value={draft.frequency}
          onValueChange={(value) => setDraft((d) => ({ ...d, frequency: value as MedicationDraft["frequency"] }))}
        />
        <Input
          testID="medication-times"
          label="Times of Day (24-hour, like 08:00, 20:00)"
          accessibilityLabel="Times of day"
          placeholder="08:00, 20:00"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          value={draft.times}
          onChangeText={set("times")}
          error={errors.times}
        />
        <DateField
          testID="medication-start"
          label="Set Start Date"
          placeholder="Today if left blank"
          value={draft.startDate}
          onChange={(value) => set("startDate")(value)}
          error={errors.startDate}
          containerStyle={{ marginBottom: theme.spacing.md }}
        />
        <DateField
          testID="medication-end"
          label="Set End Date"
          placeholder="Ongoing if left blank"
          value={draft.endDate}
          onChange={(value) => set("endDate")(value)}
          error={errors.endDate}
          containerStyle={{ marginBottom: theme.spacing.md }}
        />
        <Input testID="medication-strength" label="Medicine Strength" accessibilityLabel="Strength" placeholder="For example: 500 mg" value={draft.strength} onChangeText={set("strength")} error={errors.strength} />
        <Input testID="medication-route" label="Route" accessibilityLabel="Route" placeholder="For example: oral" value={draft.route} onChangeText={set("route")} error={errors.route} />
        <Input testID="medication-prescribed-by" label="Prescribed By" accessibilityLabel="Prescribed by" value={draft.prescribedBy} onChangeText={set("prescribedBy")} error={errors.prescribedBy} />
        {/* Figma calls this "Medication Reminder Notes"; Oakly sends no reminders (see the notice), so the label says "Notes". */}
        <Input
          testID="medication-note"
          label="Medication Notes"
          accessibilityLabel="Notes"
          multiline
          inputStyle={{ minHeight: 80, textAlignVertical: "top" }}
          value={draft.note}
          onChangeText={set("note")}
          error={errors.note}
        />
      </View>
      {error ? <FieldHint text={error} testID="medication-error" /> : null}
    </FullPageFrame>
  );
};

export default MedicationModal;
