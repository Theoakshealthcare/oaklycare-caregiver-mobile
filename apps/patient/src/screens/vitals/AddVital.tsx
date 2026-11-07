import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { useState } from "react";

import Button from "@/src/components/ui/button";
import Input from "@/src/components/ui/input";
import SampleNotice from "@/src/components/ui/sample-notice";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { messageForError } from "@/src/api/errors";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import { theme } from "@/src/constants/theme";
import { ENTRY_FIELDS, validateEntry, vitalMeta } from "@/src/domain/vitals";
import { useAddVital } from "@/src/hooks/useVitals";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "AddVital">;

/** Manual entry for any of the six vitals; the fields and their units come from the vital itself. */
const AddVital: React.FC<Props> = ({ navigation, route }) => {
  const { kind } = route.params;
  const meta = vitalMeta(kind);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<string | null>(null);
  const add = useAddVital();

  const save = () => {
    const found = validateEntry(kind, values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const parse = (key: string) => Number((values[key] ?? "").trim().replace(",", "."));
    add.mutate(
      { kind, value: parse("value"), secondary: ENTRY_FIELDS[kind].some((f) => f.key === "secondary") ? parse("secondary") : undefined },
      { onSuccess: () => navigation.goBack(), onError: (e) => setDialog(messageForError(e)) },
    );
  };

  return (
    <Screen title={`Add ${meta.label.toLowerCase()}`} scroll>
      <SampleNotice what="Saving" />
      <Text color={theme.colors.textLight}>Enter the reading you just took.</Text>
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
          keyboardType="decimal-pad"
          error={errors[field.key] || undefined}
        />
      ))}
      <Button title="Save reading" onPress={save} loading={add.isPending} style={{ marginTop: theme.spacing.sm }} />
      <ErrorDialog visible={dialog !== null} title="Could not save" message={dialog ?? ""} onClose={() => setDialog(null)} />
    </Screen>
  );
};

export default AddVital;
