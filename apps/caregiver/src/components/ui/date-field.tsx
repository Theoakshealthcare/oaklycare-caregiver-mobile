import React, { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";

import { theme } from "@/src/constants/theme";
import { formatDate, toDateOnly } from "@/src/utils/dates";

import Text from "./text";
import FieldLabel from "./field-label";

interface Props {
  label: string;
  /** "YYYY-MM-DD", or "" for no date yet. */
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  error?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Where the wheel starts while no date is chosen (a date of birth starts decades back, not today). */
  initialDate?: Date;
  testID?: string;
  /** Overrides the default 16 pt bottom margin. */
  containerStyle?: StyleProp<ViewStyle>;
}

function dateFromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : new Date();
}

/**
 * A date the person picks from the system calendar instead of typing. Shows the shared "7 Nov 2026"
 * format, hands back "YYYY-MM-DD" for the API. iOS: the spinner sits in a bottom sheet with Done
 * (so it never floats mid-form); Android: the system dialog.
 */
const DateField: React.FC<Props> = ({ label, value, onChange, placeholder = "Select a date", error, minimumDate, maximumDate, initialDate, testID, containerStyle }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => dateFromIso(value));

  const show = () => {
    setDraft(value ? dateFromIso(value) : (initialDate ?? maximumDate ?? new Date()));
    setOpen(true);
  };

  const picker = (
    <DateTimePicker
      testID={testID ? `${testID}-picker` : undefined}
      value={draft}
      mode="date"
      display={Platform.OS === "ios" ? "spinner" : "default"}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      onValueChange={(_event, date) => {
        if (Platform.OS === "ios") {
          setDraft(date);
        } else {
          setOpen(false);
          onChange(toDateOnly(date));
        }
      }}
      onDismiss={() => setOpen(false)}
    />
  );

  return (
    <View style={[{ marginBottom: 16 }, containerStyle]}>
      <FieldLabel>{label}</FieldLabel>
      <TouchableOpacity
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDate(value) : placeholder}`}
        onPress={show}
        activeOpacity={0.7}
        style={[styles.field, { borderColor: error ? theme.colors.secondary : theme.colors.primary }]}
      >
        <Text variant="body" color={value ? theme.colors.text : theme.colors.textLight}>
          {value ? formatDate(value) : placeholder}
        </Text>
        <Feather name="calendar" size={18} color={theme.colors.textLight} />
      </TouchableOpacity>
      {error ? (
        <Text variant="small" color={theme.colors.secondary} style={{ marginTop: 4 }}>
          {error}
        </Text>
      ) : null}

      {open && Platform.OS !== "ios" ? picker : null}
      {Platform.OS === "ios" ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text variant="body" color={theme.colors.textLight} onPress={() => setOpen(false)}>
                Cancel
              </Text>
              <Text
                testID={testID ? `${testID}-done` : undefined}
                variant="body"
                weight="bold"
                color={theme.colors.primary}
                onPress={() => {
                  onChange(toDateOnly(draft));
                  setOpen(false);
                }}
              >
                Done
              </Text>
            </View>
            {picker}
          </View>
        </Modal>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    minHeight: 48,
    paddingVertical: 12,
    backgroundColor: theme.colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { backgroundColor: theme.colors.white, paddingBottom: 24, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", padding: 16 },
});

export default DateField;
