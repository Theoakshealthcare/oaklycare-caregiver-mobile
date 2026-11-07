import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { useState } from "react";

import { messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import ChipSelect from "@/src/components/ui/chip-select";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Input from "@/src/components/ui/input";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { ENTRY_FIELDS, GLUCOSE_CONTEXTS, entryToInput, validateEntry, vitalMeta, type GlucoseContext } from "@/src/domain/vitals";
import { useAddVital } from "@/src/hooks/useVitals";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "AddVital">;

/** Manual entry for any of the six vitals; the fields and their units come from the vital itself. */
const AddVital: React.FC<Props> = ({ navigation, route }) => {
  const { kind } = route.params;
  const meta = vitalMeta(kind);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [glucoseContext, setGlucoseContext] = useState<GlucoseContext>("RBS");
  const [dialog, setDialog] = useState<string | null>(null);
  const add = useAddVital();

  const save = () => {
    const found = validateEntry(kind, values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    add.mutate(entryToInput(kind, values, glucoseContext), {
      onSuccess: () => navigation.goBack(),
      onError: (e) => setDialog(messageForError(e)),
    });
  };

  return (
    <Screen title={`Add ${meta.label.toLowerCase()}`} scroll>
      <Text color={theme.colors.textLight}>Enter the reading you just took.</Text>
      {kind === "blood_glucose" ? (
        <ChipSelect label="When was it taken?" options={GLUCOSE_CONTEXTS} value={glucoseContext} onChange={(v) => setGlucoseContext(v as GlucoseContext)} />
      ) : null}
      {ENTRY_FIELDS[kind].map((field) => (
        <Input
          key={field.key}
          label={field.label}
          placeholder={field.placeholder}
          value={values[field.key] ?? ""}
          onChangeText={(v) => {
            setValues((prev) => ({ ...prev, [field.key]: v }));
            setErrors((prev) => ({ ...prev, [field.key]: "" }));
          }}
          keyboardType={field.type === "time" ? "numbers-and-punctuation" : "decimal-pad"}
          error={errors[field.key] || undefined}
        />
      ))}
      <Button title="Save reading" onPress={save} loading={add.isPending} style={{ marginTop: theme.spacing.sm }} />
      <ErrorDialog visible={dialog !== null} title="Could not save" message={dialog ?? ""} onClose={() => setDialog(null)} />
    </Screen>
  );
};

export default AddVital;
