import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import { CardSheet } from "@/src/components/ui/card-modal";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import FieldLabel from "@/src/components/ui/field-label";
import Input from "@/src/components/ui/input";
import Select from "@/src/components/ui/select";
import Text from "@/src/components/ui/text";
import UnitChecks from "@/src/components/vitals/UnitChecks";
import { theme } from "@/src/constants/theme";
import { ENTRY_FIELDS, TIME_OPTIONS, UNITS, durationLabel, entryToInputs, sleepHours, validateEntry, vitalMeta, type FieldSpec } from "@/src/domain/vitals";
import { useAddVital } from "@/src/hooks/useVitals";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "AddVital">;

/**
 * Manual entry for any of the six vitals, as the Figma sheet: a card over the dimmed Vitals page with the vital's round icon, its
 * title, one line of help and a button named for it ("Update Heart Rate"). Blood pressure is one row ("120 / 80"), glucose has a
 * unit choice and three boxes (random, fasting, after a meal: each box filled is one reading), sleep takes a bed and a wake time
 * from lists and shows the hours between them, temperature has a unit choice.
 */
const AddVital: React.FC<Props> = ({ navigation, route }) => {
  const { kind } = route.params;
  const meta = vitalMeta(kind);
  const units = UNITS[kind];
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [unit, setUnit] = useState<string>(meta.unit);
  const [dialog, setDialog] = useState<string | null>(null);
  const add = useAddVital();

  const set = (key: string) => (text: string) => {
    setValues((prev) => ({ ...prev, [key]: text }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const save = () => {
    const found = validateEntry(kind, values, unit);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    add.mutate(entryToInputs(kind, values, unit), {
      onSuccess: () => navigation.goBack(),
      onError: (e) => setDialog(messageForError(e)),
    });
  };

  const fields = ENTRY_FIELDS[kind];
  const numberField = (field: FieldSpec) => (
    <Input
      key={field.key}
      label={field.label.replace("{unit}", unit)}
      placeholder={field.placeholder}
      value={values[field.key] ?? ""}
      onChangeText={set(field.key)}
      keyboardType="decimal-pad"
      error={errors[field.key] || undefined}
    />
  );

  let body: React.ReactNode;
  if (kind === "blood_pressure") {
    const [top, bottom] = fields;
    body = (
      <View>
        <FieldLabel>{top.label}</FieldLabel>
        <View style={styles.bpRow}>
          <View style={styles.bpBox}>
            <Input accessibilityLabel="Systolic, top number (mmHg)" placeholder={top.placeholder} value={values.value ?? ""} onChangeText={set("value")} keyboardType="number-pad" error={errors.value || undefined} />
          </View>
          <Text variant="h3">/</Text>
          <View style={styles.bpBox}>
            <Input accessibilityLabel={bottom.label} placeholder={bottom.placeholder} value={values.secondary ?? ""} onChangeText={set("secondary")} keyboardType="number-pad" error={errors.secondary || undefined} />
          </View>
        </View>
      </View>
    );
  } else if (kind === "sleep_duration") {
    const hours = values.start && values.wake ? sleepHours(values.start, values.wake) : null;
    body = (
      <>
        <Input
          label="Total Sleep Duration (HRS/MINS)"
          placeholder="Set the two times below"
          value={hours === null ? "" : durationLabel(hours)}
          editable={false}
        />
        {fields.map((field) => (
          <Select key={field.key} label={field.label} placeholder={field.placeholder} options={TIME_OPTIONS} value={values[field.key] ?? ""} onChange={set(field.key)} error={errors[field.key] || undefined} />
        ))}
      </>
    );
  } else {
    body = (
      <>
        {units ? <UnitChecks units={units} value={unit} onChange={setUnit} /> : null}
        {fields.map(numberField)}
      </>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <CardSheet onClose={() => navigation.goBack()} icon={meta.icon} iconColor={meta.tint} title={meta.title} subtitle={meta.sheetSubtitle}>
          <View style={styles.fields}>
            {body}
            <Button title={meta.button} onPress={save} loading={add.isPending} style={styles.button} />
          </View>
        </CardSheet>
      </ScrollView>
      <ErrorDialog visible={dialog !== null} title="Could not save" message={dialog ?? ""} onClose={() => setDialog(null)} />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: theme.spacing.lg, paddingTop: theme.spacing.xxl + 40 },
  fields: { gap: theme.spacing.md, marginTop: theme.spacing.sm },
  button: { marginTop: theme.spacing.xs },
  bpRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  bpBox: { width: 84 },
});

export default AddVital;
