import type React from "react";
import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, View } from "react-native";

import { theme } from "@/src/constants/theme";

import FieldLabel from "./field-label";
import Icon from "./icon";
import Text from "./text";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  required?: boolean;
  placeholder?: string;
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/**
 * A dropdown as Figma draws it: the label with its red star, a teal-bordered field showing the choice (or a grey
 * placeholder) and a chevron. Tapping opens a bottom sheet with the choices; picking one closes it.
 */
const Select: React.FC<SelectProps> = ({ label, required, placeholder = "Select", options, value, onChange, error }) => {
  const [open, setOpen] = useState(false);
  const chosen = options.find((o) => o.value === value);
  return (
    <View>
      <FieldLabel required={required}>{label}</FieldLabel>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: chosen?.label ?? placeholder }}
        onPress={() => setOpen(true)}
        style={[styles.field, { borderColor: error ? theme.colors.secondary : theme.colors.primary }]}
      >
        <Text color={chosen ? theme.colors.text : theme.colors.textLight} style={styles.fieldText} numberOfLines={1}>
          {chosen?.label ?? placeholder}
        </Text>
        <Icon name="chevron-down" size={20} />
      </Pressable>
      {error ? (
        <Text variant="small" color={theme.colors.secondary} style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text weight="bold" style={styles.fieldText}>
              {label}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={() => setOpen(false)}>
              <Icon name="close" size={22} />
            </Pressable>
          </View>
          <FlatList
            data={options}
            // The lists are short (37 states, 47 lengths): render them all at once, so nothing is missing the first time the sheet opens.
            initialNumToRender={options.length}
            keyExtractor={(option) => option.value}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: item.value === value }}
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
                style={styles.option}
              >
                <Text weight={item.value === value ? "bold" : "regular"} color={item.value === value ? theme.colors.primary : theme.colors.text} style={styles.fieldText}>
                  {item.label}
                </Text>
                {item.value === value ? <Icon name="checkmark" size={20} color={theme.colors.primary} /> : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  fieldText: { flex: 1 },
  error: { marginTop: theme.spacing.xs },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { maxHeight: "65%", backgroundColor: theme.colors.white, borderTopLeftRadius: theme.borderRadius.xxl, borderTopRightRadius: theme.borderRadius.xxl, paddingBottom: theme.spacing.lg },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.spacing.md, minHeight: 52, borderBottomWidth: 1, borderBottomColor: theme.colors.background },
});

export default Select;
