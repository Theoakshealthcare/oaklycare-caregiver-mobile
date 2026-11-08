import type React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { theme } from "@/src/constants/theme";

import Text from "./text";

interface ChipSelectProps {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  /** Choices that are shown but cannot be picked (a start time that has already passed today). */
  disabledValues?: readonly string[];
  error?: string;
}

/** A labelled row of pill choices that scrolls sideways (date and time pickers without a native module). */
const ChipSelect: React.FC<ChipSelectProps> = ({ label, options, value, onChange, disabledValues, error }) => (
  <View style={styles.wrap}>
    <Text variant="small">{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityLabel={label}>
      {options.map((option) => {
        const selected = option.value === value;
        const disabled = disabledValues?.includes(option.value) ?? false;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[styles.chip, selected && styles.selected, disabled && styles.disabled]}
          >
            <Text variant="small" weight="bold" color={disabled ? theme.colors.textLight : selected ? theme.colors.white : theme.colors.text}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
    {error ? (
      <Text variant="small" color={theme.colors.secondary}>
        {error}
      </Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: { gap: theme.spacing.xs },
  row: { gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },
  chip: {
    borderRadius: theme.borderRadius.round,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  selected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  disabled: { opacity: 0.4 },
});

export default ChipSelect;
