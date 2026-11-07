import React, { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import Input from "@/src/components/ui/input";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useCreateVital, useMe } from "@/src/hooks/queries";
import {
  GLUCOSE_CONTEXTS,
  GLUCOSE_CONTEXT_LABEL,
  VITALS_UNAVAILABLE_HINT,
  buildVitalInput,
  isVitalsAccessDenied,
  kindInfo,
  type GlucoseContext,
  type VitalKind,
} from "@/src/vitals/vitalsModel";

const Chip: React.FC<{ label: string; selected: boolean; onPress: () => void; testID?: string }> = ({ label, selected, onPress, testID }) => (
  <Pressable
    testID={testID}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    onPress={onPress}
    style={{
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.round,
      backgroundColor: selected ? theme.colors.primary : theme.colors.soft,
    }}
  >
    <Text variant="small" weight="medium" color={selected ? theme.colors.white : theme.colors.text}>
      {label}
    </Text>
  </Pressable>
);

/** The "Update ..." popup of the design: one vital, one reading, saved to the patient's record. */
const VitalEntryModal: React.FC<{
  kind: VitalKind;
  patientId: string;
  onClose: () => void;
  onSaved: (kind: VitalKind) => void;
}> = ({ kind, patientId, onClose, onSaved }) => {
  const info = kindInfo(kind);
  const me = useMe();
  const create = useCreateVital();

  const [value, setValue] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [unit, setUnit] = useState(info.units[0]);
  const [context, setContext] = useState<GlucoseContext | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // An old error ("must be between 50 and 260") must not stay on screen once the caregiver is correcting the reading.
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setError(null);
  };

  const save = () => {
    const userId = me.data?.id;
    if (!userId) {
      setError("We couldn't confirm your account. Please try again in a moment.");
      return;
    }
    const built = buildVitalInput(kind, { value, diastolic, unit, glucoseContext: context });
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setError(null);
    create.mutate(
      { patientId, recordedByUserId: userId, ...built.input },
      {
        onSuccess: () => onSaved(kind),
        onError: (e) => setError(isVitalsAccessDenied(e) ? VITALS_UNAVAILABLE_HINT : messageForError(e)),
      },
    );
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: theme.spacing.md }}>
        <View style={{ backgroundColor: theme.colors.white, borderRadius: theme.borderRadius.xxl, padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <Pressable accessibilityRole="button" onPress={onClose} style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }} testID="entry-close">
            <Feather name="x-circle" size={18} color={theme.colors.textLight} />
            <Text variant="small" color={theme.colors.textLight}>
              Close
            </Text>
          </Pressable>

          <View style={{ alignItems: "center", gap: theme.spacing.xs }}>
            <Feather name={info.icon} size={28} color={theme.colors.primary} />
            <Text variant="h3" weight="bold" color={theme.colors.primary}>
              {info.label}
            </Text>
          </View>

          {kind === "blood_pressure" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
              <Input
                containerStyle={{ flex: 1 }}
                label="Top (mmHg)"
                placeholder="120"
                keyboardType="number-pad"
                value={value}
                onChangeText={edit(setValue)}
                testID="entry-systolic"
              />
              <Text variant="h3">/</Text>
              <Input
                containerStyle={{ flex: 1 }}
                label="Bottom (mmHg)"
                placeholder="80"
                keyboardType="number-pad"
                value={diastolic}
                onChangeText={edit(setDiastolic)}
                testID="entry-diastolic"
              />
            </View>
          ) : (
            <Input
              label={`Enter ${info.label.toLowerCase()} (${unit})`}
              placeholder="0"
              keyboardType="decimal-pad"
              value={value}
              onChangeText={edit(setValue)}
              testID="entry-value"
            />
          )}

          {info.units.length > 1 ? (
            <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
              {info.units.map((u) => (
                <Chip key={u} label={u} selected={unit === u} onPress={() => edit(setUnit)(u)} testID={`unit-${u}`} />
              ))}
            </View>
          ) : null}

          {kind === "blood_glucose" ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="small" color={theme.colors.textLight}>
                When was it taken? (optional)
              </Text>
              <View style={{ flexDirection: "row", gap: theme.spacing.sm, flexWrap: "wrap" }}>
                {GLUCOSE_CONTEXTS.map((c) => (
                  <Chip
                    key={c}
                    label={`${c} · ${GLUCOSE_CONTEXT_LABEL[c]}`}
                    selected={context === c}
                    onPress={() => edit(setContext)(context === c ? undefined : c)}
                    testID={`context-${c}`}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {error ? (
            <Text variant="small" color={theme.colors.errorText} testID="entry-error">
              {error}
            </Text>
          ) : null}

          <Button title={`Save ${info.label.toLowerCase()}`} onPress={save} loading={create.isPending} />
        </View>
      </View>
    </Modal>
  );
};

export default VitalEntryModal;
