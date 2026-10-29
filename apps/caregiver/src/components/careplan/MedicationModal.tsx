import React, { useState } from "react";
import { View } from "react-native";

import { messageForError } from "@/src/api/errors";
import { Chip, FieldHint, ModalFrame } from "@/src/components/careplan/parts";
import Button from "@/src/components/ui/button";
import Input from "@/src/components/ui/input";
import Text from "@/src/components/ui/text";
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

  return (
    // Closing while the save is open would lose its answer (success page or error) and invite a duplicate.
    <ModalFrame testID="medication-modal" title="Add Medication" onClose={() => (add.isPending ? undefined : onClose())}>
      <Text variant="small" color={theme.colors.textLight}>{`Record a medicine the prescriber ordered for ${plan.client.full_name}`}</Text>
      <Input testID="medication-name" label="Medication name" accessibilityLabel="Medication name" placeholder="As written on the prescription" value={draft.name} onChangeText={set("name")} error={errors.name} />
      <Input testID="medication-strength" label="Strength (optional)" accessibilityLabel="Strength (optional)" placeholder="For example: 500 mg" value={draft.strength} onChangeText={set("strength")} error={errors.strength} />
      <Input testID="medication-dose-amount" label="Dose (optional)" accessibilityLabel="Dose (optional)" placeholder="For example: 1" value={draft.doseAmount} onChangeText={set("doseAmount")} error={errors.doseAmount} />
      <Input testID="medication-dose-unit" label="Dose unit (optional)" accessibilityLabel="Dose unit (optional)" placeholder="For example: tablet" value={draft.doseUnit} onChangeText={set("doseUnit")} error={errors.doseUnit} />
      <Input testID="medication-route" label="Route (optional)" accessibilityLabel="Route (optional)" placeholder="For example: oral" value={draft.route} onChangeText={set("route")} error={errors.route} />
      <Input testID="medication-reason" label="Reason (optional)" accessibilityLabel="Reason (optional)" value={draft.reason} onChangeText={set("reason")} error={errors.reason} />
      <Input testID="medication-prescribed-by" label="Prescribed by (optional)" accessibilityLabel="Prescribed by (optional)" value={draft.prescribedBy} onChangeText={set("prescribedBy")} error={errors.prescribedBy} />
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="small">How often</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          {MEDICATION_FREQUENCIES.map((f) => (
            <Chip key={f.value} testID={`medication-frequency-${f.value}`} label={f.label} selected={draft.frequency === f.value} onPress={() => setDraft((d) => ({ ...d, frequency: f.value }))} />
          ))}
        </View>
      </View>
      <Input
        testID="medication-times"
        label="Times (optional, 24-hour HH:MM, separated by commas)"
        accessibilityLabel="Times (optional, 24-hour HH:MM, separated by commas)"
        placeholder="08:00, 20:00"
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
        value={draft.times}
        onChangeText={set("times")}
        error={errors.times}
      />
      <Input testID="medication-start" label="Start date (optional, YYYY-MM-DD)" accessibilityLabel="Start date (optional, YYYY-MM-DD)" placeholder="Today if left blank" autoCapitalize="none" value={draft.startDate} onChangeText={set("startDate")} error={errors.startDate} />
      <Input testID="medication-end" label="End date (optional, YYYY-MM-DD)" accessibilityLabel="End date (optional, YYYY-MM-DD)" placeholder="Ongoing if left blank" autoCapitalize="none" value={draft.endDate} onChangeText={set("endDate")} error={errors.endDate} />
      <Input
        testID="medication-note"
        label="Notes (optional)"
        accessibilityLabel="Notes (optional)"
        multiline
        inputStyle={{ minHeight: 80, textAlignVertical: "top" }}
        value={draft.note}
        onChangeText={set("note")}
        error={errors.note}
      />
      {error ? <FieldHint text={error} testID="medication-error" /> : null}
      <Button testID="medication-save" title="Add Medication" onPress={save} loading={add.isPending} />
    </ModalFrame>
  );
};

export default MedicationModal;
